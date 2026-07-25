# Source of Truth — James Roman Advisory

Updated 2026-07-24.

## Stack

| Layer | Provider |
|---|---|
| Auth | First-party email/password sessions |
| Database | Neon PostgreSQL |
| File storage | Vercel Blob |
| Email | Resend |
| Hosting | Vercel |

## Auth model

`src/lib/auth.ts` owns session creation, lookup, revocation, and role guards.
`src/lib/password.ts` owns scrypt password hashing and verification.
`src/proxy.ts` performs the unauthenticated fast-path redirect; protected API
handlers call `getAuthContext()` and enforce role and ownership checks themselves.

## Database tables

- `users` — account identity, role, and password hash
- `auth_sessions` — hashed opaque session tokens and expiry
- `auth_invitations` — hashed, expiring invitation tokens
- `consultations` — public intake records
- `clients` — client records linked by `user_id`
- `properties`, `matters`, `matter_events`, `documents`, `file_access_events`

## Required production variables

`DATABASE_URL`, `RESEND_API_KEY`, `BLOB_READ_WRITE_TOKEN`, and
`STAGING_PASSWORD`. `SEED_KEY` plus `SEED_PASSWORD` are only required for a
controlled seed operation. Upstash variables enable rate limiting when present.

No hosted authentication-provider variables belong in this project.
