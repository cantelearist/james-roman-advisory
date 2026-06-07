# Current State

**Project:** James Roman Advisory  
**Status:** Active  
**Last Updated:** 2026-06-06  
**Owner:** Roman Cantelearist  

---

## Purpose

This file is the short-form operational dashboard for the project.

It should be updated whenever deployment state, branch state, verification status, blockers, or production risk changes.

The goal is to let a new agent understand the current state in under two minutes without excavating chat history like a doomed archaeologist with a keyboard.

---

## Production

**Domain:** `https://www.jamesroman.la`

**Active production deployment:** `dpl_3yFwfQ7GgDdeDbx4w9tuTEMpQryZ`

**Production URL:** `https://jr-advisory-nw2vs1ok0-roman-2757s-projects.vercel.app`

**Deployed:** 2026-06-07T06:31:24Z from `hotfix/remove-clerk` @ `3b4ba53`

**Rollback target:** `dpl_6t7vzRxwcaEysXg1bVP9o3kqZpLi` (pre-hotfix baseline)

```bash
# Emergency rollback if needed:
npx vercel rollback dpl_6t7vzRxwcaEysXg1bVP9o3kqZpLi --yes --timeout 3m
npx vercel alias set jr-advisory-l925rkcj8-roman-2757s-projects.vercel.app www.jamesroman.la
```

**Production status:**

- Production is live and stable. All routes verified 200.
- No production deploy without Roman's explicit approval in the current thread.
- Prototype2/public visual experience must remain unchanged unless Roman explicitly approves a visual change.

**Bad deployment:**

```text
dpl_44EVkKaQFs4buprP8dF3nXMC34SC
```

Never promote this deployment.

---

## Staging

**Active staging branch:** `staging-secure-office-foundation`

**Staging preview:** `https://jr-advisory-lxme9mhnb-roman-2757s-projects.vercel.app`

**Staging deployment ID:** `dpl_4d2CVJSmag8q6Z9PZcz5gFb4dnHU`

**Staging access:** Protected by Vercel Authentication — 401 without authorization.

**Staging status:**

- Staging is the correct lane for secure office, CRM, auth, RLS, document exchange, payments, and infrastructure work.
- Staging must remain separate from production.
- No real client data.
- No live Stripe keys.
- No live contractor payouts.

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

Latest known baseline (hotfix branch, pre-deploy):

```bash
npm run build
# passed (Next.js 15, no type errors)

npm test
# 36/37 passing (1 pre-existing DATABASE_URL env failure — not a regression)

curl https://www.jamesroman.la{/,/sign-in,/sign-up,/prototype2,/prototype2/contact,/portal}
# all → 200
```

---

## Current Blockers / Open Items

- Stripe payment flow remains non-live — must stay in staging/test mode until legal/payment review and explicit approval.
- Staging Stripe test-mode keys not yet configured.
- Sentry DSN not yet set — monitoring is installed but inactive.
- Counsel approval required for retention/CPRA language before real client data is stored.
- `consultations/route.test.ts` (valid intake POST) requires `DATABASE_URL` in test env — pre-existing gap.

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
