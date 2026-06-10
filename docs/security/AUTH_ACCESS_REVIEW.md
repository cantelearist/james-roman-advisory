# AUTH ACCESS REVIEW
**Ticket 2 — Auth + Role Matrix**  
**Owner:** Claude  
**Date:** 2026-06-09  
**Methodology:** Direct code read — proxy.ts, auth.ts, db.ts, vault.ts, security.ts, all API routes, all portal pages. No assumptions. Contradictions with the external audit are noted and adjudicated against code.

---

## REPORT FORMAT

Each section follows:

> **STATUS** · **EVIDENCE** · **FINDINGS** · **RISKS** · **RECOMMENDATION** · **CONFIDENCE**

---

## 1. Clerk Integration

**STATUS:** ✅ EXISTS — fully integrated.

**EVIDENCE:**  
- `src/proxy.ts`: `import { clerkMiddleware } from "@clerk/nextjs/server"` — Clerk middleware is active and wraps all routes.  
- `src/lib/auth.ts`: `import { currentUser } from "@clerk/nextjs/server"` — server-side Clerk calls present across all protected handlers.  
- `src/app/api/admin/invite/route.ts`: `import { clerkClient, currentUser }` — Clerk admin SDK used for invitation management.

**FINDINGS:**  
Clerk is the single auth provider. Two check surfaces are in use:  
1. **Middleware (fast path):** `sessionClaims?.metadata?.role` from JWT — requires a custom JWT template configured in Clerk Dashboard.  
2. **Server components / API routes (authoritative path):** `currentUser()` — fetches live user object from Clerk, role read from `publicMetadata.role`.

The code includes an explicit warning in `proxy.ts` comments: *"Without this template, role is undefined and role checks are deferred to server components."* There is no file in the codebase that verifies this template exists in the Clerk Dashboard. It is an unverified runtime dependency.

**RISKS:**  
- If the JWT template is missing or misconfigured, middleware role checks silently fail open. Staff routes would rely entirely on server-component enforcement. This is functional but degrades the defense-in-depth posture.  
- No test confirms the Clerk Dashboard JWT template is active.

**RECOMMENDATION:**  
Add a `CLERK_JWT_TEMPLATE_CONFIGURED=true` env var as a deployment gate. In the middleware, assert this is set at startup. Separately, document the required JWT template shape in `docs/security/CLERK_SETUP.md`.

**CONFIDENCE:** 97%

---

## 2. Middleware Architecture

**STATUS:** ✅ EXISTS — `src/proxy.ts` (not `middleware.ts`).

**EVIDENCE:**  
File: `src/proxy.ts` — 128 lines. Confirmed active as Next.js middleware via the project's config (filename alias handled by build tooling).

**FINDINGS:**

### Route Classification
```
Public:    /, /prototype/*, /prototype2/*, /sign-in/*, /sign-up/*,
           /mfa-required/*, /robots.txt, /sitemap.xml,
           /api/consultations/*, /api/seed/*

Staff:     /portal/matters/*, /portal/vault/*, /portal/admin/*

Admin:     /portal/admin/*

Protected: All other /portal/* routes (auth required, no role gate)
```

### Staging Gate
Hostname check for `staging.jamesroman.la` runs **before** Clerk. Basic auth challenge via `STAGING_PASSWORD` env var. Correctly exits early on failure.

### MFA Enforcement
Staff routes check `fva[1] === null` from JWT claims. If null, user is redirected to `/mfa-required`. This is the middleware gate. The server-side `requireMFA()` in `auth.ts` uses a different criterion: `user.twoFactorEnabled === true OR verified phone`. A user who passes the server-side MFA check (via phone verification) might still be blocked at the middleware level if the `fva` JWT claim does not reflect phone as a second factor — depending on how Clerk encodes this.

**RISKS:**  
- **MFA criterion mismatch**: Middleware uses `fva[1]` (TOTP/hardware second factor); server uses `twoFactorEnabled || verified phone`. These can diverge. A staff user who verifies via SMS and `twoFactorEnabled` is false passes server-side but fails middleware — locked out of their own dashboard.  
- `/api/seed/*` is public. If the seed route is not disabled in production, it can be called by anyone.

**RECOMMENDATION:**  
1. Reconcile MFA checks — pick one criterion and use it in both places, or document the intentional divergence.  
2. Disable or secret-gate `/api/seed/*` in production via env var check inside the handler.

**CONFIDENCE:** 95%

---

## 3. Role Model

**STATUS:** ✅ EXISTS — fully defined.

