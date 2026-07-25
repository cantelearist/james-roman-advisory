import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createSession, setSessionCookie } from "@/lib/auth";
import { ensureAuthTables, getDb } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export const runtime = "nodejs";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(320),
  password: z.string().min(12).max(256),
  inviteToken: z.string().trim().max(256).optional(),
});

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Name, email, and a 12-character password are required" }, { status: 400 });
  }

  await ensureAuthTables();
  const sql = getDb();
  let role: "client" | "advisor" | "admin" = "client";
  let invitationId: string | null = null;

  if (parsed.data.inviteToken) {
    const invitations = await sql`
      SELECT id, email, role
      FROM auth_invitations
      WHERE token_hash = ${hashToken(parsed.data.inviteToken)}
        AND accepted_at IS NULL
        AND expires_at > NOW()
      LIMIT 1
    `;
    const invitation = invitations[0] as Record<string, unknown> | undefined;
    if (!invitation || String(invitation.email).toLowerCase() !== parsed.data.email.toLowerCase()) {
      return NextResponse.json({ error: "Invitation is invalid or expired" }, { status: 400 });
    }
    role = invitation.role as typeof role;
    invitationId = String(invitation.id);
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const existing = await sql`SELECT id, password_hash, role FROM users WHERE LOWER(email) = LOWER(${parsed.data.email}) LIMIT 1`;
  let userId: string;
  if (existing.length > 0) {
    const existingUser = existing[0] as Record<string, unknown>;
    if (existingUser.password_hash) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }
    userId = String(existingUser.id);
    const effectiveRole = parsed.data.inviteToken ? role : (existingUser.role as typeof role);
    await sql`
      UPDATE users
      SET name = ${parsed.data.name}, email = ${parsed.data.email.toLowerCase()}, role = ${effectiveRole}, password_hash = ${passwordHash}
      WHERE id = ${userId}
    `;
    role = effectiveRole;
  } else {
    userId = `usr_${randomBytes(12).toString("hex")}`;
    await sql`
      INSERT INTO users (id, name, email, role, password_hash)
      VALUES (${userId}, ${parsed.data.name}, ${parsed.data.email.toLowerCase()}, ${role}, ${passwordHash})
    `;
  }
  if (invitationId) {
    await sql`UPDATE auth_invitations SET accepted_at = NOW() WHERE id = ${invitationId}`;
  }

  const { token, expiresAt } = await createSession(userId);
  const response = NextResponse.json({ user: { id: userId, name: parsed.data.name, email: parsed.data.email.toLowerCase(), role } }, { status: 201 });
  setSessionCookie(response, token, expiresAt);
  return response;
}
