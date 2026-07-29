import { NextResponse } from "next/server";
import { z } from "zod";

import { accessAuditQuery } from "@/lib/access-control";
import { getAuthContext, isSuperAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";

export const runtime = "nodejs";

const settingsSchema = z.object({
  workspaceName: z.string().trim().min(2).max(80),
  defaultDocumentVisibility: z.enum(["internal", "contractor", "client"]),
  invitationExpiryDays: z.number().int().min(1).max(30),
  notifyOnMessage: z.boolean(),
  notifyOnDocument: z.boolean(),
  notifyOnInvoice: z.boolean(),
  notifyOnTask: z.boolean(),
  requireWorkflowGates: z.boolean(),
});

const DEFAULTS = {
  workspaceName: "James Roman Private Office",
  defaultDocumentVisibility: "internal" as const,
  invitationExpiryDays: 7,
  notifyOnMessage: true,
  notifyOnDocument: true,
  notifyOnInvoice: true,
  notifyOnTask: true,
  requireWorkflowGates: true,
};

async function requireSuperAdminApi() {
  const context = await getAuthContext();
  if (!context) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  if (!isSuperAdmin(context.role)) return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  return { context } as const;
}

export async function GET() {
  const auth = await requireSuperAdminApi();
  if ("response" in auth) return auth.response;
  await assertRequiredSchemaVersions();
  const sql = getDb();
  const rows = await sql`SELECT value, updated_at FROM portal_settings WHERE key = 'workspace' LIMIT 1`;
  const stored = rows[0]?.value && typeof rows[0].value === "object" ? rows[0].value : {};
  return NextResponse.json({
    settings: { ...DEFAULTS, ...stored },
    updatedAt: rows[0]?.updated_at ?? null,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireSuperAdminApi();
  if ("response" in auth) return auth.response;
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Workspace settings are invalid", issues: parsed.error.issues }, { status: 400 });
  }
  await assertRequiredSchemaVersions();
  const sql = getDb();
  await sql.transaction((tx) => [
    tx`
      INSERT INTO portal_settings (key, value, updated_by)
      VALUES ('workspace', CAST(${JSON.stringify(parsed.data)} AS JSONB), ${auth.context.userId})
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
    `,
    accessAuditQuery(tx, {
      actorId: auth.context.userId,
      action: "workspace.settings_updated",
      metadata: parsed.data,
    }),
  ]);
  return NextResponse.json({ settings: parsed.data });
}
