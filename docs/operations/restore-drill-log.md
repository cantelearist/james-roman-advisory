# Backup and Restore Drill Log

## Purpose

This document is the living record of backup verification drills for the JRA office platform. A drill must be run before any real client data is stored in production, and at minimum quarterly thereafter. The drill proves that a Supabase database backup can actually be restored to a usable state — not just that backups are configured.

An untested backup is not a backup.

---

## Supabase Backup Overview

| Feature | Supabase Pro Plan |
|---------|------------------|
| Daily snapshots | Automatic, retained 7 days |
| Point-in-Time Recovery (PITR) | Available as add-on; retains WAL logs for continuous restore |
| Storage backups | Not included in PITR — Storage objects must be backed up separately |
| Backup encryption | AES-256 at rest (AWS S3) |
| Geographic redundancy | Depends on region and plan |

**Important:** Supabase PITR covers the Postgres database only. Files in Supabase Storage (client documents) are not covered by PITR. Storage backup strategy is a separate open item — see Known Gaps below.

---

## Drill Procedure

Run this procedure against the **staging** Supabase project, not production. The goal is to verify the restore path works — not to restore production data.

### Step 1: Document the current state

Before starting, record:

```
Drill date:
Executor:
Staging project ref: (from Supabase dashboard URL)
Backup point being restored: (timestamp of the daily snapshot or PITR target)
Current row counts (run in Supabase SQL editor):
  SELECT COUNT(*) FROM profiles;
  SELECT COUNT(*) FROM matters;
  SELECT COUNT(*) FROM documents;
  SELECT COUNT(*) FROM audit_events;
```

### Step 2: Trigger a restore

Supabase currently exposes database restores through:

**Option A — Daily snapshot restore (free tier / Pro)**
1. Supabase Dashboard → Settings → Backups
2. Select the target snapshot date
3. Click "Restore to new branch" or contact Supabase support for an in-place restore
4. Note: restoring to a new branch is safer — it creates a parallel Supabase project, leaving the original intact

**Option B — PITR restore (if add-on is enabled)**
1. Supabase Dashboard → Settings → Backups → Point in Time
2. Enter the target timestamp (ISO 8601)
3. Confirm restore target (new branch recommended for drills)

**Option C — pgdump / psql manual restore**
```bash
# Dump from staging
pg_dump "$STAGING_DATABASE_URL" \
  --no-owner \
  --no-acl \
  --format=plain \
  --file=staging-backup-$(date +%Y%m%d).sql

# Restore to a separate test Postgres instance
psql "$TEST_DATABASE_URL" < staging-backup-$(date +%Y%m%d).sql
```

For drills, Option C with a local Postgres instance is the fastest way to verify schema and data integrity without touching any live Supabase project.

### Step 3: Verify the restore

After restore completes, run these checks against the restored database:

```sql
-- Row count parity (compare to Step 1 baseline)
SELECT COUNT(*) FROM profiles;
SELECT COUNT(*) FROM matters;
SELECT COUNT(*) FROM documents;
SELECT COUNT(*) FROM audit_events;

-- Schema sanity: confirm all expected tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- RLS policies present
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Spot-check data integrity
SELECT id, tenant_id, status, created_at
FROM documents
ORDER BY created_at DESC
LIMIT 10;

-- Audit log intact
SELECT action, COUNT(*) as count
FROM audit_events
GROUP BY action
ORDER BY count DESC;
```

### Step 4: Verify application connectivity

Start the Next.js app pointed at the restored database (using a `.env.local` override for `DATABASE_URL` / Supabase connection string) and confirm:

- [ ] `/office` login flow works (magic link → session)
- [ ] At least one matter loads correctly
- [ ] Document list renders (no 500 errors)
- [ ] Admin panel loads

### Step 5: Record results and sign off

Fill in the drill log entry below.

---

## Drill Log

### Drill #1 — Pre-Launch Verification

```
Date:               [ not yet run ]
Executor:           [ ]
Staging project:    [ ]
Backup point:       [ ]
Method used:        [ pgdump | Supabase snapshot | PITR ]
Restore target:     [ new branch | local Postgres | other ]

Row count verification:
  profiles:         expected [ ] / actual [ ]
  matters:          expected [ ] / actual [ ]
  documents:        expected [ ] / actual [ ]
  audit_events:     expected [ ] / actual [ ]

Schema check:       [ pass | fail | notes: ]
RLS policies:       [ pass | fail | notes: ]
App connectivity:   [ pass | fail | notes: ]

Issues found:       [ none | describe ]
Time to restore:    [ ]
Sign-off:           [ ]
Next drill due:     [ 90 days from today ]
```

---

## Known Gaps

| Gap | Risk | Status |
|-----|------|--------|
| Supabase Storage is not covered by PITR | Client-uploaded documents (PDFs, contracts) cannot be restored from a Supabase database restore alone | Open — no Storage backup strategy defined |
| Storage backup strategy | Documents in the `case-files` bucket need a separate backup mechanism (e.g., scheduled rclone to S3, or Supabase Storage replication) | Open — needs separate design |
| No automated drill schedule | Drills depend on Roman running this manually | Acceptable for v1; automate reminders quarterly |
| Restore to production not tested | This drill covers staging only | Production restore procedure should be drilled once before first real client |
| Auth records | Supabase Auth user records (email, MFA factors) live in a separate `auth` schema — confirm they are included in the snapshot | Verify during Drill #1 |

---

## Storage Backup (Open Item)

Until a Storage backup strategy is in place, the disaster recovery posture is:

- **Database:** recoverable via Supabase snapshot or PITR within 7 days
- **Client documents in Storage:** **not recoverable** from a database restore

This is an acceptable risk for the pre-launch period when no real client documents are stored. It becomes unacceptable the moment real client files exist in the bucket. Before onboarding any client, a Storage backup approach must be designed and tested.

Options to evaluate:
- Supabase Storage → AWS S3 cross-region replication (manual setup via rclone or aws-cli scheduled job)
- Vercel Cron job that periodically syncs Storage to a separate bucket
- Client-side document retention: clients keep originals; JRA Storage is a working copy only

---

## Quarterly Drill Reminder

Add a recurring calendar event: **"JRA Restore Drill"** every 90 days. The drill should take under 2 hours. Log results in this file.
