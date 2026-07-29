import { NextResponse } from "next/server";
import { z } from "zod";

import { accessAuditQuery } from "@/lib/access-control";
import { getAuthContext, isSuperAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";

export const runtime = "nodejs";

const updateSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
  ownerUserId: z.string().min(1).nullable(),
  dueInDays: z.number().int().min(0).max(30).optional(),
});

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
  const automations = await sql`
    SELECT automation.*, owner.name AS owner_name,
      (SELECT COUNT(*)::int FROM automation_runs run
        WHERE run.automation_id = automation.id AND run.status = 'failed') AS failure_count,
      (SELECT MAX(run.started_at) FROM automation_runs run
        WHERE run.automation_id = automation.id) AS last_run_at
    FROM portal_automations automation
    LEFT JOIN users owner ON owner.id = automation.owner_user_id
    ORDER BY automation.trigger_type, automation.name
  `;
  const runs = await sql`
    SELECT run.id, run.automation_id, run.matter_id, run.status, run.result,
      run.error_message, run.started_at, run.completed_at,
      automation.name AS automation_name, matter.title AS matter_title
    FROM automation_runs run
    JOIN portal_automations automation ON automation.id = run.automation_id
    LEFT JOIN matters matter ON matter.id = run.matter_id
    ORDER BY run.started_at DESC
    LIMIT 100
  `;
  return NextResponse.json({ automations, runs });
}

export async function PATCH(request: Request) {
  const auth = await requireSuperAdminApi();
  if ("response" in auth) return auth.response;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Automation settings are invalid" }, { status: 400 });
  await assertRequiredSchemaVersions();
  const sql = getDb();
  const existing = await sql`SELECT * FROM portal_automations WHERE id = ${parsed.data.id} LIMIT 1`;
  if (existing.length === 0) return NextResponse.json({ error: "Automation not found" }, { status: 404 });
  if (parsed.data.enabled && existing[0].action_type === "create_task" && !parsed.data.ownerUserId) {
    return NextResponse.json({ error: "Select an accountable owner before enabling this automation" }, { status: 400 });
  }
  if (parsed.data.ownerUserId) {
    const owners = await sql`
      SELECT u.id
      FROM users u
      LEFT JOIN user_permission_assignments assignment ON assignment.user_id = u.id
      WHERE u.id = ${parsed.data.ownerUserId}
        AND u.status = 'active'
        AND (
          u.role = 'super_admin'
          OR (u.role = 'admin' AND assignment.access_scope = 'global')
        )
      LIMIT 1
    `;
    if (owners.length === 0) return NextResponse.json({ error: "Automation owner must be an active global operator" }, { status: 400 });
  }
  const configuration = existing[0].configuration && typeof existing[0].configuration === "object"
    ? existing[0].configuration as Record<string, unknown>
    : {};
  if (parsed.data.dueInDays !== undefined) configuration.dueInDays = parsed.data.dueInDays;
  const [rows] = await sql.transaction((tx) => [
    tx`
      UPDATE portal_automations
      SET enabled = ${parsed.data.enabled},
          owner_user_id = ${parsed.data.ownerUserId},
          configuration = ${JSON.stringify(configuration)},
          updated_by = ${auth.context.userId},
          updated_at = NOW()
      WHERE id = ${parsed.data.id}
      RETURNING *
    `,
    accessAuditQuery(tx, {
      actorId: auth.context.userId,
      action: "automation.updated",
      metadata: {
        automationId: parsed.data.id,
        recipeKey: String(existing[0].recipe_key),
        enabled: parsed.data.enabled,
        ownerUserId: parsed.data.ownerUserId,
        configuration,
      },
    }),
  ]);
  return NextResponse.json({ automation: rows[0] });
}
