# James Roman Advisory prototype / staging / production Sprint Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` before implementing tickets. Work one ticket at a time, update checkboxes, verify locally, and do not deploy production unless the ticket explicitly says production deployment is approved.

**Goal:** Build a production-ready secure client office and internal CRM while preserving the approved Prototype2 public experience.

**Architecture:** Keep `www.jamesroman.la` as the quiet luxury public front-of-house experience. Build secure authenticated workflows under `/office` and `/admin` first, with optional subdomain mapping later. Consolidate backend services around Supabase Postgres/Auth/Storage, but do not let service-role shortcuts weaken RLS as a defense layer.

**Tech Stack:** Next.js 16.2.6, React 19, TypeScript, Vercel, Supabase Postgres/Auth/Storage, Tailwind/shadcn-style UI, Motion/GSAP/Lenis, Vitest, Playwright.

**Naming:** Every environment and operational command starts with `prototype`, `staging`, or `production`. See `docs/operations/environment-naming.md`.

**Visual Constitution:** No future CRM, Office Portal, or Admin feature may reduce visual calmness, perceived discretion, perceived competence, or speed. See `docs/operations/visual-constitution.md`.

---

## Staging Mandate

All work in this plan must happen in staging until Roman explicitly approves production.

Current environment finding:

- Vercel project `jr-advisory` has standard `Production`, `Preview`, and `Development` targets.
- Vercel `Preview` is the implementation of the `staging` lane.
- staging env vars exist, but the visible Supabase URL prefix appears to match production. Treat this as **not a valid staging backend** until a separate Supabase staging project is connected.
- Supabase CLI is not installed locally in this worktree, so Supabase staging cannot be created from this machine without installing/authenticating the CLI or using the Supabase dashboard/API.
- No production promotion, rollback, alias change, or `vercel deploy --prod` is allowed without Roman's explicit approval in the current thread.

Valid staging requires:

- staging deployment only, never production.
- Separate Supabase staging project.
- Separate Supabase staging Auth settings and private storage bucket.
- Separate Stripe test-mode keys and Connect test accounts.
- No real client data, real documents, real cards, or live contractor payouts in staging.

## Executive Summary

The prior Option A recommendation still holds: Vercel plus Next.js for the app shell, Supabase for Postgres/Auth/Storage, custom CRM, managed infrastructure, no full SaaS overbuild in v1.

But the plan missed several things that matter:

1. It blurred live production, backup deploy copies, and local WIP. That is dangerous. Production is currently rolled back to `dpl_6t7vzRxwcaEysXg1bVP9o3kqZpLi`; the active architecture worktree is not production-ready.
2. It did not make visual/animation QA a hard deployment gate. The founder-image rollback proved this. Media changes can break the premium feel even when the build passes.
3. It trusted "server-side checks plus service role" too much. Supabase service-role keys bypass RLS, so using the admin client broadly in app data paths weakens defense-in-depth.
4. It treated virus scanning as a later enhancement. For client document exchange, upload scanning or quarantine needs to be in the v1 launch boundary.
5. It did not fully define key management, audit-log tamper resistance, CPRA deletion versus legal hold, or object-storage recovery.
6. It did not address CI/source-of-truth discipline strongly enough. No more ad-hoc production deploys from dirty worktrees or backup extracts.
7. It originally deferred payments. That was acceptable before the requirement was known, but contractor payments from the online office affect data model, permissions, audit logs, and legal/payment risk. Payments are now a staged architecture track, not a quick button.

The corrected plan below makes those items P0.

## Current Verified State

Verified on June 5, 2026:

- Live production domain: `https://www.jamesroman.la`
- Current live deployment after rollback: `dpl_6t7vzRxwcaEysXg1bVP9o3kqZpLi`
- Bad image-swap deployment rolled back: `dpl_44EVkKaQFs4buprP8dF3nXMC34SC`
- Live founder image hash: `2e7fa3fcd62cce3e100b7a1697121eddb36472f6d98bbe3b922d17d340f4d9ac`
- Active local founder image was restored to match live after rollback.
- Active WIP branch: `prototype/liquid-glass-home`
- Active worktree: `/Users/romancantelearist/.config/superpowers/worktrees/james-roman-advisory/prototype-liquid-glass`
- staging exists through Vercel `Preview`, but must not be treated as full staging until its backend env vars point to a separate Supabase staging project.
- `npm run build`: passed.
- `npm run test`: passed, 13 files and 37 tests.
- `npm audit --audit-level=moderate`: failed with 32 findings, mostly through local Vercel CLI dependency chain plus PostCSS inside Next. Do not run `npm audit fix --force` blindly.

