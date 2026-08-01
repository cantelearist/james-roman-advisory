import { NextResponse } from "next/server";
import { z } from "zod";

import {
  authorizeCapability,
  canReceiveAudience,
  getPortalAccessSummary,
  hasCapability,
} from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";
import { getDb, logMatterEvent } from "@/lib/db";
import type { ResourceAudience } from "@/lib/data-model";
import { notifyEngagementMembers } from "@/lib/notifications";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";
import { canCreateWorkflowRecords } from "@/lib/workflow-authority";

export const runtime = "nodejs";

const createSchema = z.object({
  matterId: z.string().uuid(),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(5_000).nullable().optional(),
  stageKey: z.string().trim().max(80).nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  assigneeUserId: z.string().min(1).nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
  audience: z.enum(["internal", "contractor", "client"]).default("internal"),
});

export async function GET(request: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = await getPortalAccessSummary(context);
  if (!hasCapability(access, "timeline.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(request.url);
  const matterId = url.searchParams.get("matter_id");
  const mine = url.searchParams.get("mine") === "1";
  if (matterId && !(await authorizeCapability(context, access, "timeline.view", { matterId }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await assertRequiredSchemaVersions();
  const sql = getDb();
  const global = context.role === "super_admin"
    || (context.role === "admin" && access.scope === "global");
  const rows = await sql`
    SELECT
      t.id, t.matter_id, t.workflow_item_id, t.stage_key, t.title,
      t.description, t.status, t.priority, t.assignee_user_id, t.due_date,
      t.audience, t.position, t.completed_by, t.completed_at,
      t.created_at, t.updated_at,
      m.title AS matter_title,
      assignee.name AS assignee_name,
      creator.name AS created_by_name
    FROM engagement_tasks t
    JOIN matters m ON m.id = t.matter_id
    LEFT JOIN users assignee ON assignee.id = t.assignee_user_id
    LEFT JOIN users creator ON creator.id = t.created_by
    WHERE (
        ${global}
        OR EXISTS (
          SELECT 1
          FROM engagement_memberships em
          WHERE em.matter_id = t.matter_id
            AND em.user_id = ${context.userId}
            AND em.status = 'active'
            AND (em.expires_at IS NULL OR em.expires_at > NOW())
        )
      )
      AND (${matterId}::TEXT IS NULL OR t.matter_id = ${matterId})
      AND (${mine} = FALSE OR t.assignee_user_id = ${context.userId})
    ORDER BY t.status = 'completed', t.due_date ASC NULLS LAST, t.position, t.created_at DESC
    LIMIT 500
  `;
  const tasks = rows.filter((task) =>
    canReceiveAudience(context.role, String(task.audience) as ResourceAudience),
  );
  return NextResponse.json({ tasks });
}

export async function POST(request: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Task details are invalid", issues: parsed.error.issues }, { status: 400 });
  }
  const access = await getPortalAccessSummary(context);
  if (!(await authorizeCapability(context, access, "timeline.manage", { matterId: parsed.data.matterId }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canCreateWorkflowRecords(context.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (parsed.data.audience === "internal" && !hasCapability(access, "timeline.internal_view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await assertRequiredSchemaVersions();
  const sql = getDb();
  const matter = await sql`SELECT id, title FROM matters WHERE id = ${parsed.data.matterId} LIMIT 1`;
  if (matter.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (parsed.data.assigneeUserId) {
    const assignee = await sql`
      SELECT u.id
      FROM users u
      LEFT JOIN engagement_memberships em
        ON em.user_id = u.id
        AND em.matter_id = ${parsed.data.matterId}
        AND em.status = 'active'
      LEFT JOIN user_permission_assignments a ON a.user_id = u.id
      WHERE u.id = ${parsed.data.assigneeUserId}
        AND u.status = 'active'
        AND (
          u.role = 'super_admin'
          OR (u.role = 'admin' AND a.access_scope = 'global')
          OR em.id IS NOT NULL
        )
      LIMIT 1
    `;
    if (assignee.length === 0) {
      return NextResponse.json({ error: "Assignee does not have access to this engagement" }, { status: 400 });
    }
  }

  const id = crypto.randomUUID();
  const rows = await sql`
    INSERT INTO engagement_tasks (
      id, matter_id, stage_key, title, description, priority,
      assignee_user_id, due_date, audience, created_by
    )
    VALUES (
      ${id}, ${parsed.data.matterId}, ${parsed.data.stageKey ?? null},
      ${parsed.data.title}, ${parsed.data.description ?? null},
      ${parsed.data.priority}, ${parsed.data.assigneeUserId ?? null},
      ${parsed.data.dueDate ?? null}, ${parsed.data.audience}, ${context.userId}
    )
    RETURNING *
  `;
  await logMatterEvent({
    matterId: parsed.data.matterId,
    userId: context.userId,
    eventType: "task_created",
    content: `Task created: ${parsed.data.title}`,
    metadata: { taskId: id, assigneeUserId: parsed.data.assigneeUserId ?? null },
    visibility: parsed.data.audience,
  });
  if (parsed.data.assigneeUserId && parsed.data.assigneeUserId !== context.userId) {
    await notifyEngagementMembers({
      matterId: parsed.data.matterId,
      actorId: context.userId,
      audience: parsed.data.audience,
      eventType: "task_assigned",
      subject: `Task assigned · ${String(matter[0].title)}`,
      preview: parsed.data.title,
      path: `/portal/matters/${parsed.data.matterId}?section=work`,
    });
  }
  return NextResponse.json({ task: rows[0] }, { status: 201 });
}
