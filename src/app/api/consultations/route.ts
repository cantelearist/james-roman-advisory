import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { draftLocalIntakeSummary } from "@/lib/ai/intake-summary";
import { ensureConsultationsTable, getDb } from "@/lib/db";
import { consultationSchema, redactForAudit } from "@/lib/intake";

export const runtime = "nodejs";

function makeReferenceId() {
  return `JRA-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = consultationSchema.parse(body);
    const referenceId = makeReferenceId();
    const summaryDraft = draftLocalIntakeSummary(input);
    const id = crypto.randomUUID();

    await ensureConsultationsTable();
    const sql = getDb();
    await sql`
      INSERT INTO consultations (id, reference_id, name, email, market, matter, message, summary_draft)
      VALUES (${id}, ${referenceId}, ${input.name}, ${input.email}, ${input.market}, ${input.matter}, ${input.message}, ${summaryDraft})
    `;

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
    return NextResponse.json(
      { message: "The request could not be submitted. Please try again." },
      { status: 500 },
    );
  }
}
