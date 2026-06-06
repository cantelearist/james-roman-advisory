# Data Retention Policy Draft

## Executive Summary

This is an operational draft for counsel review. It is not legal advice and should not be treated as the final privacy or retention policy.

The system now supports retention-aware case handling:

- matter sensitivity labels
- document classification labels
- legal hold flags
- deletion request timestamps
- soft-deletion timestamps
- document retention dates

The rule is simple: sensitive records are retired deliberately, not casually erased.

## Classification Model

Matter sensitivity:

- `standard`: ordinary matter administration.
- `sensitive`: matter contains higher-risk client, property, insurance, payment, or dispute context.
- `restricted`: matter requires tighter internal access discipline and step-up review before sharing, export, or deletion.

Document classification:

- `general`: routine matter document.
- `property`: property photos, inspection materials, site notes, estimates, or remediation records.
- `financial`: invoices, payment-related records, contractor cost materials.
- `legal`: NDA, engagement, claim, dispute, attorney-provided, or privilege-adjacent materials.
- `restricted`: high-risk file that should receive explicit advisor review before client visibility, export, or deletion.

## Legal Hold

Legal hold can be applied to matters and documents.

When legal hold is active:

- soft deletion is blocked
- document status cannot be changed to `deleted`
- hard deletion is blocked
- a correction or release event should be audit logged

Legal hold fields:

- `legal_hold`
- `legal_hold_reason`
- `legal_hold_at`
- `legal_hold_by`

## Deletion And CPRA Requests

Client deletion/privacy requests should be recorded before action is taken:

- `deletion_requested_at`
- `deletion_requested_by`

Deletion should normally be soft deletion:

- `deleted_at`
- `deleted_by`
- `deletion_reason`

Do not fulfill a CPRA deletion request automatically if the record is subject to:

- legal hold
- active matter obligations
- unpaid invoice/payment record requirements
- insurance/dispute documentation needs
- accounting/tax retention obligations
- contractual retention requirements

When deletion is denied or delayed, preserve the reason in an internal note or audit event.

## Document Retention

Documents can carry `retention_until`.

Before deleting or archiving a document, staff should verify:

- the matter is closed or the document is no longer operationally needed
- no legal hold applies
- the retention date has passed, if one exists
- the document is not needed for billing, contractor payment, dispute, insurance, or tax records

## Production Rules

- Do not hard-delete matters or documents through application code.
- Use soft deletion and preserve audit history.
- If a mistake is made, add a correction event; do not edit audit history.
- Counsel should approve final retention periods before real client data enters production.

## Open Counsel Questions

- Standard retention period after matter closure.
- Retention period for contractor invoices and payment records.
- Whether NDA/engagement records have a separate retention period.
- How to respond when a CPRA deletion request conflicts with insurance, dispute, or payment documentation needs.
- Whether any matter category requires restricted handling by default.
