# Source of Truth — James Roman Advisory

Updated 2026-07-26.

## Stack

| Layer | Provider |
|---|---|
| Auth | First-party email/password sessions |
| Database | Neon PostgreSQL |
| File storage | Vercel Blob |
| Email | Resend |
| Hosting | Vercel |

## Auth model

`src/lib/auth.ts` owns session creation, lookup, revocation, and account-status checks.
`src/lib/access-control.ts` owns capability, access-scope, engagement-membership,
and resource-audience decisions.
`src/lib/password.ts` owns scrypt password hashing and verification.
`src/proxy.ts` performs the unauthenticated fast-path redirect; protected API
handlers call `getAuthContext()` and enforce capability and scope checks themselves.

## Database tables

- `users` — account identity, role family, status, and password hash
- `auth_sessions` — hashed opaque session tokens and expiry
- `auth_invitations` — hashed invitations with role, profile, scope, and engagement
- `permission_profiles` — reusable Admin and Contractor capabilities
- `user_permission_assignments` — profile and global/assigned scope
- `engagement_memberships` — revocable, optionally expiring engagement access
- `access_audit_events` — append-only access-administration history
- `consultations` — public intake records
- `clients` — client records linked by `user_id`
- `properties`, `matters`, `matter_events`, `documents`, `file_access_events`

## Required production variables

`DATABASE_URL`, `RESEND_API_KEY`, `BLOB_READ_WRITE_TOKEN`, and
`STAGING_PASSWORD`. `SEED_KEY` plus `SEED_PASSWORD` are only required for a
controlled seed operation. Upstash variables enable rate limiting when present.

No hosted authentication-provider variables belong in this project.
