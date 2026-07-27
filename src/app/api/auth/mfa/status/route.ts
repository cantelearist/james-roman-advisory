import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { MFA_CHALLENGE_COOKIE } from "@/lib/auth";
import { ensureAuthTables, getDb } from "@/lib/db";
import {
  createOtpAuthUri,
  encryptMfaSecret,
  generateTotpSecret,
  hashAuthToken,
} from "@/lib/mfa";

export const runtime = "nodejs";

export async function GET() {
  const token = (await cookies()).get(MFA_CHALLENGE_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "Challenge expired" }, { status: 401 });
  await ensureAuthTables();
  const sql = getDb();
  const rows = await sql`
    SELECT c.user_id, c.purpose, u.email
    FROM auth_login_challenges c
    JOIN users u ON u.id = c.user_id
    WHERE c.token_hash = ${hashAuthToken(token)}
      AND c.expires_at > NOW()
      AND c.consumed_at IS NULL
      AND u.status = 'active'
    LIMIT 1
  `;
  const challenge = rows[0] as Record<string, unknown> | undefined;
  if (!challenge) return NextResponse.json({ error: "Challenge expired" }, { status: 401 });

  if (challenge.purpose === "enroll_mfa") {
    const existing = await sql`
      SELECT encrypted_secret
      FROM auth_mfa_methods
      WHERE user_id = ${String(challenge.user_id)}
      LIMIT 1
    `;
    let secret: string;
    if (existing.length === 0) {
      secret = generateTotpSecret();
      await sql`
        INSERT INTO auth_mfa_methods (user_id, encrypted_secret)
        VALUES (${String(challenge.user_id)}, ${encryptMfaSecret(secret)})
      `;
    } else {
      const { decryptMfaSecret } = await import("@/lib/mfa");
      secret = decryptMfaSecret(String(existing[0].encrypted_secret));
    }
    return NextResponse.json({
      mode: "enroll",
      secret,
      uri: createOtpAuthUri(secret, String(challenge.email)),
    });
  }
  return NextResponse.json({ mode: "verify" });
}