## Source Of Truth Rules

These rules are now part of the architecture.

- Prototype2 public experience is sacred. No visual changes without explicit approval.
- Production deploys must come from a clean branch or clean release worktree, not from `/tmp`, backup extracts, or dirty WIP.
- Every production deploy must have a named rollback deployment.
- Every media, animation, layout, or typography change requires browser QA before deploy.
- No CRM, Office Portal, or Admin feature may reduce visual calmness, perceived discretion, perceived competence, or speed.
- Any secure backend change must be tested in staging before production.
- Service-role key is for narrowly scoped server operations only, not general application reads.
- Real client documents cannot be stored until P0 launch blockers are closed.
- Payments must be tested with Stripe test mode only until legal/payment flow approval and production go-live approval.

## External Facts Checked

- Supabase private buckets use access control and can serve private assets through short-lived signed URLs.
- Supabase signed URLs remain valid until their expiry, so short expiry and audit logging matter.
- Supabase service/secret keys bypass RLS and must stay server-side.
- Supabase Auth supports MFA flows.
- Vercel supports rollback to prior deployments through `vercel rollback`.
- Contractor payments should use Stripe Connect architecture, not a simple invoice-payment shortcut, because funds are intended to move from client to contractor.

Sources:

- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase API keys: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase MFA: https://supabase.com/docs/guides/auth/auth-mfa
- Supabase Storage buckets: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Supabase signed URLs: https://supabase.com/docs/guides/storage/serving/downloads
- Vercel rollback: https://vercel.com/docs/cli/rollback
- Stripe Checkout Sessions: https://docs.stripe.com/payments/checkout
- Stripe Connect Accounts v2: https://docs.stripe.com/connect/accounts-v2
- Stripe Connect charges: https://docs.stripe.com/connect/charges

## Priority Groups

### P0: Must Finish Before Any Sensitive Production Use

- Clean deployment discipline and rollback workflow.
- Valid staging environment with separate backend and Stripe test mode.
- Browser visual/animation QA gate for public site.
- Supabase staging and production setup.
- Auth, invite-only access, internal MFA, session policy.
- Reduce service-role usage and prove RLS boundaries.
- Rate limiting for auth, intake, signed URLs, messages.
- CSRF/same-origin checks for state-changing routes.
- Private document storage with signed URL expiry tests.
- Upload validation plus malware scanning or quarantine.
- Tamper-resistant audit logging.
- Backup and restore drill.
- Dependency vulnerability triage.
- Monitoring with PII scrubbing.
- CPRA export/delete workflow with legal-hold exception.
- Legal review of privacy, retention, NDA, document handling.
- Contractor-payment legal and operational review before any live money movement.

### P1: Needed For V1 Client Office Launch

- Internal CRM CRUD for clients and matters.
- Matter timeline and status.
- Client office dashboard.
- Secure document upload/download UX.
- Advisor-client messages.
- Manual invoice visibility and invoice PDF association.
- NDA/engagement record visibility.
- Email deliverability for login/invite and notifications.
- Contractor payment request and payment-status visibility in staging.
- Accessibility and performance QA.

### P2: After V1 Stabilizes

- `office.jamesroman.la` and `admin.jamesroman.la` subdomain split.
- Background workers for PDF processing, retention jobs, exports.
- Application-level field encryption for selected high-sensitivity fields.
- Tenant admin, tenant export/import, and productization tooling.
- Online payment flow if approved.
- Contractor/attorney/insurance guest roles if real demand appears.

---

## Sprint 0: Stabilize The Baseline

**Objective:** Make sure nobody accidentally damages the public masterpiece or deploys unfinished architecture.

### Ticket 0.0: Establish Valid Staging Boundary

**Priority:** P0

**Files:**

- Create: `docs/operations/staging-environment.md`
- Create: `docs/operations/environment-naming.md`
- Modify: `docs/operations/release-workflow.md`
- Modify: `docs/operations/production-readiness.md`

**Instructions:**

- Treat Vercel `Preview` as the implementation of the `staging` lane.
- Create or connect a separate Supabase staging project.
- Set staging env vars to staging Supabase values only:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Set production env vars only for production values.
- Set Stripe test-mode keys in staging only.
- Confirm staging does not point to the same Supabase project as production.
- Add a hard rule: no production promotion without Roman's explicit approval.

