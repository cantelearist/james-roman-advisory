import { NextResponse } from "next/server";
import { z } from "zod";

import {
  authorizeCapability,
  canReceiveAudience,
  getPortalAccessSummary,
  hasCapability,
} from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";
import { ensureEngagementOperationsTables, getDb } from "@/lib/db";
import type { ResourceAudience } from "@/lib/data-model";
import { notifyEngagementMembers } from "@/lib/notifications";

export const runtime = "nodejs";

const messageSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
  audience: z.enum(["internal", "contractor", "client"]).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const access = await getPortalAccessSummary(context);
  if (!(await authorizeCapability(context, access, "messages.view", { matterId: id }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await ensureEngagementOperationsTables();
  const sql = getDb();
  const matter = await sql`SELECT id FROM matters WHERE id = ${id} LIMIT 1`;
  if (matter.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rows = await sql`
    SELECT m.id, m.matter_id, m.sender_id, m.body, m.audience, m.created_at,
           u.name AS sender_name, u.role AS sender_role
    FROM engagement_messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.matter_id = ${id}
    ORDER BY m.created_at ASC
  `;
  const mayViewInternal = hasCapability(access, "messages.internal_view");
  const messages = rows.filter((message) => {
    const audience = String(message.audience) as ResourceAudience;
    return audience === "internal"
      ? mayViewInternal
      : canReceiveAudience(context.role, audience);
  });
  return NextResponse.json({ messages });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const access = await getPortalAccessSummary(context);
  if (!(await authorizeCapability(context, access, "messages.send", { matterId: id }))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const parsed = messageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a message of 10,000 characters or fewer." }, { status: 400 });
  }
  let audience: ResourceAudience;
  if (context.role === "client") audience = "client";
  else if (context.role === "contractor") audience = "contractor";
  else audience = parsed.data.audience ?? "client";
  if (audience === "internal" && !hasCapability(access, "messages.internal_view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureEngagementOperationsTables();
  const sql = getDb();
  const matterRows = await sql`SELECT id, title FROM matters WHERE id = ${id} LIMIT 1`;
  if (matterRows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rows = await sql`
    INSERT INTO engagement_messages (matter_id, sender_id, body, audience)
    VALUES (${id}, ${context.userId}, ${parsed.data.body}, ${audience})
    RETURNING id, matter_id, sender_id, body, audience, created_at
  `;
  const message = { ...rows[0], sender_name: context.user.name, sender_role: context.role };
  const preview = parsed.data.body.length > 180
    ? `${parsed.data.body.slice(0, 177)}…`
    : parsed.data.body;
  const delivery = await notifyEngagementMembers({
    matterId: id,
    actorId: context.userId,
    audience,
    eventType: "message_received",
    subject: `New Private Office message · ${String(matterRows[0].title)}`,
    preview,
    path: `/portal/matters/${id}?section=messages`,
  });
  return NextResponse.json({ message, delivery }, { status: 201 });
}
