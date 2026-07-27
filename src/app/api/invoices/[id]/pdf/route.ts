import { NextResponse } from "next/server";

import { authorizeCapability, getPortalAccessSummary } from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";
import { ensureEngagementOperationsTables, getDb } from "@/lib/db";
import { renderRcaPdf } from "@/lib/pdf";

export const runtime = "nodejs";

function money(cents: unknown): string {
  return (Number(cents) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureEngagementOperationsTables();
  const sql = getDb();
  const invoices = await sql`
    SELECT i.*, m.title AS matter_title, c.name AS client_name
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
  const items = await sql`
    SELECT description, quantity, unit_amount_cents
    FROM invoice_line_items WHERE invoice_id = ${id} ORDER BY position
  `;
  const pdf = await renderRcaPdf({
    title: `Invoice ${String(invoice.invoice_number)}`,
    subtitle: `${String(invoice.client_name)} · ${String(invoice.matter_title)}`,
    reference: String(invoice.invoice_number),
    generatedAt: invoice.issued_at ? new Date(String(invoice.issued_at)).toISOString().slice(0, 10) : undefined,
    sections: [
      {
        heading: "Line items",
        body: items.map((item) =>
          `${Number(item.quantity)} x ${String(item.description)} — ${money(Number(item.quantity) * Number(item.unit_amount_cents))}`,
        ),
      },
      {
        heading: "Amount due",
        body: `${money(invoice.total_cents)} ${String(invoice.currency).toUpperCase()} · Status: ${String(invoice.status).toUpperCase()}`,
      },
      ...(invoice.due_date ? [{ heading: "Due date", body: String(invoice.due_date) }] : []),
    ],
  });
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${String(invoice.invoice_number)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
