# Privacy Review Packet

## Purpose

This document is for Roman's review — and, before any real client data is stored, for a qualified privacy attorney. It inventories what data the platform collects, how it flows, where it is stored, what the legal basis is, and what obligations follow from that. Nothing here is a legal opinion. Several items below require a licensed attorney to confirm before going live with real clients.

**Review gate:** Do not store real client PII in production until this document is reviewed by counsel and all items marked [ATTORNEY REVIEW] are resolved.

---

## 1. Who This Applies To

The platform has three user categories:

| Category | Description |
|----------|-------------|
| **Clients** | Individuals or entities with active matters. They access `/office`. |
| **Team members** | Employees or contractors of James Roman Advisory. They access `/admin` and `/office`. |
| **Contractors** | Third-party contractors associated with a matter. They interact via Stripe Connect onboarding only — no direct platform login in v1. |

---

## 2. Data Inventory

### 2.1 Identity and Authentication Data

| Field | Source | Storage | Retention |
|-------|--------|---------|-----------|
| Email address | User-provided at invite | Supabase Auth + `profiles` table | See retention-review-packet.md |
| Full name | User-provided at onboarding | `profiles` table | See retention-review-packet.md |
| Magic link tokens | Supabase generated | Supabase Auth (transient) | Auto-expired per Supabase; ~24h default |
| TOTP factor enrollment | User device | Supabase Auth MFA record | Until unenrolled or account deleted |
| Session JWT | Supabase generated | httpOnly cookie (browser) | Expires per JWT expiry setting (~1h) |
| Refresh token | Supabase generated | httpOnly cookie (browser) | Rotated on use; revoked on signout |

**Note:** No passwords are stored. The platform uses magic link authentication only.

### 2.2 Matter and Document Data

| Field | Source | Storage | Notes |
|-------|--------|---------|-------|
| Matter name / description | Team-entered | Supabase `matters` table | May contain client PII if matter names are person-specific |
| Uploaded documents | Client or team uploads | Supabase Storage (private bucket) | Signed URL access only; quarantined pending virus scan |
| Document metadata | Derived from upload | `documents` table | File name, type, uploader, upload timestamp, scan status |
| Audit events | System-generated | `audit_events` table | Every significant action on a document or matter |

### 2.3 Payment Data

| Field | Source | Storage | Notes |
|-------|--------|---------|-------|
| Payment request details | Team-created | `payment_requests` table | Amount, description, contractor reference |
| Stripe session ID | Stripe API | `payment_requests.stripe_session_id` | No card or bank data stored on JRA infrastructure |
| Payment intent ID | Stripe webhook | `payment_requests.stripe_payment_intent_id` | No card or bank data |
| Webhook event payloads | Stripe | `payment_webhook_events` | May contain Stripe customer or account references |
| Contractor Stripe account ID | Stripe Connect onboarding | `contractors.stripe_account_id` | Stripe handles all financial identity; JRA stores only the reference |

**Critical:** Card numbers, bank account numbers, CVVs, and any other PCI-regulated data are never transmitted to or stored on JRA infrastructure. All financial data collection occurs on Stripe's infrastructure. JRA's PCI scope is limited to SAQ A (redirect model) — [ATTORNEY REVIEW: confirm SAQ A scope with payment counsel].

### 2.4 Monitoring and Operational Data

| Field | Source | Storage | Notes |
|-------|--------|---------|-------|
| Structured log events | Application (server) | Vercel log stream | PII is scrubbed before emission via `scrubPii()` |
| Error traces | Application (server) | Sentry (when DSN is set) | PII is scrubbed; Sentry is a data sub-processor |
| IP addresses | Vercel edge | Vercel infrastructure | Vercel log retention applies; not ingested into app DB |

---

## 3. Data Flow Diagram

```
[Client browser]
  |
  | magic link click → session cookie (httpOnly, Supabase)
  | document upload → signed URL → Supabase Storage (private bucket)
  | payment → Stripe Checkout (Stripe's infrastructure, not JRA's)
  |
[Next.js server (Vercel)]
  |
  | reads → Supabase (user-scoped, RLS enforced)
  | writes audit events → Supabase (service-role, narrow use)
  | emits scrubbed logs → Vercel log stream
  | (optionally) sends scrubbed errors → Sentry
  |
[Supabase]
  |
  | hosted on AWS (us-east-1 by default)
  | Auth database: Supabase-managed Postgres
  | Storage: Supabase-managed S3-compatible
  |
[Stripe]
  | Checkout Session, Payment Intents, Connect accounts
  | PCI-compliant; processes all card data
  | Stores contractor financial identity (Express accounts)
```

---

## 4. Legal Basis for Processing

[ATTORNEY REVIEW: Confirm legal basis analysis for each category. The analysis below is a starting framework, not legal advice.]

| Data Category | Proposed Basis | Notes |
|---------------|---------------|-------|
| Client identity and auth data | Contract performance | User has engaged JRA services; auth is necessary to perform the service |
| Matter and document data | Contract performance | Documents are the core deliverable of the service |
| Payment request data | Contract performance | Billing is a necessary incident of the service |
| Audit logs | Legitimate interest | Operational security and dispute resolution; no user consent required if proportionate |
| Monitoring / error logs | Legitimate interest | Infrastructure security and reliability; PII scrubbed |
| Contractor Stripe data | Contract performance (with contractor) | Necessary for contractor payment flow |

