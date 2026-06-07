# Multi-Agent Protocol

**Version:** 1.1  
**Status:** Active  
**Owner:** Roman Cantelearist  
**Last Updated:** 2026-06-06

---

# Purpose

This document governs how multiple AI agents, developers, contractors, and technical contributors collaborate on the James Roman Advisory platform without creating conflicts, duplicate work, deployment mistakes, security regressions, or state drift.

The rule is simple:

**The repository documents are the system of record.**

Chat history is temporary.
Documentation is authoritative.

---

# Authority Hierarchy

When documents conflict, the following hierarchy applies:

| Priority | Document Type | Authority |
|----------|---------------|-----------|
| 1 | Project Governance | Highest |
| 2 | Architecture Documents | System design |
| 3 | Security Documents | Security controls |
| 4 | Operations Documents | Deployment and workflow |
| 5 | Handoff Documents | Current state |
| 6 | Chat History | Lowest |

Example:
If a deployment recommendation in chat conflicts with `PROJECT_GOVERNANCE.md`, the governance document wins.
If a handoff note conflicts with the security model, the security model wins.

Agents must never override higher-priority documents based on memory, assumptions, or prior conversations.

---

# Source of Truth Stack

Every session begins by reading these files in order.

## Tier 1 — Governance

1. `docs/PROJECT_GOVERNANCE.md`

Purpose:
- Mission
- Philosophy
- Constraints
- Final decision rules

---

## Tier 2 — Architecture

2. `docs/ARCHITECTURE.md`
3. `docs/SECURITY_MODEL.md`
4. `docs/MATTER_LIFECYCLE.md`

Purpose:
- System structure
- Security design
- Workflow model

---

## Tier 3 — Operational State

5. `AGENTS.md`
6. `CLAUDE.md`
7. `HANDOFF_PROTOTYPE2.md`

Purpose:
- Current state
- Branch state
- Active work
- Current blockers

---

## Tier 4 — Deployment History

8. `docs/operations/release-log.md`
9. `docs/operations/release-workflow.md`
10. `docs/operations/production-hotfix-policy.md`
11. `docs/operations/production-readiness.md`

Purpose:
- Deployment history
- Release process
- Production rules

---

# If Documents Conflict

The higher-priority document wins.

Never attempt to reconcile conflicting instructions through assumptions.

Escalate to Roman.

---

# Agent Lane Assignments

Each agent has a primary operating lane.

Stay inside your lane unless Roman explicitly reassigns work.

| Agent | Primary Responsibility |
|-------|------------------------|
| Claude | Architecture, operations, governance, security review, debugging |
| Codex | Code implementation, testing, refactoring |
| ChatGPT | Review, writing, strategy, planning, documentation |
| Gemini | Research, synthesis, market intelligence |

Lane ownership exists to reduce duplicated work and conflicting edits.

---

# Session Start Protocol

Before any work begins:

## Step 1

Read the Source of Truth Stack.

## Step 2

Review:
```text
docs/operations/release-log.md
```

Confirm:
- latest deployment
- active deployment status
- unresolved incidents

## Step 3

Review:
```text
HANDOFF_PROTOTYPE2.md
```

Confirm:
- blockers
- active branches
- environment state

## Step 4

Confirm branch and worktree status.

Required:
```bash
git status
git branch --show-current
```

Do not proceed if:
- unknown changes exist
- branch purpose is unclear
- deployment state is unclear

Ask Roman.

## Step 5

Run verification baseline if touching code.

---

# Session End Protocol

Before ending any session:

## Commit Work

No work should remain exclusively in chat.

Commit all completed changes.

## Update Release Log

If deployment, rollback, production change, or operational milestone occurred:

Update:
```text
docs/operations/release-log.md
```

## Update Handoff

If project state changed:

Update:
```text
HANDOFF_PROTOTYPE2.md
```

## Document Pending Work

Record:
- unfinished tasks
- blockers
- risks
- next recommended actions

A session is not complete until documentation reflects reality.

---

# Branch Discipline

## One Task Per Branch

Branches exist for a single objective.

Examples:
```text
feature/client-messaging
hotfix/sign-in-error
staging/auth-mfa
```

Avoid mixed-purpose branches.

---

## Hotfix Branching

Hotfixes always branch from:
- current approved production baseline

Never from:
- staging
- feature branches
- experimental branches

---

## Main Protection

Never commit directly to:
```text
main
```

Without Roman's approval.

---

# Production Rules

These rules are non-negotiable.

Never:
- run `vercel deploy --prod`
- run `vercel promote`
- bypass MFA
- bypass RLS
- bypass audit logging
- bypass signed URL controls
- expose secrets
- print environment variables

Never promote deployment:
```text
dpl_44EVkKaQFs4buprP8dF3nXMC34SC
```

Production requires explicit approval from Roman in the current thread.

---

# Emergency Production Incidents

If production becomes unavailable or actively impacts client access:

## Priority Order

1. Restore service.
2. Preserve security.
3. Restore known-good state.
4. Document actions.
5. Notify Roman.

Emergency response is not a feature-development opportunity.

Do not:
- refactor
- redesign
- upgrade packages
- add features

during incident response.

Restore stability first.

---

# Environment Model

Only three environments exist:
```text
prototype
staging
production
```

No additional naming schemes should be introduced.

---

# Visual Constitution

Applies to every contributor.

No change may reduce:
- visual calmness
- perceived discretion
- perceived competence
- speed

Prototype2 visuals are protected.

No visual modification occurs without Roman's approval.

---

# Matter-Centric Model

The platform revolves around:
```text
Relationship
↓
Matter
↓
Document
```

Future features should attach to this model.

Avoid disconnected feature silos.

---

# Matter Lifecycle

Approved lifecycle:
```text
Consultation Requested
↓
Consultation Scheduled
↓
Consultation Completed
↓
Proposal Sent
↓
Engaged
↓
Assessment
↓
Remediation Oversight
↓
Monitoring
↓
Completed
↓
Archived
```

Future CRM, Office, Messaging, Audit, and Billing features should derive from this lifecycle whenever possible.

---

# How Platforms Load Context

## Claude

Automatically reads:
- CLAUDE.md
- AGENTS.md

---

## Codex

Automatically reads:
- AGENTS.md

---

## ChatGPT

Upload:
1. PROJECT_GOVERNANCE.md
2. HANDOFF_PROTOTYPE2.md
3. release-log.md (latest entries)

---

## Gemini

Upload:
1. PROJECT_GOVERNANCE.md
2. HANDOFF_PROTOTYPE2.md
3. release-log.md (latest entries)

---

# Conflict Resolution

If multiple agents disagree:

1. Committed code wins.
2. More recent approved commit wins.
3. Governance beats implementation.
4. Security beats convenience.
5. Roman resolves final disputes.

When uncertain:

Stop.

Ask Roman.

---

# Final Rule

The goal is not to build software.

The goal is to build trust.

Software is merely one of the tools used to achieve it.
