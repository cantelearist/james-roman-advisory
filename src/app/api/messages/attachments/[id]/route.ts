import { NextResponse } from "next/server";

import {
  authorizeCapability,
  canReceiveAudience,
  getPortalAccessSummary,
  hasCapability,
} from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";
import { getDb, logFileAccess } from "@/lib/db";
import type { ResourceAudience } from "@/lib/data-model";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";
import { downloadFromVault } from "@/lib/vault";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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
      SELECT d.id, d.matter_id, d.original_name, d.content_type, d.blob_pathname,
             d.archived_at, message.audience
      FROM documents d
      JOIN engagement_messages message ON message.id = d.message_id
      WHERE d.id = ${id}
      LIMIT 1
    `;
    const attachment = rows[0];
    if (!attachment || attachment.archived_at) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const audience = String(attachment.audience) as ResourceAudience;
    const mayReadAudience = audience === "internal"
      ? hasCapability(access, "messages.internal_view")
      : canReceiveAudience(context.role, audience);
    const mayReadMatter = await authorizeCapability(context, access, "messages.view", {
      matterId: String(attachment.matter_id),
    });
    if (!mayReadAudience || !mayReadMatter) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
    }
    const blobResult = await downloadFromVault(String(attachment.blob_pathname));
    if (!blobResult || blobResult.statusCode !== 200 || !blobResult.stream) {
      return NextResponse.json({ error: "File not found in storage" }, { status: 404 });
    }
    void logFileAccess({
      documentId: id,
      userId: context.userId,
      eventType: "download",
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    const filename = encodeURIComponent(String(attachment.original_name));
    return new NextResponse(blobResult.stream, {
      headers: {
        "Content-Type": String(attachment.content_type || blobResult.blob.contentType || "application/octet-stream"),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("message.attachment.download.failed", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
