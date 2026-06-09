import { Resend } from "resend";

// ─── Client ───────────────────────────────────────────────────────────────────

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "James Roman Advisory <notifications@jamesroman.la>";
const NOTIFICATION_EMAIL =
  process.env.NOTIFICATION_EMAIL ?? "advisory@jamesroman.la";

// ─── Templates ────────────────────────────────────────────────────────────────

function consultationNotificationHtml(data: {
  referenceId: string;
  name: string;
  email: string;
  market: string;
  matter: string;
  message: string;
  receivedAt: string;
}): string {
  const { referenceId, name, email, market, matter, message, receivedAt } =
    data;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>New Consultation Request — ${referenceId}</title>
</head>
<body style="margin:0;padding:0;background:#0a0b0e;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#ece6d6;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0b0e;">
    <tr>
      <td align="center" style="padding:48px 24px 0;">

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:32px;border-bottom:1px solid rgba(178,168,152,0.12);">
              <p style="margin:0;font-size:0.7rem;letter-spacing:0.28em;text-transform:uppercase;color:#c9b58a;opacity:0.6;">
                James Roman Advisory
              </p>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding:32px 0 8px;">
              <p style="margin:0 0 6px;font-size:0.7rem;letter-spacing:0.26em;text-transform:uppercase;color:#b2a898;opacity:0.55;">
                New inquiry
              </p>
              <h1 style="margin:0;font-size:1.55rem;font-weight:300;letter-spacing:-0.02em;color:#ece6d6;line-height:1.2;">
                Consultation request<br/>
                <span style="color:#c9b58a;">${referenceId}</span>
              </h1>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:4px 0 28px;">
              <div style="height:1px;background:rgba(178,168,152,0.1);"></div>
            </td>
          </tr>

          <!-- Fields -->
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">

                ${fieldRow("Client", name)}
                ${fieldRow("Email", `<a href="mailto:${email}" style="color:#c9b58a;text-decoration:none;">${email}</a>`)}
                ${fieldRow("Primary market", market)}
                ${fieldRow("Matter type", matter)}

                <!-- Message -->
                <tr>
                  <td style="padding:0 0 20px;">
                    <p style="margin:0 0 6px;font-size:0.68rem;letter-spacing:0.22em;text-transform:uppercase;color:#b2a898;opacity:0.5;">
                      Brief context
                    </p>
                    <div style="border-left:2px solid rgba(201,181,138,0.25);padding:10px 14px;background:rgba(255,255,255,0.025);border-radius:0 2px 2px 0;">
                      <p style="margin:0;font-size:0.93rem;line-height:1.8;color:#ece6d6;opacity:0.88;white-space:pre-wrap;">${escapeHtml(message)}</p>
                    </div>
                  </td>
                </tr>

                ${fieldRow("Received", receivedAt)}

              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:8px 0 28px;">
              <div style="height:1px;background:rgba(178,168,152,0.1);"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-bottom:48px;">
              <p style="margin:0;font-size:0.72rem;color:#b2a898;opacity:0.35;line-height:1.7;">
                James Roman Advisory LLC · Malibu, California<br/>
                This notification is confidential and intended for advisory team use only.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

function fieldRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:0 0 18px;">
        <p style="margin:0 0 4px;font-size:0.68rem;letter-spacing:0.22em;text-transform:uppercase;color:#b2a898;opacity:0.5;">${label}</p>
        <p style="margin:0;font-size:0.95rem;color:#ece6d6;opacity:0.9;">${value}</p>
      </td>
    </tr>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ConsultationNotificationData {
  referenceId: string;
  name: string;
  email: string;
  market: string;
  matter: string;
  message: string;
}

export async function sendConsultationNotification(
  data: ConsultationNotificationData,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn(
      "email.skipped",
      "RESEND_API_KEY not set — consultation notification not sent",
    );
    return;
  }

  const receivedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "long",
    timeStyle: "short",
  });

  const { error } = await resend.emails.send({
    from: FROM,
    to: [NOTIFICATION_EMAIL],
    subject: `New consultation request — ${data.referenceId}`,
    html: consultationNotificationHtml({ ...data, receivedAt }),
  });

  if (error) {
    // Log but don't throw — email failure must not break the submission
    console.error("email.failed", { referenceId: data.referenceId, error });
  } else {
    console.info("email.sent", {
      referenceId: data.referenceId,
      to: NOTIFICATION_EMAIL,
    });
  }
}
