# Production Hotfix Policy

## Purpose

Production hotfixes exist to resolve a specific production issue with the smallest possible change.

A hotfix is not a release vehicle for unrelated improvements, technical debt cleanup, feature work, dependency upgrades, architecture changes, visual refinements, or security initiatives already scheduled for staging.

The objective is simple:

**Fix the production problem without creating a new one.**

Hotfixes are operational exceptions, not accelerated feature releases.

---

## Core Principle

A production hotfix may contain:

- One bug
- One root cause
- One deployment objective

Nothing else.

If multiple unrelated issues exist, they must be separated into individual hotfixes or routed through the normal staging and release process.

---

## Allowed Hotfix Scope

Examples of acceptable hotfixes:

- Authentication failure
- Broken sign-in flow
- Broken redirect
- Production-only runtime exception
- Failed API endpoint
- Missing environment configuration
- Deployment-specific regression
- Critical security vulnerability requiring immediate mitigation
- Critical production outage

The hotfix should address only the verified root cause.

---

## Prohibited Hotfix Scope

The following must not be included in a production hotfix unless they are directly required to resolve the production issue:

- New features
- UI redesigns
- Visual refinements
- Typography changes
- Animation changes
- Image replacements
- Refactoring unrelated code
- Database redesign
- Architecture changes
- Package upgrades unrelated to the incident
- Payment features
- CRM enhancements
- Office Portal enhancements
- Admin enhancements
- Experimental code
- Technical debt cleanup

---

## Required Process

### Step 1: Identify The Problem

Document:

- What is broken
- Who is affected
- Severity
- Reproduction steps
- Suspected root cause

### Step 2: Create A Dedicated Hotfix Branch

Example:

```bash
git checkout -b hotfix/sign-in-clerk-runtime-error
```

Do not use:

- feature branches
- staging branches
- dirty worktrees
- backup extracts

### Step 3: Implement The Smallest Possible Fix

The preferred solution is the smallest change that resolves the verified root cause.

Avoid opportunistic improvements.

Avoid cleanup work.

Avoid "while I'm here" changes.

### Step 4: Verification

Required:

```bash
npm run build
npm run test
```

If the public site is affected:

```bash
npm run prototype:test:visual
```

### Step 5: Review Diff Size

Before deployment ask:

> If this bug did not exist, would this code still have been changed?

If the answer is yes, remove it from the hotfix.

### Step 6: Production Approval

Production remains frozen by default.

Hotfix deployment requires explicit approval from Roman in the current thread.

### Step 7: Deployment

Deploy only the hotfix branch.

Record:

- deployment ID
- deployment URL
- timestamp
- rollback target

in:

```text
docs/operations/release-log.md
```

---

## Rollback Requirement

Every hotfix must identify a rollback target before deployment.

If rollback is unclear:

**Do not deploy.**

---

## Visual Constitution Protection

Production hotfixes must not modify:

- Prototype2 visuals
- founder images
- typography
- animations
- layout
- brand presentation

unless the production issue is directly caused by those assets.

---

## Security Foundation Protection

Production hotfixes must not be used to bypass:

- MFA requirements
- access control
- RLS protections
- audit logging
- signed URL protections
- rate limiting
- security review

Temporary security shortcuts create permanent security problems.

---

## Documentation Requirement

Every production hotfix must create an entry in:

```text
docs/operations/release-log.md
```

The release log is the system of record.

Chat history is not.

---

## Default Rule

When uncertain:

Do not deploy.

Use staging.

Verify the fix.

Then return through the normal release process.

A delayed deployment is usually recoverable.

An unnecessary production incident rarely is.