**Acceptance Criteria:**

- staging deploys use staging Supabase, not production Supabase.
- staging uses Stripe test mode, not live mode.
- production is untouched.
- A new agent can identify which env vars belong to staging without seeing secret values.

**Verification:**

```bash
npx vercel env ls
npx vercel target list
npx vercel deploy
npx vercel inspect <staging-url>
```

### Ticket 0.1: Freeze Production Baseline

**Priority:** P0

**Files:**

- Create: `docs/operations/deployment-baseline.md`
- Modify: `docs/operations/backup-restore-runbook.md`

**Instructions:**

- Record current live deployment `dpl_6t7vzRxwcaEysXg1bVP9o3kqZpLi`.
- Record rollback command:

```bash
npx vercel rollback https://jr-advisory-n0pqlh56f-roman-2757s-projects.vercel.app --yes --timeout 3m
```

- Record live founder image hash and the fact that the local asset has been restored.
- State that `dpl_44EVkKaQFs4buprP8dF3nXMC34SC` should not be promoted.

**Acceptance Criteria:**

- A new agent can identify the current live deployment without reading chat history.
- The rollback target is documented.
- The bad deployment is explicitly marked as not approved.

**Verification:**

```bash
npx vercel inspect https://www.jamesroman.la
curl -L --fail --silent https://www.jamesroman.la/images/founders/founders-malibu-beach.png | shasum -a 256
```

### Ticket 0.2: Add Visual And Animation Deployment Gate

**Priority:** P0

**Files:**

- Create: `.qa/prototype-visual-regression.spec.ts`
- Modify: `package.json`
- Modify: `HANDOFF_PROTOTYPE2.md`

**Instructions:**

- Add a Playwright test that opens `/`, `/prototype`, `/prototype2`, and `/prototype2/contact`.
- Test desktop `1440x1000` and mobile `390x844`.
- Wait for intro animation, scroll through every major section, and assert:
  - no console errors,
  - no horizontal overflow,
  - hero H1 visible,
  - founder image visible,
  - founder image bounding box stable after scroll,
  - reduced-motion mode still renders core content,
  - screenshot artifacts are saved to `/tmp/jra-visual-qa`.
- Add script:

```json
"test:visual": "playwright test .qa/prototype-visual-regression.spec.ts --reporter=line"
```

**Acceptance Criteria:**

- Any visual/media change has a repeatable browser test.
- Founder-image changes are tested before deploy.
- Reduced-motion rendering is checked.

**Verification:**

```bash
npm run prototype:test:visual
ls -la /tmp/jra-visual-qa
```

### Ticket 0.3: Create Clean Release Workflow

**Priority:** P0

**Files:**

- Create: `docs/operations/release-workflow.md`
- Modify: `.gitignore`

**Instructions:**

- Document that production deploys require:
  - clean git status,
  - passing `npm run build`,
  - passing `npm run test`,
  - passing `npm run prototype:test:visual`,
  - documented rollback target,
  - explicit human approval.
- Do not deploy from dirty worktrees.
- Do not deploy from backup extracts except emergency recovery.

**Acceptance Criteria:**

- A release checklist exists.
- It explicitly blocks the mistake that caused the animation rollback.

**Verification:**

```bash
git status --short
npm run build
npm run test
npm run prototype:test:visual
```

### Ticket 0.4: Dependency Vulnerability Triage

**Priority:** P0

**Files:**

- Create: `docs/operations/dependency-risk-register.md`
- Modify: `package.json`
- Modify: `package-lock.json`

**Instructions:**

- Separate runtime dependencies from local CLI/dev dependencies.
- Investigate whether `vercel` must remain a project dependency or can be removed and used through `npx` or a pinned CI action.
- Attempt non-breaking fixes first.
- Do not use `npm audit fix --force` unless the resulting downgrade/upgrade is reviewed and tested.
- Track the Next/PostCSS advisory and the Vercel CLI chain separately.

**Acceptance Criteria:**

- `npm audit --audit-level=moderate` results are classified.
- Any unresolved advisory has owner, reason, and check-back date.
- No breaking downgrade is applied blindly.

**Verification:**

```bash
npm audit --audit-level=moderate
npm run build
npm run test
```

---

## Sprint 1: Secure Foundation

