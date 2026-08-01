import { NextResponse } from "next/server";
import { z } from "zod";

import {
  authorizeCapability,
  getPortalAccessSummary,
  hasCapability,
} from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";
import { getDb, logMatterEvent } from "@/lib/db";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";
import {
  canUpdateWorkflowRecord,
  isContractorTaskStatusPatch,
} from "@/lib/workflow-authority";

export const runtime = "nodejs";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(240).optional(),
  description: z.string().trim().max(5_000).nullable().optional(),
  status: z.enum(["open", "in_progress", "completed", "cancelled"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assigneeUserId: z.string().min(1).nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
  audience: z.enum(["internal", "contractor", "client"]).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid task update" }, { status: 400 });
  await assertRequiredSchemaVersions();
  const sql = getDb();
  const currentRows = await sql`SELECT * FROM engagement_tasks WHERE id = ${id} LIMIT 1`;
  const current = currentRows[0];
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await getPortalAccessSummary(context);
  if (!(await authorizeCapability(context, access, "timeline.manage", { matterId: String(current.matter_id) }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canUpdateWorkflowRecord({
    role: context.role,
    userId: context.userId,
    assigneeUserId: current.assignee_user_id ? String(current.assignee_user_id) : null,
  })) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (context.role === "contractor" && !isContractorTaskStatusPatch(parsed.data)) {
    return NextResponse.json({ error: "Contractors may update only the status of assigned work" }, { status: 403 });
  }
  if (parsed.data.audience === "internal" && !hasCapability(access, "timeline.internal_view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (parsed.data.assigneeUserId) {
    const assignees = await sql`
      SELECT u.id
      FROM users u
      LEFT JOIN engagement_memberships membership
        ON membership.user_id = u.id
        AND membership.matter_id = ${String(current.matter_id)}
        AND membership.status = 'active'
        AND (membership.expires_at IS NULL OR membership.expires_at > NOW())
      LEFT JOIN user_permission_assignments assignment ON assignment.user_id = u.id
      WHERE u.id = ${parsed.data.assigneeUserId}
        AND u.status = 'active'
        AND (
          u.role = 'super_admin'
          OR (u.role = 'admin' AND assignment.access_scope = 'global')
          OR membership.id IS NOT NULL
        )
      LIMIT 1
    `;
    if (assignees.length === 0) {
      return NextResponse.json({ error: "Assignee does not have access to this engagement" }, { status: 400 });
    }
  }
  const completed = parsed.data.status === "completed";
  const reopened = parsed.data.status && parsed.data.status !== "completed";
  const rows = await sql`
    UPDATE engagement_tasks
    SET
      title = COALESCE(${parsed.data.title ?? null}, title),
      description = CASE
        WHEN ${parsed.data.description !== undefined} THEN ${parsed.data.description ?? null}
        ELSE description
      END,
      status = COALESCE(${parsed.data.status ?? null}, status),
      priority = COALESCE(${parsed.data.priority ?? null}, priority),
      assignee_user_id = CASE
        WHEN ${parsed.data.assigneeUserId !== undefined} THEN ${parsed.data.assigneeUserId ?? null}
        ELSE assignee_user_id
      END,
      due_date = CASE
        WHEN ${parsed.data.dueDate !== undefined} THEN ${parsed.data.dueDate ?? null}
        ELSE due_date
      END,
      audience = COALESCE(${parsed.data.audience ?? null}, audience),
      completed_by = CASE WHEN ${completed} THEN ${context.userId} WHEN ${Boolean(reopened)} THEN NULL ELSE completed_by END,
      completed_at = CASE WHEN ${completed} THEN NOW() WHEN ${Boolean(reopened)} THEN NULL ELSE completed_at END,
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  if (completed && current.status !== "completed") {
    await logMatterEvent({
      matterId: String(current.matter_id),
      userId: context.userId,
      eventType: "task_completed",
      content: `Task completed: ${String(rows[0].title)}`,
      metadata: { taskId: id },
      visibility: String(rows[0].audience) as "internal" | "contractor" | "client",
    });
  }
  return NextResponse.json({ task: rows[0] });
}
