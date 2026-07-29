import { getDb, logMatterEvent } from "@/lib/db";
import { notifyEngagementMembers } from "@/lib/notifications";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";

type AutomationEvent = {
  triggerType: "client_message_received" | "document_review_requested" | "stage_advanced";
  matterId: string;
  actorId: string;
  sourceId: string;
  title: string;
  detail?: string;
  stageKey?: string;
};

function dateAfter(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function triggerPortalAutomations(event: AutomationEvent): Promise<void> {
  try {
    await assertRequiredSchemaVersions();
    const sql = getDb();
    const automations = await sql`
      SELECT id, owner_user_id, configuration
      FROM portal_automations
      WHERE enabled = TRUE
        AND trigger_type = ${event.triggerType}
        AND action_type = 'create_task'
    `;
    for (const automation of automations) {
      const runId = crypto.randomUUID();
      const claimed = await sql`
        INSERT INTO automation_runs (
          id, automation_id, matter_id, source_key, status
        )
        VALUES (
          ${runId}, ${String(automation.id)}, ${event.matterId},
          ${`${event.triggerType}:${event.sourceId}`}, 'running'
        )
        ON CONFLICT (automation_id, source_key) DO NOTHING
        RETURNING id
      `;
      if (claimed.length === 0) continue;
      try {
        const configuration = automation.configuration && typeof automation.configuration === "object"
          ? automation.configuration as Record<string, unknown>
          : {};
        const dueInDays = Math.min(30, Math.max(0, Number(configuration.dueInDays ?? 1)));
        const taskId = crypto.randomUUID();
        await sql`
          INSERT INTO engagement_tasks (
            id, matter_id, stage_key, title, description, status, priority,
            assignee_user_id, due_date, audience, created_by
          )
          VALUES (
            ${taskId}, ${event.matterId}, ${event.stageKey ?? null},
            ${event.title}, ${event.detail ?? null}, 'open', 'high',
            ${automation.owner_user_id ? String(automation.owner_user_id) : null},
            ${dateAfter(dueInDays)}, 'internal', ${event.actorId}
          )
        `;
        if (automation.owner_user_id) {
          await sql`
            INSERT INTO portal_notifications (
              id, user_id, matter_id, event_type, title, body, href
            )
            VALUES (
              ${crypto.randomUUID()}, ${String(automation.owner_user_id)}, ${event.matterId},
              'automation_task_created', 'Automation created a task', ${event.title},
              ${`/portal/matters/${event.matterId}?section=work`}
            )
          `;
        }
        await sql`
          UPDATE automation_runs
          SET status = 'succeeded',
              result = ${JSON.stringify({ taskId })},
              completed_at = NOW()
          WHERE id = ${runId}
        `;
        await logMatterEvent({
          matterId: event.matterId,
          userId: event.actorId,
          eventType: "task_created",
          content: `Automation created task: ${event.title}`,
          metadata: { automationId: String(automation.id), taskId },
          visibility: "internal",
        });
      } catch (error) {
        await sql`
          UPDATE automation_runs
          SET status = 'failed',
              error_message = ${error instanceof Error ? error.message.slice(0, 500) : "Automation failed"},
              completed_at = NOW()
          WHERE id = ${runId}
        `;
      }
    }
  } catch (error) {
    console.error("portal_automation.trigger.failed", error);
  }
}

export async function runScheduledPortalAutomations(): Promise<{
  overdueTaskAlerts: number;
  invoiceReminders: number;
  failures: number;
}> {
  await assertRequiredSchemaVersions();
  const sql = getDb();
  let overdueTaskAlerts = 0;
  let invoiceReminders = 0;
  let failures = 0;
  const enabled = await sql`
    SELECT id, recipe_key, owner_user_id
    FROM portal_automations
    WHERE enabled = TRUE
      AND trigger_type = 'daily_schedule'
  `;

  for (const automation of enabled) {
    if (automation.recipe_key === "overdue_task_alert") {
      const tasks = await sql`
        SELECT t.id, t.matter_id, t.title, t.assignee_user_id
        FROM engagement_tasks t
        WHERE t.status NOT IN ('completed', 'cancelled')
          AND t.due_date < CURRENT_DATE
        ORDER BY t.due_date
        LIMIT 500
      `;
      for (const task of tasks) {
        const runId = crypto.randomUUID();
        const claimed = await sql`
          INSERT INTO automation_runs (id, automation_id, matter_id, source_key, status)
          VALUES (
            ${runId}, ${String(automation.id)}, ${String(task.matter_id)},
            ${`overdue-task:${String(task.id)}`}, 'running'
          )
          ON CONFLICT (automation_id, source_key) DO NOTHING
          RETURNING id
        `;
        if (claimed.length === 0) continue;
        try {
          const recipientId = task.assignee_user_id ?? automation.owner_user_id;
          if (!recipientId) {
            await sql`
              UPDATE automation_runs
              SET status = 'skipped', result = '{"reason":"no_owner"}'::JSONB, completed_at = NOW()
              WHERE id = ${runId}
            `;
            continue;
          }
          await sql`
            INSERT INTO portal_notifications (
              id, user_id, matter_id, event_type, title, body, href
            )
            VALUES (
              ${crypto.randomUUID()}, ${String(recipientId)}, ${String(task.matter_id)},
              'task_overdue', 'Assigned work is overdue', ${String(task.title)},
              ${`/portal/matters/${String(task.matter_id)}?section=work`}
            )
          `;
          await sql`
            UPDATE automation_runs
            SET status = 'succeeded', result = '{"notificationCreated":true}'::JSONB, completed_at = NOW()
            WHERE id = ${runId}
          `;
          overdueTaskAlerts++;
        } catch (error) {
          failures++;
          await sql`
            UPDATE automation_runs
            SET status = 'failed',
                error_message = ${error instanceof Error ? error.message.slice(0, 500) : "Automation failed"},
                completed_at = NOW()
            WHERE id = ${runId}
          `;
        }
      }
    }

    if (automation.recipe_key === "invoice_reminder") {
      const invoices = await sql`
        SELECT id, matter_id, invoice_number
        FROM invoices
        WHERE status = 'issued'
          AND due_date < CURRENT_DATE
        ORDER BY due_date
        LIMIT 500
      `;
      for (const invoice of invoices) {
        const runId = crypto.randomUUID();
        const claimed = await sql`
          INSERT INTO automation_runs (id, automation_id, matter_id, source_key, status)
          VALUES (
            ${runId}, ${String(automation.id)}, ${String(invoice.matter_id)},
            ${`overdue-invoice:${String(invoice.id)}`}, 'running'
          )
          ON CONFLICT (automation_id, source_key) DO NOTHING
          RETURNING id
        `;
        if (claimed.length === 0) continue;
        try {
          await sql`UPDATE invoices SET status = 'overdue', updated_at = NOW() WHERE id = ${String(invoice.id)} AND status = 'issued'`;
          await notifyEngagementMembers({
            matterId: String(invoice.matter_id),
            actorId: automation.owner_user_id ? String(automation.owner_user_id) : "system:automation",
            audience: "client",
            eventType: "invoice_reminder",
            subject: `Payment reminder · ${String(invoice.invoice_number)}`,
            preview: "This invoice is now overdue. Open your Private Office to review the record and payment options.",
            path: `/portal/finance?matter_id=${String(invoice.matter_id)}`,
          });
          await sql`
            UPDATE automation_runs
            SET status = 'succeeded', result = '{"reminderQueued":true}'::JSONB, completed_at = NOW()
            WHERE id = ${runId}
          `;
          invoiceReminders++;
        } catch (error) {
          failures++;
          await sql`
            UPDATE automation_runs
            SET status = 'failed',
                error_message = ${error instanceof Error ? error.message.slice(0, 500) : "Automation failed"},
                completed_at = NOW()
            WHERE id = ${runId}
          `;
        }
      }
    }
  }
  return { overdueTaskAlerts, invoiceReminders, failures };
}
