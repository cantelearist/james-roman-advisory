/**
 * POST /api/vault/upload
 * Accepts a multipart form with:
 *   - file        File
 *   - category    DocumentCategory
 *   - matter_id   string (optional)
 *   - name        string (optional — defaults to original filename)
 *
 * Auth: Clerk session required. Client role → uploads to own matter.
 * Returns: { document } with id, name, category, size_bytes, created_at.
 */
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { ensureVaultTables, getDb, logFileAccess } from "@/lib/db";
import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  sanitiseFilename,
  uploadToVault,
  vaultPathname,
} from "@/lib/vault";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    // — Auth —
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? "";

    // — Parse multipart —
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as string) || "other";
    const matterId = (formData.get("matter_id") as string) || null;
    const customName = formData.get("name") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // — Validate —
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

    // — Ensure tables & get/create client record —
    await ensureVaultTables();
    const sql = getDb();

    // Upsert client row keyed by Clerk user ID
    const clientRows = await sql`
      INSERT INTO clients (id, clerk_user_id, name, email)
      VALUES (gen_random_uuid()::TEXT, ${userId}, ${clerkUser?.fullName ?? email}, ${email})
      ON CONFLICT (clerk_user_id) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `;
    const clientId = clientRows[0].id as string;

    // — Build blob path —
    const docId = crypto.randomUUID();
    const safeFilename = sanitiseFilename(file.name);
    const pathname = vaultPathname({ clientId, matterId, docId, filename: safeFilename });

    // — Upload to Vercel Blob —
    const arrayBuffer = await file.arrayBuffer();
    const blob = await uploadToVault({
      pathname,
      file: arrayBuffer,
      contentType: file.type,
    });

    // — Save document record —
    const docName = customName?.trim() || file.name;
    const rows = await sql`
      INSERT INTO documents (
        id, matter_id, client_id, name, original_name,
        category, blob_pathname, size_bytes, content_type, uploaded_by
      )
      VALUES (
        ${docId}, ${matterId}, ${clientId}, ${docName}, ${file.name},
        ${category}, ${blob.pathname}, ${file.size}, ${file.type}, ${userId}
      )
      RETURNING id, name, original_name, category, size_bytes, content_type, created_at
    `;
    const document = rows[0];

    // — Audit log —
    void logFileAccess({
      documentId: docId,
      userId,
      eventType: "upload",
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (err) {
    console.error("vault.upload.error", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
