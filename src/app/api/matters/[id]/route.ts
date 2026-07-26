import { NextResponse } from "next/server";
import { getDb, ensureVaultTables, logMatterEvent, MatterStatus } from "@/lib/db";
import {
  authorizeCapability,
  canReceiveAudience,
  getPortalAccessSummary,
  hasCapability,
} from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";

const VALID_STATUSES: MatterStatus[] = [
  "intake", "assessment", "review", "vendor_evaluation", "oversight", "clearance", "closed",
];

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
  await ensureVaultTables();
  const sql = getDb();

  const [matter] = await sql`
    SELECT
      m.*,
      c.name  AS client_name,
      c.email AS client_email,
      c.phone AS client_phone,
      p.address AS property_address,
      p.city    AS property_city,
      p.state   AS property_state
    FROM matters m
    JOIN clients c ON c.id = m.client_id
    LEFT JOIN properties p ON p.id = m.property_id
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
  const body = await req.json();
  const { status, notes, title } = body;

  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  await ensureVaultTables();
  const sql = getDb();

  // Get current matter to detect status change
  const [current] = await sql`SELECT * FROM matters WHERE id = ${id}`;
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [matter] = await sql`
    UPDATE matters SET
      status     = COALESCE(${status || null}, status),
      notes      = COALESCE(${notes !== undefined ? notes : null}, notes),
      title      = COALESCE(${title?.trim() || null}, title),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

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
  }
  if (notes !== undefined && notes !== current.notes) {
    logMatterEvent({
      matterId: id,
      userId,
      eventType: "note_added",
      content: notes,
      visibility: "internal",
    });
  }

  return NextResponse.json({ matter });
}