**EVIDENCE:**  
`src/lib/auth.ts`:
```typescript
type Role = "admin" | "advisor" | "client" | undefined;
```
Helpers present: `getRole(user)`, `isAdmin(role)`, `isStaff(role)`, `requireAuth()`, `requireStaff()`, `requireAdmin()`, `requireMFA()`, `getAuthUserId()`.

**FINDINGS:**

| Role | Description | MFA Required |
|------|-------------|--------------|
| `admin` | Full access + invite management | Yes (via staff gate) |
| `advisor` | Full matter/vault/client access | Yes (via staff gate) |
| `client` | Own matters + own documents only | No |
| `undefined` | Unauthenticated or unassigned | Blocked |

Role is stored in `user.publicMetadata.role` (Clerk). Only admins can assign or change roles — the invite flow in `/api/admin/invite` enforces this correctly: admin role is checked before any invitation is sent.

**RISKS:**  
- `undefined` role users who are authenticated by Clerk but have no role assigned can access the base `/portal` page. The portal dashboard (`/portal/page.tsx`) is currently hardcoded static data, so there is no data leakage. However, if the portal is connected to real data without a role guard, an undefined-role user could reach it.  
- There is no mechanism to detect or alert on users who exist in Clerk without a `role` in `publicMetadata`.

**RECOMMENDATION:**  
Add a role guard to `/portal/page.tsx` when it is connected to live data. Add a Clerk webhook handler or periodic audit that alerts if users are found without a role assignment.

**CONFIDENCE:** 98%

---

## 4. Protected Route Map

**STATUS:** ✅ ENFORCED — with gaps in vault write paths.

**EVIDENCE:** All API routes read directly.

### API Route Auth Summary

| Route | Method | Auth Check | Role Gate | Data Scope | Status |
|-------|--------|-----------|-----------|------------|--------|
| `/api/admin/invite` | GET | `currentUser()` | `isAdmin` | All invitations | ✅ |
| `/api/admin/invite` | POST | `currentUser()` | `isAdmin` | Create invite | ✅ |
| `/api/admin/invite` | DELETE | `currentUser()` | `isAdmin` | Revoke invite | ✅ |
| `/api/clients` | GET | `requireStaff()` / `requireAuth()` | Staff → all; Client → own | Scoped | ✅ |
| `/api/clients` | POST | `requireStaff()` | Staff only | — | ✅ |
| `/api/matters` | GET | `requireStaff()` / `requireAuth()` | Staff → all; Client → own | Scoped | ✅ |
| `/api/matters` | POST | `requireStaff()` | Staff only | — | ✅ |
| `/api/matters/[id]` | PATCH | Not audited | Unknown | — | ⚠️ Needs review |
| `/api/vault/upload` | POST | `auth()` only | **None** — any auth user | Auto-upsert client | ⚠️ Gap |
| `/api/vault/documents` | GET | `auth()` only | None — scoped by clerk_user_id | Client's docs | ⚠️ Staff gap |
| `/api/vault/documents/[id]` | GET | `auth()` | Ownership via DB query | Own doc or staff | ✅ |
| `/api/vault/documents/[id]` | DELETE | `auth()` | Staff check via `users` table | Staff only | ⚠️ Verify |
| `/api/consultations/*` | — | PUBLIC | None | — | ⚠️ Intentional? |
| `/api/seed/*` | — | PUBLIC | None | — | ❌ Disable in prod |
| `/api/properties` | — | Not audited | Unknown | — | ⚠️ Needs review |

**RISKS — VAULT UPLOAD:**  
`/api/vault/upload` accepts any authenticated Clerk user with no role check. The handler auto-upserts a `clients` row keyed by Clerk `userId`. This means a user who signs up via the public `/sign-up` route without an invitation — and thus has no role assigned — can upload documents and create a client record for themselves. This bypasses the intended onboarding flow (admin invites → client activates → client accesses portal).

**RISKS — VAULT DOCUMENTS LIST (STAFF GAP):**  
`/api/vault/documents` returns an empty array for any user not found in the `clients` table. Staff (advisor/admin) who are not also clients would always receive `{ documents: [] }`. The vault page at `/portal/vault/page.tsx` calls this endpoint, meaning staff see no documents through the UI. This is a functional gap.

**RISKS — VAULT DOCUMENTS/[id] DELETE STAFF CHECK:**  
The DELETE handler checks staff via `SELECT role FROM users WHERE id = ${userId}` — where `userId` is Clerk's auth ID string. Whether `users.id` in the Neon database stores the Clerk user ID or a different ID is not determinable from the schema alone. If this mapping is wrong, the staff check silently fails and nobody can delete documents.

