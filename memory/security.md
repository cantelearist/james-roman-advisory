# Security Model — James Roman Advisory

Sources: `security-model.md`, `service-role-policy.md`, `audit-logging.md`, `agent-2-supabase-schema-rls.md`, `agent-3-auth-mfa.md`, `document-scanning.md`, `SECURITY-POSTURE.md`

## Position
V1: managed-auth + server-side encryption + strict authorization. NOT true E2E encryption. Correct tradeoff for boutique client office.

## Identity
- Supabase Auth manages all identity
- Public signup is disabled — invite-only
- Internal users (owner/admin/advisor): MFA required
- Client users: MFA optional by default, step-up MFA for sensitive matters
- Disabled profiles = treated as unauthenticated by application code

## Roles
- `owner` — full access
- `admin` — full CRM access
- `advisor` — tenant-scoped CRM access
- `client` — access only to granted matters, filtered visibility

## Authorization Rules
- Team roles can read tenant-scoped CRM data
- Clients access matters only through active `access_grants`
- Internal notes are team-only — never visible to clients
- Client office is a controlled subset of CRM data
- Application code checks matter access before issuing any storage URL
- Postgres RLS mirrors same boundaries at database layer
- RLS tests live in `supabase/tests/rls.sql` — must pass before production data

## Auth Route Protection (`src/proxy.ts`)
- `/office`, `/admin`, `/portal` — require authenticated Supabase users
- `/admin` — requires team role (`owner`, `admin`, `advisor`)
- `/office` — allows clients only when active access grants exist
- Missing Supabase config → fails closed with 503, never fail-open
- Redirect targets must be same-origin (see `src/lib/safe-redirect.ts`)

## Session Policy (v1)
- Internal: MFA required, idle timeout 30 min, max session 8–12 hours
- Clients: idle timeout 60 min, max session 24 hours (shorter for sensitive matters)
- Concurrent sessions: limited for clients; manual revocation available to admins
- Lost device: disable profile, revoke grants, rotate secrets

## Same-Origin Request Guard
- State-changing routes must call `enforceSameOriginRequest()` before parsing body
- Allows same-origin + known James Roman domains + localhost dev + `JRA_ALLOWED_ORIGINS`
- Cross-site browser POST → generic 403
- Protected routes: consultation intake, signed upload, upload completion, message creation

## Rate Limiting
- In-process limits for local/staging behavior only
- Production must pair with Vercel Firewall, Upstash Ratelimit, or edge-backed limiter
- Rate-limit responses must be generic — must not reveal email/document/matter/user existence

## Documents
- Private `case-files` bucket — no public document URLs
- Signed upload URLs created after auth + matter upload permission check
- Completed uploads → `scan_pending` (NOT `available` directly)
- Only `available` documents receive signed download URLs
- Signed download expiry: 120 seconds
- Every upload completion + download request writes file access event + audit event

## Document Status Flow
`pending_upload` → `scan_pending` → `available` (or `quarantined`/`scan_failed`)
Only `available` documents can be downloaded. Clients cannot see `scan_pending` documents.

## Document Scanning (V1 Policy)
Manual quarantine until a real scanning worker is selected:
- Upload completed → `scan_pending`
- Advisor/scanner clears → `available`
- Advisor/scanner rejects → `quarantined` or `scan_failed`
Source: `src/lib/documents/scanning.ts`

## Audit Logging
Records per event: tenant_id, actor_id, action, resource_type, resource_id, correlation_id, HMAC-hashed IP, HMAC-hashed user-agent, limited metadata, created_at

### Append-Only Rule
Database trigger blocks UPDATE and DELETE on `audit_logs`.
Corrections → add new correction event, never edit original.
Maintenance deletion requires: `select set_config('app.audit_maintenance', 'on', true);` — local tests and approved maintenance ONLY.

### Failure Rule
Sensitive actions must NOT silently continue if audit logging fails. Application rethrows audit failures.

### Required Secret
`AUDIT_HASH_SECRET` — minimum 32 chars. Separate values for staging and production. Never share between environments.

## Service Role Policy
Supabase service-role key bypasses RLS. Treat as a controlled operational tool only.

### Allowed uses
- Consultation intake insert (before user account exists)
- Signed upload URL creation (after authenticated matter upload check)
- Signed download URL creation (after authenticated document access check)
- File access event + audit log inserts (where RLS blocks append-only logging)
- Background jobs, migrations, recovery scripts, admin maintenance

### NOT allowed
- General dashboard listing
- Client office reads
- Admin CRM browsing
- Ordinary authenticated data access

Every `createSupabaseAdminClient()` call must be in an approved narrow path or have a local comment explaining why user-scoped access is insufficient.

```bash
# Verify service-role usage before production
rg -n "createSupabaseAdminClient" src
npm run test -- src/lib/crm/access-control.test.ts
```

## RLS Requirements (all business tables)
All business tables must have `tenant_id` + RLS enabled. Tests required for:
- owner/admin/advisor can read tenant-scoped CRM data
- client can read only granted matters
- revoked grant denies matter access
- client cannot cross-read another client's matter
- client cannot cross-read another tenant's data
- client cannot read internal messages/documents
- client cannot read `scan_pending` documents
- team can read audit logs; client cannot

## Supabase Schema Tables
`tenants`, `profiles`, `clients`, `matters`, `access_grants`, `documents`, `messages`, `audit_logs`, `file_access_events`

## Required MFA Tests (Agent 3)
- missing Supabase config fails closed
- unauthenticated user cannot access `/office` or `/admin`
- client cannot access `/admin`
- disabled profile cannot access protected routes
- internal user without MFA cannot access `/admin`
- valid internal user with MFA can access `/admin`
- valid client with grant can access `/office`
- redirect target cannot be external

## Encryption
- Provider encryption at rest: Supabase Postgres + Storage
- No public document URLs
- Signed URLs expire (120s for downloads)
- Server-only service role
- No passwords or client credentials in CRM tables
- V1 does NOT include true E2E encryption or client-side key management

## Known Gaps Before Production
- Virus scanning not implemented
- Sentry/monitoring not wired
- Supabase Auth MFA settings must be configured in dashboard (not by code)
- Backup restore not yet tested
- Storage lifecycle and legal hold need business/legal approval
- CPRA export/deletion not implemented
