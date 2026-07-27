import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth";
import { ensureEngagementOperationsTables, getDb } from "@/lib/db";

export const runtime = "nodejs";

const viewSchema = z.object({
  id: z.string().optional(),
  module: z.enum(["engagements", "work", "inbox", "documents", "finance"]),
  name: z.string().trim().min(1).max(80),
  viewType: z.enum(["table", "kanban", "calendar", "workload"]).default("table"),
  filters: z.record(z.string(), z.unknown()).default({}),
  sorting: z.array(z.unknown()).max(20).default([]),
  grouping: z.unknown().nullable().optional(),
  columns: z.array(z.string()).max(50).default([]),
  sharing: z.enum(["private", "workspace"]).default("private"),
});

export async function GET(request: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewModule = new URL(request.url).searchParams.get("module") ?? "engagements";
  await ensureEngagementOperationsTables();
  const sql = getDb();
  const views = await sql`
    SELECT id, module, name, view_type, filters, sorting, grouping, columns, sharing, updated_at
    FROM saved_views
    WHERE module = ${viewModule}
      AND (owner_user_id = ${context.userId} OR sharing = 'workspace')
    ORDER BY sharing = 'workspace' DESC, updated_at DESC
  `;
  return NextResponse.json({ views });
}

export async function POST(request: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = viewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid saved view" }, { status: 400 });
  if (parsed.data.sharing === "workspace" && context.role !== "super_admin" && context.role !== "admin") {
    return NextResponse.json({ error: "Only staff can publish workspace views" }, { status: 403 });
  }
  await ensureEngagementOperationsTables();
  const sql = getDb();
  const id = parsed.data.id ?? crypto.randomUUID();
  const rows = await sql`
    INSERT INTO saved_views (
      id, owner_user_id, module, name, view_type, filters,
      sorting, grouping, columns, sharing
    )
    VALUES (
      ${id}, ${context.userId}, ${parsed.data.module}, ${parsed.data.name},
      ${parsed.data.viewType}, ${JSON.stringify(parsed.data.filters)},
      ${JSON.stringify(parsed.data.sorting)}, ${parsed.data.grouping ? JSON.stringify(parsed.data.grouping) : null},
      ${JSON.stringify(parsed.data.columns)}, ${parsed.data.sharing}
    )
    ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        view_type = EXCLUDED.view_type,
        filters = EXCLUDED.filters,
        sorting = EXCLUDED.sorting,
        grouping = EXCLUDED.grouping,
        columns = EXCLUDED.columns,
        sharing = EXCLUDED.sharing,
        updated_at = NOW()
    WHERE saved_views.owner_user_id = ${context.userId}
    RETURNING *
  `;
  if (rows.length === 0) return NextResponse.json({ error: "View not found" }, { status: 404 });
  return NextResponse.json({ view: rows[0] }, { status: parsed.data.id ? 200 : 201 });
}
