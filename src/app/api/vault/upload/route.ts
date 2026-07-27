/**
 * POST /api/vault/upload
 * Accepts a multipart form with:
 *   - file        File
 *   - category    DocumentCategory
 *   - matter_id   string (optional)
 *   - name        string (optional — defaults to original filename)
 *
 * Auth: first-party session required.
 *   - Global Admin/Super Admin: may upload to any client's engagement.
 *   - Client: must have an existing, admin-provisioned client record.
 *             Auto-creation of client records is NOT permitted here.
 *             If a matter_id is supplied, it must belong to this client.
 *   - No-role / unprovisioned users: 403.
 *
 * Returns: { document } with id, name, category, size_bytes, created_at.
 */
import { NextResponse } from "next/server";

import {
  authorizeCapability,
  getPortalAccessSummary,
  hasCapability,
} from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";
import { ensureEngagementOperationsTables, getDb, logFileAccess } from "@/lib/db";
import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  sanitiseFilename,
  uploadToVault,
  vaultPathname,
} from "@/lib/vault";
import { notifyEngagementMembers } from "@/lib/notifications";
import { triggerPortalAutomations } from "@/lib/automations";
import type { ResourceAudience } from "@/lib/data-model";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const context = await getAuthContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { userId, role } = context;
    const access = await getPortalAccessSummary(context);
    if (!hasCapability(access, "documents.upload")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── Parse multipart ──────────────────────────────────────────────────────
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as string) || "other";
    const matterId = (formData.get("matter_id") as string) || null;
    const customName = formData.get("name") as string | null;
    const requestedVisibility = formData.get("visibility") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // ── Validate file ────────────────────────────────────────────────────────
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File exceeds 50 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB)` },
        { status: 413 }
      );
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `File type not allowed: ${file.type}` },
        { status: 415 }
      );
    }

    // ── Resolve client record ────────────────────────────────────────────────
    await ensureEngagementOperationsTables();
    const sql = getDb();

    if (!matterId) {
      return NextResponse.json(
        { error: "Select an engagement before uploading a document" },
        { status: 400 },
      );
    }
    const allowed = await authorizeCapability(
      context,
      access,
      "documents.upload",
      { matterId },
    );
    if (!allowed) {
      return NextResponse.json({ error: "Matter not found" }, { status: 404 });
    }
    const matterRows = await sql`
      SELECT client_id FROM matters WHERE id = ${matterId}
    `;
    if (matterRows.length === 0) {
      return NextResponse.json({ error: "Matter not found" }, { status: 404 });
    }
    const clientId = matterRows[0].client_id as string;

    // ── Build blob path ──────────────────────────────────────────────────────
    const docId = crypto.randomUUID();
    const safeFilename = sanitiseFilename(file.name);
    const pathname = vaultPathname({ clientId, matterId, docId, filename: safeFilename });

    // ── Upload to Vercel Blob ────────────────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const blob = await uploadToVault({
      pathname,
      file: arrayBuffer,
      contentType: file.type,
    });

    // ── Save document record ─────────────────────────────────────────────────
    // blob.pathname is stored server-side only; blob.url is NEVER returned
    // to the client. All downloads go through the authenticated proxy at
    // /api/vault/documents/[id].
    const docName = customName?.trim() || file.name;
    const canPublish = hasCapability(access, "documents.publish");
    const settingsRows = canPublish && !requestedVisibility
      ? await sql`SELECT value FROM portal_settings WHERE key = 'workspace' LIMIT 1`
      : [];
    const settings = settingsRows[0]?.value && typeof settingsRows[0].value === "object"
      ? settingsRows[0].value as Record<string, unknown>
      : {};
    const configuredVisibility = ["internal", "contractor", "client"].includes(String(settings.defaultDocumentVisibility))
      ? String(settings.defaultDocumentVisibility)
      : null;
    const visibility: ResourceAudience =
      canPublish && ["internal", "contractor", "client"].includes(requestedVisibility ?? configuredVisibility ?? "")
        ? (requestedVisibility ?? configuredVisibility) as ResourceAudience
        : role === "client"
          ? "client"
          : role === "contractor"
            ? "contractor"
            : "internal";
    const publicationStatus =
      role === "contractor" && visibility === "client"
        ? "pending_review"
        : "published";
    const rows = await sql`
      INSERT INTO documents (
        id, matter_id, client_id, name, original_name,
        category, blob_pathname, size_bytes, content_type, uploaded_by,
        visibility, publication_status
      )
      VALUES (
        ${docId}, ${matterId}, ${clientId}, ${docName}, ${file.name},
        ${category}, ${blob.pathname}, ${file.size}, ${file.type}, ${userId},
        ${visibility}, ${publicationStatus}
      )
      RETURNING id, name, original_name, category, size_bytes, content_type, created_at
    `;
    const document = rows[0];
    await sql`
      INSERT INTO document_versions (
        id, document_id, version_number, blob_pathname, original_name,
        size_bytes, content_type, uploaded_by
      )
      VALUES (
        ${crypto.randomUUID()}, ${docId}, 1, ${blob.pathname}, ${file.name},
        ${file.size}, ${file.type}, ${userId}
      )
      ON CONFLICT (document_id, version_number) DO NOTHING
    `;

    // ── Audit log ────────────────────────────────────────────────────────────
    void logFileAccess({
      documentId: docId,
      userId,
      eventType: "upload",
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    if (matterId) {
      await notifyEngagementMembers({
        matterId,
        actorId: userId,
        audience: visibility,
        eventType: "document_uploaded",
        subject: "New document in your Private Office",
        preview: docName,
        path: `/portal/matters/${matterId}?section=documents`,
      });
      if (publicationStatus === "pending_review") {
        await triggerPortalAutomations({
          triggerType: "document_review_requested",
          matterId,
          actorId: userId,
          sourceId: docId,
          title: `Review document for publication · ${docName}`,
          detail: "Confirm the audience and publish or return the document.",
        });
      }
    }

    return NextResponse.json({ document }, { status: 201 });
  } catch (err) {
    console.error("vault.upload.error", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
