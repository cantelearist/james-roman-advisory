import { NextResponse } from "next/server";
import { z } from "zod";

import { accessAuditQuery } from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  createOtpAuthUri,
  createRecoveryCodes,
  decryptMfaSecret,
  encryptMfaSecret,
  generateTotpSecret,
  hashAuthToken,
  normalizeRecoveryCode,
  verifyTotp,
} from "@/lib/mfa";
import { verifyPassword } from "@/lib/password";
import { ratelimit } from "@/lib/ratelimit";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";

export const runtime = "nodejs";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("begin_enrollment"), currentPassword: z.string().min(1).max(256) }),
  z.object({ action: z.literal("confirm_enrollment"), code: z.string().trim().length(6) }),
  z.object({ action: z.literal("regenerate_recovery_codes"), currentPassword: z.string().min(1).max(256) }),
  z.object({
    action: z.literal("disable"),
    currentPassword: z.string().min(1).max(256),
    code: z.string().trim().length(6),
  }),
]);

function unavailableSecurityResponse() {
  return NextResponse.json(
    { error: "Account security is temporarily unavailable. Please try again." },
    { status: 503 },
  );
}

async function verifyCurrentPassword(userId: string, password: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`
    SELECT password_hash
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;
  return Boolean(rows[0] && await verifyPassword(password, String(rows[0].password_hash ?? "")));
}

function recoveryCodeQueries(userId: string, recoveryCodes: string[]) {
  const sql = getDb();
  return recoveryCodes.map((code) => sql`
    INSERT INTO auth_mfa_recovery_codes (id, user_id, code_hash)
    VALUES (${crypto.randomUUID()}, ${userId}, ${hashAuthToken(normalizeRecoveryCode(code))})
  `);
}

export async function GET() {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await assertRequiredSchemaVersions();
  const sql = getDb();
  const [methods, recoveryCodes] = await Promise.all([
    sql`
      SELECT enabled_at AS "enabledAt"
      FROM auth_mfa_methods
      WHERE user_id = ${context.userId}
      LIMIT 1
    `,
    sql`
      SELECT COUNT(*)::int AS count
      FROM auth_mfa_recovery_codes
      WHERE user_id = ${context.userId}
        AND used_at IS NULL
    `,
  ]);
  const enabledAt = methods[0]?.enabledAt ?? null;
  return NextResponse.json({
    enabled: Boolean(enabledAt),
    enabledAt,
    recoveryCodesRemaining: Number(recoveryCodes[0]?.count ?? 0),
  });
}

export async function POST(request: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = await ratelimit("account-security", context.userId);
  if (!limit.available) return unavailableSecurityResponse();
  if (limit.blocked) {
    return NextResponse.json({ error: "Too many security requests. Please wait and try again." }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid MFA request." }, { status: 400 });

  await assertRequiredSchemaVersions();
  const sql = getDb();
  const input = parsed.data;

  if (input.action === "begin_enrollment") {
    if (!await verifyCurrentPassword(context.userId, input.currentPassword)) {
      return NextResponse.json({ error: "Your current password is not correct." }, { status: 401 });
    }
    const existing = await sql`
      SELECT enabled_at
      FROM auth_mfa_methods
      WHERE user_id = ${context.userId}
      LIMIT 1
    `;
    if (existing[0]?.enabled_at) {
      return NextResponse.json({ error: "Two-step verification is already active." }, { status: 409 });
    }
    const secret = generateTotpSecret();
    await sql.transaction((tx) => [
      tx`
        INSERT INTO auth_mfa_methods (user_id, encrypted_secret, enabled_at, last_used_step)
        VALUES (${context.userId}, ${encryptMfaSecret(secret)}, NULL, NULL)
        ON CONFLICT (user_id) DO UPDATE
        SET encrypted_secret = EXCLUDED.encrypted_secret,
            enabled_at = NULL,
            last_used_step = NULL,
            updated_at = NOW()
      `,
      tx`DELETE FROM auth_mfa_recovery_codes WHERE user_id = ${context.userId}`,
      accessAuditQuery(tx, {
        actorId: context.userId,
        action: "account.mfa_enrollment_started",
        targetUserId: context.userId,
      }),
    ]);
    return NextResponse.json({
      secret,
      uri: createOtpAuthUri(secret, context.user.email),
    });
  }

  const methods = await sql`
    SELECT encrypted_secret, enabled_at, last_used_step
    FROM auth_mfa_methods
    WHERE user_id = ${context.userId}
    LIMIT 1
  `;
  const method = methods[0] as Record<string, unknown> | undefined;

  if (input.action === "confirm_enrollment") {
    if (!method || method.enabled_at) {
      return NextResponse.json({ error: "Start two-step verification before confirming it." }, { status: 409 });
    }
    const step = verifyTotp(decryptMfaSecret(String(method.encrypted_secret)), input.code);
    if (step == null) return NextResponse.json({ error: "That authentication code is not valid." }, { status: 401 });
    const recoveryCodes = createRecoveryCodes();
    await sql.transaction((tx) => [
      tx`
        UPDATE auth_mfa_methods
        SET enabled_at = NOW(), last_used_step = ${step}, updated_at = NOW()
        WHERE user_id = ${context.userId}
          AND enabled_at IS NULL
      `,
      tx`DELETE FROM auth_mfa_recovery_codes WHERE user_id = ${context.userId}`,
      ...recoveryCodeQueries(context.userId, recoveryCodes),
      accessAuditQuery(tx, {
        actorId: context.userId,
        action: "account.mfa_enabled",
        targetUserId: context.userId,
      }),
    ]);
    return NextResponse.json({ enabled: true, recoveryCodes });
  }

  if (!method?.enabled_at) {
    return NextResponse.json({ error: "Two-step verification is not active." }, { status: 409 });
  }

  if (input.action === "regenerate_recovery_codes") {
    if (!await verifyCurrentPassword(context.userId, input.currentPassword)) {
      return NextResponse.json({ error: "Your current password is not correct." }, { status: 401 });
    }
    const recoveryCodes = createRecoveryCodes();
    await sql.transaction((tx) => [
      tx`DELETE FROM auth_mfa_recovery_codes WHERE user_id = ${context.userId}`,
      ...recoveryCodeQueries(context.userId, recoveryCodes),
      accessAuditQuery(tx, {
        actorId: context.userId,
        action: "account.mfa_recovery_codes_regenerated",
        targetUserId: context.userId,
      }),
    ]);
    return NextResponse.json({ recoveryCodes });
  }

  if (!await verifyCurrentPassword(context.userId, input.currentPassword)) {
    return NextResponse.json({ error: "Your current password is not correct." }, { status: 401 });
  }
  const step = verifyTotp(decryptMfaSecret(String(method.encrypted_secret)), input.code, {
    lastUsedStep: method.last_used_step == null ? null : Number(method.last_used_step),
  });
  if (step == null) return NextResponse.json({ error: "That authentication code is not valid." }, { status: 401 });
  await sql.transaction((tx) => [
    tx`DELETE FROM auth_mfa_recovery_codes WHERE user_id = ${context.userId}`,
    tx`DELETE FROM auth_mfa_methods WHERE user_id = ${context.userId}`,
    tx`DELETE FROM auth_login_challenges WHERE user_id = ${context.userId}`,
    accessAuditQuery(tx, {
      actorId: context.userId,
      action: "account.mfa_disabled",
      targetUserId: context.userId,
    }),
  ]);
  return NextResponse.json({ enabled: false });
}
