# James Roman Advisory — Reconciled Implementation Plan

_Last reconciled: 2026-08-07_
_Evidence baseline: `GRAPH_REPORT.md` (2026-08-01), source review of `main` at `3c6501b`, and the current security documentation. This is a delivery plan, not a claim that unverified production controls are live._

## Executive position

The Private Office is no longer an MVP on paper. It is a working, role-aware operating portal with engagement workflow, correspondence, secure documents, finance, notifications, administrative controls, and first-party authentication.

The center of gravity has changed. The next work is not another portal redesign. It is to close the gaps that decide whether a confidential client system is ready for broader use: client self-service, public/legal surfaces, operational verification, durable security controls, and observability.

The original plan assumed a future Next 15/Drizzle/monorepo build. The delivered system is a single Next.js 16 application with hand-written Neon SQL and idempotent schema helpers. This plan follows the system that actually exists.

## Scope and release truth

| Reference | State | Meaning |
|---|---|---|
| Production source | `main` at `3c6501b` | Includes the merged finance loading-state correction from PR #28. |
| Open local checkout | `agent/message-attachments` at `8ddc9bc` | An older ancestor of `main`; it must not be treated as the production source. The message-attachment work it contains has already been merged, along with later fixes. |
| Local unrelated changes | Present in the open checkout | `skills-lock.json`, `src/app/prototype2/page.tsx`, local skills, and `graphify-out/` remain outside this plan and release train. |
| Runtime claims | Require fresh verification | Source, CI, and a Vercel-ready deployment do not prove a credential cutover, scheduled job, email receipt, backup restore, or production role policy. |

## Reconciliation matrix

| Original intent | Current state | Evidence | Plan action |
|---|---|---|---|
| Next.js App Router, TypeScript, Tailwind | **EXISTS — changed implementation** | `package.json`, `src/app/*` | Keep the single application. Do not introduce the proposed monorepo unless a second independently deployed product justifies it. |
| Drizzle migrations | **NOT ADOPTED** | `@neondatabase/serverless`; schema helpers in `src/lib/db.ts` | Continue with reviewed SQL migrations and the protected migration workflow. Do not add an ORM merely to match the old plan. |
| First-party email/password sessions | **EXISTS** | `src/lib/auth.ts`, `src/lib/password.ts`, `/api/auth/*` | Maintain; keep hosted authentication providers out of scope. |
| MFA for portal users | **PARTIAL** | `src/lib/mfa.ts`, `/mfa`, `AUTH_ACCESS_REVIEW.md` | Staff TOTP plus recovery codes exist. Enroll every staff identity and decide whether client MFA and passkeys are required before broad client onboarding. |
| Four-role access model | **EXISTS** | `src/lib/access-control.ts`, `engagement_memberships`, `/portal/admin` | Continue capability and engagement-scope enforcement. Test every role against the live deployment before each material release. |
| Engagement dashboard and detail workspace | **EXISTS** | `/portal`, `/portal/matters`, `/portal/matters/[id]` | Treat Engagements as the canonical operating record. Continue refinement only where a real operating gap appears. |
| Persisted workflow and tasks | **EXISTS** | `engagement_workflow_items`, `engagement_tasks`, `/api/tasks`, `/api/matters/[id]/workflow` | Finish policy and transition-gate acceptance tests, including staff overrides and evidence requirements. |
| Monday-grade board mechanics | **EXISTS, with bounded scope** | table, Kanban, calendar, workload, filters, saved views in `/portal/matters` and `/api/portal/views` | Improve only from observed staff use. Do not build a general-purpose automation or BI platform. |
| Unified correspondence and notifications | **EXISTS** | `/portal/inbox`, `engagement_messages`, notifications, email delivery records | Exercise live receipt, unread/read, audience, attachment, and error paths for each role. |
| Secure document vault | **EXISTS** | Vercel Blob proxies, versions, download audit, `/portal/vault` | Complete real document lifecycle tests: publish, replace, download, delete, access history, and client isolation. |
| Contracts, invoices, change orders, Stripe payment | **EXISTS** | contracts/invoices/change-orders routes, Stripe Checkout/webhook, RCA PDF routes | Complete finance operational acceptance: draft, issue, reminder, payment, failure, void, change order, and audit history. |
| Super Admin administration | **EXISTS** | users, profiles, invitations, audit, automations, settings in `/portal/admin` | Keep high-impact confirmation and audit behavior. Add a documented lost-factor procedure. |
| Public marketing information architecture | **PARTIAL** | The public site is primarily a single-page narrative; header links are section anchors. There are no dedicated Practice, Principles, People, Jurisdictions, Engagements, Insights, legal, or accessibility routes. | Build the minimum credible public and legal surface before promoting the portal broadly. |
| Consultation intake | **EXISTS** | `ConsultationForm`, `/api/consultations`, Resend notification | Keep a clear submission receipt and verify provider acceptance and mailbox receipt separately. |
| Client requests, account, personal audit log | **MISSING** | No `/api/requests`, `/portal/account`, or client audit route exists. | Build as the next client-facing product phase; do not describe them as live. |
| AI intake, summarization, RAG, drafting | **MISSING by design** | No Anthropic/OpenAI application integration is present. | Defer until a written data-processing, redaction, review, retention, and disclosure decision is approved. |
| RLS for secondary database access | **PARTIAL — readiness only** | `docs/security/RLS_READINESS_PLAN.md` | Keep application authorization authoritative. Do not grant direct database access to secondary tools until the readiness plan is completed and verified. |
| Production runtime database role | **NOT VERIFIED LIVE** | Guarded migration/runtime-role workflow and docs exist; source alone is insufficient proof. | Re-run the cutover evidence gate before relying on this as a live control. |
| Sentry, axe-core, backup drill, external security review | **MISSING / NOT VERIFIED** | No Sentry or axe dependency/CI job; no restore-drill evidence in repository. | Make these operational-release work, not aspirational architecture notes. |

