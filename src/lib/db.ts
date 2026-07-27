import { neon } from "@neondatabase/serverless";

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

export async function ensureAuthTables() {
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
export async function ensureVaultTables() {
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
  "messages.view",
  "messages.send",
] as const;

/**
 * Ensures the hybrid role/capability model exists and backfills legacy client
 * ownership into explicit engagement memberships.
 */
export async function ensureAccessControlTables() {
  await ensureAuthTables();
  await ensureVaultTables();
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
}

/** Ensures engagement correspondence, billing, and amendment records exist. */
export async function ensureEngagementOperationsTables() {
  await ensureAccessControlTables();
  const sql = getDb();

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
