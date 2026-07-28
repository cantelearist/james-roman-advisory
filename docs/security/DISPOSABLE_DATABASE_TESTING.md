# Disposable Database Testing

Mutation and database-backed authorization tests must never target a Vercel
preview or any database shared with production.

## Confirmed unsafe default

As of 2026-07-27, Vercel production and ordinary preview deployments resolve to
the same `DATABASE_URL`. Branch-specific overrides exist only for named legacy
branches. A Vercel preview hostname is therefore not evidence of database
isolation.

## Required boundary

The supported integration workflow:

1. Creates a Neon branch whose name starts with `test/`.
2. Uses a schema-only branch so production client data is not copied.
3. Sets an expiry no more than 24 hours in the future.
4. Passes the branch ID, endpoint host, branch type, and expiry to the test
   process.
5. Runs the role, capability, and scope matrix against that branch.
6. Confirms every public application table has an explicit RLS classification.
7. Creates a temporary unprivileged SQL role and fixture policy to prove that
   missing scope defaults to no rows, transaction-local scope does not leak,
   and cross-scope writes are rejected.
8. Deletes the fixture role and table, then deletes the branch even when tests
   fail. Neon expiry remains a second cleanup
   mechanism.

The runtime guard rejects missing attestations, production execution, ordinary
data-bearing branches, endpoint mismatches, expired or long-lived branches, and
database URLs that match a protected URL.

Mutating Playwright tests have an additional restriction: their application
target must be loopback (`localhost`, `127.0.0.1`, or `::1`). Remote previews
are forbidden even when `ALLOW_MUTATING_E2E=true`.

## GitHub configuration

The manual workflow
`.github/workflows/disposable-database-integration.yml` requires:

- repository secret `NEON_API_KEY`
- repository variable `NEON_PROJECT_ID`

Use the Neon GitHub integration or a dedicated Neon API key. Do not expose the
API key to application or test steps; only the official create/delete branch
actions receive it.

Run **Disposable database access integration** from GitHub Actions and select
the Git ref to test. The workflow is manual by design so unreviewed pull-request
code cannot automatically receive database credentials.

The RLS fixture is intentionally isolated from application tables. Passing this
suite proves the required Postgres mechanics; it does not mean production RLS
is enabled.
