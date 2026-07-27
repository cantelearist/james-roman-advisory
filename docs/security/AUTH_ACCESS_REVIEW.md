# Authentication and Access Review

Updated 2026-07-26 after the engagement-scoped authorization migration.

## Current model

- Email/password accounts are stored in the Neon `users` table.
- Passwords are hashed with Node `scrypt`; plaintext passwords are never stored.
- Sessions are opaque, random tokens stored as SHA-256 hashes in `auth_sessions`.
- The `jra_session` cookie is HttpOnly, Secure in production, SameSite=Lax, and expires after 12 hours.
- Role families are `super_admin`, `admin`, `contractor`, and `client`.
- Super Admin has fixed system authority. Admin and Contractor authority comes from a Super Admin-managed Permission Profile.
- Admin scope may be global or limited to assigned engagements. Contractor and Client scope is always limited to active Engagement Memberships.
- Middleware only performs the fast unauthenticated redirect. Server handlers remain authoritative.
- Existing `clients.user_id` ownership is retained for compatibility, but `engagement_memberships` is the canonical engagement-access boundary.
- Engagement events and documents carry an explicit audience. Clients receive only published `client` resources. Contractors receive only `contractor` resources and published `client` resources.
- Invitations are one-time, hashed tokens stored in `auth_invitations` and expire after seven days.
- New account registration requires an invitation or a pre-provisioned passwordless account.
- Role, profile, membership, suspension, and invitation changes are written to `access_audit_events`.

## Protected surfaces

`/portal/*`, `/api/clients`, `/api/properties`, `/api/matters`, `/api/vault/*`,
`/api/documents/pdf`, and `/api/admin/*` require a valid session. Each protected
operation requires a named capability. Assigned-scope requests must also pass an
active, unexpired Engagement Membership check. Unauthorized resource identifiers
return `404` to prevent engagement enumeration.

Only Super Admin can create Permission Profiles, configure Admin or Contractor
authority, suspend accounts, or assign and revoke Engagement Memberships.

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
- Move the authorization policy into database row-level security before granting direct database access to any secondary application or reporting tool.
- Add integration coverage against a disposable Postgres branch for every role/capability/scope combination.
