/**
 * GET /api/vault/documents
 * Returns the authenticated client's documents, optionally filtered by matter_id.
 * Query params: ?matter_id=<uuid>  (optional)
 *
 * Auth: first-party session required.
 */
import { NextResponse } from "next/server";

import { ensureVaultTables, getDb, logFileAccess } from "@/lib/db";
import { getAuthContext } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await getAuthContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { userId } = context;

    await ensureVaultTables();
    const sql = getDb();

    // Resolve client id for this user
    const clientRows = await sql`
      SELECT id FROM clients WHERE user_id = ${userId}
    `;
    if (clientRows.length === 0) {
      return NextResponse.json({ documents: [] });
    }
    const clientId = clientRows[0].id as string;

    const url = new URL(request.url);
    const matterId = url.searchParams.get("matter_id");

    const documents = matterId
      ? await sql`
          SELECT id, name, original_name, category, size_bytes, content_type, matter_id, created_at
          FROM documents
          WHERE client_id = ${clientId} AND matter_id = ${matterId}
          ORDER BY created_at DESC
        `
      : await sql`
          SELECT id, name, original_name, category, size_bytes, content_type, matter_id, created_at
          FROM documents
          WHERE client_id = ${clientId}
          ORDER BY created_at DESC
        `;

    // Log view event for the listing (lightweight — no per-doc events here)
    void logFileAccess({
      documentId: "list",
      userId,
      eventType: "view",
    });

    return NextResponse.json({ documents });
  } catch (err) {
    console.error("vault.documents.list.error", err);
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}
