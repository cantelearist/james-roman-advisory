import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentAuthContext, isTeamRole } from "@/lib/crm/auth";
import { writeAuditEvent } from "@/lib/crm/audit";
import { captureApiError } from "@/lib/monitoring";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOriginRequest } from "@/lib/request-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const reviewRequestSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(500).optional(),
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

    // Document review is a team-only action. Clients cannot approve or reject
    // documents — even documents they uploaded themselves.
    if (!isTeamRole(context.profile.role)) {
      return NextResponse.json({ message: "Document review requires team access." }, { status: 403 });
    }

    const limitResponse = enforceRateLimit({
      namespace: "document-review",
      limit: 60,
      windowMs: 60_000,
      keyParts: [context.userId],
    });
    if (limitResponse) return limitResponse;

    let input: z.infer<typeof reviewRequestSchema>;
    try {
      input = reviewRequestSchema.parse(await request.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { message: "Invalid review request.", errors: err.flatten().fieldErrors },
          { status: 400 },
        );
      }
      return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
    }

    // Service-role is required here because status transitions out of
    // scan_pending must bypass the document-update RLS that restricts
    // status changes to system-level operations.
    const adminClient = createSupabaseAdminClient();

    const { data: document, error: documentError } = await adminClient
      .from("documents")
      .select("id, tenant_id, matter_id, status, visibility, title")
      .eq("id", documentId)
      .single();

    if (documentError || !document || document.status === "deleted") {
      return NextResponse.json({ message: "Document not found." }, { status: 404 });
    }

    // Enforce tenant isolation: a team member can only review documents
    // within their own tenant.
    if (document.tenant_id !== context.profile.tenant_id) {
      return NextResponse.json({ message: "Document not found." }, { status: 404 });
    }

    // Only scan_pending documents can be reviewed. Any other status means the
    // document is not awaiting review (already approved, already quarantined,
    // etc.) and a review action should be rejected to prevent accidental
    // re-transitions.
    if (document.status !== "scan_pending") {
      return NextResponse.json(
        {
          message: "Document is not awaiting review.",
          currentStatus: document.status,
        },
        { status: 409 },
      );
    }

    const nextStatus = input.action === "approve" ? "available" : "quarantined";
    const auditAction =
      input.action === "approve" ? "document.review_approved" : "document.review_rejected";

    const { error: updateError } = await adminClient
      .from("documents")
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId)
      .eq("tenant_id", context.profile.tenant_id);

    if (updateError) throw updateError;

    await adminClient.from("file_access_events").insert({
      tenant_id: context.profile.tenant_id,
      document_id: documentId,
      actor_id: context.userId,
      action: input.action === "approve" ? "review_approved" : "review_rejected",
    });

    await writeAuditEvent({
      actorId: context.userId,
      tenantId: context.profile.tenant_id,
      action: auditAction,
      resourceType: "document",
      resourceId: documentId,
      metadata: {
        matterId: document.matter_id,
        previousStatus: "scan_pending",
        nextStatus,
        reason: input.reason ?? null,
      },
    });

    return NextResponse.json({
      documentId,
      status: nextStatus,
      action: input.action,
    });
  } catch (error) {
    console.error("document.review_failed", error);
    captureApiError("/api/documents/[documentId]/review", 500, error, {
      operation: "document.review",
    });
    return NextResponse.json({ message: "The review could not be completed." }, { status: 500 });
  }
}
