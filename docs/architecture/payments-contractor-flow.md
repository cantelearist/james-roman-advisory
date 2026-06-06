# Contractor Payments Architecture

## Executive Summary

Clients paying contractors from the online office is not just an invoice button. It makes James Roman Advisory a payment coordinator, even if the business is not trying to become a marketplace. That creates real merchant-of-record, dispute, and compliance exposure.

This document defines the architecture, the open decisions that need Roman's approval before implementation begins, and the staging test sequence. Nothing in this document goes to code until Roman explicitly approves the answers to the open questions below.

---

## Open Decisions — Roman Must Approve Before Implementation

These are not implementation details. They are business and legal decisions that determine the code.

| # | Question | Why it matters |
|---|----------|----------------|
| 1 | **Who is the merchant of record?** JRA or the contractor directly? | Determines charge model (Destination vs. Direct), liability, and tax obligations |
| 2 | **Who pays Stripe processing fees?** JRA, contractor, or passed to client? | Affects amount math and Stripe fee configuration |
| 3 | **Does JRA take a platform fee?** If yes, what percentage or flat amount? | Determines application fee amount in Stripe Connect |
| 4 | **Who owns disputes and chargebacks?** | Determines which Stripe account absorbs the dispute liability |
| 5 | **Refund policy?** Who can initiate, what time window, who bears the loss? | Determines webhook handling and client-facing terms |
| 6 | **Negative balance risk?** If a contractor's connected account goes negative, who covers it? | Standard Connect risk — must be addressed in contractor agreement |
| 7 | **Contractor onboarding model?** Express (Stripe-hosted) vs Custom (JRA-hosted UI)? | Express is faster and lower risk; Custom requires more legal responsibility |
| 8 | **Are contractors 1099 vendors or something else?** | Affects Stripe's tax reporting obligations and contractor agreement requirements |
| 9 | **Which Stripe Connect charge model?** | See section below — this follows from decisions 1, 3, and 4 |

**Do not write a line of payment code until these decisions are recorded and confirmed.**

---

## Charge Model Decision

Three Stripe Connect charge models exist. The right one follows from the open decisions above.

### Option A: Destination Charges (Recommended starting point)

```
Client → JRA Stripe account (charge) → Contractor connected account (transfer)
```

- JRA is the merchant of record on the charge.
- JRA can deduct an application fee before transferring.
- Refunds and disputes are JRA's responsibility.
- Simplest payout: Stripe moves funds from JRA to contractor after the charge succeeds.
- Contractor must be on Stripe Connect (Express or Custom).

**Use this if:** JRA wants to control the client-facing payment experience and take a platform fee.

### Option B: Direct Charges

```
Client → Contractor's Stripe account (charge)
```

- Contractor is the merchant of record.
- JRA is not on the hook for disputes.
- JRA can collect an application fee.
- Requires the contractor to have their own Stripe account linked to JRA.
- Client sees the contractor's business name on their card statement.

**Use this if:** JRA wants minimal liability exposure and the contractor should be the face of the transaction.

### Option C: Separate Charges and Transfers

```
Client → JRA account (charge) → JRA initiates separate transfer to contractor
```

- JRA is merchant of record.
- Most flexible for complex split logic.
- Most operational overhead.
- Not recommended for v1.

**Provisional recommendation:** Option A (Destination Charges) for v1, because it keeps the client experience controlled and makes the payment flow predictable. Revisit if legal review changes the merchant-of-record decision.

---

## Architecture Overview

```
[Client browser]
    |
    | POST /api/payments/checkout
    |
[Next.js API route]
    | — verify auth (requireAuthContext)
    | — verify matter access (userCanViewMatter)
    | — verify payment request approved + client-visible
    | — verify payment request not already paid
    |
[Stripe SDK (server-only)]
    | — create Checkout Session
    |   destination: contractor connected account
    |   application_fee_amount: JRA fee (if any)
    |   idempotency key: payment_request_id
    |
[Stripe Checkout]
    | — client completes payment
    |
[Stripe → POST /api/payments/webhook]
    | — verify Stripe signature
    | — idempotent event processing
    | — update payment_requests.status
    | — insert payment_events row
    | — write audit event
    |
[Client browser]
    | — success/cancel redirect
    | — matter page shows updated payment status
```

---

## Database Schema

Add after the secure office foundation is stable and the open decisions above are resolved.

### `contractors`

```sql
create table contractors (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id),
  display_name    text not null,
  legal_name      text,
  email           text not null,
  phone           text,
  stripe_account_id text,          -- filled after Stripe onboarding
  onboarding_status text not null  -- pending | active | restricted | deauthorized
    check (onboarding_status in ('pending','active','restricted','deauthorized')),
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz           -- soft delete only
);
```

