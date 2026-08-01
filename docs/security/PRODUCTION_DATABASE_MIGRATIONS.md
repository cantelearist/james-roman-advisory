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

## Runtime credential cutover

The separate `Protected production runtime role` workflow uses the same
reviewer-protected environment to create the permanent `jra_app_runtime`
login. It requires a temporary `RUNTIME_DATABASE_PASSWORD` environment secret,
an exact `main` SHA, and a mode-specific confirmation phrase.

The workflow:

1. confirms all required schema versions are present;
2. creates a `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`,
   `NOREPLICATION`, `NOBYPASSRLS` login that inherits no other role;
3. grants schema usage, application-table DML, and required sequence access;
4. keeps `app_schema_versions` read-only;
5. proves the role owns no relations, cannot create or alter schema objects,
   cannot create roles, and has no truncate, references, or trigger grants;
6. confirms production RLS remains disabled during this credential-only stage;
7. removes the role automatically if provisioning or validation fails.

Only the SHA-256 fingerprint of the constructed runtime URL may appear in
logs. After the same fingerprinted URL is installed as Vercel's
production-only `DATABASE_URL`, delete `RUNTIME_DATABASE_PASSWORD` from the
GitHub environment.

### Production cutover record — 2026-08-01

The runtime credential cutover completed for exact `main` commit
`ae68075bfe136b0ae28237f6fe17f7d5091fc25e`:

- protected preflight run
  [`30689119415`](https://github.com/cantelearist/james-roman-advisory/actions/runs/30689119415)
  confirmed all six required schema versions and target-role absence;
- protected provisioning run
  [`30689293392`](https://github.com/cantelearist/james-roman-advisory/actions/runs/30689293392)
  validated `jra_app_runtime` against 38 application relations and proved the
  configured DDL and role-administration denials;
- both runs reported the same runtime URL fingerprint,
  `f574628752307bef6e31ff91bbd64aeab2bed07f3725300d4fb563c47ae1541e`;
- that fingerprinted value replaced Vercel Production `DATABASE_URL` as a
  Sensitive value;
- replacement deployment `dpl_GUibxupTc3sujzEDSJ211sCaWXkz` passed isolated
  application DML, provider-accepted email dispatch, public-route,
  protected-route, and HTTP-500-log checks before and after both production
  domains were assigned;
  and
- `RUNTIME_DATABASE_PASSWORD` was deleted after verification. The owner URL
  remains only in the protected migration environment.

This record contains identifiers and fingerprints only. It must never contain
the runtime password or either database connection URL.

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

The migration workflow installs only reviewed schema and ledger entries. The
separate runtime-role workflow and the recorded 2026-08-01 deployment changed
the Vercel runtime credential but did not enable RLS. Ordinary request paths
use the read-only required-version assertion; only the protected migration
runner may invoke the DDL compatibility facades.

If application behavior changes unexpectedly:

1. restore a known-good application deployment with a still-valid database
   credential and both production aliases;
2. leave the migration ledger intact;
3. inspect the exact migration and affected table before another deployment.

Deleting ledger rows is not a rollback. It only causes historical migration
code to run again.