**Objective:** Build the foundation without relying on optimistic app-only checks.

### Ticket 1.1: Create Supabase Staging And Production Projects

**Priority:** P0

**Files:**

- Modify: `docs/operations/production-readiness.md`
- Modify: `docs/operations/backup-restore-runbook.md`

**Instructions:**

- Create separate Supabase staging and production projects.
- Disable public signup.
- Configure invite-only flows.
- Create private `case-files` bucket through migration.
- Apply migrations to staging first.
- Do not apply production migrations until staging tests pass.

**Acceptance Criteria:**

- Staging Supabase exists.
- Production Supabase exists.
- Staging migration applies cleanly.
- `case-files` is private.

**Verification:**

```bash
supabase migration list
supabase db push --linked
```

### Ticket 1.2: Auth, MFA, And Session Policy

**Priority:** P0

**Files:**

- Modify: `src/lib/crm/auth.ts`
- Modify: `src/proxy.ts`
- Create: `src/lib/crm/auth.test.ts`
- Modify: `docs/operations/security-model.md`

**Instructions:**

- Enforce disabled profiles as unauthenticated.
- Enforce internal MFA using Supabase assurance level where available.
- Define client MFA step-up behavior for sensitive matters.
- Configure idle and max-session settings in Supabase dashboard.
- Add tests for missing profile, disabled profile, team role, client role, and MFA-required internal user.

**Acceptance Criteria:**

- Internal users cannot use `/admin` unless authenticated and authorized.
- MFA-required internal users are blocked until MFA is satisfied.
- Clients cannot access `/admin`.

**Verification:**

```bash
npm run test -- src/lib/crm/auth.test.ts
npm run build
```

### Ticket 1.3: Reduce Service-Role Usage

**Priority:** P0

**Files:**

- Modify: `src/lib/crm/data.ts`
- Modify: `src/app/api/messages/route.ts`
- Modify: `src/app/api/documents/[documentId]/download/route.ts`
- Modify: `src/app/api/documents/[documentId]/complete/route.ts`
- Create: `src/lib/crm/access-control.test.ts`
- Create: `docs/operations/service-role-policy.md`

**Instructions:**

- Use user-scoped Supabase server clients for normal authenticated reads wherever possible.
- Keep service-role client only for:
  - consultation intake insert,
  - narrow signed upload/download operations after explicit access checks,
  - audit inserts if needed,
  - operational admin jobs.
- Every remaining service-role call must have a comment explaining why user-scoped access is insufficient.
- Add tests for cross-client matter access denial and cross-tenant denial.

**Acceptance Criteria:**

- `createSupabaseAdminClient()` is not used for general dashboard listing unless justified.
- Service-role use is documented and narrow.
- Tests prove one client cannot read another client's matter, documents, messages, invoices, or timeline.

**Verification:**

```bash
rg -n "createSupabaseAdminClient" src
npm run test -- src/lib/crm/access-control.test.ts
npm run build
```

### Ticket 1.4: RLS Policy Test Harness

**Priority:** P0

**Files:**

- Create: `supabase/tests/rls.sql`
- Modify: `supabase/migrations/20260605000000_production_foundation.sql`
- Modify: `docs/operations/security-model.md`

**Instructions:**

- Add database-level tests for:
  - team tenant access,
  - client matter grant access,
  - revoked grant denial,
  - internal note team-only visibility,
  - client document visibility filtering,
  - client cannot view `pending_upload` document,
  - audit logs team-only read.
- Confirm RLS is enabled on all business tables.

**Acceptance Criteria:**

- RLS is not just written; it is tested.
- Cross-tenant access fails at the database layer.

**Verification:**

```bash
supabase test db
```

### Ticket 1.5: Rate Limiting

**Priority:** P0

**Files:**

- Create: `src/lib/rate-limit.ts`
- Modify: `src/app/api/consultations/route.ts`
- Modify: `src/app/api/documents/signed-upload/route.ts`
- Modify: `src/app/api/documents/[documentId]/download/route.ts`
- Modify: `src/app/api/messages/route.ts`
- Create: `src/lib/rate-limit.test.ts`

**Instructions:**

- Use Vercel Firewall/Edge controls or Upstash Ratelimit.
- Protect:
  - consultation intake by IP and user-agent,
  - signed upload by user and matter,
  - signed download by user, document, and matter,
  - messages by user and matter,
  - auth link request flow where applicable.
- Rate-limit responses must not reveal whether an email, document, or matter exists.

