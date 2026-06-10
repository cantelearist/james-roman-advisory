# Source of Truth — James Roman Advisory (main branch)

**Generated:** 2026-06-10  
**Branch:** `main`  
**Latest deployed SHA:** `71d6b7d`  
**Live domains:** `jamesroman.la` · `www.jamesroman.la`

This document reflects the actual production codebase as verified by direct file
reads and `vercel env ls`. It supersedes any planning documents, handoff notes,
or sprint plans that contradict it.

---

## Stack

| Layer | Provider | Package |
|---|---|---|
| **Auth** | Clerk | `@clerk/nextjs` |
| **Database** | Neon PostgreSQL | `@neondatabase/serverless` |
| **File storage** | Vercel Blob | `@vercel/blob` |
| **Email** | Resend | `resend` |
| **Payment** | Stripe *(keys in Vercel env, no code yet)* | — |
| **Observability** | Sentry | `@sentry/nextjs` |
| **Rate limiting** | Upstash *(keys not yet in Vercel; fails open)* | `@upstash/ratelimit` + `@upstash/redis` |
| **Framework** | Next.js 15 App Router + Turbopack | — |
| **Hosting** | Vercel | — |

**Not present anywhere in this codebase:** Supabase, S3, custom auth, messaging,
invoicing, e-signatures. Any planning document referencing those belongs to a
different project or an abandoned architecture branch.

---

## Auth Model

- Provider: **Clerk** (hosted sign-in/sign-up, JWT sessions)
- Middleware: `src/proxy.ts` — `clerkMiddleware` wraps all routes
- Role: stored in `user.publicMetadata.role` → `"admin" | "advisor" | "client"`
- MFA: enforced via `fva[1]` claim in JWT (`fva[1] === null` → MFA not verified → redirect)
- Dev Clerk instance: `crucial-chicken-28.clerk.accounts.dev`
  (decoded from `.env.local` publishable key `pk_test_Y3J1Y2lhbC1jaGlja2VuLTI4...`)
- Production Clerk instance: **unknown** — `NEXT_PUBLIC_CLERK_FRONTEND_API_URL` is not set
  in Vercel; CSP header falls back to the dev instance host, which is wrong for production

---

## Database Schema (Neon PostgreSQL)

8 tables. All created via `CREATE TABLE IF NOT EXISTS` in `src/lib/db.ts`.
No migration framework — schema is idempotent on each cold start.

| Table | Purpose |
|---|---|
| `users` | Internal user registry (id, name, email, role) |
| `consultations` | Public intake form submissions |
| `clients` | Client records; `clerk_user_id` links to Clerk identity |
| `properties` | Client properties (address, city, state) |
| `matters` | Active engagements (type, status, notes) |
| `matter_events` | Immutable timeline for each matter |
| `documents` | Vault file metadata (blob_pathname stored server-side only) |
| `file_access_events` | Immutable audit log (upload / download / view / delete) |

**Note:** The Supabase-based plan referenced 13 tables and a different schema. That
is not this database.

---

## API Routes (11 total)

| Route | Methods | Auth |
|---|---|---|
| `/api/admin/invite` | POST, GET, DELETE | admin only |
| `/api/clients` | GET, POST | GET: scoped by role; POST: staff only |
| `/api/consultations` | POST | public (rate-limited: 5/hr/IP) |
| `/api/matters` | GET, POST | auth required; role-scoped |
| `/api/matters/[id]` | GET, PATCH | GET: ownership-verified; PATCH: staff only |
| `/api/matters/[id]/events` | GET, POST | auth required |
| `/api/properties` | GET, POST | GET: ownership-verified (IDOR fixed 71d6b7d); POST: staff only |
| `/api/seed/users` | POST | SEED_KEY required; 503 if key absent |
| `/api/vault/documents` | GET | auth required; role-scoped |
| `/api/vault/documents/[id]` | GET, DELETE | GET: server-proxied, access-logged; DELETE: staff only |
| `/api/vault/upload` | POST | auth required; advisor/admin only |

**No `/api/health` route exists.** The endpoint at `/api/health?key=jr-health-2026`
would return 404. Do not use it as a deployment gate.

---

## Environment Variables

### Required — app will not function without these

| Variable | Used by | Status in Vercel |
|---|---|---|
| `DATABASE_URL` | `src/lib/db.ts` — all DB ops | ✅ Set (Production, Preview, Development) |
| `CLERK_SECRET_KEY` | Clerk server SDK | ✅ Set |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk client SDK | ✅ Set |
| `BLOB_READ_WRITE_TOKEN` | `src/lib/vault.ts` — all vault ops | ✅ Set (implied by vault functionality) |
| `RESEND_API_KEY` | `src/lib/email.ts` — consultation notifications | ✅ Set (Production, Preview) |

