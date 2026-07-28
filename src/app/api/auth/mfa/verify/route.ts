import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  clearMfaChallengeCookie,
  createSession,
  MFA_CHALLENGE_COOKIE,
  setSessionCookie,
} from "@/lib/auth";
import { ensureAuthTables, getDb } from "@/lib/db";
import {
  createRecoveryCodes,
  decryptMfaSecret,
  hashAuthToken,
  normalizeRecoveryCode,
  verifyTotp,
} from "@/lib/mfa";
import { getClientIp, ratelimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const schema = z.object({ code: z.string().trim().min(6).max(32) });

export async function POST(request: Request) {
  const limit = await ratelimit("auth-mfa", getClientIp(request));
  if (!limit.available) {
    return NextResponse.json(
      { error: "Verification is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
  if (limit.blocked) {
    return NextResponse.json({ error: "Too many attempts. Please wait and try again." }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid code." }, { status: 400 });
  const token = (await cookies()).get(MFA_CHALLENGE_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "Challenge expired" }, { status: 401 });

  await ensureAuthTables();
  const sql = getDb();
  const rows = await sql`
    SELECT c.id, c.user_id, c.purpose, m.encrypted_secret, m.enabled_at, m.last_used_step
    FROM auth_login_challenges c
    JOIN users u ON u.id = c.user_id
    JOIN auth_mfa_methods m ON m.user_id = c.user_id
    WHERE c.token_hash = ${hashAuthToken(token)}
      AND c.expires_at > NOW()
      AND c.consumed_at IS NULL
      AND u.status = 'active'
    LIMIT 1
  `;
  const challenge = rows[0] as Record<string, unknown> | undefined;
  if (!challenge) return NextResponse.json({ error: "Challenge expired" }, { status: 401 });

  let step: number | null = null;
  let recoveryCodeId: string | null = null;
  if (/^\d{6}$/.test(parsed.data.code.replace(/\s/g, ""))) {
    step = verifyTotp(decryptMfaSecret(String(challenge.encrypted_secret)), parsed.data.code, {
      lastUsedStep: challenge.last_used_step == null ? null : Number(challenge.last_used_step),
    });
  } else if (challenge.purpose === "verify_mfa") {
    const recoveryHash = hashAuthToken(normalizeRecoveryCode(parsed.data.code));
    const recovery = await sql`
      SELECT id
      FROM auth_mfa_recovery_codes
      WHERE user_id = ${String(challenge.user_id)}
        AND code_hash = ${recoveryHash}
        AND used_at IS NULL
      LIMIT 1
    `;
    recoveryCodeId = recovery[0] ? String(recovery[0].id) : null;
  }
  if (step == null && !recoveryCodeId) {
    return NextResponse.json({ error: "That code is not valid." }, { status: 401 });
  }
  const claimed = await sql`
    UPDATE auth_login_challenges
    SET consumed_at = NOW()
    WHERE id = ${String(challenge.id)}
      AND consumed_at IS NULL
      AND expires_at > NOW()
    RETURNING id
  `;
  if (claimed.length === 0) {
    return NextResponse.json({ error: "Challenge already used or expired" }, { status: 409 });
  }

  const recoveryCodes =
    challenge.purpose === "enroll_mfa" ? createRecoveryCodes() : undefined;
  const queries = [
    sql`
      UPDATE auth_mfa_methods
      SET enabled_at = COALESCE(enabled_at, NOW()),
          last_used_step = ${step},
          updated_at = NOW()
      WHERE user_id = ${String(challenge.user_id)}
    `,
  ];
  if (recoveryCodeId) {
    queries.push(sql`UPDATE auth_mfa_recovery_codes SET used_at = NOW() WHERE id = ${recoveryCodeId} AND used_at IS NULL`);
  }
  if (recoveryCodes) {
    queries.push(sql`DELETE FROM auth_mfa_recovery_codes WHERE user_id = ${String(challenge.user_id)}`);
    for (const code of recoveryCodes) {
      queries.push(sql`
        INSERT INTO auth_mfa_recovery_codes (id, user_id, code_hash)
        VALUES (
          ${crypto.randomUUID()},
          ${String(challenge.user_id)},
          ${hashAuthToken(normalizeRecoveryCode(code))}
        )
      `);
    }
  }
  await sql.transaction(queries);

  const session = await createSession(String(challenge.user_id));
  await sql`UPDATE users SET last_active_at = NOW() WHERE id = ${String(challenge.user_id)}`;
  const response = NextResponse.json({
    ok: true,
    recoveryCodes,
  });
  setSessionCookie(response, session.token, session.expiresAt);
  clearMfaChallengeCookie(response);
  return response;
}
