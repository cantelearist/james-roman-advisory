/**
 * POST /api/vault/upload
 * Accepts a multipart form with:
 *   - file        File
 *   - category    DocumentCategory
 *   - matter_id   string (optional)
 *   - name        string (optional — defaults to original filename)
 *
 * Auth: Clerk session required.
 *   - Staff (admin/advisor): may upload to any client's matter.
 *   - Client: must have an existing, admin-provisioned client record.
 *             Auto-creation of client records is NOT permitted here.
 *             If a matter_id is supplied, it must belong to this client.
 *   - No-role / unprovisioned users: 403.
 *
 * Returns: { document } with id, name, category, size_bytes, created_at.
 */
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getRole, isStaff } from "@/lib/auth";
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
    // ── Auth ────────────────────────────────────────────────────────────────
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = getRole(clerkUser);

    // Deny users with no assigned role. All legitimate users are provisioned
    // via the admin invite flow before they can upload anything.
    if (!role) {
      return NextResponse.json(
        { error: "Forbidden: account not provisioned" },
        { status: 403 }
      );
    }

    const callerIsStaff = isStaff(role);

    // ── Parse multipart ──────────────────────────────────────────────────────
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as string) || "other";
    const matterId = (formData.get("matter_id") as string) || null;
    const customName = formData.get("name") as string | null;

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
    await ensureVaultTables();
    const sql = getDb();

    let clientId: string;

    if (callerIsStaff) {
      // Staff may upload on behalf of any client. matter_id is the anchor.
      // If no matter_id, a client_id must be provided in the form; fall back
      // to a staff-owned "unassigned" record if needed.
      const staffClientId = formData.get("client_id") as string | null;

      if (matterId) {
        // Resolve client from the matter
        const matterRows = await sql`
          SELECT client_id FROM matters WHERE id = ${matterId}
        `;
        if (matterRows.length === 0) {
          return NextResponse.json({ error: "Matter not found" }, { status: 404 });
        }
        clientId = matterRows[0].client_id as string;
      } else if (staffClientId) {
        clientId = staffClientId;
      } else {
        // Staff self-upload without a matter — use staff's own client record,
        // creating one if needed (acceptable for staff, not for clients).
        const email = clerkUser.emailAddresses?.[0]?.emailAddress ?? "";
        const rows = await sql`
          INSERT INTO clients (id, clerk_user_id, name, email)
          VALUES (gen_random_uuid()::TEXT, ${userId}, ${clerkUser.fullName ?? email}, ${email})
          ON CONFLICT (clerk_user_id) DO UPDATE SET name = EXCLUDED.name
          RETURNING id
        `;
        clientId = rows[0].id as string;
      }
    } else {
      // Client role: must have a pre-existing, admin-provisioned client record.
      // Auto-creation is NOT allowed — it would bypass the invite-only model.
      const clientRows = await sql`
        SELECT id FROM clients WHERE clerk_user_id = ${userId}
      `;
      if (clientRows.length === 0) {
        return NextResponse.json(
          { error: "Forbidden: client record not found" },
          { status: 403 }
        );
      }
      clientId = clientRows[0].id as string;

      // If a matter_id is provided, verify the matter belongs to this client.
      if (matterId) {
        const matterRows = await sql`
          SELECT id FROM matters WHERE id = ${matterId} AND client_id = ${clientId}
        `;
        if (matterRows.length === 0) {
          return NextResponse.json(
            { error: "Forbidden: matter not found or does not belong to this client" },
            { status: 403 }
          );
        }
      }
    }

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

    // ── Audit log ────────────────────────────────────────────────────────────
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
