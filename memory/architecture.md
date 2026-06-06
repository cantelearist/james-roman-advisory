# Architecture — James Roman Advisory

Source: `production-architecture-review.md`

## Decision: Option A (Confirmed)
Keep Vercel + Next.js for frontend. Supabase for Postgres/Auth/Storage. Custom CRM. No SaaS overbuild in v1.

## Three Surfaces
1. `www.jamesroman.la` — public Prototype2 site, mostly static, fast, locked
2. `/office` (→ `office.jamesroman.la`) — secure client office: documents, messages, matter status, invoices, NDA
3. `/admin` (→ `admin.jamesroman.la`) — internal CRM: client records, matters, documents, messages, invoices, audit logs, internal notes

## Stack
- Frontend: Next.js 16.2.6, React 19, TypeScript, Tailwind/shadcn-style, Motion/GSAP/Lenis
- Hosting: Vercel
- Database: Supabase Postgres
- Auth: Supabase Auth — invite-only, MFA required for internal users
- Storage: Supabase Storage — private `case-files` bucket, signed URLs only
- Email: Supabase Auth for login links; Resend for non-auth notifications
- Payments: Stripe Connect (test mode only until legal/payment approval)
- Monitoring: Sentry or equivalent (not yet wired — launch blocker)
- Rate limiting: Vercel Firewall or Upstash Ratelimit (not yet implemented — launch blocker)

## Key Source Files
- `supabase/migrations/20260605000000_production_foundation.sql`
- `src/proxy.ts` — protected route middleware
- `src/lib/security.ts` + `next.config.ts` — CSP/security headers
- `src/lib/supabase/env.ts` — Supabase env helpers
- `src/lib/crm/auth.ts` — auth context
- `src/lib/crm/data.ts` — CRM access helpers
- `src/lib/crm/audit.ts` — audit logging
- `src/app/api/documents/*` — signed upload/download APIs
- `src/app/api/messages/route.ts` — secure messages API
- `src/lib/safe-redirect.ts` — redirect safety

## CRM Data Model
Core entities: Tenants, Profiles, Clients, Matters, Access Grants, Documents, Messages, Timeline Events, Invoices, NDA Records, Internal Notes, File Access Events, Audit Logs, Consultation Requests

Roles: `owner`, `admin`, `advisor`, `client`

V1 limits: no contractor/attorney/insurance guest roles, no live payments, no full SaaS billing, single tenant operationally (tenant-ready structurally)

## Risk Map

### Highest Priority
- External setup: Supabase staging/prod, migrations, MFA, email templates, Vercel env vars
- Access-control: every client view must be matter-scoped and grant-aware
- Rate limiting: required before sensitive production use
- CORS/CSRF: same-origin policy must be explicit before launch
- CPRA: export and deletion must exist before real CA client data is stored
- Document handling: signed URLs implemented; virus scanning and legal-hold not yet done
- Retention/legal: needs counsel review
- Email deliverability: login depends on email — it's uptime for the office
- Backup/restore: documented but not yet tested

### Medium Priority
- Client MFA policy: sensitivity-based MFA needs operational definition
- Invoice workflow: manual only in v1, scope must be constrained
- Audit forensic tradeoff: hashed IP/UA is privacy-conscious but weakens forensics
- RTO/RPO: must be set before real files are stored
- Vendor cleanup: legacy Clerk/Neon/Stripe/Supabase/Resend env vars need rotation

## Cost Estimate (Option A)
~$150–$750/month depending on Supabase plan, storage, backups, Vercel, monitoring, email, rate limiting

## Recovery Targets (v1 minimums)
- Public site RTO: 1 hour via Vercel rollback
- Office/Admin RTO: 4 business hours for active matters
- Database RPO: 24 hours minimum (tighter if Supabase PITR enabled)
- Document metadata RPO: 24 hours minimum

## Implementation Phases
1. Stabilize production baseline
2. Secure foundation (Supabase, auth, MFA, RLS)
3. Internal CRM
4. Client office
5. Production hardening (rate limiting, CORS, session, backup, CPRA, monitoring)
6. Product-ready foundation (tenant portability, subdomain split decision)

## Launch Blockers (do not store real client data until these are done)
- Supabase staging/prod created and migrated
- Auth invite-only + MFA configured
- Vercel env vars cleaned, rotated, marked sensitive
- Proxy/middleware registration verified in deployed build
- Rate limiting enabled
- Same-origin CORS/CSRF checks implemented and tested
- Signed URL expiry tested
- Backup restore drill completed
- RTO/RPO accepted
- CPRA export/deletion process defined
- Legal review completed
- Email deliverability configured and tested
- Monitoring enabled
