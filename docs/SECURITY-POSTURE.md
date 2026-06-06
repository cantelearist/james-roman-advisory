# Security Posture

This project is built around client confidentiality first.

## Production Direction

- Prototype2 remains the public front-of-house experience.
- Supabase is the planned managed backend for Postgres, Auth, MFA, and private object storage.
- Vercel remains the frontend hosting layer.
- The secure product surface is split between `/office` for clients and `/admin` for the internal CRM.

## Current Controls

- Security headers are applied globally from `next.config.ts`.
- `/office`, `/admin`, and `/portal` require Supabase authentication through `src/proxy.ts`.
- Missing Supabase auth configuration fails closed on protected routes with a 503.
- Consultation intake validates payloads with Zod before accepting them.
- Consultation intake now persists through the server-only Supabase service role.
- The production schema includes tenant-ready CRM tables, private document metadata, file access events, and audit logs.
- Document APIs issue signed upload/download URLs only after matter access checks.
- Public robots rules disallow `/api`, `/auth`, `/office`, `/admin`, and `/portal`.

## Launch Blockers

- California counsel must provide privacy policy, terms, and retention language.
- Vendor DPAs must be collected before production data is stored.
- Supabase staging and production projects must be created.
- The production migration must be applied and verified before real client files are stored.
- MFA must be enforced for internal users in Supabase Auth.
- Legacy Clerk, Neon, Supabase, Stripe, and Resend environment variables must be cleaned and rotated as appropriate.
- Backup restore must be tested before launch.
