/**
 * GET /api/vault/documents
 * Returns the authenticated client's documents, optionally filtered by matter_id.
 * Query params: ?matter_id=<uuid>  (optional)
 *
 * Auth: first-party session required.
 */
import { NextResponse } from "next/server";

import {
  authorizeCapability,
  canReceiveAudience,
  getPortalAccessSummary,
  hasCapability,
  logAccessAudit,
} from "@/lib/access-control";
import { getDb } from "@/lib/db";
import { getAuthContext } from "@/lib/auth";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await getAuthContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { userId, role } = context;
    const access = await getPortalAccessSummary(context);
    if (!hasCapability(access, "documents.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await assertRequiredSchemaVersions();
    const sql = getDb();

    const url = new URL(request.url);
    const matterId = url.searchParams.get("matter_id");
    const archived = url.searchParams.get("archived") === "1"
      && hasCapability(access, "documents.publish");
    if (
      matterId
      && !(await authorizeCapability(context, access, "documents.view", { matterId }))
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const rows = role === "super_admin" || (role === "admin" && access.scope === "global")
      ? await sql`
          SELECT
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
          FROM documents
          WHERE (${matterId}::TEXT IS NULL OR matter_id = ${matterId})
            AND (${archived} = TRUE OR archived_at IS NULL)
          ORDER BY created_at DESC
        `
      : await sql`
          SELECT DISTINCT
            d.id,
            d.name,
            d.original_name,
            d.category,
            d.size_bytes,
            d.content_type,
            d.matter_id,
            d.visibility,
            d.publication_status,
            d.archived_at,
            d.created_at
          FROM documents d
          LEFT JOIN engagement_memberships em
            ON em.matter_id = d.matter_id
            AND em.user_id = ${userId}
            AND em.status = 'active'
            AND (em.expires_at IS NULL OR em.expires_at > NOW())
          WHERE
            (em.id IS NOT NULL OR d.uploaded_by = ${userId})
            AND (${matterId}::TEXT IS NULL OR d.matter_id = ${matterId})
            AND d.archived_at IS NULL
          ORDER BY d.created_at DESC
        `;
    const visibleRows = rows.filter((document) =>
        canReceiveAudience(
          role,
          String(document.visibility ?? "internal") as "internal" | "contractor" | "client",
          document.publication_status === "pending_review" ? "pending_review" : "published",
        ),
      );
    const documents = hasCapability(access, "documents.publish")
      ? visibleRows
      : visibleRows.map((document) => {
          const result = { ...document };
          delete result.visibility;
          delete result.publication_status;
          return result;
        });

    await logAccessAudit({
      actorId: userId,
      action: "documents.list_viewed",
      matterId: matterId ?? undefined,
      metadata: { count: documents.length },
    });

    return NextResponse.json({ documents });
  } catch (err) {
    console.error("vault.documents.list.error", err);
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}
