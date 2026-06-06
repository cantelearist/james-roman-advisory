@AGENTS.md

## Memory Index

Synthesized context files live in `memory/`. Read in this order for full project context:

1. `memory/architecture.md` — Option A decision, three surfaces, stack, CRM model, risk map, launch blockers, cost
2. `memory/security.md` — Identity, roles, auth, RLS, session policy, audit logging, service-role policy, document scanning, known gaps
3. `memory/operations.md` — Environment lanes, current deployment baseline, rollback commands, release workflow, Vercel env vars, backup/restore
4. `memory/payments.md` — Stripe Connect architecture, V1 payment flow, data model, legal review requirements, deferred items
5. `memory/visual-constitution.md` — The four non-negotiable rules, enforcement gate, public site QA requirements
6. `memory/sprint-plan.md` — Full P0/P1/P2 groups, all tickets with files + verification commands, local test results, instant takeover instructions

## Quick Reference

**Live production:** `dpl_6t7vzRxwcaEysXg1bVP9o3kqZpLi` → `https://www.jamesroman.la`
**BAD deployment (do NOT promote):** `dpl_44EVkKaQFs4buprP8dF3nXMC34SC`
**Active branch:** `staging-secure-office-foundation`
**Worktree:** `/Users/romancantelearist/.config/superpowers/worktrees/james-roman-advisory/prototype-liquid-glass`

**Staging preview:** `https://jr-advisory-lxme9mhnb-roman-2757s-projects.vercel.app`
**Staging deployment ID:** `dpl_4d2CVJSmag8q6Z9PZcz5gFb4dnHU`
**Staging auth:** Protected by Vercel Authentication — 401 without authorization

**Emergency rollback:**
```bash
npx vercel rollback https://jr-advisory-n0pqlh56f-roman-2757s-projects.vercel.app --yes --timeout 3m
```

**Founder image expected hash:**
```
2e7fa3fcd62cce3e100b7a1697121eddb36472f6d98bbe3b922d17d340f4d9ac
```

## Operations Docs

```
docs/operations/
├── production-hotfix-policy.md   — rules and process for hotfixes
├── production-readiness.md       — pre-deployment checklist
└── release-log.md                — system of record for all production deployments
```