### `matter_contractors`

```sql
create table matter_contractors (
  id             uuid primary key default gen_random_uuid(),
  matter_id      uuid not null references matters(id),
  contractor_id  uuid not null references contractors(id),
  role           text,               -- e.g. "General Contractor", "Structural Engineer"
  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now(),
  unique (matter_id, contractor_id)
);
```

### `payment_requests`

```sql
create table payment_requests (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenants(id),
  matter_id            uuid not null references matters(id),
  contractor_id        uuid not null references contractors(id),
  created_by           uuid references profiles(id),
  approved_by          uuid references profiles(id),
  amount_cents         integer not null check (amount_cents > 0),
  currency             text not null default 'usd',
  description          text not null,
  status               text not null default 'draft'
    check (status in ('draft','approved','client_visible','checkout_started','paid','failed','cancelled','refunded')),
  client_visible       boolean not null default false,
  stripe_session_id    text,
  stripe_payment_intent_id text,
  idempotency_key      text unique,  -- derived from id, prevents duplicate charges
  paid_at              timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
```

### `payment_events`

Append-only log of every Stripe event touching a payment request.

```sql
create table payment_events (
  id                 uuid primary key default gen_random_uuid(),
  payment_request_id uuid references payment_requests(id),
  stripe_event_id    text not null unique,  -- idempotency gate
  event_type         text not null,         -- checkout.session.completed, etc.
  status             text,
  amount_cents       integer,
  payload_hash       text,                  -- HMAC of raw webhook body
  created_at         timestamptz not null default now()
);
```

### `payment_webhook_events`

Raw webhook store for debugging and replay.

```sql
create table payment_webhook_events (
  id              uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type      text not null,
  processed       boolean not null default false,
  error           text,
  created_at      timestamptz not null default now()
);
```

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/payments/checkout` | POST | Create Stripe Checkout Session for approved payment request |
| `/api/payments/webhook` | POST | Receive and process Stripe webhook events |
| `/api/admin/contractors` | GET/POST | List and create contractor records (team only) |
| `/api/admin/contractors/[id]/onboard` | POST | Generate Stripe Connect onboarding link |
| `/api/admin/payment-requests` | GET/POST | List and draft payment requests (team only) |
| `/api/admin/payment-requests/[id]/approve` | POST | Approve + optionally make client-visible |
| `/api/admin/payment-requests/[id]/cancel` | POST | Cancel (refund if already paid) |

All routes except `/api/payments/webhook` require authentication and appropriate role/matter access checks. The webhook route verifies Stripe signature instead.

---

## Contractor Onboarding Flow (Express, Recommended)

```
1. Admin creates contractor record in JRA CRM
2. Admin triggers "Send Onboarding Link"
   → POST /api/admin/contractors/[id]/onboard
   → Stripe creates AccountLink (type: account_onboarding)
   → Admin receives link or link is emailed to contractor
3. Contractor completes Stripe-hosted onboarding
4. Stripe sends account.updated webhook
   → JRA updates contractor.onboarding_status
5. Admin can now create payment requests for this contractor
```

Express onboarding means Stripe owns the KYC/identity flow. JRA is not responsible for verifying contractor identity — Stripe is.

---

## Webhook Processing

Webhook handlers must be idempotent. Stripe guarantees at-least-once delivery, not exactly-once.

```
POST /api/payments/webhook
  1. Read raw body as bytes (do NOT parse JSON first)
  2. Verify Stripe signature: stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)
  3. Check payment_webhook_events for stripe_event_id — if exists, return 200 (already processed)
  4. Insert row into payment_webhook_events (processed: false)
  5. Route by event type:
       checkout.session.completed
         → verify session id matches a payment_request
         → update payment_request.status = 'paid', paid_at = now()
         → insert payment_events row
         → write audit event
         → update payment_webhook_events.processed = true
       checkout.session.expired
         → update payment_request.status = 'failed'
         → insert payment_events row
         → update payment_webhook_events.processed = true
       account.updated (contractor onboarding)
         → update contractor.onboarding_status
         → update payment_webhook_events.processed = true
       payment_intent.payment_failed
         → insert payment_events row
         → update payment_webhook_events.processed = true
  6. Any unhandled event type: insert into payment_webhook_events (processed: true) and return 200
  7. On processing error: update payment_webhook_events.error, return 500 (Stripe will retry)
