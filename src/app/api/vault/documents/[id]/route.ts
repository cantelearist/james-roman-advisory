/**
 * GET  /api/vault/documents/[id]  — stream download (access-logged)
 * DELETE /api/vault/documents/[id] — soft-delete (advisor/admin only)
 *
 * Auth: Clerk session required. Clients can only access their own documents.
 */
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { ensureVaultTables, getDb, logFileAccess } from "@/lib/db";
import { deleteFromVault } from "@/lib/vault";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    await ensureVaultTables();
    const sql = getDb();

    // Resolve client, then verify ownership
    const clientRows = await sql`
      SELECT id, role FROM users WHERE id = ${userId}
    `;
    const isStaff = clientRows.length > 0 && ["advisor", "admin"].includes(clientRows[0].role as string);

    const docRows = await sql`
      SELECT d.id, d.name, d.original_name, d.blob_pathname, d.content_type, d.client_id
      FROM documents d
      JOIN clients c ON c.id = d.client_id
      WHERE d.id = ${id}
    `;

    if (docRows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const doc = docRows[0];

    // Verify: staff can download any doc; clients only their own
    if (!isStaff) {
      const ownerRows = await sql`
        SELECT id FROM clients WHERE clerk_user_id = ${userId} AND id = ${doc.client_id}
      `;
      if (ownerRows.length === 0) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
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

    const blobRes = await fetch(`https://blob.vercel-storage.com/${doc.blob_pathname}`, {
      headers: { Authorization: `Bearer ${blobToken}` },
    });

    if (!blobRes.ok) {
      return NextResponse.json({ error: "File not found in storage" }, { status: 404 });
    }

    const filename = encodeURIComponent(doc.original_name as string);
    return new NextResponse(blobRes.body, {
      headers: {
        "Content-Type": (doc.content_type as string) || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("vault.document.download.error", err);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    await ensureVaultTables();
    const sql = getDb();

    // Only advisor/admin can delete
    const staffRows = await sql`
      SELECT role FROM users WHERE id = ${userId} AND role IN ('advisor', 'admin')
    `;
    if (staffRows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const docRows = await sql`
      SELECT id, blob_pathname FROM documents WHERE id = ${id}
    `;
    if (docRows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const doc = docRows[0];

    // Audit before delete
    void logFileAccess({ documentId: id, userId, eventType: "delete" });

    // Remove from Vercel Blob
    await deleteFromVault(doc.blob_pathname as string);

    // Remove from DB
    await sql`DELETE FROM documents WHERE id = ${id}`;

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("vault.document.delete.error", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
