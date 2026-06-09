import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getDb, ensureVaultTables, logMatterEvent } from "@/lib/db";

function isStaff(role?: string) {
  return role === "admin" || role === "advisor";
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await currentUser();
  const role = user?.publicMetadata?.role as string | undefined;
  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");
  const clientId = searchParams.get("client_id");

  await ensureVaultTables();
  const sql = getDb();

  let matters;
  if (isStaff(role)) {
    // Advisor/admin: join with client + property data
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
    // Client: only own matters
    matters = await sql`
      SELECT
        m.*,
        c.name AS client_name,
        p.address AS property_address,
        p.city    AS property_city,
        p.state   AS property_state,
        (SELECT COUNT(*) FROM documents d WHERE d.matter_id = m.id)::int AS document_count
      FROM matters m
      JOIN clients c ON c.id = m.client_id AND c.clerk_user_id = ${userId}
      LEFT JOIN properties p ON p.id = m.property_id
      ORDER BY m.updated_at DESC
    `;
  }

  return NextResponse.json({ matters });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await currentUser();
  const role = user?.publicMetadata?.role as string | undefined;
  if (!isStaff(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { clientId, propertyId, title, type, notes } = body;

  if (!clientId?.trim()) return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  if (!title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 });

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

  // Fire-and-forget: log creation event
  logMatterEvent({
    matterId: matter.id,
    userId,
    eventType: "created",
    content: `Matter created: ${title.trim()}`,
    metadata: { type, status: "intake" },
  });

  return NextResponse.json({ matter }, { status: 201 });
}
