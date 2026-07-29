import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { sendPasswordRecovery } from "@/lib/email";
import { hashAuthToken } from "@/lib/mfa";
import { getClientIp, ratelimit } from "@/lib/ratelimit";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";

export const runtime = "nodejs";

const schema = z.object({ email: z.string().trim().email().max(320) });
const MESSAGE = "If that address belongs to an active account, recovery instructions are on the way.";

export async function POST(request: Request) {
  const limit = await ratelimit("auth-recovery", getClientIp(request));
  if (!limit.available) {
    return NextResponse.json(
      { message: "Password recovery is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
  if (limit.blocked) return NextResponse.json({ message: MESSAGE });
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { message: "Password recovery is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: MESSAGE });

  await assertRequiredSchemaVersions();
  const sql = getDb();
  const rows = await sql`
    SELECT id, name, email
    FROM users
    WHERE LOWER(email) = LOWER(${parsed.data.email})
      AND status = 'active'
    LIMIT 1
  `;
  const user = rows[0] as Record<string, unknown> | undefined;
  if (user) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await sql`DELETE FROM password_reset_tokens WHERE user_id = ${String(user.id)} OR expires_at <= NOW()`;
    await sql`
      INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
      VALUES (
        ${crypto.randomUUID()},
        ${String(user.id)},
        ${hashAuthToken(token)},
        ${expiresAt.toISOString()}
      )
    `;
    try {
      await sendPasswordRecovery({
        name: String(user.name),
        email: String(user.email),
        token,
      });
    } catch (error) {
      await sql`DELETE FROM password_reset_tokens WHERE token_hash = ${hashAuthToken(token)}`;
      console.error("password_recovery.delivery.failed", {
        userId: String(user.id),
        error,
      });
    }
  }
  return NextResponse.json({ message: MESSAGE });
}
