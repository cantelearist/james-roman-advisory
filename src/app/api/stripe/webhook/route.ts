import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getDb } from "@/lib/db";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";

export const runtime = "nodejs";

function paymentId(session: Stripe.Checkout.Session): string {
  if (typeof session.payment_intent === "string") return session.payment_intent;
  return session.payment_intent?.id ?? `checkout:${session.id}`;
}

async function recordPayment(
  session: Stripe.Checkout.Session,
  status: "processing" | "succeeded" | "failed",
) {
  const invoiceId = session.metadata?.invoiceId ?? session.client_reference_id;
  if (!invoiceId) return;
  const sql = getDb();
  const invoice = await sql`
    SELECT id, total_cents, currency FROM invoices WHERE id = ${invoiceId} LIMIT 1
  `;
  if (invoice.length === 0) return;
  const providerPaymentId = paymentId(session);
  const amount = session.amount_total ?? Number(invoice[0].total_cents);
  await sql`
    INSERT INTO payments (
      invoice_id, provider_payment_id, amount_cents, currency, status, received_at
    )
    VALUES (
      ${invoiceId},
      ${providerPaymentId},
      ${amount},
      ${session.currency ?? String(invoice[0].currency)},
      ${status},
      ${status === "succeeded" ? new Date().toISOString() : null}
    )
    ON CONFLICT (provider_payment_id) DO UPDATE
    SET status = EXCLUDED.status,
        received_at = COALESCE(payments.received_at, EXCLUDED.received_at),
        updated_at = NOW()
  `;
  await sql`
    UPDATE invoices
    SET status = ${status === "succeeded" ? "paid" : status === "processing" ? "processing" : "issued"},
        paid_at = ${status === "succeeded" ? new Date().toISOString() : null},
        stripe_payment_intent_id = ${providerPaymentId},
        updated_at = NOW()
    WHERE id = ${invoiceId}
      AND status <> 'void'
  `;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  let event: Stripe.Event;
  try {
    const payload = await request.text();
    event = getStripe().webhooks.constructEvent(payload, signature, getStripeWebhookSecret());
  } catch (error) {
    console.error("stripe.webhook.signature_failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  await assertRequiredSchemaVersions();
  const sql = getDb();
  const duplicate = await sql`
    SELECT event_id FROM stripe_webhook_events WHERE event_id = ${event.id} LIMIT 1
  `;
  if (duplicate.length > 0) return NextResponse.json({ received: true, duplicate: true });

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      await recordPayment(session, session.payment_status === "paid" ? "succeeded" : "processing");
    } else if (event.type === "checkout.session.async_payment_succeeded") {
      await recordPayment(event.data.object as Stripe.Checkout.Session, "succeeded");
    } else if (event.type === "checkout.session.async_payment_failed") {
      await recordPayment(event.data.object as Stripe.Checkout.Session, "failed");
    }
    await sql`
      INSERT INTO stripe_webhook_events (event_id, event_type)
      VALUES (${event.id}, ${event.type})
      ON CONFLICT (event_id) DO NOTHING
    `;
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("stripe.webhook.processing_failed", { eventId: event.id, error });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
