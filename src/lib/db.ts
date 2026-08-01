import { neon } from "@neondatabase/serverless";

import { SCHEMA_MIGRATION_VERSIONS } from "./schema-migration-manifest";

export type MatterType =
  | "mold"
  | "smoke_damage"
  | "asbestos"
  | "lead_paint"
  | "water_intrusion"
  | "transaction_review"
  | "other";

export type MatterStatus =
  | "intake"
  | "assessment"
  | "review"
  | "vendor_evaluation"
  | "oversight"
  | "clearance"
  | "closed";

export type DocumentCategory =
  | "lab_report"
  | "inspection_report"
  | "remediation_plan"
  | "contractor_proposal"
  | "insurance"
  | "photo"
  | "permit"
  | "correspondence"
  | "other";

export type AccessEventType = "upload" | "download" | "view" | "delete";

export type MatterEventType =
  | "created"
  | "status_changed"
  | "workflow_completed"
  | "workflow_override"
  | "task_created"
  | "task_completed"
  | "note_added"
  | "document_uploaded"
  | "document_downloaded"
  | "document_deleted"
  | "client_access_granted";

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

let authTablesPromise: Promise<void> | null = null;
let vaultTablesPromise: Promise<void> | null = null;
let accessTablesPromise: Promise<void> | null = null;
let operationsTablesPromise: Promise<void> | null = null;

async function schemaVersionApplied(version: string): Promise<boolean> {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS app_schema_versions (
      version    TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  const rows = await sql`SELECT version FROM app_schema_versions WHERE version = ${version} LIMIT 1`;
  return rows.length > 0;
}

async function markSchemaVersion(version: string): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO app_schema_versions (version)
    VALUES (${version})
    ON CONFLICT (version) DO NOTHING
  `;
}

export async function ensureUsersTable() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      email       TEXT NOT NULL UNIQUE,
      role        TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'contractor', 'client')),
      status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
      password_hash TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ`;
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'users'::regclass
          AND conname = 'users_status_check'
      ) THEN
        ALTER TABLE users
          ADD CONSTRAINT users_status_check
          CHECK (status IN ('active', 'suspended'));
      END IF;
    END $$;
  `;
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'users'::regclass
          AND conname = 'users_role_check'
          AND pg_get_constraintdef(oid) NOT LIKE '%super_admin%'
      ) THEN
        ALTER TABLE users DROP CONSTRAINT users_role_check;
        UPDATE users SET role = 'admin' WHERE role = 'advisor';
        ALTER TABLE users
          ADD CONSTRAINT users_role_check
          CHECK (role IN ('super_admin', 'admin', 'contractor', 'client'));
      END IF;
    END $$;
  `;
  await sql`
    UPDATE users
    SET role = 'super_admin'
    WHERE LOWER(email) = 'roman@jamesroman.la'
      AND role <> 'super_admin'
  `;
}

export function ensureAuthTables(): Promise<void> {
  if (!authTablesPromise) {
    authTablesPromise = ensureAuthTablesImpl().catch((error) => {
      authTablesPromise = null;
      throw error;
    });
  }
  return authTablesPromise;
}