**Acceptance Criteria:**

- Abuse of signed URL endpoints is limited.
- Public intake cannot be spammed cheaply.
- Tests cover allowed, limited, and identifier-normalization cases.

**Verification:**

```bash
npm run test -- src/lib/rate-limit.test.ts
npm run build
```

### Ticket 1.6: CSRF And Same-Origin Guard

**Priority:** P0

**Files:**

- Create: `src/lib/request-guard.ts`
- Modify: `src/app/api/consultations/route.ts`
- Modify: `src/app/api/documents/signed-upload/route.ts`
- Modify: `src/app/api/documents/[documentId]/complete/route.ts`
- Modify: `src/app/api/messages/route.ts`
- Create: `src/lib/request-guard.test.ts`

**Instructions:**

- For state-changing browser routes, verify `Origin` and/or `Sec-Fetch-Site`.
- Allow same-origin and explicitly allow preview domains used for staging.
- Reject cross-site POSTs with generic `403`.
- Keep future external API clients separate instead of loosening browser API rules.

**Acceptance Criteria:**

- Office/admin JSON POST routes reject cross-site requests.
- Preview/staging origin allowlist is explicit.

**Verification:**

```bash
npm run test -- src/lib/request-guard.test.ts
npm run build
```

---

## Sprint 2: Data Protection And Operations

**Objective:** Make data handling credible before the first real file enters the system.

### Ticket 2.1: Data Classification And Legal Hold

**Priority:** P0

**Files:**

- Modify: `supabase/migrations/20260605000000_production_foundation.sql`
- Modify: `docs/operations/security-model.md`
- Create: `docs/operations/data-retention-policy-draft.md`

**Instructions:**

- Add matter sensitivity fields.
- Add document classification fields.
- Add legal hold fields.
- Add soft-delete fields for records that need retention-aware deletion.
- Distinguish CPRA deletion requests from legal/business retention obligations.

**Acceptance Criteria:**

- The system can mark sensitive matters.
- The system can block deletion when legal hold applies.
- Counsel has a draft policy to review.

**Verification:**

```bash
supabase db diff
npm run build
```

### Ticket 2.2: Audit Log Hardening

**Priority:** P0

**Files:**

- Modify: `src/lib/crm/audit.ts`
- Modify: `supabase/migrations/20260605000000_production_foundation.sql`
- Create: `src/lib/crm/audit.test.ts`

**Instructions:**

- Use HMAC with a server-side secret for IP/user-agent hashes.
- Add audit event correlation id.
- Make audit logs append-only at application level.
- Do not expose audit modification UI.
- If a correction is needed, add a correction event instead of editing original.

**Acceptance Criteria:**

- Audit hashes are not plain unsalted SHA-256.
- Audit writes failing do not silently hide critical actions during sensitive operations.
- Audit viewer is read-only.

**Verification:**

```bash
npm run test -- src/lib/crm/audit.test.ts
npm run build
```

### Ticket 2.3: Backup And Restore Drill

**Priority:** P0

**Files:**

- Modify: `docs/operations/backup-restore-runbook.md`
- Create: `docs/operations/restore-drill-log.md`

**Instructions:**

- Run one staging restore drill.
- Confirm database restore.
- Confirm object storage recovery expectations.
- Confirm signed download works after restore.
- Record RTO/RPO actuals.

**Acceptance Criteria:**

- Backup is not theoretical.
- Restore drill has date, operator, source backup, target project, result, and gaps.

**Verification:**

```bash
cat docs/operations/restore-drill-log.md
```

### Ticket 2.4: Monitoring And PII Scrubbing

**Priority:** P0

**Files:**

- Create: `src/lib/monitoring.ts`
- Modify: `next.config.ts`
- Modify: `docs/operations/production-readiness.md`

**Instructions:**

- Add Sentry or equivalent.
- Scrub PII, signed URLs, auth tokens, file names if sensitive, and client messages.
- Add alerting for:
  - API 5xx spikes,
  - auth failures,
  - signed URL creation failures,
  - audit write failures,
  - upload completion failures.

**Acceptance Criteria:**

- Production errors are visible.
- Logs do not become a second data leak.

**Verification:**

```bash
npm run build
```

---

## Sprint 3: Secure Document Exchange

**Objective:** Deliver the core client-office value without creating a document leak machine.

### Ticket 3.1: Signed Upload And Download Tests

