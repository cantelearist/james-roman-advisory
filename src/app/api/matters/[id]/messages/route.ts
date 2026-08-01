import { NextResponse } from "next/server";
import { z } from "zod";

import {
  authorizeCapability,
  canReceiveAudience,
  getPortalAccessSummary,
  hasCapability,
} from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";
import { getDb, logFileAccess } from "@/lib/db";
import type { ResourceAudience } from "@/lib/data-model";
import { notifyEngagementMembers } from "@/lib/notifications";
import { triggerPortalAutomations } from "@/lib/automations";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";
import {
  ALLOWED_MIME_TYPES,
  deleteFromVault,
  MAX_UPLOAD_BYTES,
  sanitiseFilename,
  uploadToVault,
  vaultPathname,
} from "@/lib/vault";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_ATTACHMENTS = 5;

const messageSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
  audience: z.enum(["internal", "contractor", "client"]).optional(),
  subject: z.string().trim().max(180).nullable().optional(),
  parentMessageId: z.string().uuid().nullable().optional(),
});

type UploadedAttachment = {
  documentId: string;
  pathname: string;
  file: File;
};

async function parseMessageRequest(request: Request) {
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return {
      input: await request.json().catch(() => null),
      files: [] as File[],
    };
  }
  const form = await request.formData();
  const nullable = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" && value.trim() ? value : null;
  };
  return {
    input: {
      body: nullable("body") ?? "",
      audience: nullable("audience") ?? undefined,
      subject: nullable("subject"),
      parentMessageId: nullable("parentMessageId"),
    },
    files: form.getAll("attachments").filter((value): value is File => (
      typeof value !== "string"
      && "name" in value
      && "arrayBuffer" in value
    )),
  };
}

