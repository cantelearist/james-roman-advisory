import { Resend } from "resend";

import type { ResourceAudience } from "@/lib/data-model";
import { getDb } from "@/lib/db";
import { canonicalSiteOrigin } from "@/lib/site-url";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";

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

export type NotificationPreferenceKey = "messages" | "documents" | "finance" | "tasks";

export const DEFAULT_NOTIFICATION_PREFERENCES: Record<NotificationPreferenceKey, boolean> = {
  messages: true,
  documents: true,
  finance: true,
  tasks: true,
};

function preferenceKey(eventType: EngagementNotificationOptions["eventType"]): NotificationPreferenceKey {
  if (eventType === "message_received") return "messages";
  if (eventType === "document_uploaded") return "documents";
  if (["invoice_issued", "invoice_reminder", "contract_issued", "change_order_issued"].includes(eventType)) {
    return "finance";
  }
  return "tasks";
}

function emailEnabled(value: unknown, key: NotificationPreferenceKey): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return true;
  const email = (value as { email?: unknown }).email;
  if (!email || typeof email !== "object" || Array.isArray(email)) return true;
  return (email as Record<string, unknown>)[key] !== false;
}

export type EngagementNotificationOptions = {
  matterId: string;
  actorId: string;
  audience: ResourceAudience;
  eventType:
    | "message_received"
    | "document_uploaded"
    | "invoice_issued"
    | "invoice_reminder"
    | "contract_issued"
    | "change_order_issued"
    | "task_assigned"
    | "workflow_blocked";
  subject: string;
  preview: string;
  path: string;
};

export type EngagementNotificationResult = {
  sent: number;
  failed: number;
  degraded: boolean;
};

async function deliverEngagementNotifications(
  options: EngagementNotificationOptions,
): Promise<EngagementNotificationResult> {
  await assertRequiredSchemaVersions();
  const sql = getDb();
  const settingsRows = await sql`SELECT value FROM portal_settings WHERE key = 'workspace' LIMIT 1`;
  const settings = settingsRows[0]?.value && typeof settingsRows[0].value === "object"
    ? settingsRows[0].value as Record<string, unknown>
    : {};
  const workspacePreference = options.eventType === "message_received"
    ? "notifyOnMessage"
    : options.eventType === "document_uploaded"
      ? "notifyOnDocument"
      : ["invoice_issued", "invoice_reminder", "contract_issued", "change_order_issued"].includes(options.eventType)
        ? "notifyOnInvoice"
        : "notifyOnTask";
  if (settings[workspacePreference] === false) {
    return { sent: 0, failed: 0, degraded: false };
  }
  const rows = await sql`
    SELECT DISTINCT u.id, u.name, u.email, u.role,
      personal.value AS notification_preferences
    FROM users u
    LEFT JOIN engagement_memberships em
      ON em.user_id = u.id
      AND em.matter_id = ${options.matterId}
      AND em.status = 'active'
      AND (em.expires_at IS NULL OR em.expires_at > NOW())
    LEFT JOIN user_permission_assignments a ON a.user_id = u.id
    LEFT JOIN portal_settings personal ON personal.key = 'notifications:' || u.id
    WHERE u.status = 'active'
      AND u.id <> ${options.actorId}
      AND (
        u.role = 'super_admin'
        OR (u.role = 'admin' AND a.access_scope = 'global')
        OR em.id IS NOT NULL
      )
  `;
  const recipients = rows.filter((row) => mayReceive(String(row.role), options.audience));
  if (recipients.length === 0) {
    return { sent: 0, failed: 0, degraded: false };
  }

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const siteUrl = canonicalSiteOrigin();
  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    await sql`
      INSERT INTO portal_notifications (
        id, user_id, matter_id, event_type, title, body, href
      )
      VALUES (
        ${crypto.randomUUID()},
        ${String(recipient.id)},
        ${options.matterId},
        ${options.eventType},
        ${options.subject},
        ${options.preview},
        ${options.path}
      )
    `;
    let status: "sent" | "failed" | "skipped" = "skipped";
    let providerId: string | null = null;
    const wantsEmail = emailEnabled(recipient.notification_preferences, preferenceKey(options.eventType));
    let errorCode: string | null = wantsEmail ? "email_not_configured" : "user_disabled";
    if (resend && wantsEmail) {
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
  return { sent, failed, degraded: failed > 0 || !resend };
}

/**
 * Notifications are a best-effort side effect. Delivery failures are reported
 * but never turn an already committed engagement mutation into a false failure.
 */
export async function notifyEngagementMembers(
  options: EngagementNotificationOptions,
): Promise<EngagementNotificationResult> {
  try {
    return await deliverEngagementNotifications(options);
  } catch (error) {
    console.error("notification.delivery.failed", {
      matterId: options.matterId,
      eventType: options.eventType,
      error,
    });
    return { sent: 0, failed: 1, degraded: true };
  }
}
