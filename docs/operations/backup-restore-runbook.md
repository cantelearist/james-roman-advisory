# Backup And Restore Runbook

## Goal

Backups are not real until restore has been tested. The production launch standard is daily backups plus a documented restore drill before client files are stored.

## Supabase

Minimum production posture:

- Enable daily database backups.
- Enable point-in-time recovery if available on the selected plan.
- Export schema migrations into the repository.
- Keep storage bucket private.
- Confirm object storage recovery expectations with Supabase plan documentation.

Restore drill:

1. Restore production-like data into staging or a temporary recovery project.
2. Apply migrations.
3. Confirm owner/admin login.
4. Confirm client matter access.
5. Confirm document metadata exists.
6. Confirm a test signed download works.
7. Confirm audit logs survived the restore.
8. Record date, operator, source backup, target project, and issues found.

## Vercel

Minimum production posture:

- Keep production and preview deployments enabled.
- Mark secret environment variables as sensitive.
- Use preview deployments for pull requests.
- Keep a rollback candidate available after every release.
- Production deployment requires Roman's explicit approval in the current thread.
- Use `npm run staging:deploy` for staging only.
- Use `npm run staging:check` before any staging deployment that exercises secure office, CRM, document exchange, or payments.

Rollback drill:

1. Identify the last known-good deployment.
2. Promote or roll back through Vercel.
3. Confirm `/`, `/office`, and `/admin` route behavior.
4. Confirm no migration rollback is required.

Current approved rollback target:

```bash
npx vercel rollback https://jr-advisory-n0pqlh56f-roman-2757s-projects.vercel.app --yes --timeout 3m
```

## Repository

Keep these artifacts versioned:

- Supabase migrations.
- Security model.
- Production readiness checklist.
- Backup restore notes.
- Incident response notes.

Do not version:

- `.env` files.
- Service role keys.
- Client documents.
- Database dumps with real PII.

## Incident Notes

If access control or document exposure is suspected:

1. Disable affected profiles.
2. Revoke affected access grants.
3. Rotate relevant keys.
4. Disable or rotate signed URL creation if needed.
5. Preserve audit logs.
6. Notify counsel before client communications.
7. Write a factual incident record.
