import { NextResponse } from "next/server";
import { getDb, ensureVaultTables, logMatterEvent, MatterStatus } from "@/lib/db";
import { getAuthContext, isStaff } from "@/lib/auth";

const VALID_STATUSES: MatterStatus[] = [
  "intake", "assessment", "review", "vendor_evaluation", "oversight", "clearance", "closed",
];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId, role } = context;

  const { id } = await params;
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

  // Clients can only see their own matter
  if (!isStaff(role)) {
    const [client] = await sql`SELECT user_id FROM clients WHERE id = ${matter.client_id}`;
    if (!client || client.user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Fetch events
  const events = await sql`
    SELECT * FROM matter_events WHERE matter_id = ${id} ORDER BY created_at ASC
  `;

  // Fetch linked documents
  const documents = await sql`
    SELECT id, name, original_name, category, size_bytes, content_type, created_at
    FROM documents WHERE matter_id = ${id} ORDER BY created_at DESC
  `;

  return NextResponse.json({ matter, events, documents });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId, role } = context;
  if (!isStaff(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
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
    });
  }
  if (notes !== undefined && notes !== current.notes) {
    logMatterEvent({
      matterId: id,
      userId,
      eventType: "note_added",
      content: notes,
    });
  }

  return NextResponse.json({ matter });
}
