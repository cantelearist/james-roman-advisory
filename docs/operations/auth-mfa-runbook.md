# Auth and MFA Runbook

## Scope

This runbook covers Supabase Auth configuration, MFA enrollment and enforcement, client login flows, and the support procedure when a user loses their second factor. It is an operational reference — not a code spec. Read this before touching anything in the Supabase Auth dashboard or the auth middleware.

---

## Authentication Stack

| Layer | Implementation |
|-------|---------------|
| Identity provider | Supabase Auth (built-in) |
| Session management | Supabase SSR — httpOnly cookie, not localStorage |
| Magic link email | Resend SMTP (see email-deliverability.md) |
| Second factor | TOTP (authenticator app) |
| SMS fallback | Not in v1 — see Known Gaps |
| Session enforcement | Server-side via `createSupabaseServerClient()` in every protected route |

---

## Supabase Auth Dashboard Settings

### Required Settings (do before first real client)

Navigate to: **Supabase Dashboard → Authentication → Providers**

```
Email provider:         Enabled
Magic link:             Enabled
Email + password:       Disabled (magic link only — no passwords to phish)
Phone / OTP:            Disabled (no SMS in v1)
OAuth (Google, etc.):   Disabled unless separately approved
```

Navigate to: **Authentication → Configuration → Auth**

```
Site URL:               https://jamesroman.la (production)
Redirect URLs allowed:  https://jamesroman.la/**
                        https://*.vercel.app/**  (staging)
JWT expiry:             3600 (1 hour)
Refresh token rotation: Enabled
Refresh token reuse:    Disabled
```

Navigate to: **Authentication → MFA**

```
TOTP enrollment:        Enabled
Enforce MFA for:        Do NOT set at the Supabase level yet
                        MFA enforcement is handled in application middleware
                        (setting it in Supabase locks out users before they can enroll)
```

### Why Application-Level MFA Enforcement

Supabase's built-in MFA enforcement blocks all API calls from sessions without a verified second factor. This creates a circular problem: users need an API call to enroll their TOTP, but the enforcement blocks them before they complete enrollment.

The correct pattern: Supabase allows enrollment calls unconditionally; the application middleware checks `session.user.factors` and redirects un-enrolled users to the MFA setup page before serving any office route.

---

## MFA Enrollment Flow

```
1. User receives magic link via email.
2. User clicks link → Supabase Auth exchanges token → session cookie set.
3. Application middleware checks session:
     - No factors enrolled → redirect to /office/setup/mfa
     - Factor enrolled, AAL < aal2 → redirect to /office/mfa/verify
     - Factor enrolled, AAL = aal2 → proceed to requested route
4. /office/setup/mfa page:
     a. Calls Supabase client: supabase.auth.mfa.enroll({ factorType: 'totp' })
     b. Supabase returns QR code URI and backup secret.
     c. User scans QR code with authenticator app (Authy, Google Authenticator, 1Password, etc.).
     d. User enters 6-digit code to confirm enrollment.
     e. Calls: supabase.auth.mfa.challengeAndVerify({ factorId, code })
     f. Session upgrades to AAL2.
     g. Redirect to /office.
5. All subsequent sessions require magic link + TOTP verification before AAL2 is reached.
```

---

## Session AAL Enforcement (Middleware Logic)

Every server route handler and middleware must check:

```
1. Session exists (user is logged in).
2. Session.aal === 'aal2' (TOTP was verified this session).
3. User has a profile in the correct tenant.
4. User role matches the route (client vs. team vs. admin).
```

If session exists but `aal < aal2`, the user completed magic link login but has not yet verified their TOTP. Redirect to `/office/mfa/verify` — do NOT serve any office content.

The AAL check must happen server-side. Client-side checks are not sufficient because they can be bypassed by a user with a tampered local state.

---

## Daily Login Flow (After Enrollment)

```
1. User enters email on /login.
2. Supabase sends magic link email via Resend.
3. User clicks link → session cookie set (AAL1).
4. Middleware detects AAL < aal2 → redirect to /office/mfa/verify.
5. User opens authenticator app, enters 6-digit code.
6. supabase.auth.mfa.challengeAndVerify() → session upgrades to AAL2.
7. Middleware passes → user reaches /office.
```

Session duration: 1 hour (JWT expiry). Refresh token extends without requiring MFA re-verification during the active browser session. Closing the browser and returning the next day requires magic link + TOTP again.