**Priority:** P0

**Files:**

- Create: `src/app/api/documents/document-routes.test.ts`
- Modify: `src/app/api/documents/signed-upload/route.ts`
- Modify: `src/app/api/documents/[documentId]/download/route.ts`

**Instructions:**

- Test signed download expiry value is 120 seconds.
- Test unavailable documents do not generate URLs.
- Test clients cannot access internal documents.
- Test clients cannot complete uploads they did not initiate.
- Test team users can access tenant documents but not other tenants.

**Acceptance Criteria:**

- Document URL behavior is covered before production.
- Edge cases are not left to manual testing.

**Verification:**

```bash
npm run test -- src/app/api/documents/document-routes.test.ts
npm run build
```

### Ticket 3.2: Malware Scan Or Quarantine

**Priority:** P0

**Files:**

- Modify: `supabase/migrations/20260605000000_production_foundation.sql`
- Modify: `src/app/api/documents/[documentId]/complete/route.ts`
- Create: `src/lib/documents/scanning.ts`
- Create: `docs/operations/document-scanning.md`

**Instructions:**

- Add document statuses such as `quarantined`, `scan_pending`, `scan_failed`, and `available`.
- Do not mark uploaded files `available` until scan policy passes.
- If full scanning service is not ready, launch with manual quarantine: uploaded files are internal-only until advisor approval.
- Document the tradeoff clearly.

**Acceptance Criteria:**

- Client-uploaded files cannot immediately become available without scan/quarantine workflow.
- Advisors can review before sharing.

**Verification:**

```bash
npm run test
npm run build
```

### Ticket 3.3: Document UX

**Priority:** P1

**Files:**

- Modify: `src/app/office/page.tsx`
- Modify: `src/app/admin/page.tsx`
- Create: `src/components/documents/document-list.tsx`
- Create: `src/components/documents/upload-panel.tsx`

**Instructions:**

- Add office document list with status, upload date, and download action.
- Add upload panel that shows allowed types and max size without sounding cheap or technical.
- Add admin document review view.
- Keep visual language restrained and operational, not SaaS-busy.

**Acceptance Criteria:**

- Client can upload and download documents in staging.
- Admin can see pending uploads and approve/reject if quarantine mode is active.

**Verification:**

```bash
npm run build
npm run prototype:test:visual
```

---

## Sprint 4: Internal CRM V1

**Objective:** Make the internal CRM useful enough to run real matters without pretending it is Salesforce.

### Ticket 4.1: Clients And Matters CRUD

**Priority:** P1

**Files:**

- Create: `src/app/admin/clients/page.tsx`
- Create: `src/app/admin/matters/page.tsx`
- Create: `src/components/admin/client-form.tsx`
- Create: `src/components/admin/matter-form.tsx`
- Create: `src/app/admin/admin-routes.test.tsx`

**Instructions:**

- Add create/edit/list for clients.
- Add create/edit/list for matters.
- Matter fields must include status, market, property address, matter type, sensitivity, primary advisor.
- Mutations must be team-only and audit logged.

**Acceptance Criteria:**

- Team can create a client and matter in staging.
- Client cannot access admin mutation routes.

**Verification:**

```bash
npm run test -- src/app/admin/admin-routes.test.tsx
npm run build
```

### Ticket 4.2: Timeline, Notes, NDA, And Invoice Visibility

**Priority:** P1

**Files:**

- Create: `src/components/admin/timeline-editor.tsx`
- Create: `src/components/admin/internal-notes.tsx`
- Create: `src/components/admin/invoice-panel.tsx`
- Create: `src/components/admin/nda-panel.tsx`

**Instructions:**

- Timeline items can be marked client-visible or internal.
- Internal notes never appear in client office.
- Invoice records are manual only in v1.
- Invoice PDF can be associated as a private document.
- NDA record stores version and signed date.

**Acceptance Criteria:**

- Admin can update matter timeline.
- Client office sees only client-visible timeline, invoice visibility, and NDA record.

**Verification:**

```bash
npm run test
npm run build
```

### Ticket 4.3: Audit Viewer And Access Grants

**Priority:** P1

**Files:**

- Create: `src/app/admin/audit/page.tsx`
- Create: `src/components/admin/access-grants.tsx`
- Modify: `src/app/admin/page.tsx`

**Instructions:**

- Add read-only audit viewer.
- Add grant/revoke matter access for clients.
- Every grant/revoke writes audit event.
- Revoked clients immediately lose office matter visibility.

