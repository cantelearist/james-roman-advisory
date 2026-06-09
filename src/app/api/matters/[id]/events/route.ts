import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getDb, ensureVaultTables, logMatterEvent } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await currentUser();
  const role = user?.publicMetadata?.role as string | undefined;
  const isStaff = role === "admin" || role === "advisor";
  if (!isStaff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
