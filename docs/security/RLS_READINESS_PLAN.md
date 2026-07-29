# Row-Level Security Readiness Plan

Status: readiness controls only. Production RLS is not enabled.

## Executive decision

Do not add production policies to the current database connection.

The production application role owns all 38 public tables and has
`BYPASSRLS`. The application also uses Neon HTTP queries that open independent
database operations for authorization, business writes, audit events,
notifications, and automations. Enabling policies now would either have no
effect or break requests whose identity and engagement scope cannot remain
bound to one transaction.

The safe sequence is to separate schema ownership from runtime access, make
request context transactional, prove default-deny behavior on disposable
branches, and then cut over one policy cohort at a time.

## Verified starting point

Read-only production inspection on 2026-07-27 found:

- 38 application-owned tables in the `public` schema.
- 0 tables with RLS enabled.
- The current application role owns all 38 tables.
- The current application role is not a PostgreSQL superuser, but has
  `BYPASSRLS` through its Neon administrative membership.
- `getDb()` uses the Neon HTTP query function. Its transaction helper supports
  non-interactive query batches, not a request-scoped interactive session.
- Authorization checks and protected queries frequently use separate
  `getDb()` calls.
- audit, matter-event, file-access, notification, and automation helpers can
  open additional connections; several call sites are intentionally
  fire-and-forget.
- runtime table bootstrap still performs `CREATE TABLE` and `ALTER TABLE`.

These are deployment blockers, not reasons to weaken the policy.

## Complete table classification

The machine-enforced inventory lives in
`src/lib/rls-readiness.ts`. CI fails when `src/lib/db.ts` declares a table that
is not classified exactly once.

| Policy family | Count | Tables |
| --- | ---: | --- |
| Migration only | 1 | `app_schema_versions` |
| Identity private | 8 | `users`, auth session/challenge/MFA/recovery tables, `password_reset_tokens`, `saved_views`, `portal_notifications` |
| Public intake | 1 | `consultations` |
| Client rooted | 2 | `clients`, `properties` |
| Matter rooted | 1 | `matters` |
| Matter child | 11 | events, workflow items, tasks, messages, receipts, document versions, contracts, invoices, line items, payments, change orders |
| Matter or client child | 1 | `documents` |
| Access control | 4 | invitations, permission profiles, assignments, memberships |
| Append-only audit | 2 | access audits, file-access events |
| Global configuration | 4 | portal settings, workflow templates/items, automations |
| System delivery | 2 | notification deliveries, automation runs |
| Integration internal | 1 | Stripe webhook events |

The table constant is authoritative when this summary and code disagree.

## Staged implementation

### Stage 0 — readiness controls

Included in this change:

- explicit classification for all application tables;
- a source-level invariant that rejects unclassified tables;
- a disposable-branch inventory check against the real schema;
- a temporary `NOBYPASSRLS` role and fixture policy proving default-deny,
  transaction-local scope isolation, allowed in-scope writes, and rejected
  cross-scope writes;
- unconditional fixture and Neon branch cleanup.

This stage changes no production query or policy.

### Stage 1 — remove runtime ownership work

Stage 1A established the additive migration compatibility layer:

- all 37 domain tables are assigned exactly once to six ordered migration
  versions (the migration ledger is the 38th table);
- the disposable database workflow applies those versions through an explicit,
  branch-attested migration command before any integration test;
- integration tests only assert the required versions and no longer bootstrap
  the application schema themselves;
- a read-only assertion produces a clear missing-version error for the later
  runtime cutover.

Stage 1B migration and runtime-cutover status:

- the protected GitHub environment requires reviewer approval, permits only
  `main`, disables administrator bypass, and contains the dedicated owner
  migration credential and attested Neon hostname;
- production was migrated at
  `239ebffad6a776c7dfed308bec2ace4a1afca84a` on 2026-07-28;
- an independent post-apply preflight reported all six required versions and
  no pending migration;
- ordinary request paths now call the cached, read-only required-version
  assertion instead of any schema ensure facade;
- a source-level invariant rejects future request code that imports or calls
  the DDL compatibility facades;
- the DDL implementations remain available only to the protected migration
  runner.

The final Stage 1 credential boundary is still pending:

1. create or identify a least-privilege runtime role that cannot `CREATE`,
   `ALTER`, manage roles, own application tables, or bypass RLS;
2. verify the complete application access matrix with that credential on a
   disposable branch;
3. replace the owner-scoped Vercel runtime URL with the verified runtime URL;
4. prove the live runtime credential cannot perform DDL;
5. retain the owner URL only in the protected GitHub migration environment.

Only after those checks should Stage 1 be marked complete. Production RLS must
remain disabled throughout this stage.

