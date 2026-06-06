# Data Retention Review Packet

## Purpose

This document defines proposed retention periods for every category of data the platform stores, the rationale for each period, and the open legal questions that require attorney confirmation before these periods are enforced. Nothing here is a legal opinion.

**Review gate:** Retention periods must be confirmed by counsel and incorporated into the privacy policy and engagement agreement before real clients are onboarded.

---

## Retention Philosophy

Retain data only as long as there is a documented purpose for keeping it. When the purpose ends, delete. This is not just a legal position — it reduces the blast radius of a security incident and limits JRA's discovery exposure in future disputes.

The platform is not an archive service. Clients have their own file systems. The office is a working environment, not permanent storage.

---

## Proposed Retention Schedule

### User Identity and Authentication Data

| Data Type | Proposed Retention | Rationale |
|-----------|-------------------|-----------|
| Email address (Supabase Auth) | Duration of active matter + 3 years post-closure | Must be contactable for matter-related questions; 3 years covers typical dispute limitation period |
| Profile name | Same as above | |
| MFA factor enrollment | Until account deleted or user unenrolls | Functional necessity; no separate retention needed |
| Session tokens / refresh tokens | Until expiry (1h JWT) or signout | Functional only; no operational value after expiry |
| Magic link tokens | 24 hours (Supabase default) | Functional only; shorter is better |
| Audit log entries for auth events | 7 years | Potential dispute or regulatory relevance |

### Matter Data

| Data Type | Proposed Retention | Rationale |
|-----------|-------------------|-----------|
| Matter records | Duration of matter + 7 years post-closure | California statute of limitations for written contracts is 4 years; professional advisory relationships may have longer exposure; 7 years is a conservative baseline |
| Matter notes / memos | Same as above | |
| Access grants (who had access to which matter) | 7 years post-grant expiration | Dispute and audit trail |

[ATTORNEY REVIEW: Confirm whether the applicable statute of limitations is 4 years (written contract, CCP §337) or longer for the categories of advisory services JRA provides. If any matters involve federally regulated activity, federal retention requirements may control.]

### Documents

| Data Type | Proposed Retention | Rationale |
|-----------|-------------------|-----------|
| Uploaded documents (active matter) | Duration of matter | Functional necessity |
| Uploaded documents (post-matter-closure) | 7 years post-closure | Same rationale as matter records |
| Document metadata (name, uploader, timestamps) | 7 years post-closure | Audit trail |
| Virus scan results / scan_status | Retain with document record | Operational audit |
| Deleted documents | Hard delete from storage; retain metadata row with `deleted_at` | Storage cost and privacy reduction; metadata retained for audit |

[ATTORNEY REVIEW: Confirm whether any documents uploaded by clients may be subject to client-side retention obligations (e.g., if a client is a regulated entity). In that case, JRA must not delete documents that the client may be legally required to maintain — consider a client-directed deletion policy.]

### Audit Events

| Data Type | Proposed Retention | Rationale |
|-----------|-------------------|-----------|
| Audit event log (all categories) | 7 years | Dispute resolution, regulatory review, professional liability |
| Payment audit events | 7 years | IRS / state tax record requirements; Stripe disputes |

Audit events are append-only and should never be soft-deleted. Hard deletion of audit events is a significant risk — it destroys the ability to reconstruct what happened. [ATTORNEY REVIEW: Confirm that 7 years covers all applicable retention obligations for the types of advisory services and payment transactions JRA handles.]

### Payment Data

| Data Type | Proposed Retention | Rationale |
|-----------|-------------------|-----------|
| Payment request records | 7 years | Tax records (IRS requires 3–7 years; 7 is conservative) |
| Payment events log | 7 years | Dispute resolution |
| Webhook event payloads | 3 years | Operational debugging; lower dispute relevance after first year |
| Stripe session / payment intent IDs | Retain with payment request | Necessary for dispute lookup |

[ATTORNEY REVIEW: Confirm whether the JRA business entity's tax retention obligations require 7 years or a different period. Confirm whether contractor payments create 1099 reporting obligations that impose additional record-keeping requirements.]

### Contractor Data

| Data Type | Proposed Retention | Rationale |
|-----------|-------------------|-----------|
| Contractor records | 7 years post-last-payment | Tax reporting (1099), dispute resolution |
| Stripe account ID reference | 7 years post-last-payment | Dispute lookup |
| Onboarding status history | 7 years | Audit trail |

### Monitoring and Operational Data

| Data Type | Proposed Retention | Rationale |
|-----------|-------------------|-----------|
| Vercel log stream | 30 days (Vercel default) | Short; operational debugging only; PII scrubbed before emission |
| Sentry error events | 90 days (Sentry default) | Debugging; no long-term value; PII scrubbed before emission |
| Application-level monitoring events | Not persisted to DB | Emitted to Vercel log stream only; governed by Vercel retention |

---

## Deletion Triggers

When should data be deleted? Proposed triggers:

| Event | Data Affected | Action |
|-------|--------------|--------|
| Client requests deletion (DSR) | Profile, documents, matter access grants | Manual process; attorney review required for each request |
| Matter closure | Documents (if retention period starts) | No immediate deletion; retention period clock starts |
| 7 years post-matter-closure | All matter data, documents, payment records | Scheduled deletion (not yet automated) |
| Account deactivation | Session tokens, MFA factors | Immediate; Supabase handles |
| Employee/team member offboarding | Profile, access grants | Immediate deactivation; 7-year audit record retained |

[ATTORNEY REVIEW: Confirm whether any regulatory obligations prevent deletion even after the proposed retention period — e.g., if a matter is under litigation hold, active regulatory investigation, or if the client is subject to document preservation obligations that extend to advisors.]

---

## Deletion Implementation Status

| Capability | Status |
|-----------|--------|
| Supabase Auth account deletion | Available via Supabase dashboard (manual) |
| Document hard delete from storage | Requires admin action; not self-service |
| Cascade delete of profile + matter access | Not yet implemented; migration needed |
| Automated scheduled deletion at retention period end | Not implemented; v2 roadmap |
| Litigation hold flag (prevents deletion) | Not implemented; v2 roadmap |
| Client self-service deletion portal | Not implemented; v2 roadmap |

---

## Backup and Restore Implications

Supabase automated backups (Point-in-Time Recovery, PITR) retain snapshots for up to 30 days on Pro plan, longer on Enterprise. A deletion in the live database may be recoverable from backup for up to 30 days.

This means: if a client requests deletion, the data will be removed from the live database but may persist in backups for the backup retention window. [ATTORNEY REVIEW: Confirm whether backup retention creates a GDPR / CCPA compliance gap and whether a disclosure is required in the privacy policy.]

---

## Open Items Before Production Go-Live

| Item | Owner | Status |
|------|-------|--------|
| Retention periods confirmed by attorney | Attorney | [ ] Not done |
| Retention schedule incorporated into privacy policy | Attorney + Roman | [ ] Not done |
| Retention schedule incorporated into engagement agreement | Attorney | [ ] Not done |
| IRS / state tax retention period confirmed | Attorney / Accountant | [ ] Not done |
| 1099 contractor record-keeping requirements confirmed | Attorney / Accountant | [ ] Not done |
| Litigation hold procedure documented | Attorney | [ ] Not done |
| Backup retention disclosure reviewed | Attorney | [ ] Not done |
| DSR (deletion request) response procedure documented | Roman | [ ] Not done |
| Automated deletion tooling scoped for v2 | Engineering | [ ] Deferred |
