import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getRole, isStaff } from "@/lib/auth";
import { renderRcaPdf } from "@/lib/pdf";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 512 * 1024;

const documentSchema = z.object({
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().max(200).optional(),
  reference: z.string().trim().max(80).optional(),
  generatedAt: z.string().trim().max(40).optional(),
  sections: z.array(z.object({
    heading: z.string().trim().min(1).max(100),
    body: z.union([
      z.string().trim().max(8_000),
      z.array(z.string().trim().max(2_000)).max(40),
    ]),
  })).min(1).max(30),
});

function filenameFor(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  return `jra-${slug || "document"}.pdf`;
}

export async function POST(req: NextRequest) {
  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Document payload is too large" }, { status: 413 });
  }

  const [{ sessionClaims }, user] = await Promise.all([auth(), currentUser()]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStaff(getRole(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const fva = (sessionClaims as Record<string, unknown> | null)?.fva as
    | [number | null, number | null]
    | undefined;
  if (!fva || fva[1] === null) {
    return NextResponse.json({ error: "MFA required" }, { status: 403 });
  }

  let body: unknown;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Document payload is too large" }, { status: 413 });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = documentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid document payload", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const pdf = await renderRcaPdf(parsed.data);
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameFor(parsed.data.title)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("documents.pdf.render.failed", error);
    return NextResponse.json({ error: "Unable to generate document" }, { status: 500 });
  }
}
