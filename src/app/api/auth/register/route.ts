import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createSession, setSessionCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { AccessScope, UserRole } from "@/lib/data-model";
import { hashPassword } from "@/lib/password";
import { getClientIp, ratelimit } from "@/lib/ratelimit";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";

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
  const limit = await ratelimit("auth-register", getClientIp(request));
  if (!limit.available) {
    return NextResponse.json(
      { error: "Registration is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
  if (limit.blocked) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please wait and try again." },
      { status: 429 },
    );
  }

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

  await assertRequiredSchemaVersions();
  const sql = getDb();
  let role: UserRole = "client";
  let invitationId: string | null = null;
  let permissionProfileId: string | null = null;
  let accessScope: AccessScope = "assigned";
  let matterId: string | null = null;

  if (parsed.data.inviteToken) {
    const invitations = await sql`
      SELECT id, email, role, permission_profile_id, access_scope, matter_id
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
    role = invitation.role as UserRole;
    invitationId = String(invitation.id);
    permissionProfileId = invitation.permission_profile_id
      ? String(invitation.permission_profile_id)
      : null;
    accessScope = invitation.access_scope === "global" ? "global" : "assigned";
    matterId = invitation.matter_id ? String(invitation.matter_id) : null;
  }

  const existing = await sql`SELECT id, password_hash, role FROM users WHERE LOWER(email) = LOWER(${parsed.data.email}) LIMIT 1`;
  if (!parsed.data.inviteToken && existing.length === 0) {
    return NextResponse.json(
      { error: "A valid Private Office invitation is required" },
      { status: 403 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  let userId: string;
  if (existing.length > 0) {
    const existingUser = existing[0] as Record<string, unknown>;
    if (existingUser.password_hash) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }
    userId = String(existingUser.id);
    const effectiveRole = parsed.data.inviteToken ? role : (existingUser.role as UserRole);
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
  if ((role === "admin" || role === "contractor") && permissionProfileId) {
    await sql`
      INSERT INTO user_permission_assignments (
        user_id,
        permission_profile_id,
        access_scope,
        assigned_by
      )
      VALUES (
        ${userId},
        ${permissionProfileId},
        ${accessScope},
        'invitation'
      )
      ON CONFLICT (user_id) DO UPDATE
      SET permission_profile_id = EXCLUDED.permission_profile_id,
          access_scope = EXCLUDED.access_scope,
          assigned_by = EXCLUDED.assigned_by,
          assigned_at = NOW()
    `;
  }
  if (matterId) {
    await sql`
      INSERT INTO engagement_memberships (
        matter_id,
        user_id,
        member_role,
        assigned_by
      )
      VALUES (${matterId}, ${userId}, ${role}, 'invitation')
      ON CONFLICT (matter_id, user_id) DO UPDATE
      SET member_role = EXCLUDED.member_role,
          status = 'active',
          expires_at = NULL,
          assigned_by = EXCLUDED.assigned_by,
          updated_at = NOW()
    `;
    if (role === "client") {
      await sql`
        UPDATE clients
        SET user_id = ${userId}, updated_at = NOW()
        WHERE id = (SELECT client_id FROM matters WHERE id = ${matterId})
          AND (user_id IS NULL OR user_id = ${userId})
      `;
    }
  }

  const { token, expiresAt } = await createSession(userId);
  const response = NextResponse.json({ user: { id: userId, name: parsed.data.name, email: parsed.data.email.toLowerCase(), role } }, { status: 201 });
  setSessionCookie(response, token, expiresAt);
  return response;
}
