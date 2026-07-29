import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";

export const runtime = "nodejs";

const updateSchema = z.union([
  z.object({ id: z.string().min(1) }),
  z.object({ all: z.literal(true) }),
]);

export async function GET() {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await assertRequiredSchemaVersions();
  const sql = getDb();
  const notifications = await sql`
    SELECT id, matter_id, event_type, title, body, href, read_at, created_at
    FROM portal_notifications
    WHERE user_id = ${context.userId}
    ORDER BY created_at DESC
    LIMIT 50
  `;
  return NextResponse.json({ notifications });
}

export async function PATCH(request: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid notification update" }, { status: 400 });
  await assertRequiredSchemaVersions();
  const sql = getDb();
  if ("all" in parsed.data) {
    await sql`
      UPDATE portal_notifications
      SET read_at = COALESCE(read_at, NOW())
      WHERE user_id = ${context.userId}
    `;
  } else {
    await sql`
      UPDATE portal_notifications
      SET read_at = COALESCE(read_at, NOW())
      WHERE id = ${parsed.data.id}
        AND user_id = ${context.userId}
    `;
  }
  return NextResponse.json({ updated: true });
}
