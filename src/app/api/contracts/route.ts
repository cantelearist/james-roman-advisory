import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeCapability, getPortalAccessSummary, hasCapability } from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";
import { ensureEngagementOperationsTables, getDb } from "@/lib/db";

const schema = z.object({
  matterId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  originalAmountCents: z.number().int().min(0).max(100_000_000),
  issue: z.boolean().default(false),
});

function contractNumber(): string {
  return `JRA-CTR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

export async function GET(request: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = await getPortalAccessSummary(context);
  if (!hasCapability(access, "contracts.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const matterId = new URL(request.url).searchParams.get("matter_id");
  if (matterId && !(await authorizeCapability(context, access, "contracts.view", { matterId }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await ensureEngagementOperationsTables();
  const sql = getDb();
  const global = context.role === "super_admin" || (context.role === "admin" && access.scope === "global");
  const contracts = await sql`
    SELECT c.*, m.title AS matter_title
    FROM engagement_contracts c
    JOIN matters m ON m.id = c.matter_id
    LEFT JOIN engagement_memberships em
      ON em.matter_id = c.matter_id
      AND em.user_id = ${context.userId}
      AND em.status = 'active'
      AND (em.expires_at IS NULL OR em.expires_at > NOW())
    WHERE (${matterId}::TEXT IS NULL OR c.matter_id = ${matterId})
      AND (${global} OR em.id IS NOT NULL)
      AND (${context.role} <> 'client' OR c.status <> 'draft')
    ORDER BY c.created_at DESC
  `;
  return NextResponse.json({ contracts });
}

export async function POST(request: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Contract details are invalid." }, { status: 400 });
  const access = await getPortalAccessSummary(context);
  if (!(await authorizeCapability(context, access, "contracts.manage", { matterId: parsed.data.matterId }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await ensureEngagementOperationsTables();
  const sql = getDb();
  const rows = await sql`
    INSERT INTO engagement_contracts (
      matter_id, contract_number, title, status, original_amount_cents,
      issued_at, created_by
    )
    VALUES (
      ${parsed.data.matterId},
      ${contractNumber()},
      ${parsed.data.title},
      ${parsed.data.issue ? "issued" : "draft"},
      ${parsed.data.originalAmountCents},
      ${parsed.data.issue ? new Date().toISOString() : null},
      ${context.userId}
    )
    RETURNING *
  `;
  return NextResponse.json({ contract: rows[0] }, { status: 201 });
}
