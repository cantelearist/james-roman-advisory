import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createSession,
  setMfaChallengeCookie,
  setSessionCookie,
} from "@/lib/auth";
import { ensureAuthTables, getDb } from "@/lib/db";
import { hashAuthToken } from "@/lib/mfa";
import { verifyPassword } from "@/lib/password";
import { getClientIp, ratelimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(256),
});

export async function POST(request: Request) {
  const limit = await ratelimit("auth-login", getClientIp(request));
  if (!limit.available) {
    return NextResponse.json(
      { error: "Sign-in is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
  if (limit.blocked) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Please wait and try again." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  await ensureAuthTables();
  const sql = getDb();
  const rows = await sql`
    SELECT id, name, email, role, password_hash, status
    FROM users
    WHERE LOWER(email) = LOWER(${parsed.data.email})
    LIMIT 1
  `;
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row || !(await verifyPassword(parsed.data.password, String(row.password_hash ?? "")))) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  if (row.status !== "active") {
    return NextResponse.json({ error: "This account is suspended" }, { status: 403 });
  }

  if (["super_admin", "admin", "contractor"].includes(String(row.role))) {
    const methods = await sql`
      SELECT enabled_at
      FROM auth_mfa_methods
      WHERE user_id = ${String(row.id)}
      LIMIT 1
    `;
    const token = crypto.randomUUID() + crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const purpose = methods[0]?.enabled_at ? "verify_mfa" : "enroll_mfa";
    await sql`
      DELETE FROM auth_login_challenges
      WHERE user_id = ${String(row.id)}
         OR expires_at <= NOW()
         OR consumed_at IS NOT NULL
    `;
    await sql`
      INSERT INTO auth_login_challenges (
        id, user_id, token_hash, purpose, expires_at
      )
      VALUES (
        ${crypto.randomUUID()},
        ${String(row.id)},
        ${hashAuthToken(token)},
        ${purpose},
        ${expiresAt.toISOString()}
      )
    `;
    const response = NextResponse.json({
      mfaRequired: true,
      mode: purpose === "enroll_mfa" ? "enroll" : "verify",
    });
    setMfaChallengeCookie(response, token, expiresAt);
    return response;
  }

  const { token, expiresAt } = await createSession(String(row.id));
  await sql`UPDATE users SET last_active_at = NOW() WHERE id = ${String(row.id)}`;
  const response = NextResponse.json({
    user: { id: row.id, name: row.name, email: row.email, role: row.role },
  });
  setSessionCookie(response, token, expiresAt);
  return response;
}
