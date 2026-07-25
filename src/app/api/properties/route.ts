import { NextResponse } from "next/server";
import { getDb, ensureVaultTables } from "@/lib/db";
import { getAuthContext, isStaff } from "@/lib/auth";

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role } = context;
  if (!isStaff(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { clientId, address, city, state, notes } = body;

  if (!clientId?.trim()) return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  if (!address?.trim()) return NextResponse.json({ error: "address is required" }, { status: 400 });

  await ensureVaultTables();
  const sql = getDb();
  const id = crypto.randomUUID();

  const [property] = await sql`
    INSERT INTO properties (id, client_id, address, city, state, notes)
    VALUES (
      ${id},
      ${clientId},
      ${address.trim()},
      ${city?.trim() || "Malibu"},
      ${state?.trim() || "CA"},
      ${notes?.trim() || null}
    )
    RETURNING *
  `;

  return NextResponse.json({ property }, { status: 201 });
}

export async function GET(req: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId, role } = context;
  const staff = isStaff(role);

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ properties: [] });

  await ensureVaultTables();
  const sql = getDb();

  // IDOR gate: staff may query any client; clients may only query their own record.
  // Without this check, any authenticated user could enumerate any client's property
  // addresses by guessing or iterating client IDs.
  if (!staff) {
    const [owner] = await sql`
      SELECT id FROM clients
      WHERE id = ${clientId} AND user_id = ${userId}
    `;
    if (!owner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const properties = await sql`
    SELECT * FROM properties WHERE client_id = ${clientId} ORDER BY created_at DESC
  `;

  return NextResponse.json({ properties });
}
