# James Roman Advisory — Delivery Plan

_Reconciled 2026-08-07 against `main` at `16bf7d4`, the security evidence in `docs/security/`, and the account-control implementation in this branch. A checked item means code and/or release evidence exists; it is not a claim about an untested production setting._

## Operating decision

The Private Office is a role-aware operating system, not a set of independent CRUD screens. Engagements remain the canonical record. The application uses Next.js 16, first-party sessions, handwritten Neon SQL, Vercel Blob proxies, Stripe, and Resend. Do not introduce a hosted authentication provider, a monorepo, or an ORM merely to match the obsolete May plan.

## Evidence baseline

| Area | Current state | Evidence |
|---|---|---|
| Production source | Current `main` is `16bf7d4` | Git history, CI workflow optimization merged in PR #32 |
| Runtime database credential | Complete | `docs/security/RLS_READINESS_PLAN.md`: protected provisioning and Vercel runtime cutover were completed 2026-08-01 |
| Runtime DDL | Removed from request handling | `src/lib/schema-readiness.ts`, protected migration workflow |
| Public legal release | Complete | `/privacy`, `/cookies`, `/accessibility`, `/nda`, and `/terms → /nda`; PR #30 |
| Portal account control | Complete in this branch; not yet production evidence | `/portal/account`, `/api/portal/account`, `/api/portal/account/mfa` |
| Production RLS | Deliberately not enabled | `docs/security/RLS_READINESS_PLAN.md` |

## Completed foundation

- [x] First-party email/password sessions with opaque, hashed session tokens.
- [x] Four roles: Super Admin, Admin, Contractor, and Client, with server-side capability and engagement-scope enforcement.
- [x] Staff MFA challenge, encrypted TOTP secret storage, and hashed recovery codes.
- [x] Shared, role-aware Private Office shell with navigation, workspace search, notification center, mobile drawer, and authenticated sign-out.
- [x] Engagement board with filtering, saved views, table/Kanban/calendar/workload modes, bulk operations, ownership, priority, health, and next-action fields.
- [x] Persisted engagement tasks and workflow requirements; stage gates and Super Admin overrides are recorded instead of inferred from a status label.
- [x] My Work and an operational command center for assigned, overdue, unread, review, finance, and access work.
- [x] Engagement workspace with Overview, Work, Updates, Files, Finance, and Activity context.
- [x] Threaded inbox with read receipts, audience controls, attachments, engagement context, notifications, and email preferences.
- [x] Secure document vault with authenticated download proxy, versions, preview/metadata/review controls, access history, and publication audiences.
- [x] Contracts, invoices, change orders, Stripe payment flow, RCA-style PDF output, finance statuses, reminders, and auditable sensitive actions.
- [x] Super Admin users, permission profiles, invitations, scoped memberships, audit log, automation controls, and workspace settings.
- [x] Public privacy, cookie, accessibility, NDA, and terms surfaces; no fabricated legal claims.

## Release 1 — client self-service and external trust

### Account controls — highest priority

- [x] `/portal/account` exposes the authenticated user’s name, managed email identity, role, last sign-in, and active session records without inventing device/location data.
- [x] Users can update only their own display name; email changes remain an office-controlled identity action.
- [x] Password changes require the current password, reject reuse of the current password, revoke all other sessions, clear pending login challenges, and write an audit event in the same transaction.
- [x] Users can revoke other sessions while preserving the current browser session; the action is audited.
- [x] Users can enroll, confirm, regenerate recovery codes for, and disable TOTP MFA. Sensitive MFA changes require current-password confirmation; disabling MFA also requires a fresh authenticator code.
- [x] Users can manage personal email notification preferences from the account area.
- [x] Account security mutations fail closed when distributed rate limiting is unavailable.
- [ ] Add a client request workflow (type, SLA, assignee, status, attachments) before representing requests as an available service.
- [ ] Add a personal access-history view only after the event model includes a deliberately minimized, client-safe event vocabulary. Do not expose the administrative audit log verbatim.
- [ ] Have California counsel review and publish the remaining public trust content: Practice, Principles, People, Jurisdictions, and any client-facing retention/rights claims.

