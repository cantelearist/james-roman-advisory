import { NextResponse } from "next/server";

import { authorizeCapability, getPortalAccessSummary } from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";
import { ensureEngagementOperationsTables, getDb } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (context.role !== "client") {
    return NextResponse.json({ error: "Client payment access required" }, { status: 403 });
  }
  const { id } = await params;
  await ensureEngagementOperationsTables();
  const sql = getDb();
  const invoices = await sql`
    SELECT i.*, c.email AS client_email
    FROM invoices i
    JOIN matters m ON m.id = i.matter_id
    JOIN clients c ON c.id = m.client_id
    WHERE i.id = ${id}
    LIMIT 1
  `;
  const invoice = invoices[0] as Record<string, unknown> | undefined;
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await getPortalAccessSummary(context);
  if (!(await authorizeCapability(context, access, "finance.view", { matterId: String(invoice.matter_id) }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!["issued", "overdue"].includes(String(invoice.status))) {
    return NextResponse.json({ error: "This invoice is not payable." }, { status: 409 });
  }
  const items = await sql`
    SELECT description, quantity, unit_amount_cents
    FROM invoice_line_items
    WHERE invoice_id = ${id}
    ORDER BY position
  `;
  const origin = new URL(request.url).origin;
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      customer_email: invoice.client_email ? String(invoice.client_email) : undefined,
      client_reference_id: id,
      metadata: { invoiceId: id, matterId: String(invoice.matter_id) },
      line_items: items.map((item) => ({
        quantity: Number(item.quantity),
        price_data: {
          currency: String(invoice.currency),
          unit_amount: Number(item.unit_amount_cents),
          product_data: { name: String(item.description) },
        },
      })),
      success_url: `${origin}/portal/finance?payment=return&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/portal/finance?payment=cancelled`,
    },
    { idempotencyKey: `invoice-checkout-${id}` },
  );
  await sql`
    UPDATE invoices
    SET stripe_checkout_session_id = ${session.id}, updated_at = NOW()
    WHERE id = ${id}
  `;
  return NextResponse.json({ url: session.url });
}
