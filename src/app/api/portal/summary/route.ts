import { NextResponse } from "next/server";

import {
  getPortalAccessSummary,
  hasCapability,
} from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";
import { ensureEngagementOperationsTables, getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = await getPortalAccessSummary(context);
  await ensureEngagementOperationsTables();
  const sql = getDb();
  const global = context.role === "super_admin"
    || (context.role === "admin" && access.scope === "global");
  const canViewTasks = hasCapability(access, "timeline.view");

  const matters = hasCapability(access, "engagements.view")
    ? await sql`
        SELECT DISTINCT m.id, m.title, m.status, m.priority, m.health, m.due_date,
          m.next_action, m.next_action_due_at, m.updated_at, c.name AS client_name,
          p.address AS property_address,
          owner.name AS owner_name,
          (SELECT COUNT(*) FROM engagement_tasks t
            WHERE ${canViewTasks}
              AND t.matter_id = m.id
              AND (
                ${context.role} IN ('super_admin', 'admin')
                OR (${context.role} = 'contractor' AND t.audience IN ('contractor', 'client'))
                OR (${context.role} = 'client' AND t.audience = 'client')
              )
              AND t.status NOT IN ('completed', 'cancelled'))::int AS open_tasks
        FROM matters m
        JOIN clients c ON c.id = m.client_id
        LEFT JOIN properties p ON p.id = m.property_id
        LEFT JOIN users owner ON owner.id = m.owner_user_id
        LEFT JOIN engagement_memberships em
          ON em.matter_id = m.id
          AND em.user_id = ${context.userId}
          AND em.status = 'active'
          AND (em.expires_at IS NULL OR em.expires_at > NOW())
        WHERE (${global} OR em.id IS NOT NULL)
        ORDER BY m.updated_at DESC
      `
    : [];

  const tasks = hasCapability(access, "timeline.view")
    ? await sql`
        SELECT DISTINCT t.id, t.matter_id, t.title, t.status, t.priority, t.due_date,
          m.title AS matter_title, assignee.name AS assignee_name
        FROM engagement_tasks t
        JOIN matters m ON m.id = t.matter_id
        LEFT JOIN users assignee ON assignee.id = t.assignee_user_id
        LEFT JOIN engagement_memberships em
          ON em.matter_id = t.matter_id
          AND em.user_id = ${context.userId}
          AND em.status = 'active'
          AND (em.expires_at IS NULL OR em.expires_at > NOW())
        WHERE (${global} OR em.id IS NOT NULL)
          AND t.status NOT IN ('completed', 'cancelled')
          AND (
            t.assignee_user_id = ${context.userId}
            OR ${context.role} IN ('super_admin', 'admin')
          )
        ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC
        LIMIT 20
      `
    : [];

  const notificationRows = await sql`
    SELECT COUNT(*)::int AS count
    FROM portal_notifications
    WHERE user_id = ${context.userId}
      AND read_at IS NULL
  `;
  const pendingDocuments = hasCapability(access, "documents.publish")
    ? await sql`
        SELECT COUNT(DISTINCT d.id)::int AS count
        FROM documents d
        LEFT JOIN engagement_memberships em
          ON em.matter_id = d.matter_id
          AND em.user_id = ${context.userId}
          AND em.status = 'active'
        WHERE d.publication_status = 'pending_review'
          AND (${global} OR em.id IS NOT NULL)
      `
    : [{ count: 0 }];
  const finance = hasCapability(access, "finance.view")
    ? await sql`
        SELECT
          COUNT(*) FILTER (WHERE i.status = 'draft')::int AS drafts,
          COUNT(*) FILTER (WHERE i.status = 'overdue'
            OR (i.status = 'issued' AND i.due_date < CURRENT_DATE))::int AS overdue,
          COALESCE(SUM(i.total_cents) FILTER (
            WHERE i.status IN ('issued', 'processing', 'overdue')
          ), 0)::bigint AS outstanding_cents
        FROM invoices i
        LEFT JOIN engagement_memberships em
          ON em.matter_id = i.matter_id
          AND em.user_id = ${context.userId}
          AND em.status = 'active'
        WHERE (${global} OR em.id IS NOT NULL)
      `
    : [{ drafts: 0, overdue: 0, outstanding_cents: 0 }];

  return NextResponse.json({
    matters,
    tasks,
    metrics: {
      activeEngagements: matters.filter((matter) => matter.status !== "closed").length,
      atRiskEngagements: matters.filter((matter) => matter.health === "at_risk" || matter.health === "blocked").length,
      overdueTasks: tasks.filter((task) =>
        task.due_date && new Date(String(task.due_date)).getTime() < Date.now(),
      ).length,
      unreadNotifications: Number(notificationRows[0]?.count ?? 0),
      pendingDocuments: Number(pendingDocuments[0]?.count ?? 0),
      draftInvoices: Number(finance[0]?.drafts ?? 0),
      overdueInvoices: Number(finance[0]?.overdue ?? 0),
      outstandingCents: Number(finance[0]?.outstanding_cents ?? 0),
    },
  });
}