function validateAttachments(files: File[]): string | null {
  if (files.length > MAX_ATTACHMENTS) return `Attach no more than ${MAX_ATTACHMENTS} files.`;
  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  if (totalBytes > MAX_UPLOAD_BYTES) return "Attachments exceed the 50 MB total limit.";
  for (const file of files) {
    if (!file.name || file.size === 0) return "Attachments must not be empty.";
    if (!ALLOWED_MIME_TYPES.has(file.type)) return `File type not allowed: ${file.type || "unknown"}`;
  }
  return null;
}

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
  await assertRequiredSchemaVersions();
  const sql = getDb();
  const matter = await sql`SELECT id FROM matters WHERE id = ${id} LIMIT 1`;
  if (matter.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rows = await sql`
    SELECT m.id, m.matter_id, m.sender_id, m.body, m.audience, m.subject,
           m.thread_id, m.parent_message_id, m.created_at,
           u.name AS sender_name, u.role AS sender_role,
           (receipt.read_at IS NOT NULL) AS is_read,
           COALESCE((
             SELECT json_agg(json_build_object(
               'id', d.id,
               'name', d.name,
               'original_name', d.original_name,
               'content_type', d.content_type,
               'size_bytes', d.size_bytes,
               'created_at', d.created_at
             ) ORDER BY d.created_at, d.id)
             FROM documents d
             WHERE d.message_id = m.id AND d.archived_at IS NULL
           ), '[]'::JSON) AS attachments
    FROM engagement_messages m
    JOIN users u ON u.id = m.sender_id
    LEFT JOIN message_read_receipts receipt
      ON receipt.message_id = m.id AND receipt.user_id = ${context.userId}
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
  const unread = messages.filter((message) =>
    message.sender_id !== context.userId && !message.is_read,
  );
  if (unread.length > 0) {
    await Promise.all(unread.map((message) => sql`
      INSERT INTO message_read_receipts (message_id, user_id)
      VALUES (${String(message.id)}, ${context.userId})
      ON CONFLICT (message_id, user_id) DO NOTHING
    `));
  }
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
  const requestData = await parseMessageRequest(request).catch(() => null);
  const parsed = messageSchema.safeParse(requestData?.input ?? null);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a message of 10,000 characters or fewer." }, { status: 400 });
  }
  const files = requestData?.files ?? [];
  const attachmentError = validateAttachments(files);
  if (attachmentError) {
    return NextResponse.json({ error: attachmentError }, { status: 400 });
  }
  let audience: ResourceAudience;
  if (context.role === "client") audience = "client";
  else if (context.role === "contractor") audience = "contractor";
  else audience = parsed.data.audience ?? "client";
  if (audience === "internal" && !hasCapability(access, "messages.internal_view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await assertRequiredSchemaVersions();
  const sql = getDb();
  const matterRows = await sql`SELECT id, title, client_id FROM matters WHERE id = ${id} LIMIT 1`;
  if (matterRows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let threadId = crypto.randomUUID();
  if (parsed.data.parentMessageId) {
    const parents = await sql`
      SELECT id, COALESCE(thread_id, id) AS thread_id, audience
      FROM engagement_messages
      WHERE id = ${parsed.data.parentMessageId}
        AND matter_id = ${id}
      LIMIT 1
    `;
    if (parents.length === 0) return NextResponse.json({ error: "Parent message not found" }, { status: 400 });
    const parentAudience = String(parents[0].audience) as ResourceAudience;
    if (parentAudience === "internal" && !hasCapability(access, "messages.internal_view")) {
      return NextResponse.json({ error: "Parent message not found" }, { status: 404 });
    }
    if ((context.role === "client" && parentAudience !== "client")
      || (context.role === "contractor" && parentAudience !== "contractor")) {
      return NextResponse.json({ error: "This account cannot reply to that audience." }, { status: 403 });
    }
    if (context.role === "super_admin" || context.role === "admin") {
      audience = parentAudience;
    }
    threadId = String(parents[0].thread_id);
  }
  const messageId = crypto.randomUUID();
  const uploaded: UploadedAttachment[] = [];
  try {
    for (const file of files) {
      const documentId = crypto.randomUUID();
      const pathname = vaultPathname({
        clientId: String(matterRows[0].client_id),
        matterId: id,
        docId: documentId,
        filename: sanitiseFilename(file.name),
      });
      const blob = await uploadToVault({
        pathname,
        file: await file.arrayBuffer(),
        contentType: file.type,
      });
      uploaded.push({ documentId, pathname: blob.pathname, file });
    }

    await sql.transaction([
      sql`
        INSERT INTO engagement_messages (
          id, matter_id, sender_id, body, audience, subject, thread_id, parent_message_id
        )
        VALUES (
          ${messageId}, ${id}, ${context.userId}, ${parsed.data.body}, ${audience},
          ${parsed.data.subject ?? null}, ${threadId}, ${parsed.data.parentMessageId ?? null}
        )
      `,
      ...uploaded.flatMap(({ documentId, pathname, file }) => [
        sql`
          INSERT INTO documents (
            id, matter_id, client_id, name, original_name, category,
            blob_pathname, size_bytes, content_type, uploaded_by,
            visibility, publication_status, message_id
          )
          VALUES (
            ${documentId}, ${id}, ${String(matterRows[0].client_id)}, ${file.name}, ${file.name},
            'correspondence', ${pathname}, ${file.size}, ${file.type}, ${context.userId},
            ${audience}, 'published', ${messageId}
          )
        `,
        sql`
          INSERT INTO document_versions (
            id, document_id, version_number, blob_pathname, original_name,
            size_bytes, content_type, uploaded_by
          )
          VALUES (
            ${crypto.randomUUID()}, ${documentId}, 1, ${pathname}, ${file.name},
            ${file.size}, ${file.type}, ${context.userId}
          )
        `,
      ]),
    ]);
  } catch (error) {
    await Promise.allSettled(uploaded.map(({ pathname }) => deleteFromVault(pathname)));
    console.error("message.attachment.persist.failed", { matterId: id, error });
    return NextResponse.json({ error: "The message could not be sent." }, { status: 500 });
  }
  for (const attachment of uploaded) {
    void logFileAccess({
      documentId: attachment.documentId,
      userId: context.userId,
      eventType: "upload",
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
  }
  const rows = await sql`
    SELECT m.id, m.matter_id, m.sender_id, m.body, m.audience, m.subject,
           m.thread_id, m.parent_message_id, m.created_at,
           COALESCE((
             SELECT json_agg(json_build_object(
               'id', d.id,
               'name', d.name,
               'original_name', d.original_name,
               'content_type', d.content_type,
               'size_bytes', d.size_bytes,
               'created_at', d.created_at
             ) ORDER BY d.created_at, d.id)
             FROM documents d
             WHERE d.message_id = m.id AND d.archived_at IS NULL
           ), '[]'::JSON) AS attachments
    FROM engagement_messages m
    WHERE m.id = ${messageId}
    LIMIT 1
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
    preview: files.length > 0 ? `${preview} · ${files.length} attachment${files.length === 1 ? "" : "s"}` : preview,
    path: `/portal/matters/${id}?section=messages`,
  });
  if (context.role === "client") {
    await triggerPortalAutomations({
      triggerType: "client_message_received",
      matterId: id,
      actorId: context.userId,
      sourceId: messageId,
      title: `Respond to client message · ${String(matterRows[0].title)}`,
      detail: preview,
    });
  }
  return NextResponse.json({ message, delivery }, { status: 201 });
}
