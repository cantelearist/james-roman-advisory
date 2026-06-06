# Operations — James Roman Advisory

Sources: `deployment-baseline.md`, `release-log.md`, `release-workflow.md`, `staging-environment.md`, `environment-naming.md`, `backup-restore-runbook.md`, `production-readiness.md`

## Environment Lane Naming
All environments/scripts start with one of three lane names:

### prototype
- Branch: `prototype/<name>`
- Routes: `/prototype`, `/prototype2`
- Scripts: `npm run prototype:dev`, `npm run prototype:build`, `npm run prototype:test`, `npm run prototype:test:visual`
- No real client data, no production env vars, no live payment keys
- Visual changes require approval before moving to staging

### staging
- Vercel target: `Preview` (internal Vercel name)
- Branch pattern: `staging/<feature-name>`
- Active branch: `staging-secure-office-foundation`
- Supabase: `james-roman-advisory-staging` (separate project — required)
- Stripe: test mode only
- Scripts: `npm run staging:check`, `npm run staging:deploy`, `npm run staging:env:apply`
- Must use separate Supabase credentials, Stripe test-mode keys, no production data

### production
- Domain: `https://www.jamesroman.la`
- Vercel target: `Production`
- Scripts: `npm run production:guard`, `npm run production:deploy`
- **Requires Roman's explicit approval in the current thread**
- Must have named rollback deployment, clean worktree, no untested changes

## Current Production Baseline (2026-06-05)
- **Approved deployment:** `dpl_6t7vzRxwcaEysXg1bVP9o3kqZpLi`
- **URL:** `https://jr-advisory-n0pqlh56f-roman-2757s-projects.vercel.app`
- **Domain:** `https://www.jamesroman.la`
- **BAD deployment (do NOT promote):** `dpl_44EVkKaQFs4buprP8dF3nXMC34SC`
- **Bad URL:** `https://jr-advisory-ox3nv2ps3-roman-2757s-projects.vercel.app`

## Emergency Rollback
```bash
npx vercel rollback https://jr-advisory-n0pqlh56f-roman-2757s-projects.vercel.app --yes --timeout 3m
```

## Founder Image Verification
```bash
curl -L --fail --silent https://www.jamesroman.la/images/founders/founders-malibu-beach.png | shasum -a 256
# Expected: 2e7fa3fcd62cce3e100b7a1697121eddb36472f6d98bbe3b922d17d340f4d9ac
```

## Release Workflow (Required Steps)
1. Work on branch/isolated worktree
2. Keep Prototype2 visual changes separate from backend/security work
3. Review `docs/operations/release-log.md`
4. Run local verification: `npm run build && npm run test`
5. Check staging separation: `npm run staging:check`
6. Apply branch-scoped env vars if new: `npm run staging:env:apply`
7. Deploy to staging only: `npm run staging:deploy`
8. Inspect staging: `npx vercel inspect <staging-url>`
9. Run browser QA against staging URL
10. Add release-log entry for every staging/production deploy, rollback, or major milestone

## Production Deploy Gate
```bash
npm run production:deploy
# Requires: JRA_APPROVE_PRODUCTION_DEPLOY=roman-approved-production
```
Only set that value after Roman explicitly approves in the current thread.

## Staging Variables (branch: staging-secure-office-foundation)
Required now (✅ done as of 2026-06-05):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUDIT_HASH_SECRET` (staging value)

Required before payment work:
- `STRIPE_SECRET_KEY` (test mode)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (test mode)
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CONNECT_CLIENT_ID`

All secret keys must be marked sensitive/encrypted in Vercel.

## Vercel Required Env Vars (Production)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, sensitive)
- `STRIPE_SECRET_KEY` (server-only, sensitive — live mode only after legal approval)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET` (server-only, sensitive)
- `STRIPE_CONNECT_CLIENT_ID` (if Connect uses OAuth flow)
- `AUDIT_HASH_SECRET` (separate production value, ≥32 chars)
- Remove old Clerk and Neon variables after cutover is confirmed

## Backup & Restore (Supabase)
Before production:
- Enable daily database backups
- Enable point-in-time recovery if available on plan
- Export schema migrations into repo
- Confirm object storage recovery expectations with plan docs

Restore drill steps:
1. Restore production-like data into staging or temp recovery project
2. Apply migrations
3. Confirm owner/admin login
4. Confirm client matter access
5. Confirm document metadata exists
6. Confirm test signed download works
7. Confirm audit logs survived restore
8. Record date, operator, source backup, target project, issues found

## Never Do This
- `vercel deploy --prod` directly
- `vercel promote` without approval
- Deploy backend/security work to production from dirty WIP worktree
- Use production Supabase data for staging testing
- Test contractor payments with live Stripe keys

## Incident Response (if access control or document exposure suspected)
1. Disable affected profiles
2. Revoke affected access grants
3. Rotate relevant keys
4. Disable/rotate signed URL creation if needed
5. Preserve audit logs
6. Notify counsel before client communications
7. Write a factual incident record

## Staging Latest Entry (2026-06-05)
- Staging preview deployed: `dpl_4d2CVJSmag8q6Z9PZcz5gFb4dnHU`
- Routes verified: `/`, `/prototype`, `/prototype2` → 200; `/office`, `/admin` → 307 to sign-in
- `npm run staging:check`: passed
- Stripe test-mode keys still missing (acceptable until payment work begins)
- Protected by Vercel Authentication — normal browser returns 401 without auth
