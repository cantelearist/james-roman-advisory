# James Roman Advisory Production Architecture Review

Updated after cross-review on June 5, 2026.

## Executive Summary

Prototype2 remains the public front-of-house experience. That decision is locked.

The production system should be organized around three surfaces:

- `www.jamesroman.la`: public marketing site, Prototype2 design, mostly static, fast, elegant.
- `office.jamesroman.la` or `/office`: secure client office for documents, messages, matter status, engagement/NDA records, and invoice visibility.
- `admin.jamesroman.la` or `/admin`: private internal CRM for team operations, client records, matters, documents, messages, invoices, timeline, internal notes, and audit logs.

The recommended v1 architecture is still Option A: keep Vercel and Next.js for the public/front-end layer, consolidate backend services around Supabase Postgres/Auth/Storage, and build a custom CRM on that managed foundation.

The cross-review did not require a redesign. It did identify real production-readiness gaps. The highest-priority updates are rate limiting, explicit CORS/CSRF policy, CPRA export/deletion before launch, email deliverability, RTO/RPO targets, session policy, and clearer operational definitions.

The correct posture is simple: premium public experience, secure managed backend, strict access control, clear audit trail, boring operations.

## Cross-Review Corrections Incorporated

The following changes are now part of this architecture review:

- `src/proxy.ts` is recognized by the current Next build as middleware/proxy. Local `next build` output includes `Proxy (Middleware)`. This remains a Vercel deployment verification item, not a presumed fail-open defect.
- Signed download URL expiry is explicitly defined as 120 seconds in the current code and this report.
- CSP/security headers are moved into the secure foundation phase, not treated as late hardening.
- Rate limiting is added as a pre-production requirement.
- Same-origin CORS and CSRF policy are added as pre-production requirements.
- CPRA export and deletion move from productization to pre-launch production hardening.
- Invoice and consultation intake workflows are defined for v1.
- Email deliverability is upgraded to a medium/high operational dependency because login relies on email links.
- RTO/RPO targets are added.
- Operational runbooks are linked.
- Client MFA policy is clarified.
- PostCSS advisory ownership and check-back are added.
- Session timeout, idle expiration, and concurrent session policy are added.
- Staging is mandatory before production. Vercel Preview exists, but it is not a valid full staging environment until Preview points to a separate Supabase staging project and Stripe test-mode keys.
- Contractor payments from the client office are added as a staged architecture requirement. This should use a Stripe Connect-style model in test mode first, not a simple production invoice button.

## Current Stack Audit

Current repo state:

- Frontend: Next.js 16.2.6, React 19, TypeScript, Tailwind/shadcn-style components, Motion/GSAP/Lenis.
- Hosting target: Vercel, with `www.jamesroman.la` as the public production domain.
- Staging target: Vercel Preview deployments plus separate Supabase staging project. Preview must not point to production Supabase.
- Public experience: Prototype2 powers `/`, `/prototype`, and `/prototype2`.
- Backend before hardening: minimal Next API routes, fragmented auth/database direction, and no real document exchange layer.
- Backend after foundation work: Supabase client/server helpers, secure route protection, CRM shell, client office shell, signed document APIs, messaging APIs, and production schema migration.
- Database direction: Supabase Postgres.
- Auth direction: Supabase Auth, invite-only, MFA required for internal users.
- Storage direction: Supabase Storage private bucket `case-files`.
- CRM: internal custom CRM shell exists at `/admin`; schema supports clients, matters, documents, messages, invoices, NDA records, internal notes, access grants, file events, and audit logs.
- Portal: legacy `/portal` redirects to `/office`.
- Consultation intake: public consultation form posts to `/api/consultations`, which writes to `consultation_requests` through the server-only Supabase service role.
- Email: Supabase Auth email is required for invite/login links. Resend or equivalent should be used for non-auth notifications after core auth deliverability is configured.
- Payments: Stripe env vars exist in Vercel, but contractor payments are not production-ready. Payment architecture must be staged with Stripe test mode and Connect-style contractor accounts before any live money movement.
- Analytics: no production analytics layer is required for v1; keep public analytics privacy-conscious if added.

