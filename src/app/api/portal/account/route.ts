import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { accessAuditQuery } from "@/lib/access-control";
import { getAuthContext, hashSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assertPassword, hashPassword, verifyPassword } from "@/lib/password";
import { ratelimit } from "@/lib/ratelimit";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";

export const runtime = "nodejs";

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
});

const securitySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("change_password"),
    currentPassword: z.string().min(1).max(256),
    newPassword: z.string().min(12).max(256),
  }),
  z.object({ action: z.literal("revoke_other_sessions") }),
]);

function unavailableSecurityResponse() {
  return NextResponse.json(
    { error: "Account security is temporarily unavailable. Please try again." },
    { status: 503 },
  );
}

async function currentSessionHash(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? hashSessionToken(token) : null;
}

export async function GET() {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionHash = await currentSessionHash();
  if (!sessionHash) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await assertRequiredSchemaVersions();
  const sql = getDb();
  const [profileRows, sessionRows] = await Promise.all([
    sql`
      SELECT name, email, role, last_active_at AS "lastActiveAt"
      FROM users
      WHERE id = ${context.userId}
      LIMIT 1
    `,
    sql`
      SELECT
        id,
        created_at AS "createdAt",
        expires_at AS "expiresAt",
        token_hash = ${sessionHash} AS "isCurrent"
      FROM auth_sessions
      WHERE user_id = ${context.userId}
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 20
    `,
  ]);
  const profile = profileRows[0];
  if (!profile) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  return NextResponse.json({
    profile: {
      name: String(profile.name),
      email: String(profile.email),
      role: String(profile.role),
      lastActiveAt: profile.lastActiveAt ?? null,
    },
    sessions: sessionRows,
  });
}

export async function PATCH(request: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a name between 2 and 120 characters." }, { status: 400 });
  }

  await assertRequiredSchemaVersions();
  const sql = getDb();
  const [rows] = await sql.transaction((tx) => [
    tx`
      UPDATE users
      SET name = ${parsed.data.name}
      WHERE id = ${context.userId}
      RETURNING name, email, role
    `,
    accessAuditQuery(tx, {
      actorId: context.userId,
      action: "account.profile_updated",
      targetUserId: context.userId,
      metadata: { fields: ["name"] },
    }),
  ]);
  const profile = rows[0];
  if (!profile) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  return NextResponse.json({ profile });
}

export async function POST(request: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = await ratelimit("account-security", context.userId);
  if (!limit.available) return unavailableSecurityResponse();
  if (limit.blocked) {
    return NextResponse.json({ error: "Too many security requests. Please wait and try again." }, { status: 429 });
  }

  const parsed = securitySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid account security request." }, { status: 400 });

  const sessionHash = await currentSessionHash();
  if (!sessionHash) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await assertRequiredSchemaVersions();
  const sql = getDb();

  if (parsed.data.action === "revoke_other_sessions") {
    await sql.transaction((tx) => [
      tx`
        DELETE FROM auth_sessions
        WHERE user_id = ${context.userId}
          AND token_hash <> ${sessionHash}
      `,
      accessAuditQuery(tx, {
        actorId: context.userId,
        action: "account.sessions_revoked",
        targetUserId: context.userId,
        metadata: { scope: "other_sessions" },
      }),
    ]);
    return NextResponse.json({ revoked: true });
  }

  const rows = await sql`
    SELECT password_hash
    FROM users
    WHERE id = ${context.userId}
    LIMIT 1
  `;
  const account = rows[0] as Record<string, unknown> | undefined;
  if (!account || !(await verifyPassword(parsed.data.currentPassword, String(account.password_hash ?? "")))) {
    return NextResponse.json({ error: "Your current password is not correct." }, { status: 401 });
  }
  try {
    assertPassword(parsed.data.newPassword);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The new password is invalid." },
      { status: 400 },
    );
  }
  if (await verifyPassword(parsed.data.newPassword, String(account.password_hash ?? ""))) {
    return NextResponse.json({ error: "Choose a password you have not used for this account." }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await sql.transaction((tx) => [
    tx`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${context.userId}`,
    tx`
      DELETE FROM auth_sessions
      WHERE user_id = ${context.userId}
        AND token_hash <> ${sessionHash}
    `,
    tx`DELETE FROM auth_login_challenges WHERE user_id = ${context.userId}`,
    accessAuditQuery(tx, {
      actorId: context.userId,
      action: "account.password_changed",
      targetUserId: context.userId,
      metadata: { revokedOtherSessions: true },
    }),
  ]);
  return NextResponse.json({ passwordChanged: true, revokedOtherSessions: true });
}
