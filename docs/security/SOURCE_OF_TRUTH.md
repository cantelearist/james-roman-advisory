# Source of Truth — James Roman Advisory

Updated 2026-08-01.

## Stack

| Layer | Provider |
|---|---|
| Auth | First-party email/password sessions |
| Database | Neon PostgreSQL |
| File storage | Private Vercel Blob through authenticated application proxies |
| Email | Resend |
| Hosting | Vercel |

## Auth model

`src/lib/auth.ts` owns session creation, lookup, revocation, and account-status checks.
`src/lib/access-control.ts` owns capability, access-scope, engagement-membership,
and resource-audience decisions.
`src/lib/password.ts` owns scrypt password hashing and verification.
`src/lib/mfa.ts` owns RFC 6238 verification, factor-secret encryption, replay
prevention, and recovery-code normalization.
`src/proxy.ts` performs the unauthenticated fast-path redirect; protected API
handlers call `getAuthContext()` and enforce capability and scope checks themselves.

## Database tables

- `users` — account identity, role family, status, and password hash
- `auth_sessions` — hashed opaque session tokens and expiry
- `auth_invitations` — hashed invitations with role, profile, scope, and engagement
- `auth_login_challenges` — short-lived pre-session staff MFA challenges
- `auth_mfa_methods`, `auth_mfa_recovery_codes` — encrypted factors and hashed one-use recovery codes
- `password_reset_tokens` — hashed, single-use password recovery
- `permission_profiles` — reusable Admin and Contractor capabilities
- `user_permission_assignments` — profile and global/assigned scope
- `engagement_memberships` — revocable, optionally expiring engagement access
- `access_audit_events` — append-only access-administration history
- `consultations` — public intake records
- `clients` — client records linked by `user_id`
- `properties`, `matters`, `matter_events`, `documents`, `file_access_events`
- `engagement_messages` — audience-scoped Engagement File correspondence
- `engagement_workflow_items`, `engagement_tasks` — persisted requirements and assigned work; contractor status updates are limited to the same contractor's assignments
- `notification_deliveries` — email delivery audit records
- `engagement_contracts`, `change_orders` — immutable commercial source records and amendments
- `invoices`, `invoice_line_items`, `payments` — billing and provider-confirmed settlements
- `stripe_webhook_events` — idempotent Stripe event processing

## Required production variables

`DATABASE_URL`, `RESEND_API_KEY`, `BLOB_READ_WRITE_TOKEN`, and
`STAGING_PASSWORD`, plus `MFA_ENCRYPTION_KEY`. Stripe billing additionally
requires `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. `SEED_KEY` plus `SEED_PASSWORD` are only required for a
controlled seed operation. Distributed rate limiting requires either
`UPSTASH_REDIS_REST_URL` plus `UPSTASH_REDIS_REST_TOKEN`, or the Vercel
Marketplace aliases `KV_REST_API_URL` plus `KV_REST_API_TOKEN`.

No hosted authentication-provider variables belong in this project.

## Workflow authority

`src/lib/workflow-authority.ts` owns the role-specific workflow mutation rules.
Admin and Super Admin may define and edit workflow records when their profile
and engagement scope permit it. Contractors may update only the status of work
assigned to their own user ID. Clients cannot mutate workflow records.

Engagement stage transitions check all required workflow items before the
target stage, not only the engagement's currently recorded stage. The UI also
surfaces historical inconsistencies, but the API is the authoritative gate.