Implementation evidence:

- Supabase migration: `supabase/migrations/20260605000000_production_foundation.sql`
- Protected route boundary: `src/proxy.ts`
- Security headers/CSP: `src/lib/security.ts` and `next.config.ts`
- Supabase env helpers: `src/lib/supabase/env.ts`
- Auth context: `src/lib/crm/auth.ts`
- CRM access helpers: `src/lib/crm/data.ts`
- Audit logging: `src/lib/crm/audit.ts`
- Signed upload/download APIs: `src/app/api/documents/*`
- Secure messages API: `src/app/api/messages/route.ts`
- Safe redirect helper: `src/lib/safe-redirect.ts`

Version note:

- Next.js 16.2.6 is declared in `package.json` and passes local build. Confirm the same version/stability posture before production deployment. If deployment tooling flags this version as canary or unsupported, pin to the latest stable release approved by Vercel.

Migration timestamp note:

- The migration file is named `20260605000000_production_foundation.sql`. Confirm numbering against the remote Supabase migration history before applying to staging or production.

## Risk Map

Highest-priority risks:

- External setup risk: Supabase staging/production projects, migrations, Auth MFA, email templates, and Vercel environment variables are not completed by code alone.
- Access-control risk: every client-facing view must remain matter-scoped and grant-aware. Application checks and RLS helpers now represent this, but real user testing is still required.
- Rate limiting risk: signed upload, signed download, messaging, auth, and consultation intake need rate limits before sensitive production use.
- CORS/CSRF risk: same-origin policy and state-changing request protections must be explicit before office/admin APIs are considered production-ready.
- CPRA operations risk: export and deletion capability must exist before real California client data is stored.
- Document handling risk: signed URLs are implemented, but virus scanning, file classification, and legal-hold workflows are not yet implemented.
- Retention/legal risk: matter retention, NDA retention, CPRA language, and incident notification policy need counsel review.
- Email deliverability risk: invite-only login depends on email. Login-link deliverability is uptime for the client office.
- Operations risk: backup/restore is documented but must be tested before real files are stored.
- Monitoring risk: Sentry or equivalent production monitoring is documented as a gap and should be added before storing sensitive production data.

Medium-priority risks:

- Client MFA ambiguity: sensitivity-based MFA must be operationally defined before launch.
- Invoice workflow ambiguity: invoices are represented in schema and UI, but v1 process must be constrained.
- Audit forensic tradeoff: hashed IP/user-agent is privacy-conscious, but weakens some incident-response investigations.
- RTO/RPO ambiguity: recovery expectations must be set before real files are stored.
- Vendor/config risk: legacy Clerk/Neon/Stripe/Supabase/Resend variables in Vercel must be cleaned and rotated where appropriate.
- Dependency risk: current production audit has no high/critical findings. A moderate PostCSS advisory exists through Next, but npm's suggested force fix is a breaking downgrade and should not be applied blindly.

Lower-priority risks:

- Multi-tenant productization risk: `tenant_id` is present from day one, but full SaaS tenant admin, billing, and org management are intentionally deferred.
- Subdomain risk: code works path-based first; `office.` and `admin.` domain mapping still requires Vercel setup.

## Option A: Rearrange Current Stack

Recommended production v1.

Architecture:

- Keep Next.js and Vercel for the public site and app shell.
- Use Supabase as the main backend:
  - Supabase Postgres for CRM/case data.
  - Supabase Auth for managed login, invite-only access, MFA, and session handling.
  - Supabase Storage for private client files with signed URLs.
  - Postgres RLS for client/team data boundaries.
- Add Vercel Firewall/Edge controls or Upstash rate limiting before sensitive launch.
- Use Resend or equivalent for non-auth transactional notifications after auth deliverability is stable.
- Add Sentry or equivalent monitoring before sensitive launch.
- Keep Stripe out of v1 unless online payment becomes a confirmed requirement.

Why this fits:

- Simple and coherent.
- Managed auth and storage avoid unnecessary custom security machinery.
- Postgres remains portable.
- Supabase RLS gives a strong second authorization layer.
- Suitable for 5,000 visitors/month and substantially more.
- Product-ready foundation without premature SaaS complexity.

