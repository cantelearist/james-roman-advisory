import { NextResponse } from "next/server";
import { z } from "zod";

import { createSession, setSessionCookie } from "@/lib/auth";
import { ensureAuthTables, getDb } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(256),
});

export async function POST(request: Request) {
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

  const { token, expiresAt } = await createSession(String(row.id));
  const response = NextResponse.json({
    user: { id: row.id, name: row.name, email: row.email, role: row.role },
  });
  setSessionCookie(response, token, expiresAt);
  return response;
}