async function ensureAuthTablesImpl() {
  const version = SCHEMA_MIGRATION_VERSIONS.auth;
  if (await schemaVersionApplied(version)) return;
  await ensureUsersTable();
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS auth_login_challenges (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      purpose    TEXT NOT NULL CHECK (purpose IN ('verify_mfa', 'enroll_mfa')),
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS auth_mfa_methods (
      user_id          TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      encrypted_secret TEXT NOT NULL,
      enabled_at       TIMESTAMPTZ,
      last_used_step   BIGINT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS auth_mfa_recovery_codes (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash  TEXT NOT NULL UNIQUE,
      used_at    TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at    TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS auth_invitations (
      id         TEXT PRIMARY KEY,
      email      TEXT NOT NULL,
      role       TEXT NOT NULL CHECK (role IN ('admin', 'contractor', 'client')),
      token_hash TEXT NOT NULL UNIQUE,
      permission_profile_id TEXT,
      access_scope TEXT NOT NULL DEFAULT 'assigned',
      matter_id TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      accepted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE auth_invitations ADD COLUMN IF NOT EXISTS permission_profile_id TEXT`;
  await sql`ALTER TABLE auth_invitations ADD COLUMN IF NOT EXISTS access_scope TEXT NOT NULL DEFAULT 'assigned'`;
  await sql`ALTER TABLE auth_invitations ADD COLUMN IF NOT EXISTS matter_id TEXT`;
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'auth_invitations'::regclass
          AND conname = 'auth_invitations_access_scope_check'
      ) THEN
        ALTER TABLE auth_invitations
          ADD CONSTRAINT auth_invitations_access_scope_check
          CHECK (access_scope IN ('global', 'assigned'));
      END IF;
    END $$;
  `;
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'auth_invitations'::regclass
          AND conname = 'auth_invitations_role_check'
          AND pg_get_constraintdef(oid) LIKE '%advisor%'
      ) THEN
        ALTER TABLE auth_invitations DROP CONSTRAINT auth_invitations_role_check;
        UPDATE auth_invitations SET role = 'admin' WHERE role = 'advisor';
        ALTER TABLE auth_invitations
          ADD CONSTRAINT auth_invitations_role_check
          CHECK (role IN ('admin', 'contractor', 'client'));
      END IF;
    END $$;
  `;
  await markSchemaVersion(version);
}

export async function ensureConsultationsTable() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS consultations (
      id            TEXT PRIMARY KEY,
      reference_id  TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL,
      market        TEXT NOT NULL,
      matter        TEXT NOT NULL,
      message       TEXT NOT NULL,
      summary_draft TEXT,
      received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

/**
 * Ensures all vault and matter management tables exist.
 * Safe to call on every request — uses CREATE TABLE IF NOT EXISTS.
 */
export function ensureVaultTables(): Promise<void> {
  if (!vaultTablesPromise) {
    vaultTablesPromise = ensureVaultTablesImpl().catch((error) => {
      vaultTablesPromise = null;
      throw error;
    });
  }
  return vaultTablesPromise;
}

async function ensureVaultTablesImpl() {
  const version = SCHEMA_MIGRATION_VERSIONS.vault;
  if (await schemaVersionApplied(version)) return;
  const sql = getDb();

  // clients — one row per client; user_id is the first-party auth user id.
  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      user_id       TEXT UNIQUE,
      name          TEXT NOT NULL,
      email         TEXT,
      phone         TEXT,
      notes         TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS user_id TEXT`;
  await sql`
    UPDATE clients c
    SET user_id = u.id
    FROM users u
    WHERE c.user_id IS NULL
      AND c.email IS NOT NULL
      AND LOWER(c.email) = LOWER(u.email)
  `;

  // properties — one or more properties per client
  await sql`
    CREATE TABLE IF NOT EXISTS properties (
      id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      client_id  TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      address    TEXT NOT NULL,
      city       TEXT NOT NULL DEFAULT 'Malibu',
      state      TEXT NOT NULL DEFAULT 'CA',
      notes      TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // matters — engagements associated with a client and optionally a property
  await sql`
    CREATE TABLE IF NOT EXISTS matters (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      property_id TEXT REFERENCES properties(id) ON DELETE SET NULL,
      title       TEXT NOT NULL,
      type        TEXT NOT NULL DEFAULT 'other',
      status      TEXT NOT NULL DEFAULT 'intake',
      notes       TEXT,
      created_by  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // matter_events — activity timeline for each matter
  await sql`
    CREATE TABLE IF NOT EXISTS matter_events (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      matter_id   TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
      user_id     TEXT NOT NULL,
      event_type  TEXT NOT NULL,
      content     TEXT,
      metadata    JSONB,
      visibility  TEXT NOT NULL DEFAULT 'internal'
        CHECK (visibility IN ('internal', 'contractor', 'client')),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    ALTER TABLE matter_events
    ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'internal'
  `;
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'matter_events'::regclass
          AND conname = 'matter_events_visibility_check'
      ) THEN
        ALTER TABLE matter_events
          ADD CONSTRAINT matter_events_visibility_check
          CHECK (visibility IN ('internal', 'contractor', 'client'));
      END IF;
    END $$;
  `;
  await sql`
    UPDATE matter_events
    SET visibility = 'client'
    WHERE event_type IN (
      'created',
      'status_changed',
      'document_uploaded',
      'document_downloaded',
      'client_access_granted'
    )
      AND visibility = 'internal'
  `;

  // documents — files stored in Vercel Blob, associated with a matter
  await sql`
    CREATE TABLE IF NOT EXISTS documents (
      id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      matter_id     TEXT REFERENCES matters(id) ON DELETE CASCADE,
      client_id     TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      original_name TEXT NOT NULL,
      category      TEXT NOT NULL DEFAULT 'other',
      blob_pathname TEXT NOT NULL UNIQUE,
      size_bytes    BIGINT,
      content_type  TEXT,
      uploaded_by   TEXT NOT NULL,
      visibility    TEXT NOT NULL DEFAULT 'client'
        CHECK (visibility IN ('internal', 'contractor', 'client')),
      publication_status TEXT NOT NULL DEFAULT 'published'
        CHECK (publication_status IN ('pending_review', 'published')),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'client'
  `;
  await sql`
    ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'published'
  `;
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'documents'::regclass
          AND conname = 'documents_visibility_check'
      ) THEN
        ALTER TABLE documents
          ADD CONSTRAINT documents_visibility_check
          CHECK (visibility IN ('internal', 'contractor', 'client'));
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'documents'::regclass
          AND conname = 'documents_publication_status_check'
      ) THEN
        ALTER TABLE documents
          ADD CONSTRAINT documents_publication_status_check
          CHECK (publication_status IN ('pending_review', 'published'));
      END IF;
    END $$;
  `;

  // file_access_events — immutable audit log of every upload, download, view, delete
  await sql`
    CREATE TABLE IF NOT EXISTS file_access_events (
      id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      document_id   TEXT REFERENCES documents(id) ON DELETE SET NULL,
      user_id       TEXT NOT NULL,
      event_type    TEXT NOT NULL,
      ip_address    TEXT,
      user_agent    TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await markSchemaVersion(version);
}

const ADMIN_OPERATIONS_PERMISSIONS = [
  "users.invite",
  "clients.view",
  "clients.manage",
  "engagements.view",
  "engagements.create",
  "engagements.update",
  "engagements.assign",
  "documents.view",
  "documents.upload",
  "documents.publish",
  "documents.delete",
  "documents.generate_pdf",
  "timeline.view",
  "timeline.internal_view",
  "timeline.manage",
  "messages.view",
  "messages.send",
  "messages.internal_view",
  "contracts.view",
  "contracts.manage",
  "finance.view",
  "finance.manage",
  "audit.view",
] as const;

const CONTRACTOR_STANDARD_PERMISSIONS = [
  "engagements.view",
  "documents.view",
  "documents.upload",
  "timeline.view",
  "timeline.manage",
  "messages.view",
  "messages.send",
] as const;

/**
 * Ensures the hybrid role/capability model exists and backfills legacy client
 * ownership into explicit engagement memberships.
 */
export function ensureAccessControlTables(): Promise<void> {
  if (!accessTablesPromise) {
    accessTablesPromise = ensureAccessControlTablesImpl().catch((error) => {
      accessTablesPromise = null;
      throw error;
    });
  }
  return accessTablesPromise;
}

async function ensureAccessControlTablesImpl() {
  await ensureAuthTables();
  await ensureVaultTables();
  const version = SCHEMA_MIGRATION_VERSIONS.access;
  if (await schemaVersionApplied(version)) return;
  const sql = getDb();

  await sql`
    CREATE TABLE IF NOT EXISTS permission_profiles (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      role_type   TEXT NOT NULL CHECK (role_type IN ('admin', 'contractor')),
      permissions JSONB NOT NULL DEFAULT '[]'::JSONB,
      is_system   BOOLEAN NOT NULL DEFAULT FALSE,
      created_by  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE permission_profiles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`;
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'permission_profiles'::regclass
          AND conname = 'permission_profiles_status_check'
      ) THEN
        ALTER TABLE permission_profiles
          ADD CONSTRAINT permission_profiles_status_check
          CHECK (status IN ('active', 'archived'));
      END IF;
    END $$;
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_permission_assignments (
      user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      permission_profile_id TEXT NOT NULL REFERENCES permission_profiles(id),
      access_scope TEXT NOT NULL DEFAULT 'assigned'
        CHECK (access_scope IN ('global', 'assigned')),
      assigned_by TEXT,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS engagement_memberships (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      matter_id   TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      member_role TEXT NOT NULL CHECK (member_role IN ('admin', 'contractor', 'client')),
      status      TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'revoked')),
      expires_at  TIMESTAMPTZ,
      assigned_by TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (matter_id, user_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS access_audit_events (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      actor_id    TEXT NOT NULL,
      action      TEXT NOT NULL,
      target_user_id TEXT,
      matter_id   TEXT,
      metadata    JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS portal_settings (
      key         TEXT PRIMARY KEY,
      value       JSONB NOT NULL,
      updated_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    INSERT INTO permission_profiles (id, name, role_type, permissions, is_system)
    VALUES (
      'profile_admin_operations',
      'Operations Admin',
      'admin',
      CAST(${JSON.stringify(ADMIN_OPERATIONS_PERMISSIONS)} AS JSONB),
      TRUE
    )
    ON CONFLICT (id) DO NOTHING
  `;
  await sql`
    UPDATE permission_profiles
    SET permissions = CASE
      WHEN permissions ? 'timeline.manage' THEN permissions
      ELSE permissions || '["timeline.manage"]'::JSONB
    END,
    updated_at = NOW()
    WHERE id = 'profile_contractor_standard'
      AND is_system = TRUE
  `;
  await sql`
    INSERT INTO permission_profiles (id, name, role_type, permissions, is_system)
    VALUES (
      'profile_contractor_standard',
      'Engagement Contractor',
      'contractor',
      CAST(${JSON.stringify(CONTRACTOR_STANDARD_PERMISSIONS)} AS JSONB),
      TRUE
    )
    ON CONFLICT (id) DO NOTHING
  `;

  await sql`
    INSERT INTO user_permission_assignments (
      user_id,
      permission_profile_id,
      access_scope,
      assigned_by
    )
    SELECT
      u.id,
      'profile_admin_operations',
      'global',
      'system:migration'
    FROM users u
    WHERE u.role = 'admin'
    ON CONFLICT (user_id) DO NOTHING
  `;
  await sql`
    INSERT INTO user_permission_assignments (
      user_id,
      permission_profile_id,
      access_scope,
      assigned_by
    )
    SELECT
      u.id,
      'profile_contractor_standard',
      'assigned',
      'system:migration'
    FROM users u
    WHERE u.role = 'contractor'
    ON CONFLICT (user_id) DO NOTHING
  `;

  await sql`
    INSERT INTO engagement_memberships (
      matter_id,
      user_id,
      member_role,
      assigned_by
    )
    SELECT
      m.id,
      c.user_id,
      'client',
      'system:migration'
    FROM matters m
    JOIN clients c ON c.id = m.client_id
    JOIN users u ON u.id = c.user_id
    WHERE c.user_id IS NOT NULL
    ON CONFLICT (matter_id, user_id) DO NOTHING
  `;
  await markSchemaVersion(version);
}

/** Ensures engagement correspondence, billing, and amendment records exist. */
export function ensureEngagementOperationsTables(): Promise<void> {
  if (!operationsTablesPromise) {
    operationsTablesPromise = ensureEngagementOperationsTablesImpl().catch((error) => {
      operationsTablesPromise = null;
      throw error;
    });
  }
  return operationsTablesPromise;
}

async function ensureEngagementOperationsTablesImpl() {
  await ensureAccessControlTables();
  const version = SCHEMA_MIGRATION_VERSIONS.operations;
  if (await schemaVersionApplied(version)) return;
  const sql = getDb();

  await sql`ALTER TABLE matters ADD COLUMN IF NOT EXISTS owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL`;
  await sql`ALTER TABLE matters ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal'`;
  await sql`ALTER TABLE matters ADD COLUMN IF NOT EXISTS health TEXT NOT NULL DEFAULT 'on_track'`;
  await sql`ALTER TABLE matters ADD COLUMN IF NOT EXISTS start_date DATE`;
  await sql`ALTER TABLE matters ADD COLUMN IF NOT EXISTS due_date DATE`;
  await sql`ALTER TABLE matters ADD COLUMN IF NOT EXISTS next_action TEXT`;
  await sql`ALTER TABLE matters ADD COLUMN IF NOT EXISTS next_action_due_at TIMESTAMPTZ`;
  await sql`ALTER TABLE matters ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1`;
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'matters'::regclass
          AND conname = 'matters_priority_check'
      ) THEN
        ALTER TABLE matters
          ADD CONSTRAINT matters_priority_check
          CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'matters'::regclass
          AND conname = 'matters_health_check'
      ) THEN
        ALTER TABLE matters
          ADD CONSTRAINT matters_health_check
          CHECK (health IN ('on_track', 'at_risk', 'blocked'));
      END IF;
    END $$;
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS workflow_templates (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      matter_type TEXT,
      version     INTEGER NOT NULL DEFAULT 1,
      status      TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('draft', 'active', 'archived')),
      created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (name, version)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS workflow_template_items (
      id            TEXT PRIMARY KEY,
      template_id   TEXT NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
      stage_key     TEXT NOT NULL,
      title         TEXT NOT NULL,
      item_type     TEXT NOT NULL DEFAULT 'requirement'
        CHECK (item_type IN ('requirement', 'deliverable', 'approval')),
      is_required   BOOLEAN NOT NULL DEFAULT TRUE,
      position      INTEGER NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    INSERT INTO workflow_templates (
      id, name, matter_type, version, status
    )
    VALUES (
      'workflow-jra-core-v1', 'JRA Core Engagement', NULL, 1, 'active'
    )
    ON CONFLICT (id) DO NOTHING
  `;
  await sql`
    INSERT INTO workflow_template_items (
      id, template_id, stage_key, title, item_type, is_required, position
    )
    VALUES
      ('workflow-item-intake-scope-v1', 'workflow-jra-core-v1', 'intake',
       'Engagement scope confirmed', 'approval', TRUE, 10),
      ('workflow-item-intake-record-v1', 'workflow-jra-core-v1', 'intake',
       'Client and property record verified', 'requirement', TRUE, 20),
      ('workflow-item-assessment-evidence-v1', 'workflow-jra-core-v1', 'assessment',
       'Assessment evidence uploaded', 'deliverable', TRUE, 10),
      ('workflow-item-assessment-findings-v1', 'workflow-jra-core-v1', 'assessment',
       'Assessment findings reviewed', 'approval', TRUE, 20),
      ('workflow-item-review-recommendation-v1', 'workflow-jra-core-v1', 'review',
       'Advisory recommendation approved', 'approval', TRUE, 10),
      ('workflow-item-vendor-scope-v1', 'workflow-jra-core-v1', 'vendor_evaluation',
       'Vendor scope and credentials reviewed', 'approval', TRUE, 10),
      ('workflow-item-oversight-progress-v1', 'workflow-jra-core-v1', 'oversight',
       'Field progress documented', 'deliverable', TRUE, 10),
      ('workflow-item-clearance-evidence-v1', 'workflow-jra-core-v1', 'clearance',
       'Clearance evidence reviewed and published', 'deliverable', TRUE, 10),
      ('workflow-item-closed-file-v1', 'workflow-jra-core-v1', 'closed',
       'Final engagement file reviewed', 'approval', TRUE, 10)
    ON CONFLICT (id) DO NOTHING
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS engagement_workflow_items (
      id                   TEXT PRIMARY KEY,
      matter_id            TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
      template_id          TEXT REFERENCES workflow_templates(id) ON DELETE SET NULL,
      template_item_id     TEXT REFERENCES workflow_template_items(id) ON DELETE SET NULL,
      template_version     INTEGER,
      stage_key            TEXT NOT NULL,
      title                TEXT NOT NULL,
      item_type            TEXT NOT NULL DEFAULT 'requirement'
        CHECK (item_type IN ('requirement', 'deliverable', 'approval')),
      is_required          BOOLEAN NOT NULL DEFAULT TRUE,
      status               TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'waived')),
      assignee_user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
      due_date             DATE,
      evidence_document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
      blocker_reason       TEXT,
      completed_by         TEXT REFERENCES users(id) ON DELETE SET NULL,
      completed_at         TIMESTAMPTZ,
      approved_by          TEXT REFERENCES users(id) ON DELETE SET NULL,
      approved_at          TIMESTAMPTZ,
      position             INTEGER NOT NULL DEFAULT 0,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS engagement_workflow_matter_stage_idx
    ON engagement_workflow_items (matter_id, stage_key, position)
  `;
  await sql`
    INSERT INTO engagement_workflow_items (
      id, matter_id, template_id, template_item_id, template_version,
      stage_key, title, item_type, is_required, position
    )
    SELECT
      gen_random_uuid()::TEXT,
      matter.id,
      template.id,
      item.id,
      template.version,
      item.stage_key,
      item.title,
      item.item_type,
      item.is_required,
      item.position
    FROM matters matter
    JOIN workflow_templates template
      ON template.id = 'workflow-jra-core-v1'
    JOIN workflow_template_items item
      ON item.template_id = template.id
    WHERE NOT EXISTS (
      SELECT 1
      FROM engagement_workflow_items existing
      WHERE existing.matter_id = matter.id
        AND existing.template_item_id = item.id
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS engagement_tasks (
      id               TEXT PRIMARY KEY,
      matter_id        TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
      workflow_item_id TEXT REFERENCES engagement_workflow_items(id) ON DELETE SET NULL,
      stage_key        TEXT,
      title            TEXT NOT NULL,
      description      TEXT,
      status           TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
      priority         TEXT NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
      assignee_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      due_date         DATE,
      audience         TEXT NOT NULL DEFAULT 'internal'
        CHECK (audience IN ('internal', 'contractor', 'client')),
      position         INTEGER NOT NULL DEFAULT 0,
      completed_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
      completed_at     TIMESTAMPTZ,
      created_by       TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS engagement_tasks_assignee_due_idx
    ON engagement_tasks (assignee_user_id, status, due_date)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS engagement_tasks_matter_idx
    ON engagement_tasks (matter_id, status, position)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS saved_views (
      id             TEXT PRIMARY KEY,
      owner_user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      module         TEXT NOT NULL,
      name           TEXT NOT NULL,
      view_type      TEXT NOT NULL DEFAULT 'table'
        CHECK (view_type IN ('table', 'kanban', 'calendar', 'workload')),
      filters        JSONB NOT NULL DEFAULT '{}'::JSONB,
      sorting        JSONB NOT NULL DEFAULT '[]'::JSONB,
      grouping       JSONB,
      columns        JSONB NOT NULL DEFAULT '[]'::JSONB,
      sharing        TEXT NOT NULL DEFAULT 'private'
        CHECK (sharing IN ('private', 'workspace')),
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS saved_views_owner_module_idx
    ON saved_views (owner_user_id, module, updated_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS engagement_messages (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      matter_id   TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
      sender_id   TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      body        TEXT NOT NULL,
      audience    TEXT NOT NULL CHECK (audience IN ('internal', 'contractor', 'client')),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS engagement_messages_matter_created_idx
    ON engagement_messages (matter_id, created_at)
  `;
  await sql`ALTER TABLE engagement_messages ADD COLUMN IF NOT EXISTS subject TEXT`;
  await sql`ALTER TABLE engagement_messages ADD COLUMN IF NOT EXISTS thread_id TEXT`;
  await sql`ALTER TABLE engagement_messages ADD COLUMN IF NOT EXISTS parent_message_id TEXT REFERENCES engagement_messages(id) ON DELETE SET NULL`;
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS message_id TEXT REFERENCES engagement_messages(id) ON DELETE SET NULL`;
  await sql`
    CREATE INDEX IF NOT EXISTS documents_message_created_idx
    ON documents (message_id, created_at)
    WHERE message_id IS NOT NULL
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS message_read_receipts (
      message_id TEXT NOT NULL REFERENCES engagement_messages(id) ON DELETE CASCADE,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      read_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (message_id, user_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS notification_deliveries (
      id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
      matter_id       TEXT REFERENCES matters(id) ON DELETE CASCADE,
      event_type      TEXT NOT NULL,
      recipient_email TEXT NOT NULL,
      status          TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
      provider_id     TEXT,
      error_code      TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS portal_notifications (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      matter_id   TEXT REFERENCES matters(id) ON DELETE CASCADE,
      event_type  TEXT NOT NULL,
      title       TEXT NOT NULL,
      body        TEXT NOT NULL,
      href        TEXT NOT NULL,
      read_at     TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS portal_notifications_user_created_idx
    ON portal_notifications (user_id, created_at DESC)
  `;
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ`;
  await sql`
    CREATE TABLE IF NOT EXISTS document_versions (
      id            TEXT PRIMARY KEY,
      document_id   TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      blob_pathname TEXT NOT NULL UNIQUE,
      original_name TEXT NOT NULL,
      size_bytes    BIGINT,
      content_type  TEXT,
      uploaded_by   TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (document_id, version_number)
    )
  `;
  await sql`
    INSERT INTO document_versions (
      id, document_id, version_number, blob_pathname, original_name,
      size_bytes, content_type, uploaded_by, created_at
    )
    SELECT
      gen_random_uuid()::TEXT, document.id, 1, document.blob_pathname,
      document.original_name, document.size_bytes, document.content_type,
      document.uploaded_by, document.created_at
    FROM documents document
    WHERE NOT EXISTS (
      SELECT 1 FROM document_versions version
      WHERE version.document_id = document.id
    )
    ON CONFLICT (blob_pathname) DO NOTHING
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS portal_automations (
      id             TEXT PRIMARY KEY,
      recipe_key     TEXT NOT NULL UNIQUE,
      name           TEXT NOT NULL,
      description    TEXT NOT NULL,
      trigger_type   TEXT NOT NULL,
      action_type    TEXT NOT NULL,
      enabled        BOOLEAN NOT NULL DEFAULT FALSE,
      owner_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
      configuration  JSONB NOT NULL DEFAULT '{}'::JSONB,
      updated_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS automation_runs (
      id             TEXT PRIMARY KEY,
      automation_id  TEXT NOT NULL REFERENCES portal_automations(id) ON DELETE CASCADE,
      matter_id      TEXT REFERENCES matters(id) ON DELETE CASCADE,
      source_key     TEXT NOT NULL,
      status         TEXT NOT NULL
        CHECK (status IN ('running', 'succeeded', 'failed', 'skipped')),
      result          JSONB NOT NULL DEFAULT '{}'::JSONB,
      error_message   TEXT,
      started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at    TIMESTAMPTZ,
      UNIQUE (automation_id, source_key)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS automation_runs_started_idx
    ON automation_runs (started_at DESC)
  `;
  await sql`
    INSERT INTO portal_automations (
      id, recipe_key, name, description, trigger_type, action_type, configuration
    )
    VALUES
      ('automation-client-message', 'client_message_task', 'Client message follow-up',
       'Create an owned internal task when a client sends a new message.',
       'client_message_received', 'create_task', '{"dueInDays": 1}'::JSONB),
      ('automation-document-review', 'document_review_task', 'Document publication review',
       'Create an owned review task when a contractor uploads a client-facing document.',
       'document_review_requested', 'create_task', '{"dueInDays": 1}'::JSONB),
      ('automation-stage-transition', 'stage_transition_task', 'Stage transition review',
       'Create an owned internal review task after an engagement advances.',
       'stage_advanced', 'create_task', '{"dueInDays": 2}'::JSONB),
      ('automation-overdue-task', 'overdue_task_alert', 'Overdue task alert',
       'Notify the responsible operator once when assigned work becomes overdue.',
       'daily_schedule', 'notify_owner', '{}'::JSONB),
      ('automation-invoice-reminder', 'invoice_reminder', 'Overdue invoice reminder',
       'Mark issued invoices overdue and send one client reminder.',
       'daily_schedule', 'notify_client', '{}'::JSONB)
    ON CONFLICT (recipe_key) DO NOTHING
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS engagement_contracts (
      id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      matter_id             TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
      contract_number       TEXT NOT NULL UNIQUE,
      title                 TEXT NOT NULL,
      status                TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'issued', 'accepted', 'void')),
      original_amount_cents BIGINT NOT NULL DEFAULT 0 CHECK (original_amount_cents >= 0),
      currency              TEXT NOT NULL DEFAULT 'usd',
      issued_at             TIMESTAMPTZ,
      accepted_at           TIMESTAMPTZ,
      created_by            TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS invoices (
      id                         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      matter_id                  TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
      contract_id                TEXT REFERENCES engagement_contracts(id) ON DELETE SET NULL,
      invoice_number             TEXT NOT NULL UNIQUE,
      status                     TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'issued', 'processing', 'paid', 'void', 'overdue')),
      currency                   TEXT NOT NULL DEFAULT 'usd',
      subtotal_cents             BIGINT NOT NULL CHECK (subtotal_cents >= 0),
      total_cents                BIGINT NOT NULL CHECK (total_cents >= 0),
      due_date                   DATE,
      issued_at                  TIMESTAMPTZ,
      paid_at                    TIMESTAMPTZ,
      stripe_checkout_session_id TEXT UNIQUE,
      stripe_payment_intent_id   TEXT,
      created_by                 TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS invoice_line_items (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      invoice_id  TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
      unit_amount_cents BIGINT NOT NULL CHECK (unit_amount_cents >= 0),
      position    INTEGER NOT NULL DEFAULT 0
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS payments (
      id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      invoice_id               TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      provider                 TEXT NOT NULL DEFAULT 'stripe',
      provider_payment_id      TEXT NOT NULL UNIQUE,
      amount_cents             BIGINT NOT NULL CHECK (amount_cents >= 0),
      currency                 TEXT NOT NULL DEFAULT 'usd',
      status                   TEXT NOT NULL
        CHECK (status IN ('processing', 'succeeded', 'failed', 'refunded')),
      received_at              TIMESTAMPTZ,
      created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS change_orders (
      id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      matter_id           TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
      source_contract_id  TEXT REFERENCES engagement_contracts(id) ON DELETE RESTRICT,
      source_invoice_id   TEXT REFERENCES invoices(id) ON DELETE RESTRICT,
      change_order_number TEXT NOT NULL UNIQUE,
      title               TEXT NOT NULL,
      description         TEXT NOT NULL,
      amount_cents        BIGINT NOT NULL CHECK (amount_cents >= 0),
      currency            TEXT NOT NULL DEFAULT 'usd',
      status              TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'issued', 'accepted', 'rejected', 'void')),
      issued_at           TIMESTAMPTZ,
      accepted_at         TIMESTAMPTZ,
      accepted_by         TEXT REFERENCES users(id) ON DELETE SET NULL,
      supplemental_invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
      created_by          TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (source_contract_id IS NOT NULL OR source_invoice_id IS NOT NULL)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS stripe_webhook_events (
      event_id    TEXT PRIMARY KEY,
      event_type  TEXT NOT NULL,
      processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await markSchemaVersion(version);
}

/** Log a matter timeline event. Fire-and-forget — does not throw. */
export async function logMatterEvent(opts: {
  matterId: string;
  userId: string;
  eventType: MatterEventType;
  content?: string;
  metadata?: Record<string, unknown>;
  visibility?: "internal" | "contractor" | "client";
}) {
  try {
    const sql = getDb();
    const id = crypto.randomUUID();
    await sql`
      INSERT INTO matter_events (id, matter_id, user_id, event_type, content, metadata, visibility)
      VALUES (
        ${id},
        ${opts.matterId},
        ${opts.userId},
        ${opts.eventType},
        ${opts.content ?? null},
        ${opts.metadata ? JSON.stringify(opts.metadata) : null},
        ${opts.visibility ?? "internal"}
      )
    `;
  } catch {
    console.error("matter_event.log.failed", opts);
  }
}

/** Log a file access event. Fire-and-forget — does not throw. */
export async function logFileAccess(opts: {
  documentId: string;
  userId: string;
  eventType: AccessEventType;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    const sql = getDb();
    const id = crypto.randomUUID();
    await sql`
      INSERT INTO file_access_events (id, document_id, user_id, event_type, ip_address, user_agent)
      VALUES (${id}, ${opts.documentId}, ${opts.userId}, ${opts.eventType}, ${opts.ipAddress ?? null}, ${opts.userAgent ?? null})
    `;
  } catch {
    console.error("audit.log.failed", opts);
  }
}
