# Matter Lifecycle

**Version:** 1.0  
**Status:** Active  
**Owner:** Roman Cantelearist  
**Last Updated:** 2026-06-06

---

## Core Model

The platform is matter-centric. All features — CRM, office portal, document exchange, messaging, billing, audit — attach to this hierarchy:

```
Relationship (client)
↓
Matter (engagement)
↓
Document (file, note, or record)
```

A client may have multiple matters. A matter holds multiple documents. Features are not built as standalone modules — they are built as attachments to the matter.

---

## Approved Lifecycle

```
Consultation Requested
↓
Consultation Scheduled
↓
Consultation Completed
↓
Proposal Sent
↓
Engaged
↓
Assessment
↓
Remediation Oversight
↓
Monitoring
↓
Completed
↓
Archived
```

No statuses outside this list should be introduced without Roman's approval.

---

## Stage Definitions

### Consultation Requested

A prospective client has submitted the consultation form.

- Trigger: `/api/consultations` intake insert.
- Documents: none required yet.
- Client portal visibility: none — client is not yet authenticated.
- Billing: none.

---

### Consultation Scheduled

An initial consultation has been arranged.

- Trigger: advisor manually advances from Consultation Requested.
- Documents: none required.
- Client portal visibility: none — client is not yet authenticated.
- Billing: none.

---

### Consultation Completed

The initial consultation has taken place.

- Trigger: advisor manually advances.
- Documents: consultation notes (optional).
- Next action: advisor prepares proposal.
- Client portal visibility: none — client is not yet authenticated.
- Billing: none.

---

### Proposal Sent

A formal engagement proposal has been delivered to the prospective client.

- Trigger: advisor manually advances.
- Documents: proposal document attached.
- Client portal visibility: none — client is not yet authenticated.
- Billing: none.

---

### Engaged

The client has accepted the proposal. The engagement is active.

- Trigger: advisor manually advances after client acceptance.
- Documents: executed agreement, intake documents.
- Client portal visibility: enabled — client gains authenticated portal access at this stage.
- Billing: engagement fee triggered (when Stripe is live).
- Note: this is the first stage requiring a fully onboarded, authenticated client.

---

### Assessment

Active investigation and analysis of the client's situation.

- Trigger: advisor manually advances.
- Documents: site inspection reports, test results, third-party reports, photographs, contractor bids.
- Client portal visibility: documents marked `available` are visible. `scan_pending` documents are hidden.
- Billing: assessment fee or hourly billing begins (when Stripe is live).

---

### Remediation Oversight

Active remediation work is underway. Advisor is overseeing contractors or vendors.

- Trigger: advisor manually advances.
- Documents: contractor agreements, progress reports, clearance certificates, correspondence.
- Client portal visibility: documents marked `available` are visible.
- Billing: oversight fee or milestone billing (when Stripe is live).

---

### Monitoring

Remediation is complete. Advisor is monitoring for recurrence or compliance.

- Trigger: advisor manually advances.
- Documents: monitoring reports, air quality tests, clearance letters.
- Client portal visibility: documents marked `available` are visible.
- Billing: monitoring retainer (when Stripe is live).

---

### Completed

The engagement is fully resolved.

- Trigger: advisor manually advances.
- Documents: final report, all supporting documents.
- Client portal visibility: full read access to the complete matter record.
- Billing: final invoice (when Stripe is live).

---

### Archived

The matter has been closed and moved to long-term retention.

- Trigger: advisor manually advances, or automated retention policy (future).
- Documents: all documents frozen — no new additions.
- Client portal visibility: read-only. No new uploads.
- Billing: complete.
- Legal hold: if a legal hold exists, archival is permitted but deletion is blocked until hold is released.
- Retention: retention period begins from archive date. Governed by `docs/operations/data-retention-policy-draft.md`.

---

## Legal Hold

A legal hold may be placed on any matter or document at any stage.

**Effects of legal hold:**
- Soft deletion is blocked — the matter or document cannot be deleted.
- Archival is still permitted.
- Hard deletion is not permitted through normal database operations under any circumstances.
- The hold must be explicitly released before deletion can proceed.
- Legal hold status is tracked in the `legal_hold` field on the matter and document records.

---

## Document Security Within the Lifecycle

All documents follow the storage security model:

```
Upload received → scan_pending
↓
Manual advisor review (or future scan worker)
↓
Marked available
↓
Signed URL issued on demand (time-limited)
```

At no stage is a `scan_pending` document visible to the client or issued a signed URL. See `docs/SECURITY_MODEL.md`.

---

## Matter Metadata

Every matter carries the following metadata fields:

| Field | Purpose |
|-------|---------|
| `status` | Current lifecycle stage |
| `sensitivity` | Classification level |
| `classification` | Formal label |
| `legal_hold` | Boolean — blocks deletion when true |
| `deletion_request` | Tracks pending deletion requests |
| `retention` | Retention period policy |
| `soft_deleted_at` | Timestamp if soft-deleted |
| `assigned_advisor` | Responsible advisor |
| `client_relationship_id` | Parent relationship record |

---

## Transition Rules

| From | To | Who | Condition |
|------|----|----|-----------|
| Consultation Requested | Consultation Scheduled | Advisor | Manual |
| Consultation Scheduled | Consultation Completed | Advisor | Manual |
| Consultation Completed | Proposal Sent | Advisor | Manual |
| Proposal Sent | Engaged | Advisor | Client acceptance confirmed |
| Engaged | Assessment | Advisor | Manual |
| Assessment | Remediation Oversight | Advisor | Manual |
| Remediation Oversight | Monitoring | Advisor | Manual |
| Monitoring | Completed | Advisor | Manual |
| Completed | Archived | Advisor | Manual or automated |
| Any | Any earlier stage | Not permitted | — |

Backwards transitions are not permitted without Roman's explicit approval. The lifecycle is forward-only.

---

## Future Feature Attachment Points

All future features must anchor to the matter model:

| Feature | Attachment Point |
|---------|-----------------|
| Client messaging | Matter — messages thread on a matter |
| Billing / invoicing | Matter — invoices generated at lifecycle transitions |
| Audit trail | Matter and document — every state change is logged |
| Notifications | Matter — triggered by status transitions |
| Reporting | Matter — aggregated across all matters for a relationship |
| Client portal | Matter — portal is a view into the client's matters and documents |

---

## Related Documents

- [PROJECT_GOVERNANCE.md](./PROJECT_GOVERNANCE.md)
- [MULTI_AGENT_PROTOCOL.md](./MULTI_AGENT_PROTOCOL.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [SECURITY_MODEL.md](./SECURITY_MODEL.md)
- [operations/data-retention-policy-draft.md](./operations/data-retention-policy-draft.md)
- [operations/document-scanning.md](./operations/document-scanning.md)
- [operations/audit-logging.md](./operations/audit-logging.md)
