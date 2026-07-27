import { NextResponse } from "next/server";

import {
  authorizeCapability,
  canReceiveAudience,
  getPortalAccessSummary,
  hasCapability,
} from "@/lib/access-control";
import { triggerPortalAutomations } from "@/lib/automations";
import { getAuthContext } from "@/lib/auth";
import { ensureEngagementOperationsTables, getDb, logFileAccess } from "@/lib/db";
import { notifyEngagementMembers } from "@/lib/notifications";
import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  deleteFromVault,
  sanitiseFilename,
  uploadToVault,
  vaultPathname,
} from "@/lib/vault";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, routeContext: RouteContext) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await routeContext.params;
  const access = await getPortalAccessSummary(context);
  if (!hasCapability(access, "documents.view")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await ensureEngagementOperationsTables();
  const sql = getDb();
  const documents = await sql`
    SELECT id, matter_id, visibility, publication_status
    FROM documents
    WHERE id = ${id}
    LIMIT 1
  `;
  const document = documents[0];
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const allowed = await authorizeCapability(context, access, "documents.view", {
    matterId: String(document.matter_id),
  });
  const audienceAllowed = canReceiveAudience(
    context.role,
    String(document.visibility) as "internal" | "contractor" | "client",
    document.publication_status === "pending_review" ? "pending_review" : "published",
  );
  if (!allowed || !audienceAllowed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const versions = await sql`
    SELECT version.id, version.version_number, version.original_name,
      version.size_bytes, version.content_type, version.uploaded_by,
      version.created_at, uploader.name AS uploaded_by_name
    FROM document_versions version
    LEFT JOIN users uploader ON uploader.id = version.uploaded_by
    WHERE version.document_id = ${id}
    ORDER BY version.version_number DESC
  `;
  const accessEvents = hasCapability(access, "audit.view")
    ? await sql`
        SELECT event.id, event.event_type, event.user_id, event.created_at,
          actor.name AS actor_name
        FROM file_access_events event
        LEFT JOIN users actor ON actor.id = event.user_id
        WHERE event.document_id = ${id}
        ORDER BY event.created_at DESC
        LIMIT 100
      `
    : [];
  return NextResponse.json({ versions, accessEvents });
}

export async function POST(request: Request, routeContext: RouteContext) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await routeContext.params;
  const access = await getPortalAccessSummary(context);
  await ensureEngagementOperationsTables();
  const sql = getDb();
  const documents = await sql`
    SELECT id, matter_id, client_id, name, visibility, publication_status
    FROM documents
    WHERE id = ${id}
      AND archived_at IS NULL
    LIMIT 1
  `;
  const document = documents[0];
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await authorizeCapability(context, access, "documents.upload", { matterId: String(document.matter_id) }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const form = await request.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "File exceeds 50 MB limit" }, { status: 413 });
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: `File type not allowed: ${file.type}` }, { status: 415 });
  }
  const versionRows = await sql`
    SELECT COALESCE(MAX(version_number), 0)::int + 1 AS next_version
    FROM document_versions
    WHERE document_id = ${id}
  `;
  const versionNumber = Number(versionRows[0]?.next_version ?? 1);
  const pathname = vaultPathname({
    clientId: String(document.client_id),
    matterId: String(document.matter_id),
    docId: `${id}-v${versionNumber}`,
    filename: sanitiseFilename(file.name),
  });
  const blob = await uploadToVault({
    pathname,
    file: await file.arrayBuffer(),
    contentType: file.type,
  });
  try {
    const versionId = crypto.randomUUID();
    await sql`
      INSERT INTO document_versions (
        id, document_id, version_number, blob_pathname, original_name,
        size_bytes, content_type, uploaded_by
      )
      VALUES (
        ${versionId}, ${id}, ${versionNumber}, ${blob.pathname}, ${file.name},
        ${file.size}, ${file.type}, ${context.userId}
      )
    `;
    const pendingReview = context.role === "contractor" && document.visibility === "client";
    await sql`
      UPDATE documents
      SET blob_pathname = ${blob.pathname},
          original_name = ${file.name},
          size_bytes = ${file.size},
          content_type = ${file.type},
          publication_status = CASE WHEN ${pendingReview} THEN 'pending_review' ELSE publication_status END
      WHERE id = ${id}
    `;
    await logFileAccess({
      documentId: id,
      userId: context.userId,
      eventType: "upload",
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    await notifyEngagementMembers({
      matterId: String(document.matter_id),
      actorId: context.userId,
      audience: String(document.visibility) as "internal" | "contractor" | "client",
      eventType: "document_uploaded",
      subject: "New document version in your Private Office",
      preview: `${String(document.name)} · version ${versionNumber}`,
      path: `/portal/vault?matter_id=${String(document.matter_id)}`,
    });
    if (pendingReview) {
      await triggerPortalAutomations({
        triggerType: "document_review_requested",
        matterId: String(document.matter_id),
        actorId: context.userId,
        sourceId: versionId,
        title: `Review document version for publication · ${String(document.name)}`,
      });
    }
    return NextResponse.json({
      version: {
        id: versionId,
        version_number: versionNumber,
        original_name: file.name,
        size_bytes: file.size,
        content_type: file.type,
        uploaded_by: context.userId,
        created_at: new Date().toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    await deleteFromVault(blob.pathname).catch(() => undefined);
    console.error("vault.document.version.failed", error);
    return NextResponse.json({ error: "Document version could not be saved" }, { status: 500 });
  }
}
