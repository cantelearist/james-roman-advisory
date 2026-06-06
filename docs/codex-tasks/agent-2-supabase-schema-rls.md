# Agent 2: Supabase Schema + RLS

## Mission

Create staging-ready Supabase migrations for the secure James Roman Advisory backend.

No UI work.

## Scope

Create or update migrations for:

- tenants
- profiles
- clients
- matters
- access_grants
- documents
- messages
- audit_logs
- file_access_events

## Requirements

- All business tables must include `tenant_id`.
- RLS must be enabled on every business table.
- Team users may access tenant-scoped CRM data.
- Clients may only access matters through active `access_grants`.
- Clients must not see internal notes, internal messages, internal documents, or pending uploads.
- Documents must support private storage metadata, visibility, status, classification, and matter association.
- Audit logs must be append-only in normal application behavior.
- File access events must record upload, download, signed URL request, and failed/denied attempts where applicable.
- Service-role usage must not become the default access model.

## Required Tables

Minimum entities:

- `tenants`
- `profiles`
- `clients`
- `matters`
- `access_grants`
- `documents`
- `messages`
- `audit_logs`
- `file_access_events`

Add enums or check constraints for:

- user role
- matter status
- matter sensitivity
- document visibility
- document status
- message visibility
- audit action/resource type where appropriate

## Required RLS Tests

Create database-level tests for:

- owner/admin/advisor can read tenant-scoped CRM data.
- client can read only granted matters.
- revoked grant denies matter access.
- client cannot cross-read another client’s matter.
- client cannot cross-read another tenant’s data.
- client cannot read internal messages.
- client cannot read internal documents.
- client cannot read pending upload documents.
- team can read audit logs for tenant.
- client cannot read audit logs.

## Verification

Run:

```bash
npm run build
supabase test db
```

Do not deploy production. Work only against staging/local Supabase.

