import { NextResponse } from "next/server";
import { z } from "zod";

import {
  authorizeCapability,
  getPortalAccessSummary,
} from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";
import { ensureEngagementOperationsTables, getDb } from "@/lib/db";
import { notifyEngagementMembers } from "@/lib/notifications";

export const runtime = "nodejs";

const actionSchema = z.object({
  action: z.enum(["issue", "void", "remind"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid invoice action" }, { status: 400 });
  const { id } = await params;
  await ensureEngagementOperationsTables();
  const sql = getDb();
  const rows = await sql`
    SELECT i.*, m.title AS matter_title
    FROM invoices i
    JOIN matters m ON m.id = i.matter_id
    WHERE i.id = ${id}
    LIMIT 1
  `;
  const invoice = rows[0];
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await getPortalAccessSummary(context);
  if (!(await authorizeCapability(context, access, "finance.manage", { matterId: String(invoice.matter_id) }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (parsed.data.action === "issue") {
    if (invoice.status !== "draft") {
      return NextResponse.json({ error: "Only a draft invoice can be issued" }, { status: 409 });
    }
    await sql`
      UPDATE invoices
      SET status = 'issued', issued_at = NOW(), updated_at = NOW()
      WHERE id = ${id} AND status = 'draft'
    `;
    await notifyEngagementMembers({
      matterId: String(invoice.matter_id),
      actorId: context.userId,
      audience: "client",
      eventType: "invoice_issued",
      subject: `Invoice ${String(invoice.invoice_number)} is ready`,
      preview: `An invoice for ${(Number(invoice.total_cents) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} is available in your Private Office.`,
      path: `/portal/finance?matter_id=${invoice.matter_id}`,
    });
  } else if (parsed.data.action === "void") {
    if (["paid", "void"].includes(String(invoice.status))) {
      return NextResponse.json({ error: "A paid or void invoice cannot be voided" }, { status: 409 });
    }
    await sql`
      UPDATE invoices
      SET status = 'void', updated_at = NOW()
      WHERE id = ${id}
    `;
  } else {
    if (!["issued", "overdue"].includes(String(invoice.status))) {
      return NextResponse.json({ error: "Only an outstanding invoice can receive a reminder" }, { status: 409 });
    }
    await notifyEngagementMembers({
      matterId: String(invoice.matter_id),
      actorId: context.userId,
      audience: "client",
      eventType: "invoice_reminder",
      subject: `Reminder · Invoice ${String(invoice.invoice_number)}`,
      preview: `${(Number(invoice.total_cents) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} remains outstanding.`,
      path: `/portal/finance?matter_id=${invoice.matter_id}`,
    });
  }
  const updated = await sql`SELECT * FROM invoices WHERE id = ${id} LIMIT 1`;
  return NextResponse.json({ invoice: updated[0] });
}