```

**Critical rules:**
- Never return 4xx from the webhook endpoint (Stripe will stop retrying).
- Always verify the Stripe signature before processing any event body.
- The Stripe signature header is `Stripe-Signature`. Use the raw bytes, not the parsed JSON.
- Use `payment_webhook_events.stripe_event_id` as the idempotency gate, not application-level logic.

---

## Environment Variables

### Staging (Vercel Preview)

```
STRIPE_SECRET_KEY         = sk_test_...   (test mode, added by Roman)
STRIPE_PUBLISHABLE_KEY    = pk_test_...   (test mode)
STRIPE_WEBHOOK_SECRET     = whsec_...     (from Stripe CLI or dashboard webhook)
STRIPE_CONNECT_CLIENT_ID  = ca_...        (Connect application id for Express onboarding)
```

Mark `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as **sensitive** in Vercel. Never log or expose these values.

### Production

Production Stripe keys must not be set until:
- Staging payment flow is tested end-to-end with test cards.
- Legal/payment review is complete (merchant of record, dispute policy, contractor agreement).
- Roman gives explicit production go-live approval.

### Local Development

Use the Stripe CLI to forward webhooks locally:

```bash
stripe listen --forward-to localhost:3000/api/payments/webhook
# CLI prints a webhook signing secret — use this as STRIPE_WEBHOOK_SECRET locally
```

---

## Staging Test Sequence

Run this in order on the staging environment before reporting ready.

### 1. Contractor Onboarding

```
- Create a test contractor record via admin UI or API.
- Trigger onboarding link.
- Complete Stripe Express onboarding using test data (use any test SSN/EIN).
- Confirm contractor.onboarding_status updates to 'active' via webhook.
```

### 2. Payment Request Lifecycle

```
- Draft a payment request for an active matter + onboarded contractor.
- Approve the payment request as admin.
- Mark it client-visible.
- Confirm client can see it in the office (not before approval).
- Confirm client cannot edit amount or description.
```

### 3. Successful Payment

```
Test card: 4242 4242 4242 4242 (any future expiry, any CVC)

- Client initiates checkout.
- Confirm redirect to Stripe Checkout.
- Complete payment with test card.
- Confirm redirect to success URL.
- Confirm payment_request.status = 'paid'.
- Confirm payment_events row created.
- Confirm audit event written.
- Confirm client cannot initiate checkout again (idempotency).
```

### 4. Failed Payment

```
Test card: 4000 0000 0000 0002 (card declined)

- Client initiates checkout.
- Card is declined at Stripe.
- Confirm checkout.session.expired or payment_intent.payment_failed event processed.
- Confirm payment_request.status reflects failure.
- Confirm audit event written.
- Confirm client can retry (if retry is the intended behavior).
```

### 5. Duplicate Webhook

```
- Manually replay a webhook event from the Stripe dashboard.
- Confirm payment_webhook_events already has the stripe_event_id.
- Confirm no duplicate payment_events row.
- Confirm no duplicate audit event.
- Confirm 200 response (not 500).
```

### 6. Revoked Client Access

```
- Revoke client access grant on the matter.
- Confirm client cannot access the payment request via API.
- Confirm client cannot initiate checkout.
```

### 7. Double-Payment Prevention

```
- Manually set payment_request.status = 'paid' in staging DB.
- Attempt to create a checkout session for the same payment request.
- Confirm 409 or similar rejection — no second session created.
```

---

## Audit Events

Every payment action must write an audit event:

| Action | Trigger |
|--------|---------|
| `payment_request.created` | Draft created |
| `payment_request.approved` | Admin approves |
| `payment_request.made_visible` | Client visibility toggled on |
| `payment_request.checkout_started` | Checkout session created |
| `payment_request.paid` | Webhook: checkout.session.completed |
| `payment_request.failed` | Webhook: session expired / intent failed |
| `payment_request.cancelled` | Admin cancels |
| `payment_request.refunded` | Refund processed |
| `contractor.onboarding_completed` | Webhook: account.updated (onboarding complete) |

---

## Legal And Operational Review (Required Before Production)

| Topic | Question |
|-------|----------|
| Merchant of record | Clearly documented in client-facing terms |
| Platform fee | Disclosed in engagement agreement |
| Contractor agreement | Covers payment receipt, dispute liability, negative balance |
| Client-facing terms | Covers refund policy, dispute process, contractor relationship |
| Stripe fee pass-through | Clear on who pays processing fees |
| Tax reporting | Stripe handles 1099-K for contractors above threshold; verify scope |
| Dispute SLA | Internal response time for chargebacks |
| Incident process | Who handles a failed large payment at 11pm on a Friday |

---

## Deferred Items

Do not build in v1 unless specifically approved:

- Contractor portal.
- Contractor bidding or proposal flow.
- Escrow-like language or fund-holding.
- Stored cards for off-session payment.
- Automatic payout scheduling controlled by JRA.
- Subscription billing.
- Financing.
- Multi-currency.
- Automatic platform fee splits.
