# Authentication and Access Review

Updated 2026-08-01 after the engagement-scoped authorization, staff MFA,
threaded correspondence, and secure attachment-history verification.

## Current model

- Email/password accounts are stored in the Neon `users` table.
- Passwords are hashed with Node `scrypt`; plaintext passwords are never stored.
- Sessions are opaque, random tokens stored as SHA-256 hashes in `auth_sessions`.
- The `jra_session` cookie is HttpOnly, Secure in production, SameSite=Lax, and expires after 12 hours.
- Role families are `super_admin`, `admin`, `contractor`, and `client`.
- Super Admin has fixed system authority. Admin and Contractor authority comes from a Super Admin-managed Permission Profile.
- Admin scope may be global or limited to assigned engagements. Contractor and Client scope is always limited to active Engagement Memberships.
- The standard Contractor profile may update the status of workflow requirements and tasks assigned to that same contractor. Contractors cannot create workflow records, edit task definitions, reassign work, cancel tasks, or waive requirements.
- Middleware only performs the fast unauthenticated redirect. Server handlers remain authoritative.
- Existing `clients.user_id` ownership is retained for compatibility, but `engagement_memberships` is the canonical engagement-access boundary.
- Engagement events and documents carry an explicit audience. Clients receive only published `client` resources. Contractors receive only `contractor` resources and published `client` resources.
- Correspondence replies inherit the parent thread audience. Clients and Contractors cannot reply across audience boundaries, and internal reply targets remain concealed from staff without `messages.internal_view`.
- Message attachment metadata, version history, and historical downloads require both `messages.view` and engagement scope. Internal attachment details additionally require `messages.internal_view`; storage pathnames are never returned.
- Invitations are one-time, hashed tokens stored in `auth_invitations` and expire after seven days.
- Password recovery uses single-use, hashed tokens that expire after 30 minutes. Successful recovery revokes every existing session and pending login challenge.
- Post-authentication navigation accepts only normalized same-origin application
  paths; unsafe redirect targets fall back to `/portal`.
- Browser-originated API mutations require a trusted server-configured origin.
  Stripe webhooks, authenticated cron requests, and the keyed seed route remain
  explicit server-to-server exceptions.
- Authentication, recovery, invitation, seed, and consultation write routes
  fail closed when distributed rate limiting is unavailable.
- Super Admin, Admin, and Contractor accounts must complete RFC 6238 authenticator verification before a full session is issued. The pre-authentication challenge expires after ten minutes.
- TOTP secrets use AES-256-GCM encryption with `MFA_ENCRYPTION_KEY`; one-use recovery codes are stored only as SHA-256 hashes.
- New account registration requires an invitation or a pre-provisioned passwordless account.
- Role, profile, membership, suspension, and invitation changes are written to `access_audit_events`.
- Administrative access, invitation, automation, and workspace-setting
  mutations commit their mandatory audit record in the same database
  transaction.
- Production application requests connect as `jra_app_runtime`, a non-owner
  role without schema DDL, role-administration, inheritance, or RLS-bypass
  authority. The owner credential is isolated to the reviewer-protected GitHub
  migration environment.

## Protected surfaces

`/portal/*`, `/api/clients`, `/api/properties`, `/api/matters`, `/api/vault/*`,
`/api/documents/pdf`, and `/api/admin/*` require a valid session. Each protected
operation requires a named capability. Assigned-scope requests must also pass an
active, unexpired Engagement Membership check. Unauthorized resource identifiers
return `404` to prevent engagement enumeration.

Workflow stage transitions evaluate every required item in every stage before
the requested target stage. A later recorded stage therefore cannot conceal
unresolved earlier work. Only Super Admin may override the gate, and the
override requires a reason and an audit event.

The Finance route has a server-side capability gate in addition to API
authorization. Users without `finance.view` are returned to the portal instead
of receiving a partially rendered finance workspace.

Only Super Admin can create Permission Profiles, configure Admin or Contractor
authority, suspend accounts, or assign and revoke Engagement Memberships.

## Required production configuration

- `DATABASE_URL`
- `RESEND_API_KEY` for consultation and invitation email
- `SITE_URL` as the private canonical application origin used for request
  validation and secure email links
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, or the Vercel
  Marketplace aliases `KV_REST_API_URL` and `KV_REST_API_TOKEN`, for mandatory
  distributed rate limiting on sensitive write routes
- `BLOB_READ_WRITE_TOKEN` for vault storage
- `SEED_KEY` and `SEED_PASSWORD` only when the controlled seed endpoint is needed
- `STAGING_PASSWORD` for the staging host gate
- `MFA_ENCRYPTION_KEY` as a base64-encoded 32-byte encryption key

## Verified disposable-database access matrix

GitHub Actions run
[`30328567640`](https://github.com/cantelearist/james-roman-advisory/actions/runs/30328567640)
executed the database-backed role, capability, and scope matrix against a
two-hour, schema-only Neon branch at commit
`0976a429937409057df1ae194ed7bee2644cc49d`.

The run verified every declared capability for Super Admin, global Admin,
assigned Admin, Contractor, and Client access, including active, absent,
revoked, and expired engagement memberships. The job completed successfully,
and its unconditional cleanup deleted the disposable branch. A separate Neon
Console check confirmed that no `test/jra-access-*` branch remained.

## Remaining review items

- Complete live authenticator enrollment for every production staff identity before broad client onboarding.
- Define a documented, identity-verified Super Admin procedure for lost-factor recovery.
- Reconcile existing client records whose former provider identifiers cannot be mapped automatically.
- Complete the staged
  [RLS readiness plan](./RLS_READINESS_PLAN.md) before granting direct database
  access to any secondary application or reporting tool. Production RLS is not
  enabled yet.
