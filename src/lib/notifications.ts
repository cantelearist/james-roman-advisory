import { Resend } from "resend";

import type { ResourceAudience } from "@/lib/data-model";
import { ensureEngagementOperationsTables, getDb } from "@/lib/db";

const FROM = "James Roman Advisory <roman@jamesroman.la>";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mayReceive(role: string, audience: ResourceAudience): boolean {
  if (role === "super_admin" || role === "admin") return true;
  if (role === "contractor") return audience === "contractor" || audience === "client";
  return audience === "client";
}

export async function notifyEngagementMembers(options: {
  matterId: string;
  actorId: string;
  audience: ResourceAudience;
  eventType: "message_received" | "document_uploaded" | "invoice_issued" | "change_order_issued";
  subject: string;
  preview: string;
  path: string;
}): Promise<{ sent: number; failed: number }> {
  await ensureEngagementOperationsTables();
  const sql = getDb();
  const rows = await sql`
    SELECT DISTINCT u.id, u.name, u.email, u.role
    FROM users u
    LEFT JOIN engagement_memberships em
      ON em.user_id = u.id
      AND em.matter_id = ${options.matterId}
      AND em.status = 'active'
      AND (em.expires_at IS NULL OR em.expires_at > NOW())
    LEFT JOIN user_permission_assignments a ON a.user_id = u.id
    WHERE u.status = 'active'
      AND u.id <> ${options.actorId}
      AND (
        u.role = 'super_admin'
        OR (u.role = 'admin' AND a.access_scope = 'global')
        OR em.id IS NOT NULL
      )
  `;
  const recipients = rows.filter((row) => mayReceive(String(row.role), options.audience));
  if (recipients.length === 0) return { sent: 0, failed: 0 };

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.jamesroman.la").replace(/\/$/, "");
  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    let status: "sent" | "failed" | "skipped" = "skipped";
    let providerId: string | null = null;
    let errorCode: string | null = "email_not_configured";
    if (resend) {
      try {
        const result = await resend.emails.send({
          from: FROM,
          to: [String(recipient.email)],
          subject: options.subject,
          html: `<!doctype html><html><body style="margin:0;padding:40px 20px;background:#0a0b0e;color:#ece6d6;font-family:Helvetica,Arial,sans-serif">
          <div style="max-width:560px;margin:auto;border:1px solid rgba(201,181,138,.2);padding:36px;background:#0d0f14">
          <p style="margin:0 0 28px;color:#c9b58a;font-size:11px;letter-spacing:.24em;text-transform:uppercase">James Roman Advisory · Private Office</p>
          <h1 style="font-size:22px;font-weight:300;margin:0 0 18px">${escapeHtml(options.subject)}</h1>
          <p style="color:#b2a898;line-height:1.7;margin:0 0 24px">${escapeHtml(options.preview)}</p>
          <a href="${siteUrl}${options.path}" style="display:inline-block;border:1px solid #c9b58a;color:#c9b58a;padding:13px 18px;text-decoration:none;font-size:12px;letter-spacing:.16em;text-transform:uppercase">Open Private Office</a>
          </div></body></html>`,
        });
        if (result.error) {
          status = "failed";
          errorCode = result.error.name;
          failed++;
        } else {
          status = "sent";
          providerId = result.data?.id ?? null;
          errorCode = null;
          sent++;
        }
      } catch (error) {
        status = "failed";
        errorCode = error instanceof Error ? error.name : "provider_error";
        failed++;
      }
    }
    await sql`
      INSERT INTO notification_deliveries (
        user_id, matter_id, event_type, recipient_email, status, provider_id, error_code
      )
      VALUES (
        ${String(recipient.id)},
        ${options.matterId},
        ${options.eventType},
        ${String(recipient.email)},
        ${status},
        ${providerId},
        ${errorCode}
      )
    `;
  }
  return { sent, failed };
}
