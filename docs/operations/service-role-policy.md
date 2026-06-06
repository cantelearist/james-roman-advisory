# Service Role Policy

The Supabase service-role key bypasses RLS. Treat it as a controlled operational tool, not a convenient application client.

## Approved Uses

Service-role usage is allowed only for narrow server-side operations where user-scoped access is architecturally insufficient:

| Location | Use | Reason |
|---|---|---|
| `consultations/route.ts` | Insert consultation request | Pre-auth — no user session exists yet |
| `documents/signed-upload/route.ts` | Create signed upload URL | Storage API requires service-role for private bucket URL generation |
| `documents/[documentId]/download/route.ts` | Create signed download URL | Storage API requires service-role for private bucket URL generation |
| `documents/[documentId]/download/route.ts` | Insert `file_access_events` | Append-only operational log; must not be blocked by user-scoped policies |
| `documents/[documentId]/complete/route.ts` | Update document status to `scan_pending` | System-level status transition that must not be restricted by user-scoped update policies |
| `documents/[documentId]/complete/route.ts` | Insert `file_access_events` | Append-only operational log |
| `crm/audit.ts` | Insert `audit_logs` | Append-only, HMAC-protected audit trail |

## Not Approved

Do not use the service-role client for:

- General dashboard listing or browsing
- Client office reads
- Ordinary authenticated message reads or inserts
- Ordinary authenticated document metadata reads
- Any operation where the user-scoped client is architecturally sufficient

These flows must use `createSupabaseServerClient()` so Postgres RLS remains an active boundary in addition to application-level access checks.

## Code Rule

Every `createSupabaseAdminClient()` call must either appear in the approved table above or include a short local comment explaining why user-scoped access is insufficient. Any new usage outside the approved list requires security review before staging promotion.

Verify before each staging deploy:

```bash
rg -n "createSupabaseAdminClient" src
npm run test -- src/lib/crm/access-control.test.ts
```

## Current Usage Scan

As of 2026-06-05, running `rg -n "createSupabaseAdminClient" src` returns:

```
src/app/api/consultations/route.ts          # approved: pre-auth intake
src/app/api/documents/signed-upload/route.ts # approved: Storage signed-upload URL
src/app/api/documents/[documentId]/download/route.ts # approved: Storage signed-download URL + file_access_events
src/app/api/documents/[documentId]/complete/route.ts # approved: scan_pending status transition + file_access_events
src/lib/crm/audit.ts                         # approved: append-only audit log
src/lib/supabase/admin.ts                    # definition only
```

No unapproved usages. Messages and general CRM data access use `createSupabaseServerClient()`.