**Release gate:** freshly authenticated Client, Contractor, Admin, and Super Admin journeys prove account ownership boundaries, session revocation, MFA recovery, notification preferences, and client-only engagement isolation.

## Release 2 — security and operational resilience

- [x] Runtime application access uses the non-owner `jra_app_runtime` credential; production DDL, role administration, inherited roles, ownership, and RLS bypass were denied and evidenced during the 2026-08-01 cutover.
- [x] The owner migration credential is isolated to the reviewer-protected production migration environment.
- [x] Request code uses a read-only schema-version gate rather than schema bootstrapping.
- [x] Sensitive login, recovery, MFA, account-security, invite, seed, and consultation mutation paths use mandatory distributed rate limiting.
- [ ] Document and rehearse an identity-verified lost-factor recovery procedure for Super Admin. This is an operational control, not a UI shortcut.
- [ ] Complete staged database RLS only after introducing request-scoped transactional context; current Neon HTTP batches cannot safely carry per-request identity into policies. See `docs/security/RLS_READINESS_PLAN.md`.
- [ ] Add production error monitoring with PII scrubbing, deploy metadata, alert ownership, and a tested alert path.
- [ ] Produce backup-retention evidence and complete a disposable-branch restore drill.
- [ ] Complete a current dependency audit and remediation pass; do not report clean status without the exact command output.
- [ ] Run a controlled third-party penetration test before expanded client onboarding.

**Release gate:** protected production verification shows no runtime DDL authority, no lost audit writes, correct role/scope denial behavior, current security headers, delivered critical email, and a rehearsed restore path.

## Release 3 — durable operating refinement

- [ ] Gather observed staff friction from real use before expanding board configuration or automations.
- [ ] Run keyboard, screen-reader, contrast, reduced-motion, and mobile acceptance across Home, Engagements, Work, Inbox, Documents, Finance, Access, and Account.
- [ ] Establish performance budgets for initial board load, filter/sort response, document preview, PDF generation, and inbox search using representative data volume.
- [ ] Add only the automations whose trigger, owner, recipient, failure state, and audit history are defined: overdue work, document review, stage blocker, client message, and invoice reminder.
- [ ] Treat workflow template changes as versioned operations and verify that existing engagements are never silently rewritten.

**Release gate:** an Admin can identify ownership, urgency, blockers, next action, unread correspondence, pending documents, and finance risk without opening every engagement; keyboard and mobile critical paths are verified.

## Release 4 — AI (deliberately deferred)

- [ ] Define a concrete operating need and approved data boundary before adding AI.
- [ ] Require source-scoped retrieval, no cross-engagement access, human approval before outbound communication, redaction where appropriate, audit logging, and an opt-out/deletion policy approved by counsel.

**Decision:** AI does not enter the portal simply because the old plan mentioned it. The current risks are operational quality and confidentiality, not lack of model features.

## Acceptance checklist for every release

- [ ] Confirm the exact source SHA, repository, deployment, and both production aliases.
- [ ] Run lint, TypeScript, focused unit tests, the full unit suite, and the relevant integration or browser suite.
- [ ] Exercise all four roles through UI and direct API paths; test global, assigned, revoked, and expired access where applicable.
- [ ] Verify workflow evidence and stage gates, messages/audiences, document publication/download, finance status transitions, and audit entries relevant to the release.
- [ ] Run a freshly authenticated production smoke test after deployment; provider acceptance is not proof of email receipt.
- [ ] Record evidence, failures, rollback target, and unresolved risks before closing the release.

## Deferred decisions requiring owner or counsel input

1. Who is authorized to verify a lost Super Admin factor, what evidence is required, and who records the recovery event?
2. What client-request categories, SLAs, and escalation owners are commercially real enough to implement?
3. Which public Practice, Principles, People, Jurisdictions, and engagement claims have written approval?
4. What retention, deletion, privacy-rights, and consent language has California counsel approved?
5. Is direct database access by any secondary system actually needed? If yes, RLS and transactional identity context become a precondition rather than optional hardening.
