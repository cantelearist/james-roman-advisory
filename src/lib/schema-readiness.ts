import { getDb } from "./db";
import { REQUIRED_SCHEMA_VERSIONS } from "./schema-migration-manifest";

export type SchemaMigrationResult = {
  appliedVersions: string[];
  requiredVersions: string[];
};

let readinessPromise: Promise<SchemaMigrationResult> | null = null;

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

async function inspectRequiredSchemaVersions(): Promise<SchemaMigrationResult> {
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

/**
 * Read-only runtime gate. A successful result is shared within a warm process
 * so nested authorization and route helpers do not repeatedly read the ledger.
 * Failures are not cached, allowing a process to recover after migrations run.
 */
export function assertRequiredSchemaVersions(): Promise<SchemaMigrationResult> {
  if (!readinessPromise) {
    readinessPromise = inspectRequiredSchemaVersions().catch((error) => {
      readinessPromise = null;
      throw error;
    });
  }
  return readinessPromise;
}