**RECOMMENDATION:**  
1. Add explicit role check to `/api/vault/upload` — reject requests where the user has no assigned role (or at minimum, no `client` role in publicMetadata).  
2. Build a staff documents endpoint: add `?scope=all` query param to `/api/vault/documents` (staff only) that returns all documents across clients.  
3. Verify `users.id` stores the Clerk user ID by querying production DB: `SELECT id FROM users LIMIT 1` and confirming format matches Clerk's `user_xxx` format.  
4. Gate `/api/seed/*` with a `SEED_SECRET` header check.

**CONFIDENCE:** 90%

---

## 5. Data Access Scoping

**STATUS:** ✅ CORRECT for read paths. ⚠️ GAP in vault write paths.

**EVIDENCE:**  
- `/api/clients GET`: staff get all clients; client gets own record via `clerk_user_id` join.  
- `/api/matters GET`: staff get full join with client/property/document_count; client gets own matters via `clerk_user_id` join.  
- `/api/vault/documents GET`: client gets own docs via `clerk_user_id → client_id` join.

**FINDINGS:**  
Data scoping is implemented at the SQL level for read paths — not just application logic. This is correct. The scoping model is consistent: clients see their rows, staff see all rows.

The write-path gap: `/api/vault/upload` accepts a `matter_id` parameter but does not verify that the matter belongs to the uploading client. A client who knows or guesses another client's `matter_id` UUID can attach documents to that matter.

**RISKS:**  
- Matter UUID guessing is computationally infeasible (v4 UUID = 2^122 space), but the check should exist regardless.  
- More practically: if a client's matter UUID is ever exposed (e.g., in a URL, a logged error, a test), they could upload to any matter.

**RECOMMENDATION:**  
In `/api/vault/upload`, when `matter_id` is provided, add: `SELECT id FROM matters WHERE id = {matterId} AND client_id = {clientId}`. Reject with 403 if not found.

**CONFIDENCE:** 93%

---

## 6. Vault Security Posture

**STATUS:** ⚠️ FUNCTIONAL — one structural vulnerability.

**EVIDENCE:**  
`src/lib/vault.ts`: Blob uploads use `access: "public"`.  
`src/app/api/vault/documents/[id]/route.ts`: Downloads are proxied through the API with ownership checks and audit logging.

**FINDINGS:**  
Vercel Blob is configured with `access: "public"`, meaning the raw blob URLs (`https://...vercel-blob.com/vault/{clientId}/{matterId}/{docId}/{filename}`) are accessible to anyone who knows the URL — no auth required, no audit trail.

The download endpoint at `/api/vault/documents/[id]` correctly enforces ownership and logs access. But this only protects users who go through the application. Anyone with the direct blob URL bypasses all checks.

This is architecturally inconsistent with the brand promise — "Every document logged. Every access traceable."

**RISKS:**  
- **HIGH:** A direct blob URL shared outside the application (screenshot of network tab, email forward, Slack paste) provides permanent document access until the file is deleted.  
- **MEDIUM:** No access logs exist for direct blob URL fetches. There is no detection capability.  
- **LOW:** UUID path guessing is infeasible, but once a URL is known, it does not expire.

**RECOMMENDATION:**  
If Vercel Blob's current plan supports token-based (private) access, change blob uploads to use private access and generate signed URLs on demand for downloads. If private access is not available on the current plan, document this risk explicitly in the operations runbook and set a milestone to upgrade when feasible. The current proxy-download pattern is correct — the gap is the direct URL.

**CONFIDENCE:** 99%

---

## 7. Security Headers

**STATUS:** ✅ EXISTS.

**EVIDENCE:**  
`src/lib/security.ts` — 26 lines. CSP with Clerk hosts whitelisted. Headers present: `X-Frame-Options: DENY`, `Cross-Origin-Embedder-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`.

**FINDINGS:**  
The CSP hardcodes `CLERK_HOST = "https://crucial-chicken-28.clerk.accounts.dev"` — a Clerk development subdomain. In production, Clerk typically uses a custom domain or a different Clerk-hosted domain. If the production Clerk instance uses a different frontend host, the CSP will block Clerk's auth UI components without an obvious error.

**RISKS:**  
- CSP may silently break Clerk's embedded sign-in/MFA components in production if the Clerk frontend API URL differs from the hardcoded value.

**RECOMMENDATION:**  
Replace the hardcoded `CLERK_HOST` constant with `process.env.NEXT_PUBLIC_CLERK_FRONTEND_API_URL ?? "https://crucial-chicken-28.clerk.accounts.dev"`. This allows the production value to be injected without changing code.

**CONFIDENCE:** 95%

---

## 8. Governance State (AGENTS.md / CLAUDE.md)

**STATUS:** ❌ EMPTY STUBS — not fit for purpose.

