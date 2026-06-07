# Multi-Agent Protocol

**Version:** 1.0  
**Status:** Active  
**Owner:** Roman Cantelearist  
**Last Updated:** 2026-06-06

---

## Purpose

This document governs how multiple AI agents — Claude, ChatGPT, Codex, Gemini, or any future model — collaborate on this project without creating conflicts, duplicate work, or state drift.

The rule is simple: **the docs are the system of record, not the chat history.**

Every agent session that doesn't end with updated docs has produced work that may not survive the next session.

---

## The Source of Truth Stack

Read these files in this order at the start of every session, regardless of which model you are:

| Priority | File | Purpose |
|----------|------|---------|
| 1 | `docs/PROJECT_GOVERNANCE.md` | North star. What this project is and why. |
| 2 | `AGENTS.md` | Rules, constraints, and security boundaries. |
| 3 | `CLAUDE.md` | Quick reference, verification baseline, rollback commands. |
| 4 | `HANDOFF_PROTOTYPE2.md` | Full deployment and visual history. Current blockers. |
| 5 | `docs/operations/release-log.md` | What has been deployed, when, and by whom. |
| 6 | `docs/operations/production-hotfix-policy.md` | When and how to fix production. |
| 7 | `docs/operations/production-readiness.md` | Pre-deployment checklist. |

If these files conflict with your chat context or your prior understanding, **the files win.**

---

## Agent Lane Assignments

Each agent type has a lane. Stay in yours unless Roman reassigns.

| Agent | Primary Lane | Examples |
|-------|-------------|---------|
| **Claude** (Cowork / Code) | Architecture, ops, governance, documentation, security review, complex debugging | Writing policies, reviewing diffs, planning branches, multi-file changes |
| **Codex** | Targeted code generation, file-level edits, test writing | Implementing a specific function, writing a test, refactoring a module |
| **ChatGPT** | Review, writing, strategy, brief preparation | Reviewing copy, drafting client-facing content, business analysis |
| **Gemini** | Research, competitive analysis, document synthesis | Market research, summarizing long documents, cross-referencing sources |

Agents do not cross lanes without explicit instruction from Roman in the current thread.

---

## Session Start Protocol

Before doing any work, every agent must:

1. **Read the source of truth stack** (table above, in order).
2. **Check `docs/operations/release-log.md`** — confirm what the last deployment was and whether anything is in-flight.
3. **Check `HANDOFF_PROTOTYPE2.md`** — confirm current blockers and staging/production state.
4. **Identify your branch** — confirm which branch you're working on and that the worktree is clean.
5. **Run the verification baseline** from `CLAUDE.md` if you're about to touch the codebase.

Do not begin work if:
- The release log shows a deployment in-flight with no resolution entry.
- The worktree has uncommitted changes you didn't create in this session.
- The current branch is unclear.

Ask Roman to clarify before proceeding.

---

## Session End Protocol

Before closing any session, every agent must:

1. **Commit all changes** — no work lives in an uncommitted state.
2. **Update `docs/operations/release-log.md`** — add an entry if any deployment, hotfix, or significant commit occurred.
3. **Update `HANDOFF_PROTOTYPE2.md`** — if the state of the project changed (new deployment, resolved blocker, new blocker, visual change), update the relevant section.
4. **State what's pending** — if the session ends with work unfinished, note it clearly in the handoff doc under "Current Blockers."

The session is not complete until the docs reflect the current state.

---

## Branch Discipline

| Rule | Detail |
|------|--------|
| One task per branch | Each branch addresses one thing. Do not bundle unrelated changes. |
| Hotfixes branch from production baseline | Never branch a hotfix from staging. See `docs/operations/production-hotfix-policy.md`. |
| No commits to `main` directly | All changes go through a branch and are approved by Roman before merge. |
| No deployment without Roman's approval | Roman must say "approved — deploy" in the current thread before any production deployment. |
| Staging and production are separate | Different Supabase projects, different Vercel deployments, different env vars. Never cross-contaminate. |

---

## Production Rules (Non-Negotiable)

These apply to every agent, every session:

- **Do not run `vercel deploy --prod`.**
- **Do not run `vercel promote`.**
- **Do not deploy to production without Roman's explicit approval in the current thread.**
- **Do not push to origin/main without approval.**
- **Do not bypass MFA, RLS, access controls, or audit logging — not even temporarily.**
- **Do not expose secrets. Do not print env vars.**
- **Do not use the service-role Supabase key in client or browser code.**
- **BAD deployment — never promote:** `dpl_44EVkKaQFs4buprP8dF3nXMC34SC`

When in doubt: do not deploy. Use staging. Verify. Ask Roman.

---

## How Each Platform Loads Context

### Claude (Cowork / Code)
Reads `CLAUDE.md` and `AGENTS.md` automatically at session start. No manual loading required. The docs are the handoff.

### Codex
Reads `AGENTS.md` automatically at session start. Ensure `AGENTS.md` is present at the repo root and up to date.

### ChatGPT
No automatic file loading. At session start, paste or upload:
1. `docs/PROJECT_GOVERNANCE.md`
2. `HANDOFF_PROTOTYPE2.md`
3. `docs/operations/release-log.md` (last 2–3 entries)

Then state which lane and task you're delegating.

### Gemini
Same as ChatGPT — upload files manually at session start. Same three files minimum.

---

## Conflict Resolution

If two agents have worked on the same area and produced conflicting output:

1. **The committed version wins.** Uncommitted work is not authoritative.
2. **The more recent commit wins** — unless it touches a production-protected area without approval.
3. **Roman resolves all conflicts** involving production deployments, visual changes, or security boundaries. No agent resolves these unilaterally.
4. **When unsure, stop and ask Roman.** Do not guess your way through a conflict.

---

## Visual Constitution (All Agents)

No change to the public Prototype2 experience — visuals, layout, typography, animations, founder images — may be made by any agent without Roman's explicit approval.

A feature that is functionally correct but visually wrong is not complete.

The standard: a design change is only acceptable if it increases (or does not reduce) perceived calmness, discretion, competence, and speed.

---

## Related Documents

- [PROJECT_GOVERNANCE.md](./PROJECT_GOVERNANCE.md)
- [AGENTS.md](../AGENTS.md)
- [CLAUDE.md](../CLAUDE.md)
- [HANDOFF_PROTOTYPE2.md](../HANDOFF_PROTOTYPE2.md)
- [release-log.md](./operations/release-log.md)
- [production-hotfix-policy.md](./operations/production-hotfix-policy.md)
- [production-readiness.md](./operations/production-readiness.md)