Main tradeoff:

- Less portable than a fully self-hosted backend, but far more maintainable for a small team.

Estimated monthly cost:

- Likely `$150-$750/month` for v1 depending on Supabase plan, storage, backups, Vercel, monitoring, email, and rate limiting.

## Option B: Start From Scratch

Use only if the CRM is expected to become a standalone SaaS product soon.

Architecture:

- Monorepo with separate apps:
  - `apps/web`: public marketing site.
  - `apps/office`: client office.
  - `apps/admin`: internal CRM.
  - `apps/api`: dedicated backend API.
  - `packages/ui`: shared design system.
  - `packages/db`: schema, migrations, RLS/access policy.
- Backend:
  - PostgreSQL on AWS RDS, Neon, or Supabase Postgres.
  - S3 or Cloudflare R2 for private documents.
  - Auth0, Clerk, or Supabase Auth for identity.
  - Dedicated worker for virus scanning, PDF processing, email, retention jobs, export jobs, and deletion workflows.
- Deployment:
  - Public site can stay on Vercel.
  - API/worker on Fly.io, Railway, Render, AWS ECS, or similar Docker-based hosting.
  - S3-compatible storage abstraction for portability.

Why this fits later:

- Cleaner future SaaS separation.
- More portable infrastructure.
- Better for many tenants, complex roles, and dedicated operations.
- Easier to add background processing and enterprise-grade observability.

Why not v1:

- More expensive.
- More moving parts.
- Slower to launch.
- Requires stronger DevOps ownership.
- Higher chance of overbuilding before real workflow feedback matures.

Estimated monthly cost:

- Lean: `$300-$1,000/month`.
- More serious security/observability posture: `$750-$2,000/month`.
- Engineering time is the real cost.

## CRM Model

The CRM is the internal source of truth. The client office displays a controlled subset.

Core entities:

- Tenants
- Profiles
- Clients
- Matters
- Access grants
- Documents
- Messages
- Timeline events
- Invoices
- NDA records
- Internal notes
- File access events
- Audit logs
- Consultation requests

Roles:

- `owner`
- `admin`
- `advisor`
- `client`

V1 boundaries:

- No contractor, attorney, or insurance guest roles.
- No live online payments until payment architecture, legal review, Stripe test-mode staging, and production approval are complete.
- No full SaaS billing.
- Single tenant operationally, tenant-ready structurally.

### Contractor Payment Workflow

Payment requirement:

- Clients should eventually be able to pay contractors from the secure online office.

Architecture impact:

- This is not critical to the first secure document-office foundation, but it is critical to the data model and compliance boundary.
- Use Stripe Connect-style architecture, not a simple direct invoice button, because funds are intended to move from client to contractor.
- Keep all payment work in staging with Stripe test-mode keys until separately approved.

V1 staged payment flow:

1. Internal team creates or approves a contractor record.
2. Contractor completes Stripe test-mode onboarding in staging.
3. Internal team creates a matter-scoped payment request.
4. Owner/admin approves payment request visibility.
5. Client sees the payment request in the office.
6. Client pays through Stripe-hosted Checkout or embedded Checkout.
7. Stripe webhook updates payment status.
8. CRM records payment events and audit logs.

Do not activate live contractor payments until merchant-of-record, fee responsibility, refunds, disputes, contractor compliance, and client-facing payment language are reviewed.

### Consultation Intake

V1 consultation intake path:

1. Public contact form submits to `/api/consultations`.
2. The API validates payloads with Zod.
3. The API writes to `consultation_requests` through the server-only Supabase service role.
4. Advisor reviews the request in the internal CRM or an admin review queue.
5. Only accepted matters become clients/matters/access grants.

No document upload should be available before engagement acceptance and office access issuance.

### Invoice Workflow

V1 invoice workflow:

- Invoices are created manually by an internal user.
- The CRM stores invoice number, status, amount, currency, issue date, due date, and visible-to-client flag.
- If a formal invoice PDF is needed, upload it as a private document and associate it with the matter.
- The client office shows invoice status and, where applicable, a signed download link for the PDF.
- Online payment is deferred until payment workflow is explicitly approved.

