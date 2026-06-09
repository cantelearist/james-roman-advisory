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
      role        TEXT NOT NULL CHECK (role IN ('client', 'advisor', 'admin')),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
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

  // clients — one row per client; clerk_user_id nullable (set after invite accepted)
  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      clerk_user_id TEXT UNIQUE,
      name          TEXT NOT NULL,
      email         TEXT,
      phone         TEXT,
      notes         TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
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
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
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
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
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

/** Log a matter timeline event. Fire-and-forget — does not throw. */
export async function logMatterEvent(opts: {
  matterId: string;
  userId: string;
  eventType: MatterEventType;
  content?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const sql = getDb();
    const id = crypto.randomUUID();
    await sql`
      INSERT INTO matter_events (id, matter_id, user_id, event_type, content, metadata)
      VALUES (
        ${id},
        ${opts.matterId},
        ${opts.userId},
        ${opts.eventType},
        ${opts.content ?? null},
        ${opts.metadata ? JSON.stringify(opts.metadata) : null}
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
