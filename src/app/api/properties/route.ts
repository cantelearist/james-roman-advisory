import { NextResponse } from "next/server";
import { getDb, ensureVaultTables } from "@/lib/db";
import {
  authorizeCapability,
  getPortalAccessSummary,
} from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { clientId, address, city, state, notes } = body;

  if (!clientId?.trim()) return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  if (!address?.trim()) return NextResponse.json({ error: "address is required" }, { status: 400 });
  const access = await getPortalAccessSummary(context);
  if (!(await authorizeCapability(context, access, "clients.manage", { clientId }))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ properties: [] });
  const access = await getPortalAccessSummary(context);
  if (!(await authorizeCapability(context, access, "clients.view", { clientId }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await ensureVaultTables();
  const sql = getDb();

  const properties = await sql`
    SELECT * FROM properties WHERE client_id = ${clientId} ORDER BY created_at DESC
  `;

  return NextResponse.json({ properties });
}
