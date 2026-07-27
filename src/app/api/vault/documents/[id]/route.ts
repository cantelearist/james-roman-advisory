/**
 * GET  /api/vault/documents/[id]  — stream download (access-logged)
 * DELETE /api/vault/documents/[id] — capability and engagement scoped
 *
 * Auth: first-party session required. Clients can only access their own documents.
 */
import { NextResponse } from "next/server";

import { ensureEngagementOperationsTables, getDb, logFileAccess } from "@/lib/db";
import { deleteFromVault, downloadFromVault } from "@/lib/vault";
import {
  authorizeCapability,
  canReceiveAudience,
  getPortalAccessSummary,
  hasCapability,
} from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, routeContext: RouteContext) {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { userId, role } = authContext;
    const access = await getPortalAccessSummary(authContext);
    if (!hasCapability(access, "documents.view")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { id } = await routeContext.params;

    await ensureEngagementOperationsTables();
    const sql = getDb();

    // Resolve client, then verify ownership
    const docRows = await sql`
      SELECT
        d.id,
        d.name,
        d.original_name,
        d.blob_pathname,
        d.content_type,
        d.client_id,
        d.matter_id,
        d.uploaded_by,
        d.visibility,
        d.publication_status,
        d.archived_at
      FROM documents d
      JOIN clients c ON c.id = d.client_id
      WHERE d.id = ${id}
    `;

    if (docRows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const doc = docRows[0];
    if (doc.archived_at && !hasCapability(access, "documents.publish")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const scopedAccess = doc.matter_id
      ? await authorizeCapability(authContext, access, "documents.view", {
          matterId: String(doc.matter_id),
        })
      : doc.uploaded_by === userId || role === "super_admin" || (role === "admin" && access.scope === "global");
    const audienceAccess = canReceiveAudience(
      role,
      String(doc.visibility ?? "internal") as "internal" | "contractor" | "client",
      doc.publication_status === "pending_review" ? "pending_review" : "published",
    );
    if (!scopedAccess || !audienceAccess) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Log access before streaming
    void logFileAccess({
      documentId: id,
      userId,
      eventType: "download",
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    // Fetch from Vercel Blob and stream to client
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
    }

    const blobResult = await downloadFromVault(String(doc.blob_pathname));
    if (!blobResult || blobResult.statusCode !== 200 || !blobResult.stream) {
      return NextResponse.json({ error: "File not found in storage" }, { status: 404 });
    }

    const filename = encodeURIComponent(doc.original_name as string);
    return new NextResponse(blobResult.stream, {
      headers: {
        "Content-Type":
          (doc.content_type as string) ||
          blobResult.blob.contentType ||
          "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("vault.document.download.error", err);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request, routeContext: RouteContext) {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { userId } = authContext;
    const access = await getPortalAccessSummary(authContext);

    const { id } = await routeContext.params;

    await ensureEngagementOperationsTables();
    const sql = getDb();

    const docRows = await sql`
      SELECT id, blob_pathname, matter_id, uploaded_by FROM documents WHERE id = ${id}
    `;
    if (docRows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const doc = docRows[0];
    const allowed = doc.matter_id
      ? await authorizeCapability(authContext, access, "documents.delete", {
          matterId: String(doc.matter_id),
        })
      : hasCapability(access, "documents.delete")
        && (
          authContext.role === "super_admin"
          || (authContext.role === "admin" && access.scope === "global")
          || doc.uploaded_by === userId
        );
    if (!allowed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Audit before delete
    void logFileAccess({ documentId: id, userId, eventType: "delete" });

    // Remove from Vercel Blob
    const versionRows = await sql`
      SELECT blob_pathname FROM document_versions WHERE document_id = ${id}
    `;
    const paths = new Set([
      String(doc.blob_pathname),
      ...versionRows.map((version) => String(version.blob_pathname)),
    ]);
    await Promise.all([...paths].map((pathname) => deleteFromVault(pathname)));

    // Remove from DB
    await sql`DELETE FROM documents WHERE id = ${id}`;

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("vault.document.delete.error", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}

export async function PATCH(request: Request, routeContext: RouteContext) {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const access = await getPortalAccessSummary(authContext);
    const { id } = await routeContext.params;

    let body: {
      name?: string;
      visibility?: string;
      publicationStatus?: string;
      archived?: boolean;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (body.name !== undefined && (body.name.trim().length < 1 || body.name.trim().length > 240)) {
      return NextResponse.json({ error: "Document name must be between 1 and 240 characters" }, { status: 400 });
    }
    if (body.visibility !== undefined && !["internal", "contractor", "client"].includes(body.visibility)) {
      return NextResponse.json({ error: "Invalid document visibility" }, { status: 400 });
    }
    if (body.publicationStatus !== undefined && !["pending_review", "published"].includes(body.publicationStatus)) {
      return NextResponse.json({ error: "Invalid publication status" }, { status: 400 });
    }
    if (body.archived !== undefined && typeof body.archived !== "boolean") {
      return NextResponse.json({ error: "Invalid archive state" }, { status: 400 });
    }
    if (body.name === undefined && body.visibility === undefined && body.publicationStatus === undefined && body.archived === undefined) {
      return NextResponse.json({ error: "No document changes were provided" }, { status: 400 });
    }

    await ensureEngagementOperationsTables();
    const sql = getDb();
    const rows = await sql`
      SELECT id, matter_id, uploaded_by
      FROM documents
      WHERE id = ${id}
      LIMIT 1
    `;
    const document = rows[0] as Record<string, unknown> | undefined;
    if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const allowed = document.matter_id
      ? await authorizeCapability(authContext, access, "documents.publish", {
          matterId: String(document.matter_id),
        })
      : hasCapability(access, "documents.publish")
        && (
          authContext.role === "super_admin"
          || (authContext.role === "admin" && access.scope === "global")
          || document.uploaded_by === authContext.userId
        );
    if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [updated] = await sql`
      UPDATE documents
      SET name = COALESCE(${body.name?.trim() ?? null}, name),
          visibility = COALESCE(${body.visibility ?? null}, visibility),
          publication_status = COALESCE(${body.publicationStatus ?? null}, publication_status),
          archived_at = CASE
            WHEN ${body.archived === true} THEN NOW()
            WHEN ${body.archived === false} THEN NULL
            ELSE archived_at
          END
      WHERE id = ${id}
      RETURNING
        id,
        name,
        original_name,
        category,
        size_bytes,
        content_type,
        matter_id,
        visibility,
        publication_status,
        archived_at,
        created_at
    `;
    return NextResponse.json({ document: updated });
  } catch (error) {
    console.error("vault.document.publish.error", error);
    return NextResponse.json({ error: "Document update failed" }, { status: 500 });
  }
}
