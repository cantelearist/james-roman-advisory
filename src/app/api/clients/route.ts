import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  authorizeCapability,
  getPortalAccessSummary,
  hasCapability,
} from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";

export async function GET() {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId, role } = context;
  const access = await getPortalAccessSummary(context);
  if (!hasCapability(access, "clients.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await assertRequiredSchemaVersions();
  const sql = getDb();

  const clients = role === "super_admin" || (role === "admin" && access.scope === "global")
    ? await sql`SELECT * FROM clients ORDER BY created_at DESC`
    : await sql`
        SELECT DISTINCT c.*
        FROM clients c
        JOIN matters m ON m.client_id = c.id
        JOIN engagement_memberships em
          ON em.matter_id = m.id
          AND em.user_id = ${userId}
          AND em.status = 'active'
          AND (em.expires_at IS NULL OR em.expires_at > NOW())
        ORDER BY c.created_at DESC
      `;

  return NextResponse.json({ clients });
}

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = await getPortalAccessSummary(context);
  if (!(await authorizeCapability(context, access, "clients.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (context.role !== "super_admin" && access.scope !== "global") {
    return NextResponse.json(
      { error: "Creating a client requires global client authority" },
      { status: 403 },
    );
  }

  const body = await req.json();
  const { name, email, phone, notes } = body;
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  await assertRequiredSchemaVersions();
  const sql = getDb();
  const id = crypto.randomUUID();

  const [client] = await sql`
    INSERT INTO clients (id, name, email, phone, notes)
    VALUES (${id}, ${name.trim()}, ${email?.trim() || null}, ${phone?.trim() || null}, ${notes?.trim() || null})
    RETURNING *
  `;

  return NextResponse.json({ client }, { status: 201 });
}
