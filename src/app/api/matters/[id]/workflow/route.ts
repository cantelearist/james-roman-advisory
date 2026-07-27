import { NextResponse } from "next/server";
import { z } from "zod";

import {
  authorizeCapability,
  canReceiveAudience,
  getPortalAccessSummary,
} from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";
import { ensureEngagementOperationsTables, getDb, logMatterEvent } from "@/lib/db";
import type { ResourceAudience } from "@/lib/data-model";

export const runtime = "nodejs";

const createSchema = z.object({
  stageKey: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(240),
  itemType: z.enum(["requirement", "deliverable", "approval"]).default("requirement"),
  isRequired: z.boolean().default(true),
  assigneeUserId: z.string().min(1).nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
  position: z.number().int().min(0).max(10_000).default(0),
});

const updateSchema = z.object({
  itemId: z.string().uuid(),
  status: z.enum(["pending", "in_progress", "completed", "blocked", "waived"]),
  blockerReason: z.string().trim().max(2_000).nullable().optional(),
  evidenceDocumentId: z.string().uuid().nullable().optional(),
  overrideReason: z.string().trim().min(5).max(2_000).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const access = await getPortalAccessSummary(context);
  if (!(await authorizeCapability(context, access, "timeline.view", { matterId: id }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await ensureEngagementOperationsTables();
  const sql = getDb();
  const items = await sql`
    SELECT wi.*, assignee.name AS assignee_name, document.name AS evidence_document_name
    FROM engagement_workflow_items wi
    LEFT JOIN users assignee ON assignee.id = wi.assignee_user_id
    LEFT JOIN documents document ON document.id = wi.evidence_document_id
    WHERE wi.matter_id = ${id}
    ORDER BY wi.stage_key, wi.position, wi.created_at
  `;
  const tasks = await sql`
    SELECT t.*, assignee.name AS assignee_name
    FROM engagement_tasks t
    LEFT JOIN users assignee ON assignee.id = t.assignee_user_id
    WHERE t.matter_id = ${id}
    ORDER BY t.status = 'completed', t.due_date ASC NULLS LAST, t.position
  `;
  const visibleTasks = tasks.filter((task) =>
    canReceiveAudience(context.role, String(task.audience) as ResourceAudience),
  );
  return NextResponse.json({
    items: context.role === "client" ? [] : items,
    tasks: visibleTasks,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const access = await getPortalAccessSummary(context);
  if (!(await authorizeCapability(context, access, "timeline.manage", { matterId: id }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid workflow item", issues: parsed.error.issues }, { status: 400 });
  await ensureEngagementOperationsTables();
  const sql = getDb();
  const matter = await sql`SELECT id FROM matters WHERE id = ${id} LIMIT 1`;
  if (matter.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (parsed.data.assigneeUserId) {
    const assignees = await sql`
      SELECT u.id
      FROM users u
      LEFT JOIN engagement_memberships membership
        ON membership.user_id = u.id
        AND membership.matter_id = ${id}
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
  const rows = await sql`
    INSERT INTO engagement_workflow_items (
      id, matter_id, stage_key, title, item_type, is_required,
      assignee_user_id, due_date, position
    )
    VALUES (
      ${crypto.randomUUID()}, ${id}, ${parsed.data.stageKey}, ${parsed.data.title},
      ${parsed.data.itemType}, ${parsed.data.isRequired},
      ${parsed.data.assigneeUserId ?? null}, ${parsed.data.dueDate ?? null},
      ${parsed.data.position}
    )
    RETURNING *
  `;
  return NextResponse.json({ item: rows[0] }, { status: 201 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const access = await getPortalAccessSummary(context);
  if (!(await authorizeCapability(context, access, "timeline.manage", { matterId: id }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid workflow update" }, { status: 400 });
  if (parsed.data.status === "waived" && access.role !== "super_admin") {
    return NextResponse.json({ error: "Only Super Admin can waive a workflow requirement" }, { status: 403 });
  }
  if (parsed.data.status === "waived" && !parsed.data.overrideReason) {
    return NextResponse.json({ error: "An override reason is required" }, { status: 400 });
  }
  if (parsed.data.status === "blocked" && !parsed.data.blockerReason) {
    return NextResponse.json({ error: "A blocker reason is required" }, { status: 400 });
  }
  await ensureEngagementOperationsTables();
  const sql = getDb();
  const current = await sql`
    SELECT * FROM engagement_workflow_items
    WHERE id = ${parsed.data.itemId} AND matter_id = ${id}
    LIMIT 1
  `;
  if (current.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (parsed.data.evidenceDocumentId) {
    const document = await sql`
      SELECT id FROM documents
      WHERE id = ${parsed.data.evidenceDocumentId} AND matter_id = ${id}
      LIMIT 1
    `;
    if (document.length === 0) return NextResponse.json({ error: "Evidence document not found" }, { status: 400 });
  }
  const completed = parsed.data.status === "completed" || parsed.data.status === "waived";
  const rows = await sql`
    UPDATE engagement_workflow_items
    SET
      status = ${parsed.data.status},
      blocker_reason = ${parsed.data.status === "blocked" ? parsed.data.blockerReason ?? null : null},
      evidence_document_id = CASE
        WHEN ${parsed.data.evidenceDocumentId !== undefined} THEN ${parsed.data.evidenceDocumentId ?? null}
        ELSE evidence_document_id
      END,
      completed_by = ${completed ? context.userId : null},
      completed_at = ${completed ? new Date().toISOString() : null},
      approved_by = ${parsed.data.status === "waived" ? context.userId : null},
      approved_at = ${parsed.data.status === "waived" ? new Date().toISOString() : null},
      updated_at = NOW()
    WHERE id = ${parsed.data.itemId}
    RETURNING *
  `;
  if (completed) {
    await logMatterEvent({
      matterId: id,
      userId: context.userId,
      eventType: parsed.data.status === "waived" ? "workflow_override" : "workflow_completed",
      content: parsed.data.status === "waived"
        ? `Workflow requirement waived: ${String(rows[0].title)}`
        : `Workflow requirement completed: ${String(rows[0].title)}`,
      metadata: {
        workflowItemId: parsed.data.itemId,
        overrideReason: parsed.data.overrideReason ?? null,
      },
      visibility: "internal",
    });
  }
  return NextResponse.json({ item: rows[0] });
}
