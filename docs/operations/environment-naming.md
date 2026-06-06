# Environment Naming

## Executive Summary

All project naming starts with one of three lanes:

```text
prototype
staging
production
```

This is not branding theater. It keeps design exploration, safe integration testing, and live client-facing operations from bleeding into one another.

## Lane Definitions

### prototype

Use for local design, UI review, and non-production experimentation.

Examples:

- Branch: `prototype/liquid-glass-home`
- Routes: `/prototype`, `/prototype2`
- Scripts:
  - `npm run prototype:dev`
  - `npm run prototype:build`
  - `npm run prototype:test`
  - `npm run prototype:test:visual`

Rules:

- No real client data.
- No production env vars.
- No live payment keys.
- Visual changes require approval before moving to staging.

### staging

Use for integration testing before production.

Vercel's internal name for this lane is `Preview`, but our project name is `staging`.

Examples:

- Branch pattern: `staging/<feature-name>`
- Vercel target: `Preview`
- Supabase project: `james-roman-advisory-staging`
- Stripe mode: test mode only
- Scripts:
  - `npm run staging:check`
  - `npm run staging:deploy`

Rules:

- Must use separate Supabase staging credentials.
- Must use Stripe test-mode keys.
- Must not use production data.
- Must pass `npm run staging:check`.

### production

Use only for live client-facing deployment.

Examples:

- Domain: `https://www.jamesroman.la`
- Vercel target: `Production`
- Supabase project: production project only
- Stripe mode: live mode only after legal/payment approval
- Scripts:
  - `npm run production:guard`
  - `npm run production:deploy`

Rules:

- Requires Roman's explicit approval in the current thread.
- Must have a named rollback deployment.
- Must not be deployed from a dirty worktree.
- Must not receive untested visual, auth, document, or payment changes.

## Current Branches

The approved prototype/design lane branch is:

```text
prototype/liquid-glass-home
```

The active staging branch is:

```text
staging-secure-office-foundation
```

Do not create or push a production branch until production approval is given.
