import { NextResponse } from "next/server";
import { z } from "zod";

import {
  accessAuditQuery,
  getPortalAccessSummary,
  hasCapability,
} from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(240),
  email: z.string().trim().email().max(320).nullable(),
  phone: z.string().trim().max(80).nullable(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = await getPortalAccessSummary(context);
  const mayManageGlobalClients = context.role === "super_admin"
    || (context.role === "admin" && access.scope === "global");
  if (!mayManageGlobalClients || !hasCapability(access, "clients.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Client details are invalid", issues: parsed.error.issues }, { status: 400 });
  }

  await assertRequiredSchemaVersions();
  const { id } = await params;
  const sql = getDb();
  const currentRows = await sql`SELECT id, name, email, phone FROM clients WHERE id = ${id} LIMIT 1`;
  const current = currentRows[0];
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const changedFields = (["name", "email", "phone"] as const).filter((field) =>
    (current[field] ?? null) !== parsed.data[field],
  );
  if (changedFields.length === 0) {
    return NextResponse.json({ client: current });
  }

  const [updatedRows] = await sql.transaction((tx) => [
    tx`
      UPDATE clients
      SET
        name = ${parsed.data.name},
        email = ${parsed.data.email},
        phone = ${parsed.data.phone},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, name, email, phone, updated_at
    `,
    accessAuditQuery(tx, {
      actorId: context.userId,
      action: "client.identity.updated",
      metadata: { clientId: id, changedFields },
    }),
  ]);

  return NextResponse.json({ client: updatedRows[0] });
}
