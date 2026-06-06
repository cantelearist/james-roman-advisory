# Security Model

## Security Position

The v1 security model is managed-auth plus server-side encryption and strict authorization. It is not true end-to-end encryption.

That is the correct v1 tradeoff: strong enough for a boutique client office, maintainable by a small team, and portable enough for future productization.

## Identity

- Supabase Auth manages user identity.
- Public signup is not used.
- Internal users must use MFA.
- Client MFA can be optional or step-up based on matter sensitivity.
- Disabled profiles are treated as unauthenticated by application code.

## Authorization

Roles:

- `owner`
- `admin`
- `advisor`
- `client`

Rules:

- Team roles can access tenant-scoped CRM data.
- Clients access matters only through active `access_grants`.
- Internal notes are team-only.
- Client office data is a controlled subset of CRM data.
- Application code checks matter access before issuing storage URLs.
- Postgres RLS mirrors the same boundaries for direct table access.
- Database-level RLS tests live in `supabase/tests/rls.sql` and must pass before sensitive staging or production data is used.

## Same-Origin Request Guard

State-changing browser routes must call `enforceSameOriginRequest()` before parsing request bodies or checking authenticated data.

The guard allows exact same-origin requests, known James Roman domains, localhost development, and explicitly configured origins from `JRA_ALLOWED_ORIGINS`. Cross-site browser requests are rejected with a generic `403`.

Protected routes include consultation intake, signed document upload, upload completion, and message creation.

## Rate Limiting

Application route handlers enforce generic rate limits for public intake, signed upload URLs, signed download URLs, message listing, and message creation.

Current route-level limits are in-process and protect local/staging behavior. Production should pair these with Vercel Firewall, Upstash Ratelimit, or another durable edge-backed limiter so limits survive serverless instance churn.

Rate-limit responses must stay generic and must not reveal whether an email, document, matter, or user exists.

## Documents

- Documents live in the private `case-files` bucket.
- No public document URLs.
- Uploads are created through signed upload URLs.
- Completed uploads move to `scan_pending`, not directly to `available`.
- Only `available` documents can receive signed download URLs.
- Downloads are created through short-lived signed URLs.
- Document metadata is stored in Postgres.
- Every upload completion and signed download request writes a file access event and audit event.
- Manual quarantine is the minimum v1 control until a malware scanning worker is selected and verified.
- Documents carry classification, sensitivity, retention, legal-hold, and soft-deletion metadata.

## Data Classification And Retention

Matters carry a sensitivity level:

- `standard`
- `sensitive`
- `restricted`

Documents carry both a sensitivity level and a classification:

- `general`
- `property`
- `financial`
- `legal`
- `restricted`

Matters and documents can be placed under legal hold. Normal database operations block hard deletion of matters/documents, and legal hold blocks soft deletion as well.

Deletion requests are recorded separately from deletion execution. CPRA deletion requests must be reconciled with legal hold, active matter obligations, insurance/dispute needs, payment/accounting retention, and counsel-approved retention periods.

See `docs/operations/data-retention-policy-draft.md`.

## Audit Logging

Audit logs record:

- Actor id.
- Tenant id.
- Action.
- Resource type.
- Resource id.
- Correlation id.
- HMAC-hashed IP.
- HMAC-hashed user agent.
- Limited metadata.

Audit logging must remain append-only in production operations. A database trigger blocks audit row updates and deletes unless an explicit maintenance setting is enabled for controlled local tests or approved recovery work. If edits are ever needed for legal reasons, preserve the original record and add a correction event.

Audit hash secrets are environment-specific. Staging and production must not share `AUDIT_HASH_SECRET`.

See `docs/operations/audit-logging.md`.

## Monitoring

Structured monitoring is implemented in `src/lib/monitoring.ts`.

- PII (signed URL tokens, auth tokens, JWTs, email addresses, filenames, Supabase keys) is scrubbed before any event leaves the process.
- Structured JSON events are emitted to Vercel logs for all alert categories: API 5xx, auth failures, signed URL failures, audit write failures, upload completion failures.
- Sentry is installed and wired through `@sentry/nextjs`, `src/instrumentation.ts`, and the monitoring layer.
- Sentry only sends events when `SENTRY_DSN` or `NEXT_PUBLIC_SENTRY_DSN` is set.
- Session Replay, performance tracing, profiling, and default PII collection are intentionally disabled.
- Sentry `beforeSend` scrubs events before they leave the app.
- CSP `connect-src` is conditionally extended to include the Sentry ingest endpoint when `NEXT_PUBLIC_SENTRY_DSN` is set (see `src/lib/security.ts`).

See `docs/operations/sentry-monitoring.md`.

## Service Role Boundary

The Supabase service-role key bypasses RLS and must not be used as the default data client.

Normal authenticated CRM and Office Portal reads must use the user-scoped Supabase server client so Postgres RLS remains active. Service-role usage is limited to consultation intake, signed upload/download operations after explicit access checks, audit/file-access event inserts, and operational jobs.

See `docs/operations/service-role-policy.md`.

## Encryption

Provider encryption at rest is expected for Supabase Postgres and Storage. For v1, especially sensitive structured fields can be moved to application-level field encryption later if a real data classification need appears.

Do not store passwords, client secrets, or third-party credentials in CRM tables. Use managed auth and provider secret stores.

## Email Deliverability

Login links and invite emails are effectively uptime. A client who cannot receive a magic link cannot access their matter.

- Custom SMTP must be configured (Resend recommended) before real client invites are issued.
- SPF, DKIM, and DMARC DNS records must be live before production.
- Templates must be replaced with James Roman branded versions.
- Delivery must be tested to Gmail, iCloud, Outlook, and a custom domain.
- Tier 2 advisor support process must be documented for failed delivery.

See `docs/operations/email-deliverability.md`.

## Retention

Retention is a policy decision, not just a code decision.

Before launch, counsel should review:

- Client document retention.
- NDA retention.
- Matter archive/delete rules.
- CPRA-aware privacy language.
- Incident notification process.

## Known Gaps Before Production

- Virus scanning is not implemented yet (manual quarantine is the v1 control).
- Monitoring emits structured logs; Sentry runtime activation requires staging DSN configuration and manual scrub verification.
- Supabase Auth MFA settings must be configured in the Supabase Dashboard (not configurable in code).
- Backup restore must be tested on staging (see `docs/operations/backup-restore-runbook.md`).
- Storage lifecycle and final retention periods need business/legal approval.
- Custom SMTP (Resend) must be configured before real client invites are issued.
- SPF, DKIM, and DMARC DNS records must be live before production.
