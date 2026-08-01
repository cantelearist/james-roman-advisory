import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/lib/notifications";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";

export const runtime = "nodejs";

const preferencesSchema = z.object({
  email: z.object({
    messages: z.boolean(),
    documents: z.boolean(),
    finance: z.boolean(),
    tasks: z.boolean(),
  }),
});

function normalizePreferences(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { email: { ...DEFAULT_NOTIFICATION_PREFERENCES } };
  }
  const parsed = preferencesSchema.safeParse(value);
  return parsed.success
    ? parsed.data
    : { email: { ...DEFAULT_NOTIFICATION_PREFERENCES } };
}

export async function GET() {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await assertRequiredSchemaVersions();
  const sql = getDb();
  const key = `notifications:${context.userId}`;
  const rows = await sql`SELECT value FROM portal_settings WHERE key = ${key} LIMIT 1`;
  return NextResponse.json({ preferences: normalizePreferences(rows[0]?.value) });
}

export async function PATCH(request: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = preferencesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Notification preferences are invalid" }, { status: 400 });
  }
  await assertRequiredSchemaVersions();
  const sql = getDb();
  const key = `notifications:${context.userId}`;
  await sql`
    INSERT INTO portal_settings (key, value, updated_by)
    VALUES (${key}, CAST(${JSON.stringify(parsed.data)} AS JSONB), ${context.userId})
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
  `;
  return NextResponse.json({ preferences: parsed.data });
}