**California (CCPA/CPRA):** Clients who are California consumers have rights including access, deletion, and correction. The platform does not sell personal information. [ATTORNEY REVIEW: Confirm CCPA service-provider vs. business analysis.]

**Europe (GDPR):** If any client or team member is located in the EU/EEA, GDPR applies. [ATTORNEY REVIEW: If this is in scope, confirm Supabase DPA, Stripe DPA, Sentry DPA are in place and that a lawful transfer mechanism exists for EU personal data hosted on AWS us-east-1.]

---

## 5. Third-Party Sub-Processors

| Sub-Processor | Role | Data Shared | DPA in Place? |
|---------------|------|------------|---------------|
| Supabase | Database + Auth + Storage hosting | All user and document data | [VERIFY: Supabase DPA must be executed] |
| Vercel | Application hosting + CDN + logs | Request logs (no app-level PII post-scrub) | [VERIFY: Vercel DPA for business accounts] |
| Resend | Transactional email (magic links) | Email address, email body (magic link URL) | [VERIFY: Resend DPA] |
| Stripe | Payment processing | Payment request data, contractor financial identity | Stripe's standard DPA applies by default to Connect accounts |
| Sentry | Error monitoring (when activated) | Scrubbed error traces and stack traces | [VERIFY: Sentry DPA when DSN is activated] |

[ATTORNEY REVIEW: Confirm DPAs are signed before any real client data is stored. For CCPA compliance, confirm each sub-processor qualifies as a service provider under the applicable contractual terms.]

---

## 6. Data Subject Rights

These rights must be operationally supportable before real clients are onboarded.

| Right | Scope | Current State |
|-------|-------|---------------|
| Right to access | Client can request all data JRA holds about them | No self-service portal; manual response required via Roman |
| Right to correction | Client can request correction of inaccurate data | Manual via admin; no self-service |
| Right to deletion | Client can request deletion of their personal data | Manual via Supabase dashboard; no automated pipeline yet |
| Right to portability | Client can request their data in machine-readable format | Not implemented; would require a data export tool |
| Right to object | Client can object to processing on legitimate-interest basis | Manual process |

**Gap:** No data subject request (DSR) workflow exists in v1. Until automated tooling is built, requests must be handled manually by Roman within the applicable statutory response window (45 days for CCPA, 30 days for GDPR extendable to 90 days).

[ATTORNEY REVIEW: Confirm response time obligations for the jurisdictions where clients are located. Confirm whether a formal DSR intake process (email, form) is required.]

---

## 7. Data Breach Notification

[ATTORNEY REVIEW: Confirm breach notification obligations for California and any other applicable jurisdictions.]

Provisionally:

| Scenario | Obligation | Response Window |
|----------|-----------|----------------|
| Unauthorized access to client documents | Notify affected clients | 72 hours (GDPR); without unreasonable delay (CCPA) |
| Unauthorized access to auth credentials | Notify affected users; consider Supabase-level session revocation | Same |
| Stripe breach | Stripe is the controller for payment data; JRA may receive notification from Stripe | Follow Stripe's notification |
| Supabase breach | Supabase is a sub-processor; JRA remains controller and must notify clients | Without unreasonable delay |

---

## 8. Privacy Policy Requirements

A client-facing privacy policy must exist before any real client data is collected. Minimum required disclosures:

- Identity and contact details of the controller (James Roman / James Roman Advisory).
- Categories of personal data collected.
- Purposes and legal bases for processing.
- List of sub-processors (or categories thereof).
- Retention periods (see retention-review-packet.md).
- Data subject rights and how to exercise them.
- Right to lodge a complaint with a supervisory authority (if GDPR applies).
- Whether data is transferred internationally.
- Cookie / session disclosure.

[ATTORNEY REVIEW: Draft the privacy policy. Do not use a generic template without attorney review. The magic-link-only auth model, the document handling, and the Stripe Connect flow all require specific disclosures.]

---

## 9. Engagement Agreement Privacy Terms

The client engagement agreement should include:

- Description of data JRA will collect and store on the client's behalf.
- Acknowledgment that documents uploaded by the client will be stored on third-party infrastructure (Supabase / AWS).
- Description of payment processing via Stripe (if payments are enabled for that client).
- Data retention terms.
- Instructions for requesting access, correction, or deletion.

[ATTORNEY REVIEW: Add a privacy addendum to the engagement agreement template.]

---

## 10. Open Items Before Production Go-Live

| Item | Owner | Status |
|------|-------|--------|
| Supabase DPA executed | Roman | [ ] Not done |
| Vercel DPA confirmed (business account) | Roman | [ ] Not done |
| Resend DPA executed | Roman | [ ] Not done |
| Sentry DPA executed (before DSN is activated) | Roman | [ ] Not done |
| Privacy policy drafted and published | Attorney + Roman | [ ] Not done |
| Engagement agreement privacy addendum | Attorney | [ ] Not done |
| CCPA legal basis confirmed | Attorney | [ ] Not done |
| GDPR scope determined (any EU clients?) | Attorney | [ ] Not done |
| DSR response procedure documented | Roman | [ ] Not done |
| Breach notification procedure documented | Roman + Attorney | [ ] Not done |
| Retention periods confirmed (see retention-review-packet.md) | Attorney | [ ] Not done |
| PCI SAQ A scope confirmed | Payment attorney | [ ] Not done |
