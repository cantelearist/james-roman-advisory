# Contractor Payments — James Roman Advisory

Source: `payments-contractor-flow.md`, `production-architecture-review.md`

## Direction: Stripe Connect (NOT simple invoice payment)
Funds flow: `client → contractor` (not `client → James Roman Advisory`)

This makes JRA a payment coordinator. Must be treated as a staged architecture track, not a quick feature.

## V1 Staged Payment Flow
1. Internal team creates/approves contractor record
2. Contractor completes Stripe test-mode onboarding in staging
3. Internal team creates matter-scoped payment request
4. Owner/admin approves payment request visibility to client
5. Client sees payment request in office
6. Client pays through Stripe-hosted Checkout or embedded Checkout
7. Stripe webhook updates payment status
8. CRM records payment events + audit logs

## Preferred Implementation
- Stripe Checkout Sessions for client payment surface
- Stripe Connect connected accounts for contractors
- Destination charges or another Connect charge model (select after legal/payment review)
- Stripe test mode only in staging
- Manual contractor approval before any contractor can receive payment requests

## Data Model (add after secure office foundation is stable)
Tables: `contractors`, `contractor_accounts`, `payment_requests`, `payment_events`, `payment_webhook_events`, `matter_contractors`

Key fields: contractor display name, business/legal name, email, phone, Stripe connected account id, onboarding status, matter id, requested amount, currency, description, status, created_by, approved_by, visible_to_client, checkout session id, payment intent id, timestamps

## Permissions
- `owner` and `admin`: can create contractor records
- `owner`, `admin`, approved `advisor`: can draft payment requests
- `owner` or `admin`: must approve before client sees payment request
- Client: can only view/pay approved visible payment requests for assigned matters; cannot edit details
- Contractor: no portal in v1; onboarding through Stripe-hosted links only

## Staging Requirements (before any live payment)
- Stripe test mode only
- Test connected accounts only
- Test cards only
- Process test webhooks
- Confirm failed payment behavior
- Confirm duplicate webhook idempotency
- Confirm payment request cannot be paid twice
- Confirm revoked client cannot access payment request
- Confirm no production Stripe keys in Preview/staging

## Legal & Operational Review (required before production)
- Decide who is merchant of record
- Decide who pays Stripe fees
- Decide who bears negative balance risk
- Decide refund/dispute process
- Decide whether JRA receives any platform fee
- Review contractor licensing/compliance implications
- Review client-facing payment language

## Deferred (do NOT build in v1 unless specifically approved)
- Contractor portal
- Contractor bidding
- Escrow-like language
- Stored cards for off-session payment
- Automatic payout scheduling controlled by JRA
- Financing
- Subscription billing

## Status
**Payments are NOT production-ready.** All payment work stays in staging with Stripe test-mode keys until legal/payment review is complete and Roman approves production activation.
