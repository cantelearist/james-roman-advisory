# Agent 3: Auth + MFA

## Mission

Build the Supabase Auth foundation for James Roman Advisory.

No UI redesign. No CRM feature work.

## Scope

Implement:

- Supabase Auth invite-only flow
- `/office` route protection
- `/admin` route protection
- internal MFA requirement
- disabled-profile lockout
- no fail-open behavior

## Requirements

- Public signup must not be used.
- `/office`, `/admin`, and `/portal` must require authenticated Supabase users.
- `/admin` must require internal team role: `owner`, `admin`, or `advisor`.
- `/office` must allow client users only when active access grants exist.
- Missing Supabase config must fail closed with a safe error, not expose protected routes.
- Disabled profiles must be treated as unauthenticated.
- Internal users must satisfy MFA before accessing `/admin`.
- Clients may have optional MFA by default, with step-up MFA support for sensitive matters.
- Redirect handling must prevent open redirects.
- Auth checks must be compatible with the current Next.js version. Read `node_modules/next/dist/docs/` before modifying route protection.

## Files To Inspect First

- `src/proxy.ts`
- `src/lib/crm/auth.ts`
- `src/lib/supabase/env.ts`
- `src/lib/safe-redirect.ts`
- Supabase migration files
- `docs/operations/security-model.md`
- `docs/operations/production-readiness.md`

## Tests Required

Add tests for:

- missing Supabase config fails closed.
- unauthenticated user cannot access `/office`.
- unauthenticated user cannot access `/admin`.
- client cannot access `/admin`.
- disabled profile cannot access protected routes.
- internal user without required MFA cannot access `/admin`.
- valid internal user with MFA can access `/admin`.
- valid client with grant can access `/office`.
- redirect target cannot be external.

## Verification

Run:

```bash
npm run build
npm run test
```

Do not deploy production. Work only in local/staging.

