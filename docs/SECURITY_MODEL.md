# Security Model

**Version:** 1.0  
**Status:** Active  
**Owner:** Roman Cantelearist  
**Last Updated:** 2026-06-06

---

## Non-Negotiable Rules

These rules are absolute. No agent, developer, or operational exception may override them.

- MFA (AAL2) must never be bypassed, even temporarily.
- RLS must never be disabled, even in development migrations.
- Service-role key must never appear in client or browser code.
- Secrets must never be logged or printed.
- Signed URLs must not be issued for documents in `scan_pending` status.
- Legal hold must block soft deletion. Hard deletion is not permitted through normal database operations.
- Staging must never share Supabase credentials with production.

When uncertain: stop. Ask Roman. Do not proceed.

---

## Identity and Access

| Model | Detail |
|-------|--------|
| Auth provider | Supabase Auth |
| Method | Magic-link OTP only |
| Passwords | Not used |
| Public signup | Disabled (`shouldCreateUser: false`) |
| Account creation | Invite-only — by Roman or advisor manually |
| Session type | Supabase session (JWT) |
| MFA | TOTP enforced on all protected routes |
| MFA level required | AAL2 |

---

## Auth Flow

```
User submits email → /sign-in
↓
supabase.auth.signInWithOtp({ shouldCreateUser: false })
↓
Magic link delivered to email
↓
User clicks link → /auth/callback
↓
Supabase issues session (AAL1)
↓
proxy.ts checks AAL level on every protected request
↓
AAL1 only → redirect to MFA step-up
AAL2 confirmed → request proceeds
```

---

## Middleware (proxy.ts)

All requests pass through `src/proxy.ts`.

Protected prefixes:
- `/office`
- `/admin`
- `/portal`

For protected routes, the middleware:
1. Creates a Supabase server client via `@supabase/ssr`.
2. Calls `supabase.auth.getUser()` — validates the session.
3. Checks the AAL level of the session.
4. Redirects unauthenticated users to `/sign-in`.
5. Redirects AAL1-only users to MFA step-up.
6. Passes AAL2 sessions through.

The middleware cannot be removed or weakened without Roman's explicit approval.

---

## Row-Level Security (RLS)

RLS is enabled on all Supabase tables. No table is publicly readable or writable without an authenticated session.

Policy model:
- Authenticated users can only read records scoped to their identity or their permitted matters.
- Advisors have elevated read access scoped to their assigned relationships.
- Service-role bypasses RLS — this is why service-role usage is restricted to narrow server-only operations.
- `scan_pending` documents are explicitly hidden from client RLS — clients cannot read files before they are marked `available`.

RLS must be verified after every schema migration:
```bash
npx supabase test db
```

---

## Service-Role Key Policy

The service-role key bypasses RLS. It must be treated as a privileged credential.

**Permitted server-only uses:**
- Consultation intake insert
- Signed upload/download operations after explicit access checks
- Audit log inserts
- Operational admin jobs

**Never permitted:**
- Client or browser code
- General application data reads
- Default data access path

Every service-role call must be justified in a code comment explaining why the service-role is required for that specific operation.

---

## Storage Security

All files use Supabase private storage buckets. No file is publicly accessible.

**Document access lifecycle:**

```
Upload received
↓
Status: scan_pending
↓
Advisor reviews (manual) or scan worker clears
↓
Status: available
↓
Signed URL issued on explicit request
↓
URL expires (time-limited)
```

Signed URLs are never issued for `scan_pending` documents. This is enforced at the application layer and verified by RLS tests.

Before real client files are stored in production, the manual advisor review process must be the documented and explicit procedure — or a malware-scanning worker must be in place. See `docs/operations/document-scanning.md`.

---

## Audit Logging

All protected operations generate audit log entries.

Audit log design:
- HMAC-based hashing for IP and user-agent fields — PII is not stored in plaintext.
- Event correlation IDs link related events.
- Append-only database trigger — audit rows cannot be modified or deleted through normal database operations.
- Entries include: user identity, event type, resource type and ID, timestamp, correlation ID, hashed IP, hashed user-agent.

Audit log verification:
```bash
npm run test -- src/lib/crm/audit.test.ts
```

---

## Document and Matter Security

Documents and matters carry the following metadata:

| Field | Purpose |
|-------|---------|
| sensitivity | Classification level of the document |
| classification | Formal classification label |
| legal_hold | Boolean — blocks soft deletion when true |
| deletion_request | Tracks pending deletion requests |
| retention | Retention period policy |
| soft_deleted_at | Timestamp of soft deletion |

Legal hold behavior:
- Legal hold blocks soft deletion at both the matter and document level.
- Hard deletion is not possible through normal database operations.
- Legal hold must be explicitly released before deletion can proceed.

---

## Error Monitoring

Sentry is installed via `@sentry/nextjs`.

Current state:
- DSN-gated — inactive until `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` is set.
- Session Replay: disabled.
- Tracing and profiling: disabled.
- Default PII collection: disabled.
- `beforeSend` scrubs events before transmission.

Sentry must not be configured to capture session data, user identifiers, or request bodies without explicit review.

---

## Secrets Inventory

| Secret | Location | Notes |
|--------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel env | Public — safe in browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel env | Public — safe in browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env | Server-only. Never expose. |
| `NEXT_PUBLIC_SENTRY_DSN` | Vercel env | Not yet set |
| `SENTRY_DSN` | Vercel env | Not yet set |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Vercel env | Not yet set |
| Stripe keys | Vercel env | Test-mode keys not yet configured |

Secrets must never be logged, printed, or committed to the repository.

---

## Pre-Production Requirements

Before real client data is stored in production:

- [ ] Separate Supabase staging project confirmed (currently shared — `staging:check` enforces this).
- [ ] Counsel approval for retention periods and CPRA/legal-hold conflict language.
- [ ] Manual advisor review process documented and operational, or malware-scan worker in place.
- [ ] Sentry DSN set and `beforeSend` scrubbing verified.
- [ ] Stripe test-mode keys configured and validated before any live payment work.

---

## Related Documents

- [PROJECT_GOVERNANCE.md](./PROJECT_GOVERNANCE.md)
- [MULTI_AGENT_PROTOCOL.md](./MULTI_AGENT_PROTOCOL.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [operations/production-hotfix-policy.md](./operations/production-hotfix-policy.md)
- [operations/document-scanning.md](./operations/document-scanning.md)
- [operations/audit-logging.md](./operations/audit-logging.md)
- [operations/data-retention-policy-draft.md](./operations/data-retention-policy-draft.md)