Rollback for the request-time cutover: redeploy the previous application
version. The migration ledger remains intact. No RLS policy or runtime
credential cutover occurs in this release.

### Stage 2 — transactional request context

1. Introduce a request-scoped `Pool` or `Client` path for protected database
   work.
2. Resolve the authenticated session through a narrowly privileged bootstrap
   path.
3. Start a transaction and set identity, role, access scope, and resource scope
   with transaction-local settings.
4. Run authorization, the protected query, mandatory audit writes, events, and
   synchronous notification records through the same transaction client.
5. Pass the transaction client into helpers. No protected helper may call
   `getDb()` independently or run fire-and-forget.
6. Commit or roll back, then close the client within the request.
7. Add tests proving context disappears after commit, rollback, thrown errors,
   and pooled connection reuse.

Missing or malformed context must resolve to no rows. A custom setting is
trusted only because the credential remains server-side; anyone holding the
runtime credential could set it themselves.

Rollback: retain the existing HTTP query path behind a short-lived deployment
switch until the transaction path passes disposable and production smoke
checks.

### Stage 3 — runtime role and policy cohorts

Create the runtime login with SQL as a non-owner:

- `NOSUPERUSER`
- `NOCREATEDB`
- `NOCREATEROLE`
- `NOINHERIT`
- `NOREPLICATION`
- `NOBYPASSRLS`

Do not create the role through a path that grants Neon administrative
membership. Grant only schema usage, sequence access where required, and
table-level operations the application actually performs.

Install policies in reversible cohorts:

1. Core scope graph: clients, properties, matters, memberships.
2. Matter content: documents, events, workflow, tasks, messages, contracts,
   invoices, payments, and change orders.
3. Identity-private data: users, sessions, MFA/recovery, saved views, and user
   notifications.
4. Administrative, audit, automation, delivery, intake, and integration
   tables using separate capabilities or service roles.

Each cohort must pass:

- no context, wrong user, wrong matter, revoked membership, and expired
  membership tests;
- global Admin, assigned Admin, Contractor, Client, and system-actor tests;
- select, insert, update, and delete checks;
- nested-parent and nullable-parent checks;
- query-plan and latency review.

Any `SECURITY DEFINER` scope helper must have a fixed `search_path`, minimal
execute grants, no dynamic SQL, and an owner that the runtime role cannot
assume. Policy recursion must be tested explicitly.

### Stage 4 — production cutover

1. Install policies and grants while production still uses the owner role.
2. Verify the policy catalog and grants with read-only assertions.
3. Place the non-owner runtime URL in Vercel without exposing it to previews
   that are not isolated.
4. Deploy, re-alias both `jamesroman.la` and `www.jamesroman.la`, and run the
   complete route, role, and data-isolation smoke suite.
5. Monitor authorization denials, database errors, latency, audit continuity,
   webhook idempotency, and notification delivery.
6. Rotate the former application owner credential and retain it only in the
   protected migration surface.

Emergency rollback:

1. Restore the owner-backed deployment to recover service.
2. Re-alias both production domains and verify homepage plus protected-route
   signatures.
3. Disable only the policy cohort that caused the failure after service is
   restored.
4. Rotate the failed runtime credential before another cutover.

The owner rollback restores availability but temporarily removes the
database-enforced boundary. Treat it as an incident state.

## Secondary database access

Never give a reporting tool or secondary application the application runtime
credential. Use a separate `NOBYPASSRLS` read-only role with approved views or
purpose-built functions. If the client is untrusted or direct-to-database,
server-set custom settings are insufficient; use independently verifiable
identity claims and a design reviewed for token replay, claim scope, and
revocation.

## Self-audit gates

The production cutover is blocked until all answers are yes:

- Does the runtime role lack ownership, administrative membership, and
  `BYPASSRLS`?
- Is schema DDL absent from request handling?
- Does every protected query share one transaction with its authorization and
  mandatory audit writes?
- Are all missing-context paths default-deny?
- Can pooled connections prove that transaction-local context never leaks?
- Are webhook, cron, seed, automation, and notification actors represented by
  narrow service capabilities rather than a fabricated user?
- Are nested and nullable relationships covered without policy recursion?
- Are invitation, password-reset, MFA, session, audit, and idempotency records
  unreadable to ordinary users?
- Does every new table fail CI until classified and tested?
- Is the owner credential absent from runtime and secondary tools?
- Has the exact rollback deployment been rehearsed on a disposable branch?

## References

- [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Neon row-level security overview](https://neon.com/docs/guides/row-level-security)
- [Neon serverless driver](https://github.com/neondatabase/serverless)
- [Neon PostgreSQL compatibility](https://neon.com/docs/reference/compatibility)