**Acceptance Criteria:**

- Admin can invite/grant/revoke client access in staging.
- Revoked access is reflected in office UI and API responses.

**Verification:**

```bash
npm run test
npm run build
```

---

## Sprint 5: Client Office V1

**Objective:** Make the client-facing secure office feel calm, controlled, and worthy of the brand.

### Ticket 5.1: Client Dashboard

**Priority:** P1

**Files:**

- Modify: `src/app/office/page.tsx`
- Create: `src/components/office/matter-dashboard.tsx`
- Create: `src/components/office/status-timeline.tsx`

**Instructions:**

- Show assigned matters.
- Show status, timeline, recent documents, messages, invoice visibility.
- Keep copy minimal and reassuring.
- Avoid dense SaaS chrome.

**Acceptance Criteria:**

- Client can understand matter status in under 10 seconds.
- No internal fields leak.

**Verification:**

```bash
npm run build
npm run prototype:test:visual
```

### Ticket 5.2: Secure Messaging

**Priority:** P1

**Files:**

- Create: `src/components/office/message-thread.tsx`
- Modify: `src/app/api/messages/route.ts`
- Create: `src/app/api/messages/route.test.ts`

**Instructions:**

- Add matter-scoped message thread.
- Client messages default to `client` visibility.
- Internal users can create internal-only messages.
- Messages are audit logged and rate limited.

**Acceptance Criteria:**

- Client cannot read internal messages.
- Cross-matter message access is denied.

**Verification:**

```bash
npm run test -- src/app/api/messages/route.test.ts
npm run build
```

### Ticket 5.3: Client Office Invite Flow

**Priority:** P1

**Files:**

- Modify: `src/app/sign-in/[[...sign-in]]/page.tsx`
- Modify: `src/app/auth/callback/route.ts`
- Create: `docs/operations/client-invite-flow.md`

**Instructions:**

- Configure invite-only auth.
- Make magic link/login language refined and clear.
- Verify redirect safety.
- Add recovery flow for lost invitation.

**Acceptance Criteria:**

- Client can receive invite, sign in, and land on assigned matter.
- Redirects cannot be abused for open redirect.

**Verification:**

```bash
npm run test
npm run build
```

---

## Sprint 6: Release Hardening

**Objective:** Prepare for real client data without theater.

### Ticket 6.1: Email Deliverability

**Priority:** P0

**Files:**

- Create: `docs/operations/email-deliverability.md`

**Instructions:**

- Configure sending domain.
- Configure SPF, DKIM, and DMARC.
- Test invite/login delivery to Gmail, iCloud, Outlook, and a custom domain.
- Define fallback support process if a client cannot receive login links.

**Acceptance Criteria:**

- Login email deliverability is treated as uptime.
- Failed email delivery has an operational response.

**Verification:**

```bash
dig TXT jamesroman.la
dig TXT _dmarc.jamesroman.la
```

### Ticket 6.2: Legal And Privacy Review Packet

**Priority:** P0

**Files:**

- Create: `docs/legal/privacy-review-packet.md`
- Create: `docs/legal/retention-review-packet.md`
- Create: `docs/legal/nda-workflow-review-packet.md`

**Instructions:**

- Prepare counsel review packets for:
  - privacy policy,
  - CPRA requests,
  - client document handling,
  - NDA records,
  - retention and legal hold,
  - incident notification.
- Do not write final legal language as if it is approved.

**Acceptance Criteria:**

- Counsel can review the operating model without reading source code.

**Verification:**

```bash
ls -la docs/legal
```

### Ticket 6.3: Staging UAT And Production Cutover

**Priority:** P0

**Files:**

- Create: `docs/operations/staging-uat-checklist.md`
- Create: `docs/operations/go-live-checklist.md`

**Instructions:**

- Run full staging test with:
  - owner,
  - advisor,
  - client,
  - sensitive matter,
  - normal matter,
  - document upload,
  - document download,
  - message,
  - invoice visibility,
  - revoked access,
  - backup restore evidence.
- Deploy production only after approval.

**Acceptance Criteria:**

- No real client data enters the system before UAT passes.
- Rollback target is known.
- Visual public site is unchanged.

**Verification:**

```bash
npm run build
npm run test
npm run prototype:test:visual
npx vercel inspect https://www.jamesroman.la
```

---

## Sprint 7: Product-Ready Foundation