## Architecture that is actually in use

- **Application:** Next.js 16 App Router, React 19, TypeScript, Tailwind, Base UI/shadcn-style primitives.
- **Database:** Neon PostgreSQL through `@neondatabase/serverless`; schema initialization and data operations use reviewed SQL in `src/lib/db.ts`.
- **Authentication:** first-party, opaque hashed sessions; scrypt passwords; staff TOTP with encrypted factor secrets and one-use recovery codes.
- **Authorization:** fixed Super Admin authority; Super Admin-defined Admin/Contractor profiles; global or engagement-assigned scope; resource audiences; server-side capability checks.
- **Storage:** private Vercel Blob. Clients receive authenticated proxy streams, never a raw Blob URL or storage path.
- **Email:** Resend, with portal notification and delivery-record support.
- **Billing:** Stripe-hosted Checkout; signed, idempotent webhook processing is the payment authority.
- **Documents:** RCA-styled PDF endpoints for invoices, change orders, and generated documents.
- **Release controls:** GitHub Actions unit/backend tests, production dependency audit, preview smoke, guarded production migration/runtime-role workflows, and Vercel deployment.

## Current product baseline

### Private Office — shipped capability

- Role-aware shell with global search, quick create, notification center, responsive navigation, and permission-aware modules.
- Command-center dashboard, My Work, engagement board, saved views, filtering, sorting, grouping, pagination, and table/Kanban/calendar/workload views.
- Engagement workspace with persisted workflow items, tasks, stage state, activity, updates, files, finance, and client/property context.
- Threaded engagement messages with explicit audiences, unread state, email/portal notification delivery records, and secure attachments.
- Document vault with metadata, controlled downloads, version upload/history, file-access events, publication/audience controls, and empty/error states.
- Finance records with draft/issue/remind/void controls, contracts, invoices, change orders, payment activity, Stripe Checkout, signed webhooks, and PDF output.
- Super Admin control plane for people, permission profiles, invitations, engagement memberships, audit log, portal settings, and limited audited automation recipes.

### Deliberately not counted as shipped

- Passkeys, client MFA enforcement, personal account/device management, and personal audit-log access.
- Client request intake and SLA workflow.
- Dedicated public practice pages, legal pages, accessibility statement, anonymized case studies, or public insights.
- AI assistance, RAG, automated client-facing summaries, or autonomous outbound communication.
- Sentry/central error monitoring, an automated WCAG gate, independently verified backups, or a completed RLS rollout.

## Delivery sequence

### Release 0 — Evidence and documentation hygiene

**Goal:** make the existing system’s operational claims defensible.

1. Reconcile stale documentation. `docs/SECURITY-POSTURE.md` still describes a static preview and planned auth even though the application has live portal capabilities. Rewrite it from verified controls and clearly labeled unverified controls.
2. Confirm the exact Vercel project, `main` commit, apex and `www` aliases for every production release. Record the deployment URL and SHA in the release handoff.
3. Prove the production runtime database role rather than relying on workflow/doc evidence: correct Vercel `DATABASE_URL`, redeploy, denied schema/role operations, successful application requests, and temporary-secret removal.
4. Run freshly authenticated, read-only role smoke tests for Super Admin, global Admin, assigned Admin, Contractor, and Client. Include forbidden direct-route access checks.
5. Perform a mailbox-receipt test for consultation, invitation, message, and document notification flows. Provider acceptance is not mailbox receipt.
6. Verify the authenticated cron schedule for portal automations and inspect a successful and a failed run record.

**Exit gate:** each claim above has dated production evidence; gaps are marked as gaps, not inferred from code or CI.

### Release 1 — Client self-service and external trust surface

**Goal:** close the largest difference between the current private operating system and the client experience promised in the original plan.

1. Build `/portal/account`: profile, notification preferences, session/device list, password change, MFA status/enrollment, recovery-code handling, and a restrained session-revocation flow.
2. Build client Requests as a persisted, assigned, auditable engagement object with type, status, owner, SLA target, evidence, and client-visible updates. Do not overload messages to simulate requests.
3. Build `/portal/audit` as a client-safe personal activity/access view. Keep the complete security audit server-side and restrict its fields appropriately.
4. Build only the public routes needed for credibility and compliance: Practice, Principles, People, Jurisdictions, Contact/Consultation, Privacy, Terms, and Accessibility. Add anonymized engagements or insights only when approved source material exists.
5. Have California counsel supply privacy, terms, retention, consent, and engagement-letter content. Product can host those artifacts; it should not invent legal language.

