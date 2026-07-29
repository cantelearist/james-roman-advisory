import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { hashAuthToken } from "@/lib/mfa";
import { assertPassword, hashPassword } from "@/lib/password";
import { getClientIp, ratelimit } from "@/lib/ratelimit";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(32).max(256),
  password: z.string().min(12).max(256),
});

export async function POST(request: Request) {
  const limit = await ratelimit("auth-reset", getClientIp(request));
  if (!limit.available) {
    return NextResponse.json(
      { error: "Password recovery is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
  if (limit.blocked) {
    return NextResponse.json({ error: "Too many attempts. Please wait and try again." }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "The recovery request is invalid." }, { status: 400 });
  }
  try {
    assertPassword(parsed.data.password);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The password is invalid." },
      { status: 400 },
    );
  }

  await assertRequiredSchemaVersions();
  const sql = getDb();
  const rows = await sql`
    UPDATE password_reset_tokens
    SET used_at = NOW()
    WHERE password_reset_tokens.token_hash = ${hashAuthToken(parsed.data.token)}
      AND password_reset_tokens.used_at IS NULL
      AND password_reset_tokens.expires_at > NOW()
    RETURNING password_reset_tokens.id, password_reset_tokens.user_id
  `;
  const reset = rows[0] as Record<string, unknown> | undefined;
  if (!reset) {
    return NextResponse.json(
      { error: "This recovery link is invalid or has expired." },
      { status: 400 },
    );
  }
  const passwordHash = await hashPassword(parsed.data.password);
  await sql.transaction([
    sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${String(reset.user_id)}`,
    sql`DELETE FROM auth_sessions WHERE user_id = ${String(reset.user_id)}`,
    sql`DELETE FROM auth_login_challenges WHERE user_id = ${String(reset.user_id)}`,
  ]);
  return NextResponse.json({ message: "Password updated. Sign in with your new password." });
}