**Objective:** Preserve optionality without building a SaaS costume too early.

### Ticket 7.1: Tenant Export And Portability

**Priority:** P2

**Files:**

- Create: `src/lib/export/tenant-export.ts`
- Create: `docs/operations/data-export-format.md`

**Instructions:**

- Export tenant data as JSON plus document manifest.
- Do not expose this to clients in v1.
- Keep it admin/owner-only.

**Acceptance Criteria:**

- James Roman data can be exported in a portable format.

**Verification:**

```bash
npm run test
npm run build
```

### Ticket 7.2: Subdomain Split Decision

**Priority:** P2

**Files:**

- Create: `docs/architecture/subdomain-split-decision.md`

**Instructions:**

- Decide whether to keep one Next app with path routes or split into separate Vercel projects:
  - `www.jamesroman.la`,
  - `office.jamesroman.la`,
  - `admin.jamesroman.la`.
- Consider CSP, cookies, deployment blast radius, visual stability, and operational simplicity.

**Acceptance Criteria:**

- Decision is documented before subdomain implementation.

**Verification:**

```bash
cat docs/architecture/subdomain-split-decision.md
```

---

## Instant Takeover Instructions For A New Agent

Start here:

```bash
cd /Users/romancantelearist/.config/superpowers/worktrees/james-roman-advisory/prototype-liquid-glass
git status --short
git branch --show-current
npx vercel inspect https://www.jamesroman.la
npm run build
npm run test
npm audit --audit-level=moderate
```

Read these files in order:

1. `docs/superpowers/plans/2026-06-05-production-foundation-sprint-plan.md`
2. `HANDOFF_PROTOTYPE2.md`
3. `docs/operations/environment-naming.md`
4. `docs/operations/staging-environment.md`
5. `docs/architecture/payments-contractor-flow.md`
6. `docs/production-architecture-review.md`
7. `docs/operations/security-model.md`
8. `docs/operations/production-readiness.md`
9. `docs/operations/backup-restore-runbook.md`

Hard rules:

- Do not deploy production from the active dirty worktree.
- Do not deploy `dpl_44EVkKaQFs4buprP8dF3nXMC34SC`.
- Do not treat staging as valid until Vercel `Preview` points to separate Supabase staging and Stripe test-mode keys.
- Do not change Prototype2 visuals without explicit approval.
- Do not replace public images without running visual/animation QA.
- Do not store real client documents until P0 launch blockers are complete.
- Do not run live contractor payments until Stripe Connect/payment flow has passed staging and legal/payment review.
- Do not expose or print secrets.
- Do not use service-role key in client/browser code.
- Do not use `npm audit fix --force` without reviewing the resulting dependency change.

Current emergency rollback reference:

```bash
npx vercel rollback https://jr-advisory-n0pqlh56f-roman-2757s-projects.vercel.app --yes --timeout 3m
```

Current live image verification:

```bash
curl -L --fail --silent https://www.jamesroman.la/images/founders/founders-malibu-beach.png | shasum -a 256
# Expected: 2e7fa3fcd62cce3e100b7a1697121eddb36472f6d98bbe3b922d17d340f4d9ac
```

How to take a ticket:

1. Create a fresh branch/worktree for the ticket.
2. Read the ticket acceptance criteria.
3. Write or update tests first where the ticket involves security or business logic.
4. Implement the smallest useful change.
5. Run the ticket verification commands.
6. Update this plan with completion notes.
7. Do not deploy unless the ticket explicitly authorizes deployment and human approval is given.

## Final Self-Review

Spec coverage:

- Current stack, sacred Prototype2, secure office, CRM, encryption, document exchange, portability, and production readiness are covered.
- The rollback lesson is now explicitly included as a visual QA and release-discipline gate.
- The service-role/RLS issue is now a P0 ticket.
- Virus scanning/quarantine is moved into P0.
- CPRA/export/delete and legal hold are P0/P1 operational requirements, not productization fluff.

Known weak points:

- This plan still assumes Supabase remains the chosen managed backend. If Supabase project constraints or compliance terms become unacceptable, revisit Option B before writing more code.
- It does not choose the final malware scanning vendor. Ticket 3.2 allows quarantine as the minimum acceptable v1 control.
- It does not finalize legal language. Counsel must review retention, CPRA, NDA, privacy, and incident language.
- It keeps app routes path-based first. Subdomains are intentionally deferred until the secure foundation is stable.
