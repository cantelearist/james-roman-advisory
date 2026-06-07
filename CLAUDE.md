@AGENTS.md

## Absolute Rules

- Do not deploy production.
- Do not run `vercel --prod`.
- Do not promote staging to production.
- Do not change Prototype2/public visual style without Roman's approval.
- No real client data.
- No live Stripe keys.
- Preserve the Visual Constitution: no CRM, Office Portal, or Admin feature may reduce visual calmness, perceived discretion, perceived competence, or speed.

## Read First

Before starting any task, read these in order:

1. `docs/PROJECT_GOVERNANCE.md` — mission, philosophy, final decision rules
2. `docs/MULTI_AGENT_PROTOCOL.md` — authority hierarchy, agent lanes, session protocol, production rules
3. `docs/ARCHITECTURE.md` — system structure, routes, auth flow, middleware, storage
4. `docs/SECURITY_MODEL.md` — auth model, RLS, service-role policy, audit logging, storage security
5. `docs/MATTER_LIFECYCLE.md` — full lifecycle, transition rules, document security, feature attachment points
6. `HANDOFF_PROTOTYPE2.md` — current state, blockers, deployment history
7. `docs/operations/release-log.md` — what has been deployed and when

## Document Authority

When documents conflict:

1. `docs/PROJECT_GOVERNANCE.md`
2. `docs/MULTI_AGENT_PROTOCOL.md`
3. `CLAUDE.md`
4. `memory/*.md`
5. Chat history

Higher authority wins.

Do not override a higher-authority document based on memory, assumptions, prior conversation, or local convenience.

If there is a conflict involving production, security, visual constitution, deployment state, or branch ownership, stop and ask Roman.

## Memory Index

Synthesized context files live in `memory/`. Read in this order for full project context:

1. `memory/current-state.md` — current production/staging deployment state, active branch, blockers, and verification baseline
2. `memory/architecture.md` — Option A decision, three surfaces, stack, CRM model, risk map, launch blockers, cost
3. `memory/security.md` — Identity, roles, auth, RLS, session policy, audit logging, service-role policy, document scanning, known gaps
4. `memory/operations.md` — Environment lanes, current deployment baseline, rollback commands, release workflow, Vercel env vars, backup/restore
5. `memory/payments.md` — Stripe Connect architecture, V1 payment flow, data model, legal review requirements, deferred items
6. `memory/visual-constitution.md` — The four non-negotiable rules, enforcement gate, public site QA requirements
7. `memory/sprint-plan.md` — Full P0/P1/P2 groups, all tickets with files + verification commands, local test results, instant takeover instructions

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

```text
2e7fa3fcd62cce3e100b7a1697121eddb36472f6d98bbe3b922d17d340f4d9ac
```

## Current Verification Baseline

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

## Before Reporting Complete

- Run relevant targeted tests.
- Run `npm run prototype:build`.
- If schema/RLS changed, run `npx supabase db reset` and `npx supabase test db`.
- Update `HANDOFF_PROTOTYPE2.md` and `docs/operations/release-log.md`.
- Update `memory/current-state.md` if deployment, branch, blocker, or verification status changed.
- Clearly state what passed, what failed, and what remains blocked.

## Governance and Operations Docs

```text
docs/
├── PROJECT_GOVERNANCE.md         — mission, philosophy, final decision rules
├── MULTI_AGENT_PROTOCOL.md       — agent lanes, session protocol, production rules
├── ARCHITECTURE.md               — system structure, routes, auth flow, middleware
├── SECURITY_MODEL.md             — auth, RLS, service-role, audit, storage security
├── MATTER_LIFECYCLE.md           — lifecycle, transitions, document rules, billing hooks
└── operations/
    ├── production-hotfix-policy.md   — rules and process for hotfixes
    ├── production-readiness.md       — pre-deployment checklist
    ├── release-log.md                — system of record for all production deployments
    └── sentry-monitoring.md          — Sentry setup, DSN requirements, PII scrubbing rules
```

## Current-State Requirement

`memory/current-state.md` must be kept short and current.

It should answer:

- What is live?
- What is staged?
- What branch is active?
- What is blocked?
- What passed most recently?
- What must not be touched?

If that file becomes stale, future agents will waste time rediscovering the obvious, which is apparently a traditional software ritual but not one we need to honor.
