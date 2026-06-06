# staging Environment

## Executive Summary

Staging is mandatory. Nothing from the secure office, CRM, document exchange, or payments work may be promoted to production without Roman's explicit approval.

The current Vercel project has a `Preview` environment. In James Roman naming, that is the `staging` lane. It is not a valid staging environment until the Vercel Preview target points to a separate Supabase staging project. Stripe test-mode keys are required before payment testing starts, but they do not block the first secure office foundation.

## Current Finding

Checked June 5, 2026:

- Vercel project: `jr-advisory`
- Vercel environments: `Production`, `Preview`, `Development`
- staging deploys use Vercel `Preview`.
- Global Preview env vars exist.
- No branch-scoped staging Supabase env vars were found for `staging-secure-office-foundation`.
- Preview and production currently appear to share Supabase credentials.
- Supabase CLI is available through `npx supabase`, but it is not authenticated.

Conclusion: staging is not valid yet. Create or select a separate Supabase staging project before deploying the office/CRM foundation.

## Required Staging Shape

Use:

- Vercel `Preview` as the implementation of the `staging` lane.
- Supabase staging project for staging database, auth, and storage.
- Stripe test mode for all payment and contractor payout flows.
- No real client documents.
- No live cards.
- No live contractor payouts.
- No production aliases.

Do not use:

- production Supabase project from staging.
- production Stripe keys from staging.
- `vercel deploy --prod`.
- `vercel promote`.
- Production rollback except emergency recovery.

## staging Variables

Required now:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Supabase may label `NEXT_PUBLIC_SUPABASE_ANON_KEY` as the publishable key in newer dashboards. It is still a browser-safe public key, but it must belong to the staging project.

Required later, before any payment workflow testing:

```text
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_CONNECT_CLIENT_ID
```

Use branch-scoped staging env vars for:

```text
staging-secure-office-foundation
```

When values are available in the shell, apply them with:

```bash
npm run staging:env:apply
```

To apply Supabase staging first:

```bash
export NEXT_PUBLIC_SUPABASE_URL="https://<staging-project-ref>.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="<staging-publishable-or-anon-key>"
export SUPABASE_SERVICE_ROLE_KEY="<staging-service-role-key>"
npm run staging:env:apply
npm run staging:check
```

To add Stripe later, export Stripe test-mode values in the same shell and rerun `npm run staging:env:apply`.

Rules:

- `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` must be encrypted/sensitive.
- Stripe values in staging must be test-mode values.
- Supabase values in staging must point to the staging Supabase project.
- Do not print secret values in terminal output, docs, screenshots, or handoffs.

## Supabase Staging

Create a separate Supabase project named similar to:

```text
james-roman-advisory-staging
```

Required setup:

- Apply migrations to staging first.
- Disable public signup.
- Configure invite-only auth.
- Configure internal MFA.
- Create private `case-files` bucket.
- Confirm RLS on all business tables.
- Create seed test users only, never real client users.
- Use test matters and synthetic documents only.

Validation:

```bash
npx vercel env ls
npx vercel target list
npm run staging:check
npm run staging:deploy
npx vercel inspect <staging-url>
```

Supabase CLI is available through `npx supabase`, but it is not authenticated yet.

To use CLI-based staging setup, create a Supabase access token and run:

```bash
export SUPABASE_ACCESS_TOKEN=<token>
npx supabase projects list --output json
```

Then create or select the `james-roman-advisory-staging` project and apply migrations to staging.

## Stripe Staging

Use Stripe test mode only.

Required setup:

- Test-mode platform keys.
- Test connected contractor accounts.
- Test webhook endpoint pointed at the staging URL.
- Test contractor onboarding.
- Test payment success, failure, refund, dispute-like events where available.

No live-mode contractor payment may be enabled until legal/payment flow approval and production go-live approval.

## Production Approval Rule

Production remains frozen unless Roman explicitly approves a production action in the current thread.

Allowed without approval:

- Local code changes.
- Documentation updates.
- Unit tests.
- staging deployments.
- Staging Supabase migrations.
- Stripe test-mode work.

Not allowed without approval:

- `vercel deploy --prod`
- `vercel promote`
- Production Supabase migrations.
- Production env var changes.
- Production Stripe live keys.
- Live payment or payout activation.