### Optional — app degrades gracefully without these

| Variable | Used by | Effect if absent | Status in Vercel |
|---|---|---|---|
| `NOTIFICATION_EMAIL` | `src/lib/email.ts` | Falls back to `advisory@jamesroman.la` | Not set |
| `NEXT_PUBLIC_BASE_URL` | Clerk invite redirect URL | Falls back to `https://jamesroman.la` | Not set |
| `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` | Sentry error tracking | Sentry disabled | ✅ Set |
| `STAGING_PASSWORD` | Basic-auth gate for staging | No password protection | ✅ Set |
| `SEED_KEY` | `/api/seed/users` | Route returns 503 (correct safe state) | ❌ Not set |
| `UPSTASH_REDIS_REST_URL` | Rate limiting | Rate limiting disabled (fails open) | ❌ Not set |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting | Rate limiting disabled (fails open) | ❌ Not set |
| `NEXT_PUBLIC_CLERK_FRONTEND_API_URL` | CSP header in `src/lib/security.ts` | Falls back to dev Clerk host (wrong for production) | ❌ Not set |

### Present in Vercel but not referenced in code

| Variable | Note |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe is not wired in code — likely reserved for future billing feature |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Same — Preview/Development only |
| `NEON_PROJECT_ID` / `PGHOST` / `PGUSER` / etc. | Neon-managed vars; only `DATABASE_URL` is used in code |

---

## Security Fixes Shipped (this session)

All committed to `main` and live on `jamesroman.la`:

| Commit | Fix |
|---|---|
| `07a680f` | Vault upload role gate, blob URL containment, MFA alignment, CSP, governance |
| `42810ac` | Removed `SEED_KEY ?? "jr-seed-2026"` hardcoded fallback; wrote this alignment series |
| `0bc0eae` | Added `global-error.tsx` (Next.js prerender fix; was silently failing every build) |
| `71d6b7d` | Properties IDOR fix; rate limiting on 3 endpoints; full route audit |

---

## Remaining Production Blockers

These are the only unresolved items that affect production security or correctness.
All require **manual action in Vercel dashboard** — no code changes needed.

### 1. CSP Uses Wrong Clerk Host in Production — HIGH

**Problem:** `NEXT_PUBLIC_CLERK_FRONTEND_API_URL` is not set. The CSP
`script-src`, `connect-src`, and `frame-src` directives fall back to
`crucial-chicken-28.clerk.accounts.dev` — the dev instance. In production,
Clerk JS loads from the production instance host, which is different. This
means the CSP is either blocking Clerk in production (broken auth UI) or being
ignored by the browser (security control has no effect).

**Fix:** Vercel Dashboard → james-roman-advisory → Settings → Environment Variables → Add:
```
NEXT_PUBLIC_CLERK_FRONTEND_API_URL = <value from Clerk Dashboard → API Keys → Frontend API URL>
```
The production value will look like `https://[subdomain].clerk.accounts.dev`
or a custom domain if one is configured.

### 2. Rate Limiting Disabled — MEDIUM

**Problem:** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are not
set. Rate limiting code is deployed but fails open — all requests pass through.

**Fix:** Create a free Upstash Redis database at console.upstash.com, then add
both variables to Vercel Production environment.

### 3. Seed Endpoint Has No Key — LOW (currently safe)

**Problem:** `SEED_KEY` is not set in Vercel. The seed endpoint returns 503,
which is the correct safe state. It only becomes a blocker if you need to
re-seed the production database.

**Fix when needed:** Generate with `openssl rand -hex 32`, add to Vercel,
call the endpoint once, then optionally remove it again.

---

## What Supabase Instructions Belong To

The Supabase-based cutover checklist (13 tables, `/api/health?key=jr-health-2026`,
`NEXT_PUBLIC_SUPABASE_URL`, etc.) does not correspond to any code in this
repository on any branch. The `staging-secure-office-foundation` branch
HEAD is `181199d` — a `current-state.md` update from June 7 with no Supabase
code. The Supabase plan may belong to:

- A separate repository not connected to this Vercel project
- An abandoned architectural direction from an earlier phase
- A planning document written against a future state that was never built

**Recommendation:** Before any Supabase cutover is considered, locate the actual
Supabase repository and verify it is deployable independently. Do not attempt to
retrofit Supabase into this Clerk/Neon codebase.
