import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentAuthContext, isTeamRole } from "@/lib/crm/auth";
import { userCanUploadToMatter } from "@/lib/crm/data";
import { writeAuditEvent } from "@/lib/crm/audit";
import { decidePostUploadReview } from "@/lib/documents/scanning";
import { captureUploadCompletionFailure } from "@/lib/monitoring";
import { enforceSameOriginRequest } from "@/lib/request-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const completeRequestSchema = z.object({
  checksumSha256: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/i)
    .optional(),
});

type RouteContext = {
  params: Promise<{ documentId: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { documentId } = await params;

  try {
    const guardResponse = enforceSameOriginRequest(request);
    if (guardResponse) return guardResponse;

    const context = await getCurrentAuthContext();
    if (!context) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const input = completeRequestSchema.parse(await request.json().catch(() => ({})));

    // Use the user-scoped client to fetch document metadata so RLS enforces
    // tenant isolation as an additional boundary.
    const serverClient = await createSupabaseServerClient();
    const { data: document, error: documentError } = await serverClient
      .from("documents")
      .select("id, tenant_id, matter_id, uploaded_by, visibility, status")
      .eq("id", documentId)
      .single();

    if (documentError || !document) {
      return NextResponse.json({ message: "Document not found." }, { status: 404 });
    }

    const canAccess = await userCanUploadToMatter(context, document.matter_id);
    const clientCanComplete =
      document.visibility === "client" &&
      document.status === "pending_upload" &&
      document.uploaded_by === context.userId;
    if (!canAccess || (!isTeamRole(context.profile.role) && !clientCanComplete)) {
      return NextResponse.json({ message: "Document access denied." }, { status: 403 });
    }

    const reviewDecision = decidePostUploadReview();
    // Service-role is required for the status transition: setting scan_pending
    // requires bypassing any document-update RLS that would restrict status
    // changes to system-level operations.
    const adminClient = createSupabaseAdminClient();
    const { error: updateError } = await adminClient
      .from("documents")
      .update({
        status: reviewDecision.status,
        checksum_sha256: input.checksumSha256 ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId)
      .eq("tenant_id", context.profile.tenant_id);

    if (updateError) throw updateError;

    await adminClient.from("file_access_events").insert({
      tenant_id: context.profile.tenant_id,
      document_id: documentId,
      actor_id: context.userId,
      action: "upload_completed_scan_pending",
    });

    await writeAuditEvent({
      actorId: context.userId,
      tenantId: context.profile.tenant_id,
      action: "document.upload_completed",
      resourceType: "document",
      resourceId: documentId,
      metadata: {
        matterId: document.matter_id,
        status: reviewDecision.status,
        reviewRequired: reviewDecision.requiresAdvisorReview,
        reviewReason: reviewDecision.reason,
      },
    });

    return NextResponse.json({
      documentId,
      status: reviewDecision.status,
      reviewRequired: reviewDecision.requiresAdvisorReview,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Please review the completion request.", errors: error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    console.error("document.complete_failed", error);
    captureUploadCompletionFailure(documentId, error);
    return NextResponse.json({ message: "The upload could not be completed." }, { status: 500 });
  }
}
