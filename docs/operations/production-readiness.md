# production Readiness

Prototype2 stays intact as the public experience. The secure production system now has the first implementation layer for Option A: Vercel frontend plus Supabase Postgres/Auth/Storage.

## Visual Constitution

No future CRM, Office Portal, or Admin feature may reduce:

- visual calmness
- perceived discretion
- perceived competence
- speed

See `docs/operations/visual-constitution.md`. This is a production readiness rule. A feature that makes the office/admin experience feel busier, less private, less capable, or slower is not ready for release.

## Required Environments

Create separate Supabase projects for staging and production.

Staging rule:

- Vercel `Preview` is the implementation of the `staging` lane.
- staging must point to a separate Supabase staging project.
- staging must use Stripe test-mode keys only.
- production must not be changed, promoted, or migrated without Roman's explicit approval.

Required Vercel variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CONNECT_CLIENT_ID` if Connect onboarding requires it.

Rules:

- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must be marked sensitive.
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are server-only and must be marked sensitive.
- staging Stripe keys must be test-mode keys.
- Remove old Clerk and Neon variables after the cutover is confirmed.
- Rotate any legacy key that may have been exposed during prototype work.
- Keep Stripe live mode out of production until contractor payment flow is approved, tested in staging, and legally reviewed.

## DNS and Route Model

The code currently supports:

- `www.jamesroman.la` for the public Prototype2 site.
- `/office` for the secure client office.
- `/admin` for the internal CRM.
- `/portal` redirects to `/office`.

Preferred production domains:

- `www.jamesroman.la`
- `office.jamesroman.la`
- `admin.jamesroman.la`

Domain mapping still needs Vercel project/domain configuration. The route code is ready for path-based operation first.

## Supabase Setup

Apply `supabase/migrations/20260605000000_production_foundation.sql` to staging first, then production after verification.

Configuration checklist:

- Enable MFA for internal users.
- Keep `case-files` private.
- Confirm signed upload and download URLs work.
- Confirm RLS is enabled on every CRM table.
- Create the first owner profile after inviting the first admin user.
- Set production email templates for login links and invites.
- Disable public signups; accounts are invite-only.

## Production Verification

Before storing live client data:

- Public site loads at `/`, `/prototype`, and `/prototype2`.
- `/office`, `/admin`, and `/portal` are inaccessible without login.
- Missing or invalid auth configuration fails closed.
- Internal users can sign in with MFA.
- Clients can only see assigned matters.
- Clients can only see `client` visibility documents and messages.
- Internal users can see tenant-scoped CRM data.
- Signed download URLs expire.
- Every document upload, download, and message event writes an audit log.
- Backup restore has been tested.

## First Release Boundary

Included:

- Client office shell.
- Internal CRM shell.
- Tenant-ready schema.
- Matter access grants.
- Private document metadata.
- Signed document upload/download APIs.
- Secure messaging APIs.
- Audit logs and file access events.

Not included yet:

- Live online payments.
- Contractor, attorney, or insurance guest roles.
- Full SaaS billing or tenant administration.
- True end-to-end encryption.
- Virus scanning and PDF processing workers.
- Formal SOC 2 audit.

## Contractor Payments

Clients paying contractors from the office is a staged requirement.

Production readiness requires:

- Stripe test-mode implementation in staging.
- Contractor connected account model.
- Matter-scoped payment requests.
- Admin approval before a client can pay.
- Stripe webhook idempotency.
- Audit logs for every payment-state transition.
- Legal/payment review of merchant-of-record, platform fee, refund, dispute, contractor compliance, and negative-balance responsibility.

Do not enable live contractor payments until all of the above is complete and Roman approves production activation.
