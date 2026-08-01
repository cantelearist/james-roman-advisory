import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, logMatterEvent } from "@/lib/db";
import {
  authorizeCapability,
  getPortalAccessSummary,
  hasCapability,
} from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";
import { parseEngagementBoardQuery } from "@/lib/engagement-board";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";

const createMatterSchema = z.object({
  clientId: z.string().trim().min(1),
  propertyId: z.string().trim().min(1).nullable().optional(),
  title: z.string().trim().min(1).max(240),
  type: z.enum(["mold", "smoke_damage", "asbestos", "lead_paint", "water_intrusion", "transaction_review", "other"]).default("other"),
  notes: z.string().trim().max(20_000).nullable().optional(),
});

export async function GET(req: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId, role } = context;
  const access = await getPortalAccessSummary(context);
  if (!hasCapability(access, "engagements.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");
  const clientId = searchParams.get("client_id");
  const priority = searchParams.get("priority");
  const health = searchParams.get("health");
  const ownerId = searchParams.get("owner_id");
  const search = searchParams.get("q")?.trim() || null;
  const searchPattern = search ? `%${search.slice(0, 120)}%` : null;
  const { sort, direction, limit, offset, page } = parseEngagementBoardQuery(searchParams);
  const fetchLimit = limit + 1;
  const canPublishDocuments = hasCapability(access, "documents.publish");
  const canViewDocuments = hasCapability(access, "documents.view");
  const canViewTasks = hasCapability(access, "timeline.view");
  const canViewMessages = hasCapability(access, "messages.view");
  const canViewFinance = hasCapability(access, "finance.view");

  await assertRequiredSchemaVersions();
  const sql = getDb();

  let matters;
  if (role === "super_admin" || (role === "admin" && access.scope === "global")) {
    // Global operators: all engagements, with optional staff filters.
    matters = await sql`
      SELECT
        m.*,
        c.name  AS client_name,
        c.email AS client_email,
        p.address AS property_address,
        p.city    AS property_city,
        p.state   AS property_state,
        owner.name AS owner_name,
        (SELECT COUNT(*) FROM documents d WHERE ${canViewDocuments} AND d.matter_id = m.id)::int AS document_count,
        (SELECT COUNT(*) FROM documents d WHERE d.matter_id = m.id
          AND ${canPublishDocuments}
          AND d.publication_status = 'pending_review')::int AS pending_document_count,
        (SELECT COUNT(*) FROM engagement_tasks t WHERE t.matter_id = m.id
          AND ${canViewTasks}
          AND t.status NOT IN ('completed', 'cancelled'))::int AS open_task_count,
        (SELECT COUNT(*) FROM engagement_messages msg
          WHERE msg.matter_id = m.id
            AND ${canViewMessages}
            AND msg.sender_id <> ${userId}
            AND NOT EXISTS (
              SELECT 1 FROM message_read_receipts receipt
              WHERE receipt.message_id = msg.id AND receipt.user_id = ${userId}
            ))::int AS unread_message_count,
        (SELECT COALESCE(SUM(i.total_cents), 0) FROM invoices i WHERE ${canViewFinance}
          AND i.matter_id = m.id
          AND i.status IN ('issued', 'processing', 'overdue'))::bigint AS invoice_balance_cents
      FROM matters m
      JOIN clients c ON c.id = m.client_id
      LEFT JOIN properties p ON p.id = m.property_id
      LEFT JOIN users owner ON owner.id = m.owner_user_id
      WHERE
        (${statusFilter}::TEXT IS NULL OR m.status = ${statusFilter})
        AND (${clientId}::TEXT IS NULL OR m.client_id = ${clientId})
        AND (${priority}::TEXT IS NULL OR m.priority = ${priority})
        AND (${health}::TEXT IS NULL OR m.health = ${health})
        AND (${ownerId}::TEXT IS NULL OR m.owner_user_id = ${ownerId})
        AND (
          ${searchPattern}::TEXT IS NULL
          OR m.title ILIKE ${searchPattern}
          OR c.name ILIKE ${searchPattern}
          OR COALESCE(p.address, '') ILIKE ${searchPattern}
        )
      ORDER BY
        CASE WHEN ${sort}::TEXT = 'title' AND ${direction}::TEXT = 'asc' THEN LOWER(m.title) END ASC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'title' AND ${direction}::TEXT = 'desc' THEN LOWER(m.title) END DESC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'client' AND ${direction}::TEXT = 'asc' THEN LOWER(c.name) END ASC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'client' AND ${direction}::TEXT = 'desc' THEN LOWER(c.name) END DESC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'status' AND ${direction}::TEXT = 'asc' THEN
          CASE m.status WHEN 'intake' THEN 1 WHEN 'assessment' THEN 2 WHEN 'review' THEN 3 WHEN 'vendor_evaluation' THEN 4 WHEN 'oversight' THEN 5 WHEN 'clearance' THEN 6 WHEN 'closed' THEN 7 ELSE 8 END
        END ASC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'status' AND ${direction}::TEXT = 'desc' THEN
          CASE m.status WHEN 'intake' THEN 1 WHEN 'assessment' THEN 2 WHEN 'review' THEN 3 WHEN 'vendor_evaluation' THEN 4 WHEN 'oversight' THEN 5 WHEN 'clearance' THEN 6 WHEN 'closed' THEN 7 ELSE 8 END
        END DESC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'owner' AND ${direction}::TEXT = 'asc' THEN LOWER(owner.name) END ASC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'owner' AND ${direction}::TEXT = 'desc' THEN LOWER(owner.name) END DESC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'priority' AND ${direction}::TEXT = 'asc' THEN
          CASE m.priority WHEN 'low' THEN 1 WHEN 'normal' THEN 2 WHEN 'high' THEN 3 WHEN 'urgent' THEN 4 ELSE 5 END
        END ASC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'priority' AND ${direction}::TEXT = 'desc' THEN
          CASE m.priority WHEN 'low' THEN 1 WHEN 'normal' THEN 2 WHEN 'high' THEN 3 WHEN 'urgent' THEN 4 ELSE 5 END
        END DESC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'health' AND ${direction}::TEXT = 'asc' THEN
          CASE m.health WHEN 'on_track' THEN 1 WHEN 'at_risk' THEN 2 WHEN 'blocked' THEN 3 ELSE 4 END
        END ASC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'health' AND ${direction}::TEXT = 'desc' THEN
          CASE m.health WHEN 'on_track' THEN 1 WHEN 'at_risk' THEN 2 WHEN 'blocked' THEN 3 ELSE 4 END
        END DESC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'due_date' AND ${direction}::TEXT = 'asc' THEN m.due_date END ASC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'due_date' AND ${direction}::TEXT = 'desc' THEN m.due_date END DESC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'next_action_due_at' AND ${direction}::TEXT = 'asc' THEN m.next_action_due_at END ASC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'next_action_due_at' AND ${direction}::TEXT = 'desc' THEN m.next_action_due_at END DESC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'updated_at' AND ${direction}::TEXT = 'asc' THEN m.updated_at END ASC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'updated_at' AND ${direction}::TEXT = 'desc' THEN m.updated_at END DESC NULLS LAST,
        m.updated_at DESC,
        m.id ASC
      LIMIT ${fetchLimit} OFFSET ${offset}
    `;
  } else {
    // Assigned admins, contractors, and clients: active memberships only.
    matters = await sql`
      SELECT
        m.*,
        c.name AS client_name,
        p.address AS property_address,
        p.city    AS property_city,
        p.state   AS property_state,
        owner.name AS owner_name,
        (SELECT COUNT(*) FROM documents d
          WHERE ${canViewDocuments}
            AND d.matter_id = m.id
            AND (
              ${role} IN ('super_admin', 'admin')
              OR (${role} = 'contractor' AND (
                d.visibility = 'contractor'
                OR (d.visibility = 'client' AND d.publication_status = 'published')
              ))
              OR (${role} = 'client' AND d.visibility = 'client' AND d.publication_status = 'published')
            ))::int AS document_count,
        (SELECT COUNT(*) FROM documents d WHERE d.matter_id = m.id
          AND ${canPublishDocuments}
          AND d.publication_status = 'pending_review')::int AS pending_document_count,
        (SELECT COUNT(*) FROM engagement_tasks t WHERE t.matter_id = m.id
          AND ${canViewTasks}
          AND (
            ${role} IN ('super_admin', 'admin')
            OR (${role} = 'contractor' AND t.audience IN ('contractor', 'client'))
            OR (${role} = 'client' AND t.audience = 'client')
          )
          AND t.status NOT IN ('completed', 'cancelled'))::int AS open_task_count,
        (SELECT COUNT(*) FROM engagement_messages msg
          WHERE msg.matter_id = m.id
            AND ${canViewMessages}
            AND msg.sender_id <> ${userId}
            AND (
              ${role} IN ('super_admin', 'admin')
              OR (${role} = 'contractor' AND msg.audience IN ('contractor', 'client'))
              OR (${role} = 'client' AND msg.audience = 'client')
            )
            AND NOT EXISTS (
              SELECT 1 FROM message_read_receipts receipt
              WHERE receipt.message_id = msg.id AND receipt.user_id = ${userId}
            ))::int AS unread_message_count,
        (SELECT COALESCE(SUM(i.total_cents), 0) FROM invoices i WHERE ${canViewFinance}
          AND i.matter_id = m.id
          AND i.status IN ('issued', 'processing', 'overdue'))::bigint AS invoice_balance_cents
      FROM matters m
      JOIN engagement_memberships em
        ON em.matter_id = m.id
        AND em.user_id = ${userId}
        AND em.status = 'active'
        AND (em.expires_at IS NULL OR em.expires_at > NOW())
      JOIN clients c ON c.id = m.client_id
      LEFT JOIN properties p ON p.id = m.property_id
      LEFT JOIN users owner ON owner.id = m.owner_user_id
      WHERE
        (${statusFilter}::TEXT IS NULL OR m.status = ${statusFilter})
        AND (${clientId}::TEXT IS NULL OR m.client_id = ${clientId})
        AND (${priority}::TEXT IS NULL OR m.priority = ${priority})
        AND (${health}::TEXT IS NULL OR m.health = ${health})
        AND (${ownerId}::TEXT IS NULL OR m.owner_user_id = ${ownerId})
        AND (
          ${searchPattern}::TEXT IS NULL
          OR m.title ILIKE ${searchPattern}
          OR c.name ILIKE ${searchPattern}
          OR COALESCE(p.address, '') ILIKE ${searchPattern}
        )
      ORDER BY
        CASE WHEN ${sort}::TEXT = 'title' AND ${direction}::TEXT = 'asc' THEN LOWER(m.title) END ASC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'title' AND ${direction}::TEXT = 'desc' THEN LOWER(m.title) END DESC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'client' AND ${direction}::TEXT = 'asc' THEN LOWER(c.name) END ASC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'client' AND ${direction}::TEXT = 'desc' THEN LOWER(c.name) END DESC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'status' AND ${direction}::TEXT = 'asc' THEN
          CASE m.status WHEN 'intake' THEN 1 WHEN 'assessment' THEN 2 WHEN 'review' THEN 3 WHEN 'vendor_evaluation' THEN 4 WHEN 'oversight' THEN 5 WHEN 'clearance' THEN 6 WHEN 'closed' THEN 7 ELSE 8 END
        END ASC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'status' AND ${direction}::TEXT = 'desc' THEN
          CASE m.status WHEN 'intake' THEN 1 WHEN 'assessment' THEN 2 WHEN 'review' THEN 3 WHEN 'vendor_evaluation' THEN 4 WHEN 'oversight' THEN 5 WHEN 'clearance' THEN 6 WHEN 'closed' THEN 7 ELSE 8 END
        END DESC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'owner' AND ${direction}::TEXT = 'asc' THEN LOWER(owner.name) END ASC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'owner' AND ${direction}::TEXT = 'desc' THEN LOWER(owner.name) END DESC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'priority' AND ${direction}::TEXT = 'asc' THEN
          CASE m.priority WHEN 'low' THEN 1 WHEN 'normal' THEN 2 WHEN 'high' THEN 3 WHEN 'urgent' THEN 4 ELSE 5 END
        END ASC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'priority' AND ${direction}::TEXT = 'desc' THEN
          CASE m.priority WHEN 'low' THEN 1 WHEN 'normal' THEN 2 WHEN 'high' THEN 3 WHEN 'urgent' THEN 4 ELSE 5 END
        END DESC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'health' AND ${direction}::TEXT = 'asc' THEN
          CASE m.health WHEN 'on_track' THEN 1 WHEN 'at_risk' THEN 2 WHEN 'blocked' THEN 3 ELSE 4 END
        END ASC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'health' AND ${direction}::TEXT = 'desc' THEN
          CASE m.health WHEN 'on_track' THEN 1 WHEN 'at_risk' THEN 2 WHEN 'blocked' THEN 3 ELSE 4 END
        END DESC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'due_date' AND ${direction}::TEXT = 'asc' THEN m.due_date END ASC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'due_date' AND ${direction}::TEXT = 'desc' THEN m.due_date END DESC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'next_action_due_at' AND ${direction}::TEXT = 'asc' THEN m.next_action_due_at END ASC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'next_action_due_at' AND ${direction}::TEXT = 'desc' THEN m.next_action_due_at END DESC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'updated_at' AND ${direction}::TEXT = 'asc' THEN m.updated_at END ASC NULLS LAST,
        CASE WHEN ${sort}::TEXT = 'updated_at' AND ${direction}::TEXT = 'desc' THEN m.updated_at END DESC NULLS LAST,
        m.updated_at DESC,
        m.id ASC
      LIMIT ${fetchLimit} OFFSET ${offset}
    `;
  }

  const hasMore = matters.length > limit;
  const pageMatters = matters.slice(0, limit);
  const visibleMatters = hasCapability(access, "clients.view")
    ? pageMatters
    : pageMatters.map((matter) => {
        const result = { ...matter };
        delete result.client_email;
        return result;
      });
  return NextResponse.json({
    matters: visibleMatters,
    page: { number: page, limit, offset, hasMore },
  });
}

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId, role } = context;
  const access = await getPortalAccessSummary(context);
  if (!(await authorizeCapability(context, access, "engagements.create"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createMatterSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Engagement details are invalid", issues: parsed.error.issues }, { status: 400 });
  }
  const { clientId, propertyId, title, type, notes } = parsed.data;
  if (
    access.scope === "assigned"
    && !(await authorizeCapability(context, access, "engagements.create", { clientId }))
  ) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  await assertRequiredSchemaVersions();
  const sql = getDb();
  const clients = await sql`SELECT id FROM clients WHERE id = ${clientId} LIMIT 1`;
  if (clients.length === 0) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (propertyId) {
    const properties = await sql`
      SELECT id FROM properties
      WHERE id = ${propertyId} AND client_id = ${clientId}
      LIMIT 1
    `;
    if (properties.length === 0) {
      return NextResponse.json({ error: "Property does not belong to this client" }, { status: 400 });
    }
  }
  const id = crypto.randomUUID();

  const [matter] = await sql`
    INSERT INTO matters (id, client_id, property_id, title, type, status, notes, created_by)
    VALUES (
      ${id},
      ${clientId},
      ${propertyId || null},
      ${title.trim()},
      ${type || "other"},
      'intake',
      ${notes?.trim() || null},
      ${userId}
    )
    RETURNING *
  `;
  if (access.scope === "assigned" && role !== "client") {
    await sql`
      INSERT INTO engagement_memberships (
        matter_id,
        user_id,
        member_role,
        assigned_by
      )
      VALUES (${matter.id}, ${userId}, ${role}, ${userId})
      ON CONFLICT (matter_id, user_id) DO NOTHING
    `;
  }

  // Fire-and-forget: log creation event
  logMatterEvent({
    matterId: matter.id,
    userId,
    eventType: "created",
    content: `Matter created: ${title.trim()}`,
    metadata: { type, status: "intake" },
    visibility: "client",
  });

  return NextResponse.json({ matter }, { status: 201 });
}
