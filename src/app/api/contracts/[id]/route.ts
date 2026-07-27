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

const actionSchema = z.object({ action: z.enum(["issue", "void"]) });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid contract action" }, { status: 400 });
  const { id } = await params;
  await ensureEngagementOperationsTables();
  const sql = getDb();
  const rows = await sql`SELECT * FROM engagement_contracts WHERE id = ${id} LIMIT 1`;
  const contract = rows[0];
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await getPortalAccessSummary(context);
  if (!(await authorizeCapability(context, access, "contracts.manage", { matterId: String(contract.matter_id) }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (parsed.data.action === "issue" && contract.status !== "draft") {
    return NextResponse.json({ error: "Only a draft contract can be issued" }, { status: 409 });
  }
  if (parsed.data.action === "void" && contract.status === "accepted") {
    return NextResponse.json({ error: "An accepted contract cannot be voided here" }, { status: 409 });
  }
  await sql`
    UPDATE engagement_contracts
    SET status = ${parsed.data.action === "issue" ? "issued" : "void"},
        issued_at = CASE WHEN ${parsed.data.action} = 'issue' THEN NOW() ELSE issued_at END,
        updated_at = NOW()
    WHERE id = ${id}
  `;
  if (parsed.data.action === "issue") {
    await notifyEngagementMembers({
      matterId: String(contract.matter_id),
      actorId: context.userId,
      audience: "client",
      eventType: "contract_issued",
      subject: `Contract ${String(contract.contract_number)} is ready`,
      preview: String(contract.title),
      path: `/portal/finance?matter_id=${String(contract.matter_id)}`,
    });
  }
  const updated = await sql`SELECT * FROM engagement_contracts WHERE id = ${id} LIMIT 1`;
  return NextResponse.json({ contract: updated[0] });
}
