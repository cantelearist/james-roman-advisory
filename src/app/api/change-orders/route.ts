import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeCapability, getPortalAccessSummary, hasCapability } from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";
import { ensureEngagementOperationsTables, getDb } from "@/lib/db";
import { notifyEngagementMembers } from "@/lib/notifications";

const schema = z.object({
  matterId: z.string().uuid(),
  sourceContractId: z.string().uuid().nullable().optional(),
  sourceInvoiceId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(10_000),
  amountCents: z.number().int().min(0).max(100_000_000),
  issue: z.boolean().default(false),
}).refine((value) => Boolean(value.sourceContractId || value.sourceInvoiceId), {
  message: "A source contract or invoice is required.",
});

function changeOrderNumber(): string {
  return `JRA-CO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
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
  const changeOrders = await sql`
    SELECT co.*, m.title AS matter_title,
      ctr.contract_number AS source_contract_number,
      inv.invoice_number AS source_invoice_number
    FROM change_orders co
    JOIN matters m ON m.id = co.matter_id
    LEFT JOIN engagement_contracts ctr ON ctr.id = co.source_contract_id
    LEFT JOIN invoices inv ON inv.id = co.source_invoice_id
    LEFT JOIN engagement_memberships em
      ON em.matter_id = co.matter_id
      AND em.user_id = ${context.userId}
      AND em.status = 'active'
      AND (em.expires_at IS NULL OR em.expires_at > NOW())
    WHERE (${matterId}::TEXT IS NULL OR co.matter_id = ${matterId})
      AND (${global} OR em.id IS NOT NULL)
      AND (${context.role} <> 'client' OR co.status <> 'draft')
    ORDER BY co.created_at DESC
  `;
  return NextResponse.json({ changeOrders });
}

export async function POST(request: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Change order details are invalid.", issues: parsed.error.issues }, { status: 400 });
  const access = await getPortalAccessSummary(context);
  if (!(await authorizeCapability(context, access, "contracts.manage", { matterId: parsed.data.matterId }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await ensureEngagementOperationsTables();
  const sql = getDb();
  if (parsed.data.sourceContractId) {
    const rows = await sql`SELECT id FROM engagement_contracts WHERE id = ${parsed.data.sourceContractId} AND matter_id = ${parsed.data.matterId}`;
    if (rows.length === 0) return NextResponse.json({ error: "Source contract not found." }, { status: 400 });
  }
  if (parsed.data.sourceInvoiceId) {
    const rows = await sql`SELECT id FROM invoices WHERE id = ${parsed.data.sourceInvoiceId} AND matter_id = ${parsed.data.matterId}`;
    if (rows.length === 0) return NextResponse.json({ error: "Source invoice not found." }, { status: 400 });
  }
  const number = changeOrderNumber();
  const rows = await sql`
    INSERT INTO change_orders (
      matter_id, source_contract_id, source_invoice_id, change_order_number,
      title, description, amount_cents, status, issued_at, created_by
    )
    VALUES (
      ${parsed.data.matterId},
      ${parsed.data.sourceContractId ?? null},
      ${parsed.data.sourceInvoiceId ?? null},
      ${number},
      ${parsed.data.title},
      ${parsed.data.description},
      ${parsed.data.amountCents},
      ${parsed.data.issue ? "issued" : "draft"},
      ${parsed.data.issue ? new Date().toISOString() : null},
      ${context.userId}
    )
    RETURNING *
  `;
  if (parsed.data.issue) {
    await notifyEngagementMembers({
      matterId: parsed.data.matterId,
      actorId: context.userId,
      audience: "client",
      eventType: "change_order_issued",
      subject: `Change order ${number} requires review`,
      preview: parsed.data.title,
      path: `/portal/finance?matter_id=${parsed.data.matterId}`,
    });
  }
  return NextResponse.json({ changeOrder: rows[0] }, { status: 201 });
}
