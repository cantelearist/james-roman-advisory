# JRA Agent Rules

This file governs all AI agents operating on this codebase.
It is read by Claude, ChatGPT, Gemini, and any other agent assigned to this project.
These rules are non-negotiable. They do not change per-task.

---

## Framework Note

This is **Next.js App Router**. The middleware file is `src/proxy.ts`, not `middleware.ts`.
APIs are route handlers under `src/app/api/`. Server components use `async`/`await`.
Turbopack is enabled. Before modifying any framework-level config, read the relevant
docs in `node_modules/next/dist/docs/`.

---

## Security Non-Negotiables

**Never do any of the following:**

1. `npx clerk init` or any Clerk CLI on the existing project — would overwrite CLERK keys.
2. Commit `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `BLOB_READ_WRITE_TOKEN`,
   `NEON_DATABASE_URL`, or `STAGING_PASSWORD` to code. These go in Vercel env vars only.
3. Return `blob_pathname` or any Vercel Blob URL in an API response to a client.
   All file downloads go through `/api/vault/documents/[id]` (authenticated proxy).
4. Auto-create client records from upload routes. Clients must be provisioned via
   the admin invite flow (`/api/admin/invite`).
5. Remove or downgrade role checks in middleware or API routes without explicit instruction.
6. Write fake/hardcoded data in portal pages. Every page must show real data or an
   honest empty state. No mock progress bars, no static milestones, no placeholder counts.

---

## Deployment Policy

Every `npx vercel --prod` must be followed immediately by:

```
npx vercel alias <deployment-url> jamesroman.la
npx vercel alias <deployment-url> www.jamesroman.la
```

Both aliases are required on every production deploy. No exceptions.

Staging deploys use `staging.jamesroman.la`. Confirm the STAGING_PASSWORD env var
is set in both preview and production environments before deploying.

---

## MFA Rule (canonical, authoritative)

A staff session is MFA-verified when `fva[1]` from Clerk session claims is not null.
Phone verification does NOT satisfy MFA. Staff must complete a TOTP or hardware key
second factor. This rule applies in both `src/proxy.ts` (middleware) and `src/lib/auth.ts`
(server). Never relax this check for staff routes.

---

## Agent Reporting Format

All agents report findings in this format:

```
STATUS     — EXISTS / MISSING / PARTIAL / BROKEN
EVIDENCE   — File path and line numbers, or exact error message
FINDINGS   — What the code actually does
RISKS      — What can go wrong
RECOMMENDATION — What to build or fix
CONFIDENCE — 0–100%
```

Agents do not report assumptions as facts. If a finding cannot be verified from code,
it is marked with "(unverified — check runtime)".

---

## Definition of Done

A ticket is done when:
- [ ] Code change is written and syntactically correct
- [ ] No fake data, mock states, or TODO comments in shipped code
- [ ] If a new API route: role check is present and tested manually
- [ ] If a UI change: empty state is implemented alongside happy path
- [ ] Deployed to production and both domain aliases are confirmed live
- [ ] AUTH_ACCESS_REVIEW.md is updated if auth behavior changed

---

## No Fake Data Rule

This is a client-facing system that explicitly sells privacy, trust, and real-time
visibility. Shipping fake data — hardcoded progress, static milestones, placeholder
document counts — is a breach of the product promise and must never happen.

If real data is unavailable (no matters exist, no documents uploaded), show an
honest empty state with a clear message. Do not fabricate state.

---

## Active Sprint

See `PLAN.md` for the current sprint and open tickets.
See `docs/security/AUTH_ACCESS_REVIEW.md` for the auth audit and build list.