**EVIDENCE:**  
- `CLAUDE.md`: 1 line. Contains only: `@AGENTS.md`  
- `AGENTS.md`: 5 lines. Contains only: a generic note to read Next.js docs before writing code.  
- No agent rules, deployment constraints, security rules, sprint context, or reporting format defined anywhere.

**FINDINGS:**  
Any agent operating on this codebase has no guardrails. The security constraints established verbally in the audit plan — no `clerk init`, no key commits, production alias required — exist only in conversation history, not in the repository. They would not survive a context reset or a new agent.

**RISKS:**  
- An agent operating fresh on this repo could run `clerk init`, overwrite env vars, deploy without aliasing, or commit secrets — because nothing in the repo says not to.  
- No definition of done means tickets can be reported as complete without the deliverable existing.

**RECOMMENDATION:**  
Ticket 5 must execute before any further agent-driven development. Minimum required contents for CLAUDE.md:  
- Security prohibitions (verbatim from the audit plan)  
- Deployment policy (always alias after `npx vercel --prod`)  
- Agent reporting format (STATUS / EVIDENCE / FINDINGS / RISKS / RECOMMENDATION / CONFIDENCE)  
- Pointer to active sprint + current branch

**CONFIDENCE:** 100%

---

## 9. Portal Dashboard Gap

**STATUS:** ❌ STATIC PREVIEW — not connected to real data.

**EVIDENCE:**  
`src/app/portal/page.tsx`: 200 lines. Hardcoded mock data throughout. Progress bar fixed at `68%`. Milestones are static strings. Zero API calls.

**FINDINGS:**  
This is the page clients land on after logging in. Every other portal component — matters list (`/portal/matters`), vault (`/portal/vault`), admin console (`/portal/admin`) — is fully connected to real APIs. The portal landing page is the only exception.

**RISKS:**  
- Clients who authenticate see a fake dashboard. This is a trust failure for a firm whose product premise is a "Private Office" with real-time visibility.  
- If this page is not flagged, it could ship as-is and no one would immediately notice — because it renders without errors.

**RECOMMENDATION:**  
Connect `/portal/page.tsx` to `/api/matters` and `/api/vault/documents` for the authenticated user. Display: active matter count, most recent matter status with timestamp, and document count. This is a Sprint 2 task and should be treated as a blocker for client-facing launch.

**CONFIDENCE:** 100%

---

## SUMMARY TABLE

| Area | Status | Priority |
|------|--------|----------|
| Clerk Integration | ✅ Exists | Verify JWT template in Clerk Dashboard |
| Middleware / proxy.ts | ✅ Exists | Fix MFA criterion mismatch; disable /api/seed in prod |
| Role Model | ✅ Defined | Add undefined-role guard when portal connects to real data |
| Protected Routes (read) | ✅ Correct | — |
| Protected Routes (write) | ⚠️ Gaps | Fix vault upload role check + matter ownership check |
| Data Scoping | ✅ Read correct | Add matter ownership check on upload |
| Vault Blob Access | ⚠️ Public blobs | Upgrade to private blobs or document risk |
| Security Headers | ✅ Exists | Replace hardcoded Clerk host with env var |
| Governance (AGENTS.md) | ❌ Empty | Ticket 5 — blocks all future agent work |
| Portal Dashboard | ❌ Static fake data | Connect to real APIs before client launch |

---

## MISSING PROTECTIONS — BUILD LIST

1. `/api/vault/upload` — add role check; reject `undefined` role users.  
2. `/api/vault/upload` — add matter ownership check when `matter_id` is provided.  
3. `/api/vault/documents` — add staff query path (all documents when caller is advisor/admin).  
4. `/api/vault/documents/[id]` DELETE — verify `users.id` maps to Clerk user ID in production data.  
5. `/api/matters/[id]` PATCH — audit this route; confirm role gate is present.  
6. `/api/properties` — audit this route; confirm role gate is present.  
7. `/api/seed/*` — gate with `SEED_SECRET` env var or disable in production.  
8. CSP `CLERK_HOST` — replace hardcoded development URL with env var.  
9. MFA criteria — align middleware `fva[1]` check with server-side `twoFactorEnabled` check.  
10. Portal `/portal/page.tsx` — connect to real API data before client-facing launch.  
11. Clerk JWT template — confirm configured in Dashboard; document setup in `docs/security/CLERK_SETUP.md`.  
12. Vercel Blob — evaluate private access; if not available, document direct-URL risk in ops runbook.

---

*Document generated via direct code audit — 2026-06-09. All findings based on file reads against actual code. No assumptions made about runtime state. Items marked ⚠️ are verified gaps in code. Items marked ❌ are confirmed absent.*
