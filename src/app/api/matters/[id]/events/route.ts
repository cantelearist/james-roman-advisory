import { NextResponse } from "next/server";
import { getDb, ensureVaultTables, logMatterEvent } from "@/lib/db";
import { getAuthContext, isStaff } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId, role } = context;
  if (!isStaff(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { content } = body;

  if (!content?.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  await ensureVaultTables();
  const sql = getDb();

  const [matter] = await sql`SELECT id FROM matters WHERE id = ${id}`;
  if (!matter) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logMatterEvent({
    matterId: id,
    userId,
    eventType: "note_added",
    content: content.trim(),
  });

  const [event] = await sql`
    SELECT * FROM matter_events
    WHERE matter_id = ${id} AND user_id = ${userId} AND event_type = 'note_added'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  return NextResponse.json({ event }, { status: 201 });
}