**Exit gate:** a client can manage their own account, submit and track a request, see only their own engagement activity, and reach the required public/legal information without encountering placeholder content.

### Release 2 — Security and operational resilience

**Goal:** make the portal dependable under real client data, not merely functional in a happy-path demonstration.

1. Complete staff MFA enrollment and approve a Super Admin lost-factor recovery runbook with identity verification and audit requirements.
2. Decide client MFA policy. The default recommendation is staff MFA mandatory; offer client TOTP at onboarding, then require it only after usability and support implications are tested. Do not promise passkeys until they are implemented.
3. Implement Sentry or an equivalent error monitor with strict PII scrubbing, release identifiers, alert ownership, and a tested incident path.
4. Add automated accessibility checks to CI plus manual keyboard/screen-reader review. Resolve contrast, focus, labeling, reduced-motion, mobile, and error-announcement findings before broad use.
5. Execute a restore drill, document retention/deletion handling, confirm vendor DPAs, and obtain an independent application-security review before sensitive volume grows.
6. Complete the RLS readiness plan before granting any secondary app, reporting tool, or analyst direct database access.

**Exit gate:** MFA, monitoring, accessibility, incident response, backups, and least-privilege controls have executed evidence—not simply repository documentation.

### Release 3 — Operating refinement from real use

**Goal:** refine without turning the Private Office into generic project-management software.

1. Collect real operating friction from Super Admin, Admin, Contractor, and Client sessions. Prioritize missed deadlines, unclear ownership, permission confusion, correspondence visibility, and finance exceptions.
2. Add only validated board improvements: bulk actions, transitions, column/view defaults, workload signals, and automation recipes with ownership and run history.
3. Complete finance exception flows: failed payment, refund if the business process requires it, overdue escalation, and supplemental billing from accepted change orders.
4. Establish performance budgets for board queries and document lists under a realistic seeded dataset; paginate and index before virtualization is introduced.

**Exit gate:** each new operating control solves an observed workflow problem and preserves auditability, scope authorization, and honest loading/error states.

### Release 4 — AI (only after formal approval)

**Goal:** introduce narrow advisor-assist features without making AI a silent participant in confidential client work.

Preconditions: approved vendor/data-processing decision, PII redaction boundary, audit schema, retention policy, disclosure language, human-review workflow, and a failure-mode review.

Sequence: internal consultation triage first; advisor-reviewed document summary second; engagement-scoped retrieval third. Client-visible automation, autonomous replies, and cross-engagement search remain out of scope until separately approved.

## Quality and acceptance gates

Every material release must satisfy these checks in addition to feature-specific tests:

- Role matrix: Super Admin, global Admin, assigned Admin, Contractor, and Client; permitted and forbidden API access; active, absent, revoked, and expired engagement memberships.
- Truthful state: no zero metrics, completed workflow stages, document counts, or payment status may be inferred while data is loading or absent.
- Finance: create, review, issue, reminder, payment success/failure, void, change order, PDF, and audit record.
- Communication: audience isolation, thread/read state, attachment upload/download, notification preference, provider acceptance, and target-mailbox receipt.
- Documents: upload, publish/unpublish, version, preview/download, delete, access log, and scope/audience isolation.
- Security: unauthenticated redirect, same-origin mutation protection, rate-limit fail-closed behavior, token expiry, password recovery session revocation, staff MFA, and audit continuity.
- Experience: keyboard path, visible focus, 44 px targets, mobile flows for inbox/approvals/lookup, empty/loading/error/retry states, and no console errors on core routes.
- Deployment: exact SHA, green CI, correct Vercel project, both production aliases, fresh authenticated smoke test, and a recorded rollback target.

## Decisions retained from the original plan

- James Roman Advisory represents the owner; public materials remain discreet and anonymized.
- The visual direction remains quiet authority: editorial restraint, controlled typography, warm neutral surfaces, and no generic SaaS clutter.
- First-party authentication remains canonical. Clerk and other hosted identity providers remain out of scope.
- Engagement data is private by default. Raw storage URLs, public buckets, fake portal data, and client-name/address disclosure are prohibited.
- Legal, retention, and compliance language require qualified California counsel. A product plan is not legal clearance.

## Open decisions requiring owner direction

1. Should clients be required to enroll TOTP at onboarding, or should it remain optional until a passkey implementation exists?
2. Which public/legal pages have approved copy and source material now? This determines the smallest credible public release.
3. Should client requests support only advisory/site-visit/document/second-opinion categories, or must they include contractor coordination and scheduling?
4. Is direct reporting-tool database access a real near-term need? If not, do not spend RLS rollout effort before it has a concrete consumer.
5. Is AI a near-term revenue/operating need, or should it remain deliberately deferred while the human operating model matures?
