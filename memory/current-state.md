# Current State

**Project:** James Roman Advisory  
**Status:** Active  
**Last Updated:** 2026-06-07  
**Owner:** Roman Cantelearist  

---

## Purpose

This file is the short-form operational dashboard for the project.

It should be updated whenever deployment state, branch state, verification status, blockers, or production risk changes.

The goal is to let a new agent understand the current state in under two minutes without excavating chat history like a doomed archaeologist with a keyboard.

---

## Production

**Domain:** `https://www.jamesroman.la`

**Active production deployment:** `jr-advisory-cyie1utur-roman-2757s-projects.vercel.app`

**Deployed:** 2026-06-07 from `hotfix/remove-clerk` (via promote of `jr-advisory-30mfpl513`)

**Rollback target:** `jr-advisory-g8ymd18f2-roman-2757s-projects.vercel.app` (previous June 5 snapshot)

```bash
# Emergency rollback if needed:
node_modules/.bin/vercel alias jr-advisory-g8ymd18f2-roman-2757s-projects.vercel.app www.jamesroman.la
```

**Production status:**

- Production is live. All three routes (/, /prototype, /prototype2) verified 200.
- Prototype experience (liquid glass, GSAP, Lenis) is live on all three routes.
- `page.tsx` = `export { default } from "./prototype/page"` (re-export)
- `prototype2/page.tsx` = independent 797-line copy of prototype experience
- `founders-together.png` (Malibu ridge shot) confirmed in HTML.
- No production deploy without Roman's explicit approval in the current thread.

**Bad deployment:**

```text
dpl_44EVkKaQFs4buprP8dF3nXMC34SC
```

Never promote this deployment.

---

## Staging

**Active staging branch:** `staging-secure-office-foundation`

**Staging preview:** `https://jr-advisory-55j9uyv1r-roman-2757s-projects.vercel.app`

**Staging access:** Protected by Vercel Authentication (SSO) — 401 without Vercel login. Access via Vercel dashboard.

**Staging status:**

- Staging build clean — /, /prototype, /prototype2 all static ✅
- Prototype experience on all routes matches production.
- Staging has full security feature set: /admin, /office, /api/*, auth/callback, document flows, rate limiting, CSRF guards.
- Staging must remain separate from production.
- No real client data.
- No live Stripe keys.
- No live contractor payouts.

---

## Visual Benchmark

**Reference deployment:** `https://jr-advisory-g8ymd18f2-roman-2757s-projects.vercel.app`

Roman confirmed this as the visual benchmark for all environments. All routes must show the prototype experience (liquid glass, GSAP scroll, Lenis smooth scroll, `founders-together.png` Malibu ridge shot).

---

## Active Work

Current known active foundation areas:

- Supabase schema and RLS
- Auth + MFA
- Service-role reduction
- Access-control regression tests
- Request guard / same-origin checks
- Rate limiting
- Document scan gating
- Governance and multi-agent protocol hardening

---

## Current Verification Baseline

Latest known baseline (2026-06-07):

```bash
# Production routes
curl -s -o /dev/null -w "%{http_code}" https://www.jamesroman.la/        # 200
curl -s -o /dev/null -w "%{http_code}" https://www.jamesroman.la/prototype  # 200
curl -s -o /dev/null -w "%{http_code}" https://www.jamesroman.la/prototype2 # 200

# Content confirmed: founders-together, jra-hero, smooth (prototype components)
```

---

## Current Blockers / Open Items

- Stripe payment flow remains non-live — must stay in staging/test mode until legal/payment review and explicit approval.
- Staging Stripe test-mode keys not yet configured.
- Sentry DSN not yet set — monitoring is installed but inactive.
- Counsel approval required for retention/CPRA language before real client data is stored.
- `consultations/route.test.ts` (valid intake POST) requires `DATABASE_URL` in test env — pre-existing gap.
- Staging domain alias (`staging.jamesroman.la`) not yet set — staging accessible only via Vercel SSO or dashboard.

---

## Do Not Touch Without Approval

- Production deployment
- Production Supabase
- Production Stripe
- `main`
- Prototype2 visuals
- Founder images
- Typography
- Animations
- Public visual style
- MFA enforcement
- RLS
- Audit logging
- Signed URL controls
- Service-role handling

---

## Required Reading

Before work begins:

1. `docs/PROJECT_GOVERNANCE.md`
2. `docs/MULTI_AGENT_PROTOCOL.md`
3. `CLAUDE.md`
4. `memory/current-state.md` (this file)
5. `HANDOFF_PROTOTYPE2.md`
6. `docs/operations/release-log.md`

---

## Update Rule

Update this file when any of these change:

- production deployment
- staging deployment
- active branch
- rollback target
- known blockers
- verification baseline
- environment status
- security posture
- production approval status
