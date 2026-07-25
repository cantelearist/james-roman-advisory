# Authentication and Access Review

Updated 2026-07-24 after the first-party authentication migration.

## Current model

- Email/password accounts are stored in the Neon `users` table.
- Passwords are hashed with Node `scrypt`; plaintext passwords are never stored.
- Sessions are opaque, random tokens stored as SHA-256 hashes in `auth_sessions`.
- The `jra_session` cookie is HttpOnly, Secure in production, SameSite=Lax, and expires after 12 hours.
- Roles are `admin`, `advisor`, or `client` and are checked server-side for every protected API operation.
- Middleware only performs the fast unauthenticated redirect. Server handlers remain authoritative.
- Client records are scoped by `clients.user_id`; staff roles may access the staff-wide views.
- Invitations are one-time, hashed tokens stored in `auth_invitations` and expire after seven days.

## Protected surfaces

`/portal/*`, `/api/clients`, `/api/properties`, `/api/matters`, `/api/vault/*`,
`/api/documents/pdf`, and `/api/admin/invite` require a valid session. Staff-only
operations require `admin` or `advisor`; administrator operations require `admin`.

## Required production configuration

- `DATABASE_URL`
- `RESEND_API_KEY` for consultation and invitation email
- `BLOB_READ_WRITE_TOKEN` for vault storage
- `SEED_KEY` and `SEED_PASSWORD` only when the controlled seed endpoint is needed
- `STAGING_PASSWORD` for the staging host gate

## Remaining review items

- Add and verify a production password-reset flow before broad client onboarding.
- Add a second factor to the first-party session system before granting high-risk staff access.
- Configure Upstash variables to enable rate limiting; the code currently fails open when absent.
- Reconcile existing client records whose former provider identifiers cannot be mapped automatically.
