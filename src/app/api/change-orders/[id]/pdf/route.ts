import { NextResponse } from "next/server";

import { authorizeCapability, getPortalAccessSummary } from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";
import { ensureEngagementOperationsTables, getDb } from "@/lib/db";
import { renderRcaPdf } from "@/lib/pdf";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await ensureEngagementOperationsTables();
  const sql = getDb();
  const rows = await sql`
    SELECT co.*, m.title AS matter_title, c.name AS client_name,
      ctr.contract_number, inv.invoice_number
    FROM change_orders co
    JOIN matters m ON m.id = co.matter_id
    JOIN clients c ON c.id = m.client_id
    LEFT JOIN engagement_contracts ctr ON ctr.id = co.source_contract_id
    LEFT JOIN invoices inv ON inv.id = co.source_invoice_id
    WHERE co.id = ${id}
    LIMIT 1
  `;
  const item = rows[0] as Record<string, unknown> | undefined;
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await getPortalAccessSummary(context);
  if (!(await authorizeCapability(context, access, "contracts.view", { matterId: String(item.matter_id) }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const amount = (Number(item.amount_cents) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  const pdf = await renderRcaPdf({
    title: `Change Order ${String(item.change_order_number)}`,
    subtitle: `${String(item.client_name)} · ${String(item.matter_title)}`,
    reference: String(item.change_order_number),
    generatedAt: item.issued_at ? new Date(String(item.issued_at)).toISOString().slice(0, 10) : undefined,
    sections: [
      { heading: "Amends", body: String(item.contract_number ?? item.invoice_number ?? "Engagement record") },
      { heading: String(item.title), body: String(item.description) },
      { heading: "Fee adjustment", body: `${amount} ${String(item.currency).toUpperCase()}` },
      { heading: "Status", body: String(item.status).toUpperCase() },
    ],
  });
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${String(item.change_order_number)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
