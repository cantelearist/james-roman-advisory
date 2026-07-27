import { NextResponse } from "next/server";
import { z } from "zod";

import {
  authorizeCapability,
  getPortalAccessSummary,
  hasCapability,
} from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";
import { ensureEngagementOperationsTables, getDb } from "@/lib/db";
import { notifyEngagementMembers } from "@/lib/notifications";

export const runtime = "nodejs";

const invoiceSchema = z.object({
  matterId: z.string().uuid(),
  contractId: z.string().uuid().nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
  issue: z.boolean().default(false),
  lineItems: z.array(z.object({
    description: z.string().trim().min(1).max(500),
    quantity: z.number().int().min(1).max(1000).default(1),
    unitAmountCents: z.number().int().min(0).max(100_000_000),
  })).min(1).max(100),
});

function invoiceNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `JRA-INV-${date}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

export async function GET(request: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = await getPortalAccessSummary(context);
  if (!hasCapability(access, "finance.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const matterId = new URL(request.url).searchParams.get("matter_id");
  if (matterId && !(await authorizeCapability(context, access, "finance.view", { matterId }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await ensureEngagementOperationsTables();
  const sql = getDb();
  const global = context.role === "super_admin" || (context.role === "admin" && access.scope === "global");
  const invoices = await sql`
    SELECT i.*, m.title AS matter_title, c.name AS client_name,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', payment.id,
          'status', payment.status,
          'amount_cents', payment.amount_cents,
          'received_at', payment.received_at,
          'created_at', payment.created_at
        ) ORDER BY payment.created_at DESC)
        FROM payments payment
        WHERE payment.invoice_id = i.id
      ), '[]'::json) AS payments,
      COALESCE(
        json_agg(
          json_build_object(
            'id', li.id,
            'description', li.description,
            'quantity', li.quantity,
            'unit_amount_cents', li.unit_amount_cents,
            'position', li.position
          ) ORDER BY li.position
        ) FILTER (WHERE li.id IS NOT NULL),
        '[]'::json
      ) AS line_items
    FROM invoices i
    JOIN matters m ON m.id = i.matter_id
    JOIN clients c ON c.id = m.client_id
    LEFT JOIN invoice_line_items li ON li.invoice_id = i.id
    LEFT JOIN engagement_memberships em
      ON em.matter_id = i.matter_id
      AND em.user_id = ${context.userId}
      AND em.status = 'active'
      AND (em.expires_at IS NULL OR em.expires_at > NOW())
    WHERE (${matterId}::TEXT IS NULL OR i.matter_id = ${matterId})
      AND (${global} OR em.id IS NOT NULL)
      AND (${context.role} <> 'client' OR i.status <> 'draft')
    GROUP BY i.id, m.title, c.name
    ORDER BY i.created_at DESC
  `;
  return NextResponse.json({ invoices });
}

export async function POST(request: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = await getPortalAccessSummary(context);
  const parsed = invoiceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invoice details are invalid.", issues: parsed.error.issues }, { status: 400 });
  }
  if (!(await authorizeCapability(context, access, "finance.manage", { matterId: parsed.data.matterId }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await ensureEngagementOperationsTables();
  const sql = getDb();
  const matter = await sql`SELECT id, title FROM matters WHERE id = ${parsed.data.matterId} LIMIT 1`;
  if (matter.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (parsed.data.contractId) {
    const contract = await sql`
      SELECT id FROM engagement_contracts
      WHERE id = ${parsed.data.contractId} AND matter_id = ${parsed.data.matterId}
      LIMIT 1
    `;
    if (contract.length === 0) return NextResponse.json({ error: "Contract not found" }, { status: 400 });
  }
  const total = parsed.data.lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitAmountCents,
    0,
  );
  const id = crypto.randomUUID();
  const number = invoiceNumber();
  const status = parsed.data.issue ? "issued" : "draft";
  const queries = [
    sql`
      INSERT INTO invoices (
        id, matter_id, contract_id, invoice_number, status, subtotal_cents,
        total_cents, due_date, issued_at, created_by
      )
      VALUES (
        ${id},
        ${parsed.data.matterId},
        ${parsed.data.contractId ?? null},
        ${number},
        ${status},
        ${total},
        ${total},
        ${parsed.data.dueDate ?? null},
        ${parsed.data.issue ? new Date().toISOString() : null},
        ${context.userId}
      )
    `,
    ...parsed.data.lineItems.map((item, position) => sql`
      INSERT INTO invoice_line_items (
        invoice_id, description, quantity, unit_amount_cents, position
      )
      VALUES (
        ${id}, ${item.description}, ${item.quantity}, ${item.unitAmountCents}, ${position}
      )
    `),
  ];
  await sql.transaction(queries);
  if (parsed.data.issue) {
    await notifyEngagementMembers({
      matterId: parsed.data.matterId,
      actorId: context.userId,
      audience: "client",
      eventType: "invoice_issued",
      subject: `Invoice ${number} is ready`,
      preview: `An invoice for ${(total / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} is available in your Private Office.`,
      path: `/portal/finance?matter_id=${parsed.data.matterId}`,
    });
  }
  const invoice = await sql`SELECT * FROM invoices WHERE id = ${id} LIMIT 1`;
  return NextResponse.json({ invoice: invoice[0] }, { status: 201 });
}
