import { NextResponse } from "next/server";
import { getDb, ensureVaultTables } from "@/lib/db";
import { getAuthContext, isStaff } from "@/lib/auth";

export async function GET() {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId, role } = context;

  await ensureVaultTables();
  const sql = getDb();

  const clients = isStaff(role)
    ? await sql`SELECT * FROM clients ORDER BY created_at DESC`
    : await sql`SELECT * FROM clients WHERE user_id = ${userId}`;

  return NextResponse.json({ clients });
}

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role } = context;
  if (!isStaff(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, email, phone, notes } = body;
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  await ensureVaultTables();
  const sql = getDb();
  const id = crypto.randomUUID();

  const [client] = await sql`
    INSERT INTO clients (id, name, email, phone, notes)
    VALUES (${id}, ${name.trim()}, ${email?.trim() || null}, ${phone?.trim() || null}, ${notes?.trim() || null})
    RETURNING *
  `;

  return NextResponse.json({ client }, { status: 201 });
}
