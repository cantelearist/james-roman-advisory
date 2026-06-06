# Release Workflow

## Executive Summary

production is frozen unless Roman explicitly approves a production action in the current thread. Default work happens in `prototype` and then in `staging`.

No production deploy should happen from a dirty worktree, a backup extract, or a temporary folder.

## Required Flow

1. Work on a branch or isolated worktree.
2. Keep Prototype2 visual changes separate from backend/security work.
3. Review the canonical release log before changing deployment state:

```bash
cat docs/operations/release-log.md
```

4. Run local verification:

```bash
npm run build
npm run test
npm run prototype:test:visual
```

Visual regression must pass before staging. Screenshots are saved to `/tmp/jra-visual-qa` and are not committed.

5. Check `staging` environment separation:

```bash
npm run staging:check
```

6. Apply branch-scoped staging environment variables when new staging credentials are available:

```bash
npm run staging:env:apply
```

7. Deploy only to `staging`:

```bash
npm run staging:deploy
```

8. Inspect the staging deployment:

```bash
npx vercel inspect <staging-url>
```

9. Run browser QA against the staging URL before asking for production approval.
10. Add a release-log entry for every staging deployment, production deployment, rollback, and major production-readiness milestone.

## production Deploy Rule

production deployment is blocked by default:

```bash
npm run production:deploy
```

This command requires:

```bash
JRA_APPROVE_PRODUCTION_DEPLOY=roman-approved-production
```

Only set that value after Roman explicitly approves production deployment in the current thread.

## Current Staging Blocker

As of June 5, 2026:

- staging and production share the same Supabase URL, anon key, and service-role key.
- staging has no properly named Stripe test-mode keys.
- Therefore staging is not yet valid.

The expected result is:

```bash
npm run staging:check
# fails until separate Supabase staging and Stripe test-mode env vars are configured
```

## Never Do This

- Do not run `vercel deploy --prod` directly.
- Do not run `vercel promote` without approval.
- Do not deploy backend/security work to production from this dirty WIP worktree.
- Do not use production Supabase data for staging testing.
- Do not test contractor payments with live Stripe keys.
