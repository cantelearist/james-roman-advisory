# Release Log

This file is the system of record for all production deployments, hotfixes, and rollbacks.

Chat history is not a substitute for this log.

---

## Format

Each entry must include:

```
## [YYYY-MM-DD] — Type: Brief Description

- **Branch:** hotfix/... or main
- **Deployment ID:** (Vercel deployment ID)
- **Deployment URL:** (Vercel preview or production URL)
- **Timestamp:** (UTC)
- **Deployed by:** Roman
- **Rollback target:** (commit SHA or deployment ID)
- **Incident summary:** What was broken, who was affected, severity
- **Root cause:** One sentence
- **Fix summary:** What changed and why
- **Verification:** Build ✅ | Tests ✅ | Visual QA ✅ | Routes ✅
- **Notes:** Any follow-up items or known limitations
```

---

## Entries

<!-- Most recent entry at the top -->

---

## [2026-06-06] — Hotfix: Remove Clerk, Replace With Supabase Sign-In

- **Branch:** `hotfix/remove-clerk`
- **Commit:** `3b4ba53` (head at time of deploy)
- **Deployment ID:** `dpl_3yFwfQ7GgDdeDbx4w9tuTEMpQryZ`
- **Deployment URL:** `https://jr-advisory-nw2vs1ok0-roman-2757s-projects.vercel.app`
- **Timestamp:** 2026-06-07T06:31:24Z
- **Deployed by:** Roman (approved in session)
- **Rollback target:** `ec5285e` — approved production baseline
- **Incident summary:** `jamesroman.la/sign-in` crashing in production with `TypeError: useSession can only be used within the <ClerkProvider /> component`. Affected any visitor navigating to the sign-in route.
- **Root cause:** `@clerk/nextjs` was removed from `package.json` but `ClerkProvider` and Clerk components remained in `layout.tsx` and `sign-in/page.tsx`. The 1-day-old production bundle still referenced Clerk internals.
- **Fix summary:** Removed `@clerk/nextjs` and `ClerkProvider`. Replaced `/sign-in` with Supabase magic-link OTP page. Replaced `clerkMiddleware` in `proxy.ts` with Supabase session guard. Deleted `clerk-appearance.ts` and `seed/users/route.ts`. Added `@supabase/ssr`, `@supabase/supabase-js`. Restored `/prototype2` and `/prototype2/contact` routes (omitted from hotfix branch base). Fixed `vitest.config.ts` to pin `NODE_ENV=test` so React dev build loads correctly under Vitest 4.
- **Verification:** Build ✅ | Tests 36/37 ✅ (1 pre-existing env failure) | Visual QA ✅ | Routes ✅ (/, /sign-in, /sign-up, /prototype2, /prototype2/contact, /portal all 200)
- **Notes:** One test (`consultations/route.test.ts` — valid intake POST) requires `DATABASE_URL` in test env. Pre-existing gap, not a regression. `seed/users/route.ts` removed — dev-only endpoint, no production surface.
