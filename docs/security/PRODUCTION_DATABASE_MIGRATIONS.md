# Protected Production Database Migrations

Status: active, protected, and manually dispatched. Production reports all six
required migration versions. No migration runs automatically.

The initial production apply completed on 2026-07-28 at
`239ebffad6a776c7dfed308bec2ace4a1afca84a`. An independent post-apply
preflight reported `6/6` required versions and no pending migration.

## Security boundary

The only supported production migration surface is the manually dispatched
`Protected production database migration` GitHub Actions workflow.

The `production-database-migrations` GitHub environment is configured with:

- required reviewer approval;
- deployment branches restricted to `main`;
- environment secret `MIGRATION_DATABASE_URL`, containing the owner-only Neon
  connection URL;
- environment variable `MIGRATION_DATABASE_HOST`, containing only the exact
  hostname from that URL.

Do not treat GitHub's `Protected branches only` setting as a `main` restriction
when the repository has no branch protection rule. In that state GitHub reports
that every branch may deploy. Use an exact selected-branch rule for `main`, or
protect only `main` before selecting `Protected branches only`, and verify the
effective policy in the environment summary.

The migration URL must not be added to repository secrets, pull-request jobs,
Vercel previews, application runtime variables, local committed files, or
secondary tools. `NEON_API_KEY` is not a substitute for the migration URL and
is not used by the application.

## Required sequence

1. Select `main` in the workflow dispatcher.
2. Run `preflight` with the exact current 40-character `main` SHA and the
   confirmation phrase `inspect james-roman-advisory production`.
3. Review the reported pending versions. Preflight performs no schema DDL.
4. If the pending set is expected, run `apply` against the same `main` SHA with
   the phrase `migrate james-roman-advisory production`.
5. Confirm all six required versions are present.
6. For a migration required by a new application release, deploy application
   code only after the apply output confirms the complete required ledger.

The runner rejects non-manual events, non-main workflow sources, other
repositories, SHA drift, missing approval flags, a mismatched Neon hostname,
the ordinary `DATABASE_URL`, and incorrect confirmation phrases.

## Rollback

This workflow installs only reviewed schema and ledger entries. It does not
enable RLS or change the Vercel runtime credential. Ordinary request paths use
the read-only required-version assertion; only the protected migration runner
may invoke the DDL compatibility facades.

If application behavior changes unexpectedly:

1. restore the previous application deployment and both production aliases;
2. leave the migration ledger intact;
3. inspect the exact migration and affected table before another deployment.

Deleting ledger rows is not a rollback. It only causes historical migration
code to run again.
