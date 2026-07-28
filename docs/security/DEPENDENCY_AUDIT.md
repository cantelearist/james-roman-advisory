# Dependency Audit

Updated 2026-07-27 after the RLS readiness deployment.

## Current result

- Production dependency advisories: **0**
- Development dependency advisories: **9 high**
- Critical advisories: **0**

The production result is enforced in pull-request and `main` CI with
`npm run audit:production`.

## Remediation completed

- Removed the local `vercel` development dependency. The repository has no
  package script or application import that uses it; deployment operations use
  an explicitly invoked current CLI.
- Removed the Vercel CLI's transitive archive, routing, HTTP, and builder
  dependency graph from ordinary installs.
- Eliminated the critical `tar` advisory and reduced the full audit from 42
  findings to 9.
- Updated the MCP SDK and Hono Node adapter selected through `shadcn` to patched
  versions within the existing declared dependency range.
- Removed `DATABASE_URL` from the pull-request unit-test job. The unit suite
  passes without database credentials, so unreviewed test code has no reason to
  receive that secret.

## Remaining development-only findings

All nine remaining findings are the same ESLint toolchain constraint:

- ESLint 9 and plugins bundled by `eslint-config-next` depend on
  `minimatch` 3 and `brace-expansion` 1.
- npm reports the patched route as ESLint 10.
- A strict ESLint 10 resolution currently fails because
  `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, and
  `eslint-plugin-react` in `eslint-config-next` do not yet declare ESLint 10
  compatibility.

Do not use `npm audit fix --force`, downgrade `eslint-config-next`, or override
these transitive majors. Those paths either break the Next.js lint contract or
install an unsupported dependency graph.

The residual exposure is confined to local and CI lint tooling. It does not
ship in the production dependency tree. Re-test the ESLint 10 migration when
the Next.js lint plugin set declares compatible peers, then require:

1. strict peer resolution without `--force` or `--legacy-peer-deps`;
2. a clean full audit;
3. unchanged lint findings;
4. the full unit suite and production build.

## Verification commands

```bash
npm ci
npm run audit:production
npm audit
npm test
npm run lint
npm run build
```