---

## Support: User Lost MFA Device

This is the most operationally sensitive scenario. There is no self-service recovery in v1.

### Procedure

```
Step 1: Identity verification
  - Contact must come from the user's registered email address.
  - Roman confirms user identity via a separate channel (phone call, known in-person, or prior relationship).
  - Never process MFA reset requests via email alone.

Step 2: Unenroll existing TOTP factor
  - In Supabase Dashboard → Authentication → Users → [user] → Factors.
  - Delete the enrolled TOTP factor.
  - This does NOT delete the user's account or data.

Step 3: Notify the user
  - Tell the user their authenticator has been removed.
  - They must log in and re-enroll before they can access the office.

Step 4: User re-enrolls
  - User logs in via magic link.
  - Middleware redirects them to /office/setup/mfa.
  - User scans new QR code, confirms with 6-digit code.
  - Session upgrades to AAL2.

Step 5: Log the event
  - Write a manual note in the internal audit log (matter notes or ops log):
    Date, user email, reason for reset, who authorized.
  - This is not automatic — it must be done manually until admin tooling is built.
```

### What NOT to Do

- Do not disable MFA globally to let one user through.
- Do not send the user's QR code or secret by email.
- Do not process the request without a separate identity verification step.
- Do not share Supabase dashboard access with clients.

---

## Support: User Not Receiving Magic Link

```
Step 1: Ask the user to check spam/junk.
Step 2: Confirm the email address is correct (typos are common).
Step 3: Check Supabase Dashboard → Authentication → Logs for a delivery attempt.
Step 4: Check Resend dashboard for delivery status and any bounce or spam signals.
Step 5: If consistently failing for a domain (e.g., iCloud), check email-deliverability.md
        for DMARC/DKIM troubleshooting steps.
Step 6: If all else fails, resend the magic link manually from the Supabase dashboard:
        Authentication → Users → [user] → Send magic link.
```

---

## Staging Configuration

The staging Supabase project should mirror production auth settings exactly, including MFA enforcement. Do not disable MFA in staging — it creates a false test environment.

For local development: use the Supabase local dev stack (`supabase start`). TOTP works locally; use any authenticator app. The QR code secret is readable from the Supabase local logs if you need to reset during development.

---

## Monitoring and Alerts

Auth failures that should trigger a monitoring event (via `captureAuthFailure` in `src/lib/monitoring.ts`):

| Event | Condition |
|-------|-----------|
| `auth.failure` | Session missing on a protected route |
| `auth.failure` | AAL check fails after session present |
| `auth.failure` | Profile not found for authenticated user |
| `auth.failure` | Role mismatch (client accessing team route) |

Do not log the session token, JWT, or magic link URL — these are scrubbed by `scrubPii` but defense in depth means not emitting them in the first place.

---

## Known Gaps Before Production

| Gap | Risk | Mitigation |
|-----|------|-----------|
| No SMS fallback | User with a lost device and no recovery path must call Roman | Acceptable for v1 client count; revisit at 20+ clients |
| No recovery codes | Same risk as above | Supabase does not generate these automatically; could be built as a v2 feature |
| Manual MFA reset | Requires Supabase dashboard access | Admin tooling (Ticket backlog) will add a UI for this |
| No session revocation UI | Roman cannot remotely kill a specific session | Supabase supports `signOut(scope: 'global')` — needs admin UI |
| Magic link expiry | Default is 24 hours; users may be confused if they use an expired link | Consider reducing to 1 hour; document in user-facing copy |

---

## Checklist: Before First Real Client

- [ ] Supabase email provider is set to magic link only — passwords disabled.
- [ ] Resend is configured as SMTP provider (see email-deliverability.md).
- [ ] TOTP enrollment is enabled in Supabase Dashboard.
- [ ] Application middleware enforces AAL2 on all `/office`, `/admin` routes.
- [ ] Enrollment flow (`/office/setup/mfa`) is tested end-to-end on staging.
- [ ] Daily login flow (magic link + TOTP) is tested on staging with real authenticator app.
- [ ] MFA reset procedure has been tested once manually.
- [ ] Monitoring events fire correctly for auth failures.
- [ ] JWT expiry and refresh token settings are confirmed in Supabase Dashboard.
- [ ] Redirect URL allowlist is correct for production domain.
