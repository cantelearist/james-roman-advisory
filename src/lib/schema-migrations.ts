import {
  ensureAccessControlTables,
  ensureAuthTables,
  ensureConsultationsTable,
  ensureEngagementOperationsTables,
  ensureUsersTable,
  ensureVaultTables,
  getDb,
} from "./db";
import {
  SCHEMA_MIGRATION_MANIFEST,
  SCHEMA_MIGRATION_VERSIONS,
  type SchemaMigrationDomain,
} from "./schema-migration-manifest";
import {
  assertRequiredSchemaVersions,
  type SchemaMigrationResult,
} from "./schema-readiness";

export {
  assertRequiredSchemaVersions,
  getAppliedSchemaVersions,
  type SchemaMigrationResult,
} from "./schema-readiness";

async function ensureMigrationLedger(): Promise<void> {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS app_schema_versions (
      version    TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function recordMigrationVersion(version: string): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO app_schema_versions (version)
    VALUES (${version})
    ON CONFLICT (version) DO NOTHING
  `;
}

const MIGRATION_HANDLERS: Record<SchemaMigrationDomain, () => Promise<void>> = {
  users: async () => {
    await ensureUsersTable();
    await recordMigrationVersion(SCHEMA_MIGRATION_VERSIONS.users);
  },
  auth: ensureAuthTables,
  consultations: async () => {
    await ensureConsultationsTable();
    await recordMigrationVersion(SCHEMA_MIGRATION_VERSIONS.consultations);
  },
  vault: ensureVaultTables,
  access: ensureAccessControlTables,
  operations: ensureEngagementOperationsTables,
};

export async function applySchemaMigrations(): Promise<SchemaMigrationResult> {
  await ensureMigrationLedger();

  for (const migration of SCHEMA_MIGRATION_MANIFEST) {
    await MIGRATION_HANDLERS[migration.domain]();
  }

  return assertRequiredSchemaVersions();
}
