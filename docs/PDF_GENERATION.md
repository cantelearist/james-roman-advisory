# RCA document PDFs

Staff-facing document generation is available at `POST /api/documents/pdf`.
The route requires an authenticated advisor or admin session and returns an
RCA-styled, private PDF attachment. Payloads are limited to 512 KB, 30
sections, and bounded text fields so a malformed request cannot consume
unbounded server memory.

```json
{
  "title": "Remediation Oversight Brief",
  "subtitle": "Private engagement record",
  "reference": "JRA-2026-0001",
  "sections": [
    { "heading": "Scope", "body": "Independent review of the remediation plan." },
    { "heading": "Next actions", "body": ["Confirm insurance", "Schedule site review"] }
  ]
}
```

The reusable renderer lives in `src/lib/pdf.ts`, so invoice, contract, change
order, and report workflows can share the same visual and validation path.
