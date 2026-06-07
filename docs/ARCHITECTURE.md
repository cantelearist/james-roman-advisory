# Architecture

**Version:** 1.0  
**Status:** Active  
**Owner:** Roman Cantelearist  
**Last Updated:** 2026-06-06

---

## Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Framework | Next.js (App Router) | Turbopack for production builds |
| Hosting | Vercel | Deployment protection on staging |
| Database | Supabase — Postgres | RLS enforced on all tables |
| Auth | Supabase Auth | Magic-link only. No passwords. No public signup. |
| MFA | Supabase AAL2 | Enforced on all protected routes via middleware |
| Storage | Supabase Private Storage | Signed URLs only. Scan gate before access. |
| Middleware | `src/proxy.ts` | Next.js middleware — guards protected prefixes |
| Email | TBD | Not yet configured |
| Payments | Stripe | Not yet live. Test-mode keys not yet set. |
| Monitoring | Sentry (`@sentry/nextjs`) | Installed. DSN-gated. Inactive until DSN is set. |

---

## Environments

| Environment | Purpose | Supabase Project |
|-------------|---------|-----------------|
| prototype | Visual development and QA | Separate |
| staging | Pre-production integration testing | Separate — must never share production credentials |
| production | Live client-facing system | Production |

Staging and production must always use separate Supabase projects with separate credentials. `npm run staging:check` enforces this and blocks staging deploys if they share credentials.

---

## Route Map

### Public

| Route | Purpose |
|-------|---------|
| `/` | Public homepage |
| `/prototype` | Prototype visual environment |
| `/prototype2` | Prototype2 visual environment (current approved direction) |
| `/prototype2/contact` | Prototype2 consultation form |
| `/sign-in` | Supabase magic-link sign-in |
| `/sign-up` | Redirects to `/sign-in` — access is invite-only |
| `/auth/callback` | Supabase auth callback handler |

### Protected (requires auth + MFA AAL2)

| Route | Purpose |
|-------|---------|
| `/office/*` | Advisor office portal |
| `/admin/*` | Internal admin surface |
| `/portal/*` | Client-facing portal |

### API

| Route | Purpose |
|-------|---------|
| `/api/consultations` | Consultation intake (service-role insert) |

---

## Middleware

File: `src/proxy.ts`

Replaces the former `clerkMiddleware`. Runs on every request.

**Protected prefixes:** `/office`, `/admin`, `/portal`

**Logic:**
1. All other routes pass through.
2. For protected routes, create a Supabase server client using `@supabase/ssr`.
3. Call `supabase.auth.getUser()`.
4. If no session, redirect to `/sign-in`.
5. If session exists but AAL level is below AAL2 (MFA not completed), redirect to MFA step-up.
6. If session is AAL2-compliant, allow through.

MFA cannot be bypassed. AAL2 is not optional on protected routes.

---

## Auth Flow

```
User enters email on /sign-in
↓
supabase.auth.signInWithOtp({ shouldCreateUser: false })
↓
Magic link sent to email
↓
User clicks link → /auth/callback
↓
Supabase exchanges token, creates session
↓
Session checked for AAL level in proxy.ts
↓
If AAL1 only → MFA step-up required
If AAL2 → route allowed
↓
User lands on protected route
```

`shouldCreateUser: false` — only existing accounts can sign in. No self-registration.

---

## Data Model

The platform is matter-centric. Everything attaches to this hierarchy:

```
Relationship (client)
↓
Matter (engagement)
↓
Document (file, note, or record)
```

Future features — messaging, billing, audit, reporting — must attach to this model. Disconnected silos are not acceptable.

See `docs/MATTER_LIFECYCLE.md` for the full state machine.

---

## Storage Design

All storage uses Supabase private buckets. No files are publicly accessible.

**Upload flow:**
```
Client uploads file
↓
File moves to scan_pending status
↓
Manual advisor review (or future malware-scan worker)
↓
Advisor marks document available
↓
Signed download URL issued on request
```

Signed URLs are never issued for documents in `scan_pending` status. RLS enforces this. See `docs/SECURITY_MODEL.md`.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/proxy.ts` | Middleware — auth and MFA guard |
| `src/app/layout.tsx` | Root layout — no auth provider wrapper (Clerk removed) |
| `src/app/sign-in/[[...sign-in]]/page.tsx` | Magic-link sign-in page |
| `src/app/sign-up/[[...sign-up]]/page.tsx` | Redirects to sign-in |
| `src/app/auth/callback/route.ts` | Supabase auth callback |
| `src/lib/supabase/server.ts` | `createSupabaseServerClient` — server-side client |
| `src/lib/supabase/env.ts` | Supabase env config |
| `src/lib/safe-redirect.ts` | Redirect safety utility |
| `src/lib/db.ts` | Neon/Postgres direct client (used by consultations route) |
| `src/app/api/consultations/route.ts` | Consultation intake API |
| `src/app/prototype2/page.tsx` | Prototype2 homepage |
| `src/app/prototype2/contact/page.tsx` | Prototype2 contact/form route |

---

## Deployment Pipeline

```
Work on feature/hotfix branch
↓
Build + test locally
↓
Visual QA (npm run prototype:test:visual)
↓
Push to origin → Vercel staging preview
↓
staging:check (confirms env isolation)
↓
Roman's explicit approval in current thread
↓
Vercel production deploy
↓
Release log entry
```

Production deploy requires `JRA_APPROVE_PRODUCTION_DEPLOY=roman-approved-production` env var set after explicit approval. `npm run production:deploy` will not run without it.

---

## Related Documents

- [PROJECT_GOVERNANCE.md](./PROJECT_GOVERNANCE.md)
- [MULTI_AGENT_PROTOCOL.md](./MULTI_AGENT_PROTOCOL.md)
- [SECURITY_MODEL.md](./SECURITY_MODEL.md)
- [MATTER_LIFECYCLE.md](./MATTER_LIFECYCLE.md)
- [operations/release-log.md](./operations/release-log.md)
- [operations/production-hotfix-policy.md](./operations/production-hotfix-policy.md)
