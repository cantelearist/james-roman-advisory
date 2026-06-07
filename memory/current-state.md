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

**Approved production deployment:** `dpl_6t7vzRxwcaEysXg1bVP9o3kqZpLi`

**Rollback target:**

```bash
npx vercel rollback https://jr-advisory-n0pqlh56f-roman-2757s-projects.vercel.app --yes --timeout 3m
```

**Production status:**

- Production is frozen by default.
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

Latest known baseline:

```bash
npm run prototype:test
# 18 files, 58 tests passed

npm run prototype:build
# passed

npx supabase db reset
# passed

npx supabase test db
# 1 file, 20 tests, PASS

npm run staging:check
# passed, Stripe warnings only
```

---

## Current Blockers / Open Items

- No production deploy is approved.
- Stripe payment flow remains non-live and must stay in staging/test mode until legal/payment review and explicit approval.
- Staging Stripe test-mode keys not yet configured.
- Sentry DSN not yet set — monitoring is installed but inactive.
- Counsel approval required for retention/CPRA language before real client data is stored.

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
