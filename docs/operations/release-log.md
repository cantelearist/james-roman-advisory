# Release Log

This is the canonical release and deployment log for James Roman Advisory.

Use this file for production releases, staging deployments, rollbacks, and major local/staging foundation milestones. Chat history is not a release system.

## Entry Template

```text
Date:
Environment:
Branch:
Commit:
Deployment ID:
Deployment URL:
Domain:
Approved by:
What changed:
Verification:
Rollback target:
Risks / notes:
Follow-up:
```

## 2026-06-05 - production baseline after rollback

Date: 2026-06-05
Environment: production
Branch: main
Commit: unknown from Vercel deployment record in this local log
Deployment ID: `dpl_6t7vzRxwcaEysXg1bVP9o3kqZpLi`
Deployment URL: `https://jr-advisory-n0pqlh56f-roman-2757s-projects.vercel.app`
Domain: `https://www.jamesroman.la`
Approved by: Roman

What changed:

- Production was restored to the approved Prototype2 experience after the founder-image deployment broke animation/visual behavior.
- This deployment is the current approved production baseline.

Verification:

- Live domain verified after rollback.
- Founder image baseline hash documented in `docs/operations/deployment-baseline.md`.

Rollback target:

```bash
npx vercel rollback https://jr-advisory-n0pqlh56f-roman-2757s-projects.vercel.app --yes --timeout 3m
```

Risks / notes:

- Do not promote `dpl_44EVkKaQFs4buprP8dF3nXMC34SC`.
- Do not deploy production without Roman's explicit approval in the current thread.

Follow-up:

- Keep Prototype2 visual experience frozen unless a separate visual change is approved.

## 2026-06-05 - rejected founder-image deployment

Date: 2026-06-05
Environment: production
Branch: main
Commit: unknown from Vercel deployment record in this local log
Deployment ID: `dpl_44EVkKaQFs4buprP8dF3nXMC34SC`
Deployment URL: `https://jr-advisory-ox3nv2ps3-roman-2757s-projects.vercel.app`
Domain: `https://www.jamesroman.la`
Approved by: not approved after review

What changed:

- Founder image was changed.
- Animation/visual behavior broke.

Verification:

- User rejected the deployment.
- Production was rolled back to `dpl_6t7vzRxwcaEysXg1bVP9o3kqZpLi`.

Rollback target:

- Current approved production baseline: `https://jr-advisory-n0pqlh56f-roman-2757s-projects.vercel.app`.

Risks / notes:

- This deployment is explicitly not approved for promotion.
- Media changes must pass visual/animation QA before staging or production.

Follow-up:

- Visual gate added through `.qa/prototype-visual-regression.spec.ts`.

## 2026-06-05 - staging branch and env boundary setup

Date: 2026-06-05
Environment: staging
Branch: `staging-secure-office-foundation`
Commit: `ec5285eb0b7bb0ed4ad71d30874c0817add9e6dd`
Deployment ID: none yet
Deployment URL: none yet
Domain: Vercel Preview only
Approved by: Roman approved staging branch push

What changed:

- Created/pushed staging branch to the Vercel-connected GitHub repo `cantelearist/jr-advisory`.
- Added branch-scoped Preview env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Updated local docs/tooling to use `staging-secure-office-foundation`.

Verification:

```bash
npx vercel env ls preview staging-secure-office-foundation
```

Current result:

- Branch-scoped public Supabase URL exists.
- Branch-scoped public Supabase publishable/anon key exists.
- Branch-scoped `SUPABASE_SERVICE_ROLE_KEY` is still missing.

Rollback target:

- No staging deployment yet.

Risks / notes:

- Staging is not valid until branch-scoped `SUPABASE_SERVICE_ROLE_KEY` is added.
- Stripe test-mode keys are not configured yet and remain warnings until payment work begins.

Follow-up:

- Add fresh rotated `SUPABASE_SERVICE_ROLE_KEY` directly in Vercel, scoped to Preview and branch `staging-secure-office-foundation`.

## 2026-06-05 - local secure foundation milestones

Date: 2026-06-05
Environment: local / staging-prep
Branch: `staging-secure-office-foundation`
Commit: local WIP based on `ec5285eb0b7bb0ed4ad71d30874c0817add9e6dd`
Deployment ID: none
Deployment URL: none
Domain: none
Approved by: local work only

What changed:

- Added Visual Constitution as a hard rule.
- Reduced service-role usage for normal CRM/Office reads.
- Added service-role policy documentation.
- Added access-control regression tests.
- Added Supabase RLS test harness.
- Added tenant RLS and team-only file-access-event visibility.
- Added same-origin request guard.
- Added application route rate limiting.
- Added v1 document quarantine policy:
  - completed uploads move to `scan_pending`, not `available`
  - signed download URLs are created only for `available` documents
  - RLS explicitly blocks clients from seeing `scan_pending` documents
- Added document-scanning/quarantine operations note.
- Added audit-log hardening:
  - HMAC-based IP/user-agent hashes using `AUDIT_HASH_SECRET`
  - audit event correlation id
  - database append-only trigger for audit logs
  - documented correction-by-new-event rule
- Added data classification and retention foundation:
  - matter sensitivity labels
  - document classification and sensitivity labels
  - legal-hold metadata
  - retention/deletion-request/soft-deletion fields
  - database deletion rules for matters and documents
  - counsel-review retention policy draft

Verification:

```bash
npm run test -- src/lib/crm/audit.test.ts
npm run prototype:test
npm run prototype:build
npx supabase db reset
npx supabase test db
```

Latest known successful results:

- `npm run test -- src/lib/documents/scanning.test.ts`: 1 file passed, 2 tests passed.
- `npm run test -- src/lib/crm/audit.test.ts`: 1 file passed, 4 tests passed.
- `npm run prototype:test`: 18 files passed, 58 tests passed.
- `npm run prototype:build`: passed.
- `npx supabase db reset`: passed from clean local migration.
- `npx supabase test db`: 1 file, 20 tests, PASS.
- `npm run staging:check`: passed, with Stripe test-mode warnings only.

Rollback target:

- Not applicable; local WIP has not been deployed.

Risks / notes:

- Do not deploy this dirty WIP to production.
- Staging deploy remains blocked until branch-scoped `SUPABASE_SERVICE_ROLE_KEY` is present.
- Staging and production now also require separate `AUDIT_HASH_SECRET` values with at least 32 characters.
- In-process rate limiting is not enough for production by itself; pair with Vercel Firewall, Upstash Ratelimit, or another durable limiter.
- Manual quarantine is acceptable for staging/v1, but production must either keep it as an explicit advisor-review process or add a malware-scanning worker before real client file exchange.
- Retention periods and CPRA/legal-hold conflict language still need counsel approval.

Follow-up:

- Add branch-scoped service-role key.
- Add branch-scoped staging `AUDIT_HASH_SECRET`.
- Add production `AUDIT_HASH_SECRET` before production promotion is considered.
- Run `npm run staging:check`.
- Deploy to staging only after the check passes.

## 2026-06-05 - staging secure foundation preview

Date: 2026-06-05
Environment: staging
Branch: `staging-secure-office-foundation`
Commit: local WIP based on `ec5285eb0b7bb0ed4ad71d30874c0817add9e6dd`
Deployment ID: `dpl_4d2CVJSmag8q6Z9PZcz5gFb4dnHU`
Deployment URL: `https://jr-advisory-lxme9mhnb-roman-2757s-projects.vercel.app`
Domain: protected Vercel Preview only
Approved by: Roman approved staging work only

What changed:

- Added branch-scoped staging `SUPABASE_SERVICE_ROLE_KEY`.
- Added separate `AUDIT_HASH_SECRET` values for staging and production.
- Fixed staging env checker to verify encrypted Vercel env existence through `vercel env ls`.
- Deployed secure-foundation WIP to protected Vercel Preview.

Verification:

```bash
npm run staging:check
npm run staging:deploy
npx vercel inspect https://jr-advisory-lxme9mhnb-roman-2757s-projects.vercel.app
npx vercel curl /prototype2 --deployment https://jr-advisory-lxme9mhnb-roman-2757s-projects.vercel.app -- -I
```

Latest known successful results:

- `npm run staging:check`: passed.
- Staging warnings remain for missing Stripe test-mode keys; payments staging is not configured yet.
- Vercel deployment status: `READY`, target `preview`.
- Protected public routes returned `200` through `vercel curl`: `/`, `/prototype`, `/prototype2`, `/prototype2/contact`, `/robots.txt`, `/sitemap.xml`.
- Protected app routes behaved correctly:
  - `/office`: `307` to `/sign-in?redirect_url=%2Foffice`
  - `/admin`: `307` to `/sign-in?redirect_url=%2Fadmin`
  - `/sign-in`: `200`

Rollback target:

- Staging preview only; no production alias changed.
- Current approved production baseline remains `dpl_6t7vzRxwcaEysXg1bVP9o3kqZpLi`.

Risks / notes:

- Preview is protected by Vercel Authentication. A normal browser request returns `401` unless the viewer is authorized or uses an approved Vercel protection bypass.
- Do not promote this deployment to production.
- Stripe test-mode env vars are still missing and must be added before payment work is tested.

Follow-up:

- Add Stripe test-mode keys when contractor-payment staging begins.
- Run visual QA against the protected preview with authorized browser access before any visual approval.
- Continue P0 backend hardening before production consideration.

## 2026-06-06 - staging Sentry monitoring wiring

Date: 2026-06-06
Environment: local / staging-prep
Branch: `staging-secure-office-foundation`
Commit: local WIP
Deployment ID: none
Deployment URL: none
Domain: none
Approved by: local staging-safe work only

What changed:

- Installed `@sentry/nextjs`.
- Added Sentry initialization files:
  - `sentry.server.config.ts`
  - `sentry.edge.config.ts`
  - `instrumentation-client.ts`
  - `src/instrumentation.ts`
- Wired Sentry through the existing monitoring abstraction.
- Added `beforeSend` scrubbing before events leave the app.
- Kept Session Replay, tracing, profiling, and default PII collection disabled.
- Added monitoring hooks for consultation failures, signed upload/download failures, upload completion failures, message failures, and audit write failures.
- Added Sentry env placeholders and staging-check warnings.
- Added Sentry operations runbook.

Verification:

```bash
npm run test -- src/lib/monitoring.test.ts src/app/api/consultations/route.test.ts src/lib/crm/audit.test.ts
npm run prototype:test
npm run prototype:build
npm run staging:check
```

Latest known successful results:

- Targeted monitoring tests: 3 files passed, 41 tests passed.
- `npm run prototype:test`: 21 files passed, 153 tests passed.
- `npm run prototype:build`: passed.
- `npm run staging:check`: passed.

Risks / notes:

- Sentry runtime sending is not active until `NEXT_PUBLIC_SENTRY_DSN` and/or `SENTRY_DSN` are added.
- Source-map upload is not active until `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` are added.
- Stripe staging warnings remain unrelated to monitoring.

Follow-up:

- Roman needs to provide staging Sentry DSN.
- Optional: provide Sentry org slug, project slug, and auth token for source maps.
- After DSN is added, deploy staging only and trigger a controlled test error to verify scrubbing inside Sentry.
