import { NextResponse } from "next/server";
import { z } from "zod";

import {
  authorizeCapability,
  canReceiveAudience,
  getPortalAccessSummary,
  hasCapability,
} from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { ResourceAudience } from "@/lib/data-model";
import { notifyEngagementMembers } from "@/lib/notifications";
import { triggerPortalAutomations } from "@/lib/automations";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";

export const runtime = "nodejs";

const messageSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
  audience: z.enum(["internal", "contractor", "client"]).optional(),
  subject: z.string().trim().max(180).nullable().optional(),
  parentMessageId: z.string().uuid().nullable().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const access = await getPortalAccessSummary(context);
  if (!(await authorizeCapability(context, access, "messages.view", { matterId: id }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await assertRequiredSchemaVersions();
  const sql = getDb();
  const matter = await sql`SELECT id FROM matters WHERE id = ${id} LIMIT 1`;
  if (matter.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rows = await sql`
    SELECT m.id, m.matter_id, m.sender_id, m.body, m.audience, m.subject,
           m.thread_id, m.parent_message_id, m.created_at,
           u.name AS sender_name, u.role AS sender_role,
           (receipt.read_at IS NOT NULL) AS is_read
    FROM engagement_messages m
    JOIN users u ON u.id = m.sender_id
    LEFT JOIN message_read_receipts receipt
      ON receipt.message_id = m.id AND receipt.user_id = ${context.userId}
    WHERE m.matter_id = ${id}
    ORDER BY m.created_at ASC
  `;
  const mayViewInternal = hasCapability(access, "messages.internal_view");
  const messages = rows.filter((message) => {
    const audience = String(message.audience) as ResourceAudience;
    return audience === "internal"
      ? mayViewInternal
      : canReceiveAudience(context.role, audience);
  });
  const unread = messages.filter((message) =>
    message.sender_id !== context.userId && !message.is_read,
  );
  if (unread.length > 0) {
    await Promise.all(unread.map((message) => sql`
      INSERT INTO message_read_receipts (message_id, user_id)
      VALUES (${String(message.id)}, ${context.userId})
      ON CONFLICT (message_id, user_id) DO NOTHING
    `));
  }
  return NextResponse.json({ messages });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const access = await getPortalAccessSummary(context);
  if (!(await authorizeCapability(context, access, "messages.send", { matterId: id }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const parsed = messageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a message of 10,000 characters or fewer." }, { status: 400 });
  }
  let audience: ResourceAudience;
  if (context.role === "client") audience = "client";
  else if (context.role === "contractor") audience = "contractor";
  else audience = parsed.data.audience ?? "client";
  if (audience === "internal" && !hasCapability(access, "messages.internal_view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await assertRequiredSchemaVersions();
  const sql = getDb();
  const matterRows = await sql`SELECT id, title FROM matters WHERE id = ${id} LIMIT 1`;
  if (matterRows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let threadId = crypto.randomUUID();
  if (parsed.data.parentMessageId) {
    const parents = await sql`
      SELECT id, COALESCE(thread_id, id) AS thread_id
      FROM engagement_messages
      WHERE id = ${parsed.data.parentMessageId}
        AND matter_id = ${id}
      LIMIT 1
    `;
    if (parents.length === 0) return NextResponse.json({ error: "Parent message not found" }, { status: 400 });
    threadId = String(parents[0].thread_id);
  }
  const rows = await sql`
    INSERT INTO engagement_messages (
      matter_id, sender_id, body, audience, subject, thread_id, parent_message_id
    )
    VALUES (
      ${id}, ${context.userId}, ${parsed.data.body}, ${audience},
      ${parsed.data.subject ?? null}, ${threadId}, ${parsed.data.parentMessageId ?? null}
    )
    RETURNING id, matter_id, sender_id, body, audience, subject,
      thread_id, parent_message_id, created_at
  `;
  const message = { ...rows[0], sender_name: context.user.name, sender_role: context.role };
  const preview = parsed.data.body.length > 180
    ? `${parsed.data.body.slice(0, 177)}…`
    : parsed.data.body;
  const delivery = await notifyEngagementMembers({
    matterId: id,
    actorId: context.userId,
    audience,
    eventType: "message_received",
    subject: `New Private Office message · ${String(matterRows[0].title)}`,
    preview,
    path: `/portal/matters/${id}?section=messages`,
  });
  if (context.role === "client") {
    await triggerPortalAutomations({
      triggerType: "client_message_received",
      matterId: id,
      actorId: context.userId,
      sourceId: String(rows[0]?.id),
      title: `Respond to client message · ${String(matterRows[0].title)}`,
      detail: preview,
    });
  }
  return NextResponse.json({ message, delivery }, { status: 201 });
}
