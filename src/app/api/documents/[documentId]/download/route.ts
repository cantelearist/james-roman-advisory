import { NextResponse } from "next/server";

import { getCurrentAuthContext, isTeamRole } from "@/lib/crm/auth";
import { userCanViewMatterDocuments } from "@/lib/crm/data";
import { writeAuditEvent } from "@/lib/crm/audit";
import { canCreateSignedDownload } from "@/lib/documents/scanning";
import { captureApiError, captureSignedUrlFailure } from "@/lib/monitoring";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const SIGNED_DOWNLOAD_SECONDS = 120;

type RouteContext = {
  params: Promise<{ documentId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { documentId } = await params;

  try {
    const context = await getCurrentAuthContext();
    if (!context) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const limitResponse = enforceRateLimit({
      namespace: "document-signed-download",
      limit: 30,
      windowMs: 60_000,
      keyParts: [context.userId, documentId],
    });
    if (limitResponse) return limitResponse;

    // Service-role is required for private Storage signed-download creation after document access is checked.
    const supabase = createSupabaseAdminClient();
    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("id, tenant_id, matter_id, storage_bucket, storage_path, visibility, status")
      .eq("id", documentId)
      .single();

    if (documentError || !document || document.status === "deleted") {
      return NextResponse.json({ message: "Document not found." }, { status: 404 });
    }

    const canAccess = await userCanViewMatterDocuments(context, document.matter_id);
    const visibleToClient = document.visibility === "client" && canCreateSignedDownload(document.status);
    if (!canAccess || (!isTeamRole(context.profile.role) && !visibleToClient)) {
      return NextResponse.json({ message: "Document access denied." }, { status: 403 });
    }

    if (!canCreateSignedDownload(document.status)) {
      return NextResponse.json({ message: "Document is not available." }, { status: 409 });
    }

    const { data, error: signedUrlError } = await supabase.storage
      .from(document.storage_bucket)
      .createSignedUrl(document.storage_path, SIGNED_DOWNLOAD_SECONDS);

    if (signedUrlError || !data?.signedUrl) {
      throw signedUrlError ?? new Error("Signed download URL missing.");
    }

    await supabase.from("file_access_events").insert({
      tenant_id: context.profile.tenant_id,
      document_id: document.id,
      actor_id: context.userId,
      action: "signed_download_created",
    });

    await writeAuditEvent({
      actorId: context.userId,
      tenantId: context.profile.tenant_id,
      action: "document.signed_download_created",
      resourceType: "document",
      resourceId: document.id,
      metadata: { matterId: document.matter_id, expiresIn: SIGNED_DOWNLOAD_SECONDS },
    });

    return NextResponse.json({ signedUrl: data.signedUrl, expiresIn: SIGNED_DOWNLOAD_SECONDS });
  } catch (error) {
    console.error("document.download_failed", error);
    captureSignedUrlFailure("download", { documentId });
    captureApiError("/api/documents/[documentId]/download", 500, error, { operation: "document.signed_download" });
    return NextResponse.json({ message: "The document could not be prepared." }, { status: 500 });
  }
}
