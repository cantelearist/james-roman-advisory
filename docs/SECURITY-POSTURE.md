# Security Posture

This project is built around client confidentiality first.

## Current Controls

- Security headers are applied globally from `next.config.ts`.
- Consultation intake validates payloads with Zod before accepting them.
- Intake audit logging stores redacted metadata only.
- Portal routes are static previews; no sensitive records are stored yet.
- No third-party analytics or trackers have been added.

## Planned Controls

- First-party password sessions for `/portal/*`.
- Postgres row-level security for engagement-scoped records.
- Signed document URLs only; no public storage buckets.
- Append-only audit log for every document read/write and AI operation.
- Advisor review required before any AI summary is client-visible.

## Launch Blockers

- California counsel must provide privacy policy, terms, and retention language.
- Vendor DPAs must be collected before production data is stored.
- A real database, storage token, password-reset flow, and second factor must be configured before broad portal use.
