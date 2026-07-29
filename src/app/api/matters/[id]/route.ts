import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, logMatterEvent, MatterStatus } from "@/lib/db";
import {
  authorizeCapability,
  canReceiveAudience,
  getPortalAccessSummary,
  hasCapability,
} from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";
import { triggerPortalAutomations } from "@/lib/automations";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";

const VALID_STATUSES: MatterStatus[] = [
  "intake", "assessment", "review", "vendor_evaluation", "oversight", "clearance", "closed",
];
const updateSchema = z.object({
  status: z.enum(["intake", "assessment", "review", "vendor_evaluation", "oversight", "clearance", "closed"]).optional(),
  notes: z.string().max(20_000).nullable().optional(),
  title: z.string().trim().min(1).max(240).optional(),
  ownerUserId: z.string().min(1).nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  health: z.enum(["on_track", "at_risk", "blocked"]).optional(),
  startDate: z.string().date().nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
  nextAction: z.string().trim().max(500).nullable().optional(),
  nextActionDueAt: z.string().trim().max(40).nullable().optional(),
  version: z.number().int().min(1).optional(),
  overrideReason: z.string().trim().min(5).max(2_000).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role } = context;

  const { id } = await params;
  const access = await getPortalAccessSummary(context);
  if (!(await authorizeCapability(context, access, "engagements.view", { matterId: id }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await assertRequiredSchemaVersions();
  const sql = getDb();

  const [matter] = await sql`
    SELECT
      m.*,
      c.name  AS client_name,
      c.email AS client_email,
      c.phone AS client_phone,
      p.address AS property_address,
      p.city    AS property_city,
      p.state   AS property_state,
      owner.name AS owner_name
    FROM matters m
    JOIN clients c ON c.id = m.client_id
    LEFT JOIN properties p ON p.id = m.property_id
    LEFT JOIN users owner ON owner.id = m.owner_user_id
    WHERE m.id = ${id}
  `;
  if (!matter) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch events
  const eventRows = await sql`
    SELECT * FROM matter_events WHERE matter_id = ${id} ORDER BY created_at ASC
  `;
  const canViewInternalTimeline = hasCapability(access, "timeline.internal_view");
  const visibleEventRows = eventRows.filter((event) => {
    const visibility = String(event.visibility ?? "internal") as "internal" | "contractor" | "client";
    if (visibility === "internal") return canViewInternalTimeline;
    return canReceiveAudience(role, visibility);
  });
  const events = role === "client" || role === "contractor"
    ? visibleEventRows.map((event) => {
        const result = { ...event };
        delete result.user_id;
        return result;
      })
    : visibleEventRows;

  // Fetch linked documents
  const documentRows = hasCapability(access, "documents.view")
    ? await sql`
    SELECT
      id,
      name,
      original_name,
      category,
      size_bytes,
      content_type,
      visibility,
      publication_status,
      created_at
    FROM documents WHERE matter_id = ${id} ORDER BY created_at DESC
  `
    : [];
  const documents = documentRows.filter((document) =>
    canReceiveAudience(
      role,
      String(document.visibility ?? "internal") as "internal" | "contractor" | "client",
      document.publication_status === "pending_review" ? "pending_review" : "published",
    ),
  );

  const canViewClientContact = role === "client" || hasCapability(access, "clients.view");
  const visibleMatter = {
    ...matter,
    notes: canViewInternalTimeline ? matter.notes : null,
    client_email: canViewClientContact ? matter.client_email : null,
    client_phone: canViewClientContact ? matter.client_phone : null,
  };

  return NextResponse.json({ matter: visibleMatter, events, documents });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = context;

  const { id } = await params;
  const access = await getPortalAccessSummary(context);
  if (!(await authorizeCapability(context, access, "engagements.update", { matterId: id }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Engagement update is invalid", issues: parsed.error.issues }, { status: 400 });
  }
  const {
    status,
    notes,
    title,
    ownerUserId,
    priority,
    health,
    startDate,
    dueDate,
    nextAction,
    nextActionDueAt,
    version,
    overrideReason,
  } = parsed.data;

  await assertRequiredSchemaVersions();
  const sql = getDb();

  // Get current matter to detect status change
  const [current] = await sql`SELECT * FROM matters WHERE id = ${id}`;
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (ownerUserId) {
    const owner = await sql`
      SELECT u.id
      FROM users u
      LEFT JOIN engagement_memberships em
        ON em.user_id = u.id
        AND em.matter_id = ${id}
        AND em.status = 'active'
      LEFT JOIN user_permission_assignments assignment ON assignment.user_id = u.id
      WHERE u.id = ${ownerUserId}
        AND u.status = 'active'
        AND (
          u.role = 'super_admin'
          OR (u.role = 'admin' AND assignment.access_scope = 'global')
          OR em.id IS NOT NULL
        )
      LIMIT 1
    `;
    if (owner.length === 0) {
      return NextResponse.json({ error: "Owner does not have access to this engagement" }, { status: 400 });
    }
  }

  const currentIndex = VALID_STATUSES.indexOf(current.status as MatterStatus);
  const nextIndex = status ? VALID_STATUSES.indexOf(status) : currentIndex;
  const settingsRows = await sql`SELECT value FROM portal_settings WHERE key = 'workspace' LIMIT 1`;
  const workspaceSettings = settingsRows[0]?.value && typeof settingsRows[0].value === "object"
    ? settingsRows[0].value as Record<string, unknown>
    : {};
  const requireWorkflowGates = workspaceSettings.requireWorkflowGates !== false;
  if (status && nextIndex > currentIndex && requireWorkflowGates) {
    const normalizedOverrideReason = typeof overrideReason === "string"
      ? overrideReason.trim()
      : "";
    const incomplete = await sql`
      SELECT id, title, status
      FROM engagement_workflow_items
      WHERE matter_id = ${id}
        AND stage_key = ${String(current.status)}
        AND is_required = TRUE
        AND status NOT IN ('completed', 'waived')
      ORDER BY position, created_at
    `;
    if (incomplete.length > 0 && !(context.role === "super_admin" && normalizedOverrideReason.length >= 5)) {
      return NextResponse.json({
        error: "Complete or resolve the required workflow items before advancing this engagement.",
        blockers: incomplete,
        overrideAvailable: context.role === "super_admin",
      }, { status: 409 });
    }
    if (incomplete.length > 0) {
      await logMatterEvent({
        matterId: id,
        userId,
        eventType: "workflow_override",
        content: `Workflow gate overridden before advancing to ${status}`,
        metadata: {
          from: current.status,
          to: status,
          reason: normalizedOverrideReason,
          incompleteItemIds: incomplete.map((item) => item.id),
        },
        visibility: "internal",
      });
    }
  }

  const rows = await sql`
    UPDATE matters SET
      status     = COALESCE(${status || null}, status),
      notes      = COALESCE(${notes !== undefined ? notes : null}, notes),
      title      = COALESCE(${title?.trim() || null}, title),
      owner_user_id = CASE WHEN ${ownerUserId !== undefined} THEN ${ownerUserId || null} ELSE owner_user_id END,
      priority = COALESCE(${priority || null}, priority),
      health = COALESCE(${health || null}, health),
      start_date = CASE WHEN ${startDate !== undefined} THEN ${startDate || null} ELSE start_date END,
      due_date = CASE WHEN ${dueDate !== undefined} THEN ${dueDate || null} ELSE due_date END,
      next_action = CASE WHEN ${nextAction !== undefined} THEN ${nextAction?.trim() || null} ELSE next_action END,
      next_action_due_at = CASE WHEN ${nextActionDueAt !== undefined} THEN ${nextActionDueAt || null} ELSE next_action_due_at END,
      version = version + 1,
      updated_at = NOW()
    WHERE id = ${id}
      AND (${version ?? null}::INTEGER IS NULL OR version = ${version ?? null})
    RETURNING *
  `;
  const matter = rows[0];
  if (!matter) {
    return NextResponse.json({
      error: "This engagement changed while you were editing it. Refresh before saving again.",
      code: "version_conflict",
    }, { status: 409 });
  }

  // Log events
  if (status && status !== current.status) {
    logMatterEvent({
      matterId: id,
      userId,
      eventType: "status_changed",
      content: `Status changed from ${current.status} to ${status}`,
      metadata: { from: current.status, to: status },
      visibility: "client",
    });
    if (nextIndex > currentIndex) {
      await triggerPortalAutomations({
        triggerType: "stage_advanced",
        matterId: id,
        actorId: userId,
        sourceId: `${String(matter.version)}:${status}`,
        title: `Review stage transition · ${status.replaceAll("_", " ")}`,
        detail: `Confirm ownership, next action and deadlines after advancing from ${String(current.status)}.`,
        stageKey: status,
      });
    }
  }
  if (notes !== undefined && notes !== current.notes) {
    logMatterEvent({
      matterId: id,
      userId,
      eventType: "note_added",
      content: notes ?? undefined,
      visibility: "internal",
    });
  }

  return NextResponse.json({ matter });
}
