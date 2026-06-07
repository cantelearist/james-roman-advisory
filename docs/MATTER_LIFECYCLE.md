# Matter Lifecycle

**Version:** 0.1 — STUB  
**Status:** Pending — not yet complete  
**Owner:** Roman Cantelearist  
**Last Updated:** 2026-06-06

> **Note:** This document is a placeholder. It must be completed before any agent builds CRM, Office, Messaging, Billing, or Audit features. All future features must anchor to this lifecycle. Do not interpret the stub as authoritative design.

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

---

## Core Model

The platform revolves around:

```
Relationship
↓
Matter
↓
Document
```

Every feature — messaging, billing, audit, reporting — attaches to this model.

Disconnected feature silos are not acceptable.

---

## Lifecycle Rules (Known)

- Legal hold blocks soft deletion at the matter and document level.
- Hard deletion is not permitted through normal database operations.
- Matters and documents carry sensitivity, classification, legal hold, deletion request, retention, and soft-deletion metadata.
- Documents cannot move to `available` status without passing the scan gate.

---

## Sections To Complete

- [ ] Full state machine diagram (all transitions, allowed and forbidden)
- [ ] Transition rules (who can trigger each transition, under what conditions)
- [ ] Data model per stage (what fields are required at each status)
- [ ] Document attachment rules (which document types belong to which stages)
- [ ] Billing trigger points (when invoicing attaches to matter status)
- [ ] Messaging rules (what communications are logged, how they attach to the matter)
- [ ] Audit requirements per transition (what gets logged, what triggers an alert)
- [ ] Retention and archival rules (when a completed matter becomes archived, how long it is retained)
- [ ] Legal hold interaction (what freezes when a hold is placed, what is still permitted)
- [ ] Client portal visibility rules (what a client can see at each stage)

---

## Related Documents

- [PROJECT_GOVERNANCE.md](./PROJECT_GOVERNANCE.md)
- [MULTI_AGENT_PROTOCOL.md](./MULTI_AGENT_PROTOCOL.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [SECURITY_MODEL.md](./SECURITY_MODEL.md)
