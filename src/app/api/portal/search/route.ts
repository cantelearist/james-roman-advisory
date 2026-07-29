import { NextResponse } from "next/server";

import {
  getPortalAccessSummary,
  hasCapability,
} from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";

export const runtime = "nodejs";

type SearchResult = {
  id: string;
  type: "engagement" | "client" | "document" | "message";
  title: string;
  context?: string;
  href: string;
};

export async function GET(request: Request) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ results: [] });

  const access = await getPortalAccessSummary(context);
  await assertRequiredSchemaVersions();
  const sql = getDb();
  const pattern = `%${query.slice(0, 120)}%`;
  const global = context.role === "super_admin"
    || (context.role === "admin" && access.scope === "global");
  const results: SearchResult[] = [];

  if (hasCapability(access, "engagements.view")) {
    const matters = await sql`
      SELECT m.id, m.title, m.status, c.name AS client_name,
        p.address AS property_address
      FROM matters m
      JOIN clients c ON c.id = m.client_id
      LEFT JOIN properties p ON p.id = m.property_id
      WHERE (
          ${global}
          OR EXISTS (
            SELECT 1
            FROM engagement_memberships em
            WHERE em.matter_id = m.id
              AND em.user_id = ${context.userId}
              AND em.status = 'active'
              AND (em.expires_at IS NULL OR em.expires_at > NOW())
          )
        )
        AND (
          m.title ILIKE ${pattern}
          OR c.name ILIKE ${pattern}
          OR COALESCE(p.address, '') ILIKE ${pattern}
        )
      ORDER BY m.updated_at DESC
      LIMIT 12
    `;
    for (const matter of matters) {
      results.push({
        id: String(matter.id),
        type: "engagement",
        title: String(matter.title),
        context: [matter.client_name, matter.property_address].filter(Boolean).join(" · "),
        href: `/portal/matters/${matter.id}`,
      });
    }
  }

  if (hasCapability(access, "clients.view")) {
    const clients = await sql`
      SELECT DISTINCT c.id, c.name, c.email
      FROM clients c
      JOIN matters m ON m.client_id = c.id
      LEFT JOIN engagement_memberships em
        ON em.matter_id = m.id
        AND em.user_id = ${context.userId}
        AND em.status = 'active'
        AND (em.expires_at IS NULL OR em.expires_at > NOW())
      WHERE (${global} OR em.id IS NOT NULL)
        AND (c.name ILIKE ${pattern} OR COALESCE(c.email, '') ILIKE ${pattern})
      ORDER BY c.name
      LIMIT 8
    `;
    for (const client of clients) {
      results.push({
        id: String(client.id),
        type: "client",
        title: String(client.name),
        context: client.email ? String(client.email) : "Client record",
        href: `/portal/matters?q=${encodeURIComponent(String(client.name))}`,
      });
    }
  }

  if (hasCapability(access, "documents.view")) {
    const documents = await sql`
      SELECT d.id, d.name, d.matter_id, m.title AS matter_title
      FROM documents d
      JOIN matters m ON m.id = d.matter_id
      WHERE (
          ${global}
          OR d.uploaded_by = ${context.userId}
          OR EXISTS (
            SELECT 1
            FROM engagement_memberships em
            WHERE em.matter_id = d.matter_id
              AND em.user_id = ${context.userId}
              AND em.status = 'active'
              AND (em.expires_at IS NULL OR em.expires_at > NOW())
          )
        )
        AND d.name ILIKE ${pattern}
        AND d.archived_at IS NULL
        AND (
          ${context.role} IN ('super_admin', 'admin')
          OR (d.visibility = 'client' AND d.publication_status = 'published')
          OR (${context.role} = 'contractor' AND d.visibility = 'contractor')
        )
      ORDER BY d.created_at DESC
      LIMIT 8
    `;
    for (const document of documents) {
      results.push({
        id: String(document.id),
        type: "document",
        title: String(document.name),
        context: String(document.matter_title),
        href: `/portal/vault?matter_id=${encodeURIComponent(String(document.matter_id))}`,
      });
    }
  }

  if (hasCapability(access, "messages.view")) {
    const internal = hasCapability(access, "messages.internal_view");
    const messages = await sql`
      SELECT msg.id, msg.matter_id, msg.body, m.title AS matter_title
      FROM engagement_messages msg
      JOIN matters m ON m.id = msg.matter_id
      WHERE (
          ${global}
          OR EXISTS (
            SELECT 1
            FROM engagement_memberships em
            WHERE em.matter_id = msg.matter_id
              AND em.user_id = ${context.userId}
              AND em.status = 'active'
              AND (em.expires_at IS NULL OR em.expires_at > NOW())
          )
        )
        AND msg.body ILIKE ${pattern}
        AND (
          (${internal} AND msg.audience = 'internal')
          OR msg.audience = 'client'
          OR (${context.role} IN ('super_admin', 'admin', 'contractor') AND msg.audience = 'contractor')
        )
      ORDER BY msg.created_at DESC
      LIMIT 6
    `;
    for (const message of messages) {
      const body = String(message.body);
      results.push({
        id: String(message.id),
        type: "message",
        title: body.length > 90 ? `${body.slice(0, 87)}…` : body,
        context: String(message.matter_title),
        href: `/portal/matters/${message.matter_id}?section=messages`,
      });
    }
  }

  return NextResponse.json({ results: results.slice(0, 24) });
}
