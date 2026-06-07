# Architecture

**Version:** 0.1 — STUB  
**Status:** Pending — not yet complete  
**Owner:** Roman Cantelearist  
**Last Updated:** 2026-06-06

> **Note:** This document is a placeholder. It must be completed before any agent makes structural changes to the system. Do not interpret the stub as authoritative design.

---

## Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js (App Router) |
| Hosting | Vercel |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth + MFA |
| Storage | Supabase Private Storage |
| Email | TBD |
| Payments | Stripe (not yet live) |
| Monitoring | Sentry (DSN-gated) |

---

## Environments

| Environment | Purpose |
|-------------|---------|
| prototype | Visual development and QA |
| staging | Pre-production integration testing |
| production | Live client-facing system |

Staging must use a separate Supabase project from production. They must never share credentials.

---

## Sections To Complete

- [ ] Route map (all current and planned routes)
- [ ] Data flow diagram (auth → matter → document)
- [ ] API surface (internal routes, external integrations)
- [ ] Supabase schema overview (tables, RLS policy summary)
- [ ] Storage bucket design
- [ ] Auth flow (magic link → session → MFA)
- [ ] Middleware (proxy.ts behavior, protected prefixes)
- [ ] Deployment pipeline (branch → staging → production approval)
- [ ] Dependency constraints (what can and cannot be upgraded without review)

---

## Related Documents

- [PROJECT_GOVERNANCE.md](./PROJECT_GOVERNANCE.md)
- [MULTI_AGENT_PROTOCOL.md](./MULTI_AGENT_PROTOCOL.md)
- [SECURITY_MODEL.md](./SECURITY_MODEL.md)
- [MATTER_LIFECYCLE.md](./MATTER_LIFECYCLE.md)
