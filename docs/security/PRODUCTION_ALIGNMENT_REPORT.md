# Production Alignment Report

**Date:** 2026-06-10  
**Commit:** `07a680f`  
**Author:** Claude (security hardening sprint)

---

## 1. GitHub ↔ Production Alignment

**Status: ALIGNED ✓**

| Reference | Value |
|-----------|-------|
| `origin/main` HEAD | `07a680f` |
| Vercel production deployment | `james-roman-advisory-88lstuk74` |
| Production domain | `jamesroman.la` · `www.jamesroman.la` |

Both the GitHub main branch and the live production deployment are on the same commit. No drift.

---

## 2. Hardening Plan vs. Reality Gap

The MVP Hardening Sprint document was written against a different codebase. The discrepancies are material — not minor version differences. This section documents what was described versus what actually exists so future agents do not act on false premises.

### Auth Layer

| Plan Claimed | Actual |
|---|---|
| Supabase Auth | **Clerk** (hosted auth, JWT, `publicMetadata.role`) |
| Supabase TOTP MFA | **Clerk MFA** (`fva[1]` claim in JWT) |
| Custom password reset flow | **Clerk hosted UI** handles this natively |

No Supabase dependency exists anywhere in this codebase. Any task referencing Supabase Auth is inapplicable.

### Database

| Plan Claimed | Actual |
|---|---|
| Supabase Storage | **Vercel Blob** (`@vercel/blob`) |
| 14-table schema | Unverified — Neon PostgreSQL via `@neondatabase/serverless` |

### API Surface

| Plan Claimed | Actual |
|---|---|
| 34 API endpoints | **11 routes** |
| `/api/messages/read` | Does not exist — no messaging feature |
| Invoicing endpoints | Do not exist |
| E-signature endpoints | Do not exist |

**Actual API surface (11 routes):**

```
src/app/api/admin/invite/route.ts
src/app/api/clients/route.ts
src/app/api/consultations/route.ts
src/app/api/matters/[id]/events/route.ts
src/app/api/matters/[id]/route.ts
src/app/api/matters/route.ts
src/app/api/properties/route.ts
src/app/api/seed/users/route.ts
src/app/api/vault/documents/[id]/route.ts
src/app/api/vault/documents/route.ts
src/app/api/vault/upload/route.ts
```

---

## 3. Security Findings — This Codebase

These are findings discovered during the hardening sprint that are real and specific to this Clerk+Neon stack.

### FIXED — B3: Hardcoded Seed Key Fallback

**File:** `src/app/api/seed/users/route.ts`

**Was:**
```typescript
const SEED_KEY = process.env.SEED_KEY ?? "jr-seed-2026";
```

**Now:**
```typescript
const SEED_KEY = process.env.SEED_KEY;
// Route returns 503 if key is not configured — never silently degrades
```

The previous fallback meant that in any environment where `SEED_KEY` was not set, the seed endpoint was accessible via the predictable key `jr-seed-2026`. This would have allowed anyone who found the endpoint to bulk-insert or overwrite user records including admin roles.

**Remediation:** The `SEED_KEY` environment variable must now be explicitly set in every environment (staging, production) or the endpoint returns 503. No fallback, no silent degradation.

**Required action:** Confirm `SEED_KEY` is set in Vercel production environment variables. If it is not, the seed endpoint is currently disabled — which is the correct safe state.

---

### OPEN — CSP Dead Code

**File:** `src/proxy.ts` (the active middleware)

The Content-Security-Policy header references `NEXT_PUBLIC_CLERK_FRONTEND_API_URL`. If this environment variable is absent from Vercel, the CSP header falls back to a permissive or broken value.

**Required action:** Verify `NEXT_PUBLIC_CLERK_FRONTEND_API_URL` is set in Vercel production environment variables.

---

### OPEN — Blob Download Proxy

**File:** `src/app/api/vault/documents/[id]/route.ts`

The vault upload model uses Vercel Blob with UUID-obscured paths. The security model requires that `blob_pathname` and `blob.url` are never returned to clients — all downloads must flow through a signed proxy.

**Required action:** Confirm the `GET /api/vault/documents/[id]` handler streams the blob through the server rather than redirecting to the public blob URL.

---

### OPEN — `/api/matters/[id]` IDOR Risk

The `PATCH /api/matters/[id]` handler has not been audited for indirect object reference checks. A client-role user could potentially modify matters belonging to another client if the route validates session but not matter ownership.

**Required action:** Audit that the PATCH handler verifies the authenticated user owns or has advisor access to the matter before applying updates.

---

### OPEN — `/api/properties` Role Gate

The `GET /api/properties` handler has not been confirmed to enforce role gating. Without a role check, any authenticated user could list all properties regardless of their assignment.

**Required action:** Confirm the handler gates on `admin | advisor` role, or on client-specific property assignment, before returning results.

---

## 4. Priority Items from the Hardening Plan — Status

| ID | Item | Status | Notes |
|---|---|---|---|
| B1 | Secure `/api/messages/read` | **N/A** | Route does not exist. No messaging feature in this codebase. |
| B2 | Password reset flow | **Clerk handles natively** | Clerk's hosted sign-in UI includes forgot-password flow. No custom route needed unless a `/forgot-password` redirect page is desired. |
| B3 | Remove demo mode fallback | **FIXED** | `SEED_KEY` fallback removed. Requires env var or endpoint returns 503. |
| P2-A | Supabase TOTP MFA | **N/A** | Auth is Clerk. MFA enforced via `fva[1]` in JWT — already implemented in `src/proxy.ts` and `requireMFA()`. |
| P2-B | Rate limiting | **OPEN** | `src/proxy.ts` does not currently implement rate limiting. Recommend Vercel WAF or Upstash Rate Limit middleware. |
| P2-C | Cryptographically secure password generation | **N/A** | Clerk manages all passwords. Not applicable. |
| P2-D | Manager role alignment | **OPEN** | Role model is `admin | advisor | client`. No `manager` role exists — skip or clarify intent. |

---

## 5. What Can Be Executed Next (Correct Scope)

In priority order, based on what actually exists in this codebase:

1. **Verify `SEED_KEY` in Vercel env** — If absent, the seed endpoint is locked (correct). If present, ensure the value is a strong random string, not `jr-seed-2026`.
2. **Verify `NEXT_PUBLIC_CLERK_FRONTEND_API_URL` in Vercel env** — Required for CSP to be effective.
3. **Audit vault document proxy** — Confirm `GET /api/vault/documents/[id]` does not leak blob URLs.
4. **Audit `/api/matters/[id]` PATCH for IDOR** — Confirm ownership check before writes.
5. **Audit `/api/properties` GET for role gate** — Confirm advisor/admin-only access.
6. **Add rate limiting** — Upstash `@upstash/ratelimit` + `@upstash/redis` is the standard Vercel-native approach. Apply to: `/api/consultations` (POST), `/api/seed/users` (POST), `/api/admin/invite` (POST).

---

## 6. Permanent Security Constraints

These constraints are non-negotiable and must be preserved by all agents:

1. Do NOT run `clerk init` — would risk overwriting active Clerk credentials.
2. Stripe and Resend API keys → Vercel env vars only. Never committed to code.
3. After every `npx vercel --prod`: alias both `jamesroman.la` AND `www.jamesroman.la`.
4. `blob_pathname` and `blob.url` must NEVER be returned to clients in any API response.
5. Do NOT auto-create client records from upload routes — admin invite flow only.
6. No fake/hardcoded data in portal pages — real data or honest empty state.
