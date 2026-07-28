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
  REQUIRED_SCHEMA_VERSIONS,
  SCHEMA_MIGRATION_MANIFEST,
  SCHEMA_MIGRATION_VERSIONS,
  type SchemaMigrationDomain,
} from "./schema-migration-manifest";

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

export type SchemaMigrationResult = {
  appliedVersions: string[];
  requiredVersions: string[];
};

export async function getAppliedSchemaVersions(): Promise<string[]> {
  const sql = getDb();
  const [catalog] = await sql`
    SELECT to_regclass('public.app_schema_versions')::TEXT AS relation
  `;

  if (!catalog?.relation) return [];

  const rows = await sql`
    SELECT version
    FROM app_schema_versions
    ORDER BY version
  `;
  return rows.map(({ version }) => String(version));
}

export async function assertRequiredSchemaVersions(): Promise<SchemaMigrationResult> {
  const appliedVersions = await getAppliedSchemaVersions();
  const applied = new Set(appliedVersions);
  const missingVersions = REQUIRED_SCHEMA_VERSIONS.filter(
    (version) => !applied.has(version),
  );

  if (missingVersions.length > 0) {
    throw new Error(
      [
        "Database schema is incomplete.",
        `Missing migrations: ${missingVersions.join(", ")}.`,
        "Run the protected schema migration job before deploying this application version.",
      ].join(" "),
    );
  }

  return {
    appliedVersions,
    requiredVersions: [...REQUIRED_SCHEMA_VERSIONS],
  };
}

export async function applySchemaMigrations(): Promise<SchemaMigrationResult> {
  await ensureMigrationLedger();

  for (const migration of SCHEMA_MIGRATION_MANIFEST) {
    await MIGRATION_HANDLERS[migration.domain]();
  }

  return assertRequiredSchemaVersions();
}
