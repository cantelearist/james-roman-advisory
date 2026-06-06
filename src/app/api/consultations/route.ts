import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { draftLocalIntakeSummary } from "@/lib/ai/intake-summary";
import { consultationSchema, redactForAudit } from "@/lib/intake";
import { captureApiError } from "@/lib/monitoring";
import { clientFingerprint, enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOriginRequest } from "@/lib/request-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function makeReferenceId() {
  return `JRA-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function POST(request: Request) {
  try {
    const guardResponse = enforceSameOriginRequest(request);
    if (guardResponse) return guardResponse;

    const limitResponse = enforceRateLimit({
      namespace: "consultation-intake",
      limit: 12,
      windowMs: 60_000,
      keyParts: [clientFingerprint(request)],
    });
    if (limitResponse) return limitResponse;

    const body = await request.json();
    const input = consultationSchema.parse(body);
    const referenceId = makeReferenceId();
    const summaryDraft = draftLocalIntakeSummary(input);
    const id = crypto.randomUUID();
    // Service-role use is limited here to public intake before a user account exists.
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase.from("consultation_requests").insert({
      id,
      reference_id: referenceId,
      name: input.name,
      email: input.email,
      market: input.market,
      matter: input.matter,
      message: input.message,
      summary_draft: summaryDraft,
    });

    if (error) throw error;

    console.info("consultation.received", {
      referenceId,
      audit: redactForAudit(input),
      receivedAt: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        referenceId,
        message:
          "Request received. A private review record has been created for advisor screening.",
      },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: "Please review the highlighted fields.",
          errors: error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    console.error("consultation.failed", error);
    captureApiError("/api/consultations", 500, error, { operation: "consultation.create" });
    return NextResponse.json(
      { message: "The request could not be submitted. Please try again." },
      { status: 500 },
    );
  }
}