This keeps invoice visibility professional without prematurely building accounting software.

## Security Model

### Identity

- Supabase Auth.
- Invite-only accounts.
- MFA required for all internal users.
- Disabled profiles are treated as unauthenticated.
- Client MFA policy:
  - Default: optional client MFA for low-sensitivity matter status access.
  - Required: client MFA for matters with active insurance/legal disputes, sensitive property documents, hazardous-material reports, or any client request for elevated security.
  - Decision owner: `owner` or `admin`.
  - Enforcement mechanism: Matter sensitivity flag and/or profile-level MFA requirement before production launch.

### Authorization

- `/office`, `/admin`, and `/portal` are protected by `src/proxy.ts`.
- Current local build recognizes `src/proxy.ts` as `Proxy (Middleware)`.
- Production deployment must verify that Vercel build output also shows proxy/middleware registration.
- Missing Supabase public env fails closed.
- Internal CRM requires team role.
- Client access requires active access grants.
- Document view/upload and messaging permissions are grant-aware.
- RLS mirrors client/team data boundaries inside Postgres.

### Signed URLs

- Private documents are never public.
- Signed upload URLs are created only after authentication and matter upload permission checks.
- Signed download URLs are created only after authentication and matter document-view permission checks.
- Current signed download expiry: 120 seconds.
- Acceptance tests must verify expiry behavior before launch.

### Rate Limiting

Rate limiting is required before storing sensitive client data.

Minimum v1 rate limits:

- Auth/login link requests: limit by IP and email.
- Consultation intake: limit by IP and user agent.
- Signed upload URL creation: limit by authenticated user and matter.
- Signed download URL creation: limit by authenticated user, document, and matter.
- Messages API: limit by authenticated user and matter.

Implementation options:

- Vercel Firewall/Edge rate limiting where available.
- Upstash Redis plus `@upstash/ratelimit`.

Rate limits should return generic errors and should not reveal whether an email, matter, or document exists.

### CORS And CSRF

V1 policy:

- Same-origin browser use only.
- No third-party browser clients.
- No public cross-origin office/admin API access.
- State-changing JSON routes should verify `Origin` or `Sec-Fetch-Site` before processing.
- Preview deployments should use an explicit allowlist.
- Form submissions should stay same-origin.
- If future mobile or external clients are added, introduce a separate API auth model instead of loosening office/admin browser rules.

### Session Policy

Minimum v1 session policy:

- Internal users: MFA required, idle timeout target of 30 minutes, maximum session age of 8 to 12 hours.
- Clients: idle timeout target of 60 minutes, maximum session age of 24 hours unless matter sensitivity requires shorter.
- Concurrent sessions: allow limited concurrent sessions for clients, but expose manual session revocation to admins before full launch.
- Lost-device response: disable profile, revoke grants if needed, and rotate affected secrets.

Supabase dashboard/session settings must be configured to match this policy before launch.

### Audit Logging

Audit logs record:

- Actor id.
- Tenant id.
- Action.
- Resource type.
- Resource id.
- Hashed IP.
- Hashed user agent.
- Limited metadata.

Tradeoff:

- Hashing IP/user-agent reduces stored personal data and supports privacy posture.
- It also weakens some forensic investigations.
- Under CPRA, hashed IP tied to an account may still be personal information if re-identifiable in context.

Required decision before launch:

- Define hash algorithm and salting strategy.
- Decide whether production uses unsalted hash, rotating salt, or HMAC with a server-side secret.
- Document which incident scenarios are accepted as harder to investigate.

### Secrets

- Service role key is server-only.
- No passwords or client credentials should be stored in CRM tables.
- Old auth/database env vars must be removed or rotated after cutover.

## Encryption Model

V1 uses managed auth plus server-side encryption and strict authorization.

Included:

- Provider encryption at rest for database/storage.
- Private storage bucket.
- Signed download URLs expiring in 120 seconds.
- Signed upload URLs.
- Server-only service role.
- No public document URLs.

Not included in v1:

- True end-to-end encryption.
- Client-side key management.
- Dedicated KMS envelope encryption.

Potential v2 upgrades:

- Application-level field encryption for especially sensitive structured fields.
- KMS-managed object encryption if vendor/customer requirements demand it.
- Virus scanning and file quarantine worker.
- Document classification and retention automation.

## Deployment Model

Recommended:

- Vercel production and preview deployments.
- Supabase staging and production projects.
- Stripe test mode for Preview/staging and Stripe live mode only after approval.
- Path-based launch first:
  - `/`
  - `/office`
  - `/admin`
- Subdomains later or during launch hardening:
  - `www.jamesroman.la`
  - `office.jamesroman.la`
  - `admin.jamesroman.la`

Required Vercel env vars:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY` for staging test mode and later production live mode.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` for staging test mode and later production live mode.
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CONNECT_CLIENT_ID` if Connect onboarding uses OAuth-style flow.

Production deployment checks:

- Apply migrations to staging first.
- Test invite/login/MFA.
- Test session timeout policy.
- Test client matter access.
- Test signed upload/download expiration.
- Test rate limits.
- Test same-origin state-changing routes.
- Test backup restore.
- Verify no seed/debug endpoints are deployed.
- Verify sensitive env vars are marked sensitive.
- Verify Vercel build output recognizes `src/proxy.ts` as proxy/middleware.

## Migration Plan

### Phase 1: Stabilize Current Production

- Keep Prototype2 as `/`.
- Keep `/prototype` and `/prototype2` available.
- Remove or disable seed/debug endpoints.
- Remove broken auth fail-open behavior.
- Clean Vercel env vars.
- Document deploy and rollback process.

### Phase 2: Secure Foundation

- Create Supabase staging and production.
- Apply the production migration.
- Configure invite-only Auth.
- Enforce MFA for internal users.
- Confirm private `case-files` storage.
- Confirm RLS policies.
- Keep CSP/security headers active from the beginning.
- Create first owner/admin profile.
- Configure Supabase Auth email templates.
- Configure custom sending domain, SPF, DKIM, and DMARC.

### Phase 3: Internal CRM

- Build out client records.
- Build out matter records.
- Add matter sensitivity flag.
- Add engagement status.
- Add document list.
- Add message threads.
- Add internal notes.
- Add invoice manual entry and PDF association.
- Add timeline events.
- Add audit viewer.

### Phase 4: Client Office

- Invite-only access.
- Matter dashboard.
- Secure upload/download.
- Advisor-client messages.
- Timeline/status.
- NDA/engagement records.
- Invoice status and signed invoice PDF download where applicable.
- Client MFA enforcement for sensitive matters.

### Phase 5: Production Hardening Before Real Client Data

- Backup restore drill.
- RLS/policy tests.
- File URL expiration tests.
- MFA tests.
- Rate limiting.
- Same-origin CORS/CSRF checks.
- Session timeout and revocation tests.
- Sentry or equivalent monitoring.
- Incident response runbook.
- Retention policy.
- CPRA export capability.
- CPRA deletion workflow, subject to legal retention constraints.
- Privacy/legal review.
- PostCSS advisory check-back.

### Phase 6: Product-Ready Foundation

- Keep `tenant_id` on all business tables.
- Separate tenant config from James Roman config.
- Add migration docs.
- Add broader export tooling for future tenant portability.
- Delay SaaS tenant billing until productization is real.

## Recovery Targets

Minimum v1 targets pending business approval:

- Public site RTO: 1 hour via Vercel rollback.
- Office/Admin RTO: 4 business hours for active matters.
- Database RPO: 24 hours minimum, tighter if Supabase PITR is enabled.
- Document metadata RPO: 24 hours minimum.
- Object storage recovery: confirm with Supabase plan and document the limitation before launch.

Backup/restore runbook:

- `docs/operations/backup-restore-runbook.md`

Production readiness checklist:

- `docs/operations/production-readiness.md`

Security model:

- `docs/operations/security-model.md`

## Cost And Complexity Comparison

Option A:

- Monthly cost: likely `$150-$750/month`.
- Complexity: low to moderate.
- Team fit: strong for small dev team.
- Security posture: strong enough for v1 if configured and tested properly.
- Portability: moderate; Postgres schema remains portable.
- Launch speed: fastest.
- Risk: vendor dependency and external Supabase/Vercel configuration quality.

Option B:

- Monthly cost: likely `$300-$2,000/month`.
- Complexity: moderate to high.
- Team fit: requires stronger DevOps ownership.
- Security posture: can be stronger long-term but easier to misconfigure early.
- Portability: high.
- Launch speed: slower.
- Risk: overbuilding and operational drag.

## Final Recommendation

Choose Option A.

Do it decisively:

- Keep Prototype2 untouched unless separately approved.
- Use Supabase for Postgres, Auth, MFA, and private Storage.
- Keep Vercel for public delivery and app routes.
- Build the CRM custom.
- Keep the architecture tenant-ready, not SaaS-heavy.
- Add rate limiting, same-origin checks, email deliverability, monitoring, and backup restore before storing real client files.
- Move CPRA export/deletion from future productization into pre-launch hardening.
- Defer contractor/attorney guest roles, online payments, true E2E encryption, and full SaaS billing.

The right posture is premium restraint: minimal visible complexity, strong controls, clean records, and enough portability that the system can become a product later without forcing a full rewrite.

## Acceptance Criteria

The production foundation is ready to launch sensitive workflows only when:

- Public site loads fast and preserves Prototype2 quality.
- `/office` and `/admin` reject unauthenticated users.
- Vercel deployment confirms proxy/middleware registration.
- Internal users use MFA.
- Sensitive matters can require client MFA.
- Clients only see assigned matters.
- Documents are private and never public.
- Signed download URLs expire in 120 seconds.
- Document and message access is audit logged.
- Rate limits protect auth, intake, signed URL, and message routes.
- State-changing office/admin routes enforce same-origin policy.
- Session timeout and revocation policy is configured.
- Backups exist and restore has been tested.
- RTO/RPO targets are documented.
- Sensitive env vars are rotated and marked secret/sensitive.
- Seed/debug/admin fallback endpoints are absent from production.
- CPRA export and deletion workflows exist, subject to retention rules.
- Counsel has reviewed privacy, retention, NDA, and client-document handling language.
- Email deliverability has been configured and tested.
- Monitoring is active.

## Dependency Advisory Tracking

Current audit status:

- No high/critical production vulnerabilities were found in the last local audit.
- A moderate PostCSS advisory exists through the current Next dependency chain.
- Do not run `npm audit fix --force` because npm proposes a breaking downgrade.

Owner:

- Engineering owner before launch.

Check-back:

- Recheck after the next Next.js patch release or before production deployment, whichever comes first.

## Current Status

Implemented locally:

- Option A foundation.
- Supabase schema migration.
- Supabase auth helpers.
- Protected office/admin routes.
- Client office shell.
- Internal CRM shell.
- Signed document APIs.
- Message APIs.
- Audit logging helper.
- Safe internal redirect handling.
- CSP/security headers.
- Operational runbooks.

Not completed by code:

- Supabase project creation.
- Supabase Auth/MFA dashboard configuration.
- Remote migration application.
- Vercel production env cleanup/rotation.
- Rate limiting.
- CORS/CSRF enforcement beyond basic same-origin assumptions.
- Session timeout/revocation configuration.
- CPRA export/deletion workflows.
- Backup restore drill.
- Legal policy review.
- Monitoring setup.
- Email deliverability configuration.

## Launch Blockers

Do not store real client documents until these are complete:

- Supabase staging/prod created and migrated.
- Auth invite-only and MFA configured.
- Vercel env vars cleaned, rotated, and marked sensitive.
- Proxy/middleware registration verified in deployed build.
- Rate limiting enabled.
- Same-origin CORS/CSRF checks implemented and tested.
- Signed URL expiry tested.
- Backup restore drill completed.
- RTO/RPO accepted.
- CPRA export/deletion process defined and implemented.
- Legal review completed.
- Email deliverability configured and tested.
- Monitoring enabled.
