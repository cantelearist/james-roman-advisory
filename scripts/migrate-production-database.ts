import { assertProductionMigrationEnvironment } from "../src/lib/production-database-migration";
import { REQUIRED_SCHEMA_VERSIONS } from "../src/lib/schema-migration-manifest";

async function main() {
  const config = assertProductionMigrationEnvironment(process.env);

  // The legacy compatibility functions still read DATABASE_URL. Assign it only
  // after every protected-workflow and target attestation has passed.
  process.env.DATABASE_URL = config.databaseUrl;

  const {
    applySchemaMigrations,
    getAppliedSchemaVersions,
  } = await import("../src/lib/schema-migrations");

  const appliedBefore = await getAppliedSchemaVersions();
  const appliedSet = new Set(appliedBefore);
  const missingBefore = REQUIRED_SCHEMA_VERSIONS.filter(
    (version) => !appliedSet.has(version),
  );

  if (config.mode === "preflight") {
    console.log(
      `Production migration preflight: ${REQUIRED_SCHEMA_VERSIONS.length - missingBefore.length}/${REQUIRED_SCHEMA_VERSIONS.length} required versions present.`,
    );
    console.log(
      missingBefore.length === 0
        ? "Production migration preflight: no migrations are pending."
        : `Production migration preflight: pending versions: ${missingBefore.join(", ")}.`,
    );
    return;
  }

  const result = await applySchemaMigrations();
  console.log(
    `Production schema migrations verified at ${config.expectedSha}: ${result.requiredVersions.length}/${result.requiredVersions.length}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
