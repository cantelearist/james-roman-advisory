# Security Model

**Version:** 0.1 — STUB  
**Status:** Pending — not yet complete  
**Owner:** Roman Cantelearist  
**Last Updated:** 2026-06-06

> **Note:** This document is a placeholder. It must be completed before any agent modifies auth, access control, storage, or audit behavior. Do not interpret the stub as authoritative security design.

---

## Current Controls (Known)

| Control | Status |
|---------|--------|
| Magic-link auth (Supabase) | Active |
| MFA (AAL2 enforcement via proxy.ts) | Active |
| Row-Level Security (RLS) | Active |
| Signed storage URLs | Active |
| Audit logging (HMAC, append-only trigger) | Active |
| Document scan gating (scan_pending → available) | Active |
| Service-role key restricted to server only | Active |
| Sentry error monitoring | Installed, DSN-gated |
| Stripe payments | Not live |

---

## Non-Negotiable Rules

- MFA must never be bypassed, even temporarily.
- RLS must never be disabled, even in development migrations.
- Service-role key must never appear in client or browser code.
- Secrets must never be logged or printed.
- Signed URLs must not be issued for documents in `scan_pending` status.
- Legal hold must block soft deletion. Hard deletion through normal database operations must not be possible.

---

## Sections To Complete

- [ ] Auth flow (full sequence: magic link → session → MFA → protected route)
- [ ] RLS policy inventory (per table, per role)
- [ ] Storage access model (who can read/write which buckets)
- [ ] Audit log schema and retention policy
- [ ] Document lifecycle security (upload → scan → available → legal hold → soft delete)
- [ ] Secret management (which env vars exist, where they live, who has access)
- [ ] Incident response — security-specific (breach, credential exposure, unauthorized access)
- [ ] Dependency security policy (when to upgrade, how to audit)
- [ ] Penetration test requirements before production client data

---

## Related Documents

- [PROJECT_GOVERNANCE.md](./PROJECT_GOVERNANCE.md)
- [MULTI_AGENT_PROTOCOL.md](./MULTI_AGENT_PROTOCOL.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [operations/production-hotfix-policy.md](./operations/production-hotfix-policy.md)
