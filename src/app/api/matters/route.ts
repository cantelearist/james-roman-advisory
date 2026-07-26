import { NextResponse } from "next/server";
import { getDb, ensureVaultTables, logMatterEvent } from "@/lib/db";
import {
  authorizeCapability,
  getPortalAccessSummary,
  hasCapability,
} from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";

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

  await ensureVaultTables();
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
        (SELECT COUNT(*) FROM documents d WHERE d.matter_id = m.id)::int AS document_count
      FROM matters m
      JOIN clients c ON c.id = m.client_id
      LEFT JOIN properties p ON p.id = m.property_id
      WHERE
        (${statusFilter}::TEXT IS NULL OR m.status = ${statusFilter})
        AND (${clientId}::TEXT IS NULL OR m.client_id = ${clientId})
      ORDER BY m.updated_at DESC
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
        (SELECT COUNT(*) FROM documents d WHERE d.matter_id = m.id)::int AS document_count
      FROM matters m
      JOIN engagement_memberships em
        ON em.matter_id = m.id
        AND em.user_id = ${userId}
        AND em.status = 'active'
        AND (em.expires_at IS NULL OR em.expires_at > NOW())
      JOIN clients c ON c.id = m.client_id
      LEFT JOIN properties p ON p.id = m.property_id
      WHERE
        (${statusFilter}::TEXT IS NULL OR m.status = ${statusFilter})
        AND (${clientId}::TEXT IS NULL OR m.client_id = ${clientId})
      ORDER BY m.updated_at DESC
    `;
  }

  const visibleMatters = hasCapability(access, "clients.view")
    ? matters
    : matters.map((matter) => {
        const result = { ...matter };
        delete result.client_email;
        return result;
      });
  return NextResponse.json({ matters: visibleMatters });
}

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId, role } = context;
  const access = await getPortalAccessSummary(context);
  if (!(await authorizeCapability(context, access, "engagements.create"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { clientId, propertyId, title, type, notes } = body;

  if (!clientId?.trim()) return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  if (!title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (
    access.scope === "assigned"
    && !(await authorizeCapability(context, access, "engagements.create", { clientId }))
  ) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  await ensureVaultTables();
  const sql = getDb();
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
