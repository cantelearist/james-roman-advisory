import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentAuthContext, isTeamRole } from "@/lib/crm/auth";
import { userCanUploadToMatter } from "@/lib/crm/data";
import type { DocumentVisibility } from "@/lib/crm/types";
import { writeAuditEvent } from "@/lib/crm/audit";
import { captureApiError, captureSignedUrlFailure } from "@/lib/monitoring";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOriginRequest } from "@/lib/request-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const CASE_FILES_BUCKET = "case-files";

const uploadRequestSchema = z.object({
  matterId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(180),
  contentType: z.string().trim().min(3).max(160).optional(),
  sizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES).optional(),
  visibility: z.enum(["client", "internal"]).optional(),
});

function safeFileName(input: string) {
  const normalized = input
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 120);

  return normalized || "case-file";
}

export async function POST(request: Request) {
  try {
    const guardResponse = enforceSameOriginRequest(request);
    if (guardResponse) return guardResponse;

    const context = await getCurrentAuthContext();
    if (!context) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const input = uploadRequestSchema.parse(await request.json());
    const limitResponse = enforceRateLimit({
      namespace: "document-signed-upload",
      limit: 20,
      windowMs: 60_000,
      keyParts: [context.userId, input.matterId],
    });
    if (limitResponse) return limitResponse;

    const canAccess = await userCanUploadToMatter(context, input.matterId);
    if (!canAccess) {
      return NextResponse.json({ message: "Matter access denied." }, { status: 403 });
    }

    // Service-role is required for Storage signed-upload creation after matter upload access is checked.
    const supabase = createSupabaseAdminClient();
    const id = crypto.randomUUID();
    const title = input.fileName.trim();
    const visibility: DocumentVisibility = isTeamRole(context.profile.role)
      ? input.visibility ?? "client"
      : "client";
    const storagePath = [
      context.profile.tenant_id,
      input.matterId,
      `${id}-${safeFileName(input.fileName)}`,
    ].join("/");

    const { error: insertError } = await supabase.from("documents").insert({
      id,
      tenant_id: context.profile.tenant_id,
      matter_id: input.matterId,
      uploaded_by: context.userId,
      title,
      storage_bucket: CASE_FILES_BUCKET,
      storage_path: storagePath,
      mime_type: input.contentType ?? null,
      size_bytes: input.sizeBytes ?? null,
      visibility,
      status: "pending_upload",
    });

    if (insertError) throw insertError;

    const { data, error: signedUrlError } = await supabase.storage
      .from(CASE_FILES_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (signedUrlError || !data) throw signedUrlError ?? new Error("Signed upload URL missing.");

    await writeAuditEvent({
      actorId: context.userId,
      tenantId: context.profile.tenant_id,
      action: "document.signed_upload_created",
      resourceType: "document",
      resourceId: id,
      metadata: {
        matterId: input.matterId,
        visibility,
        sizeBytes: input.sizeBytes ?? null,
        contentType: input.contentType ?? null,
      },
    });

    return NextResponse.json({
      documentId: id,
      bucket: CASE_FILES_BUCKET,
      path: storagePath,
      signedUrl: data.signedUrl,
      token: data.token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Please review the upload request.", errors: error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    console.error("document.signed_upload_failed", error);
    captureSignedUrlFailure("upload");
    captureApiError("/api/documents/signed-upload", 500, error, { operation: "document.signed_upload" });
    return NextResponse.json({ message: "The upload could not be prepared." }, { status: 500 });
  }
}
