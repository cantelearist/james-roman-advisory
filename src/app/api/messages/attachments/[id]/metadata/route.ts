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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = await getPortalAccessSummary(context);
  if (!hasCapability(access, "messages.view")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { id } = await params;
  await assertRequiredSchemaVersions();
  const sql = getDb();
  const rows = await sql`
    SELECT d.id, d.matter_id, d.name, d.original_name, d.content_type,
      d.size_bytes, d.created_at, d.archived_at, message.audience,
      uploader.name AS uploaded_by_name
    FROM documents d
    JOIN engagement_messages message ON message.id = d.message_id
    LEFT JOIN users uploader ON uploader.id = d.uploaded_by
    WHERE d.id = ${id}
    LIMIT 1
  `;
  const attachment = rows[0];
  if (!attachment || attachment.archived_at) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const audience = String(attachment.audience) as ResourceAudience;
  const audienceAllowed = audience === "internal"
    ? hasCapability(access, "messages.internal_view")
    : canReceiveAudience(context.role, audience);
  const matterAllowed = await authorizeCapability(context, access, "messages.view", {
    matterId: String(attachment.matter_id),
  });
  if (!audienceAllowed || !matterAllowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const versions = await sql`
    SELECT version.id, version.version_number, version.original_name,
      version.size_bytes, version.content_type, version.created_at,
      uploader.name AS uploaded_by_name
    FROM document_versions version
    LEFT JOIN users uploader ON uploader.id = version.uploaded_by
    WHERE version.document_id = ${id}
    ORDER BY version.version_number DESC
  `;
  const accessEvents = hasCapability(access, "audit.view")
    ? await sql`
        SELECT event.id, event.event_type, event.created_at, actor.name AS actor_name
        FROM file_access_events event
        LEFT JOIN users actor ON actor.id = event.user_id
        WHERE event.document_id = ${id}
        ORDER BY event.created_at DESC
        LIMIT 25
      `
    : [];
  return NextResponse.json({
    attachment: {
      id: attachment.id,
      name: attachment.name,
      original_name: attachment.original_name,
      content_type: attachment.content_type,
      size_bytes: attachment.size_bytes,
      created_at: attachment.created_at,
      uploaded_by_name: attachment.uploaded_by_name,
      audience,
    },
    versions,
    accessEvents,
  });
}
