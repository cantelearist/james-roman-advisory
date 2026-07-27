import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeCapability, getPortalAccessSummary } from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";
import { ensureEngagementOperationsTables, getDb } from "@/lib/db";
import { notifyEngagementMembers } from "@/lib/notifications";

const schema = z.object({ action: z.enum(["issue", "accept", "reject", "void"]) });

function supplementalInvoiceNumber(): string {
  return `JRA-INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  const { id } = await params;
  await ensureEngagementOperationsTables();
  const sql = getDb();
  const rows = await sql`SELECT * FROM change_orders WHERE id = ${id} LIMIT 1`;
  const changeOrder = rows[0] as Record<string, unknown> | undefined;
  if (!changeOrder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await getPortalAccessSummary(context);
  const matterId = String(changeOrder.matter_id);
  const isClientDecision = ["accept", "reject"].includes(parsed.data.action);
  const capability = isClientDecision ? "contracts.view" : "contracts.manage";
  if (!(await authorizeCapability(context, access, capability, { matterId }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (isClientDecision && context.role !== "client") {
    return NextResponse.json({ error: "Only the client may accept or reject an issued change order." }, { status: 403 });
  }
  if (parsed.data.action === "issue" && changeOrder.status !== "draft") {
    return NextResponse.json({ error: "Only a draft change order can be issued." }, { status: 409 });
  }
  if (isClientDecision && changeOrder.status !== "issued") {
    return NextResponse.json({ error: "This change order is not awaiting a decision." }, { status: 409 });
  }
  if (parsed.data.action === "accept") {
    if (Number(changeOrder.amount_cents) === 0) {
      const accepted = await sql`
        UPDATE change_orders
        SET status = 'accepted', accepted_at = NOW(), accepted_by = ${context.userId}, updated_at = NOW()
        WHERE id = ${id} AND status = 'issued'
        RETURNING id
      `;
      if (accepted.length === 0) {
        return NextResponse.json({ error: "This change order was already decided." }, { status: 409 });
      }
    } else {
      const invoiceId = crypto.randomUUID();
      const invoiceNumber = supplementalInvoiceNumber();
      const accepted = await sql`
        WITH accepted AS (
          UPDATE change_orders
          SET status = 'accepted',
              accepted_at = NOW(),
              accepted_by = ${context.userId},
              supplemental_invoice_id = ${invoiceId},
              updated_at = NOW()
          WHERE id = ${id} AND status = 'issued'
          RETURNING *
        ),
        invoice AS (
          INSERT INTO invoices (
            id, matter_id, contract_id, invoice_number, status, subtotal_cents,
            total_cents, issued_at, created_by
          )
          SELECT
            ${invoiceId},
            matter_id,
            source_contract_id,
            ${invoiceNumber},
            'issued',
            amount_cents,
            amount_cents,
            NOW(),
            created_by
          FROM accepted
          RETURNING id
        ),
        line_item AS (
          INSERT INTO invoice_line_items (
            invoice_id, description, quantity, unit_amount_cents, position
          )
          SELECT
            invoice.id,
            ${`Change order ${String(changeOrder.change_order_number)} · ${String(changeOrder.title)}`},
            1,
            accepted.amount_cents,
            0
          FROM invoice, accepted
          RETURNING id
        )
        SELECT id FROM accepted
      `;
      if (accepted.length === 0) {
        return NextResponse.json({ error: "This change order was already decided." }, { status: 409 });
      }
    }
  } else {
    const nextStatus = parsed.data.action === "issue" ? "issued" : parsed.data.action === "reject" ? "rejected" : "void";
    await sql`
      UPDATE change_orders
      SET status = ${nextStatus},
          issued_at = CASE WHEN ${nextStatus} = 'issued' THEN NOW() ELSE issued_at END,
          updated_at = NOW()
      WHERE id = ${id}
    `;
    if (parsed.data.action === "issue") {
      await notifyEngagementMembers({
        matterId,
        actorId: context.userId,
        audience: "client",
        eventType: "change_order_issued",
        subject: `Change order ${String(changeOrder.change_order_number)} requires review`,
        preview: String(changeOrder.title),
        path: `/portal/finance?matter_id=${matterId}`,
      });
    }
  }
  const updated = await sql`SELECT * FROM change_orders WHERE id = ${id} LIMIT 1`;
  return NextResponse.json({ changeOrder: updated[0] });
}
