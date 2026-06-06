# Audit Logging

## Executive Summary

Audit logs are append-only operational evidence for sensitive client-office and CRM actions.

They are not a general activity feed, and they are not editable CRM notes.

## Current Model

Audit events record:

- tenant id
- actor id
- action
- resource type
- resource id
- correlation id
- HMAC-hashed IP address
- HMAC-hashed user agent
- limited metadata
- created timestamp

IP and user-agent hashes use `AUDIT_HASH_SECRET`. Do not reuse this secret between staging and production.

## Append-Only Rule

`audit_logs` has a database trigger that blocks update and delete operations.

If a correction is needed, add a new correction event. Do not edit the original row.

Maintenance deletion is only allowed with the explicit database setting:

```sql
select set_config('app.audit_maintenance', 'on', true);
```

That setting is for local tests, controlled restore drills, and formally approved maintenance only. It is not for application code.

## Failure Rule

Sensitive actions must not silently continue if audit logging fails.

The application audit writer rethrows failures after logging a server-side error, so route handlers can return a generic failure instead of completing an unaudited sensitive action.

## Required Secrets

Staging and production both require:

```text
AUDIT_HASH_SECRET
```

Minimum length: 32 characters.

Use separate values for staging and production.
