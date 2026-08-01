import { NextResponse } from "next/server";

import {
  authorizeCapability,
  canReceiveAudience,
  getPortalAccessSummary,
  hasCapability,
} from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { ResourceAudience } from "@/lib/data-model";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = await getPortalAccessSummary(context);
  if (!hasCapability(access, "messages.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get("unread") === "1";
  const query = url.searchParams.get("q")?.trim();
  const pattern = query ? `%${query.slice(0, 120)}%` : null;
  await assertRequiredSchemaVersions();
  const sql = getDb();
  const global = context.role === "super_admin"
    || (context.role === "admin" && access.scope === "global");
  const rows = await sql`
    SELECT
      msg.id, msg.matter_id, msg.sender_id, msg.body, msg.audience,
      msg.subject, msg.thread_id, msg.parent_message_id, msg.created_at,
      sender.name AS sender_name, sender.role AS sender_role,
      m.title AS matter_title, c.name AS client_name,
      (receipt.read_at IS NOT NULL OR msg.sender_id = ${context.userId}) AS is_read,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', d.id,
          'name', d.name,
          'original_name', d.original_name,
          'content_type', d.content_type,
          'size_bytes', d.size_bytes,
          'created_at', d.created_at
        ) ORDER BY d.created_at, d.id)
        FROM documents d
        WHERE d.message_id = msg.id AND d.archived_at IS NULL
      ), '[]'::JSON) AS attachments
    FROM engagement_messages msg
    JOIN matters m ON m.id = msg.matter_id
    JOIN clients c ON c.id = m.client_id
    JOIN users sender ON sender.id = msg.sender_id
    LEFT JOIN message_read_receipts receipt
      ON receipt.message_id = msg.id AND receipt.user_id = ${context.userId}
    WHERE (${global} OR EXISTS (
      SELECT 1
      FROM engagement_memberships em
      WHERE em.matter_id = msg.matter_id
        AND em.user_id = ${context.userId}
        AND em.status = 'active'
        AND (em.expires_at IS NULL OR em.expires_at > NOW())
    ))
      AND (${pattern}::TEXT IS NULL
        OR msg.body ILIKE ${pattern}
        OR COALESCE(msg.subject, '') ILIKE ${pattern}
        OR m.title ILIKE ${pattern}
        OR c.name ILIKE ${pattern})
      AND (${unreadOnly} = FALSE OR (receipt.read_at IS NULL AND msg.sender_id <> ${context.userId}))
    ORDER BY msg.created_at DESC
    LIMIT 200
  `;
  const mayViewInternal = hasCapability(access, "messages.internal_view");
  const messages = rows.filter((message) => {
    const audience = String(message.audience) as ResourceAudience;
    return audience === "internal"
      ? mayViewInternal
      : canReceiveAudience(context.role, audience);
  });
  return NextResponse.json({ messages });
}

export async function PATCH(request: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { messageId?: string; matterId?: string } | null;
  if (!body?.messageId && !body?.matterId) {
    return NextResponse.json({ error: "A message or engagement is required" }, { status: 400 });
  }
  const access = await getPortalAccessSummary(context);
  if (!hasCapability(access, "messages.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await assertRequiredSchemaVersions();
  const sql = getDb();
  const resourceRows = body.messageId
    ? await sql`SELECT matter_id FROM engagement_messages WHERE id = ${body.messageId} LIMIT 1`
    : await sql`SELECT id AS matter_id FROM matters WHERE id = ${body.matterId} LIMIT 1`;
  const matterId = resourceRows[0]?.matter_id ? String(resourceRows[0].matter_id) : null;
  if (!matterId || !(await authorizeCapability(context, access, "messages.view", { matterId }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (body.messageId) {
    await sql`
      INSERT INTO message_read_receipts (message_id, user_id)
      SELECT msg.id, ${context.userId}
      FROM engagement_messages msg
      WHERE msg.id = ${body.messageId}
      ON CONFLICT (message_id, user_id) DO NOTHING
    `;
  } else {
    await sql`
      INSERT INTO message_read_receipts (message_id, user_id)
      SELECT msg.id, ${context.userId}
      FROM engagement_messages msg
      WHERE msg.matter_id = ${body.matterId}
      ON CONFLICT (message_id, user_id) DO NOTHING
    `;
  }
  return NextResponse.json({ updated: true });
}
