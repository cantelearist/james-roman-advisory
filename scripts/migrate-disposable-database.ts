import { assertDisposableDatabaseEnvironment } from "../src/lib/disposable-database";

async function main() {
  const config = assertDisposableDatabaseEnvironment(process.env);

  // The existing compatibility migration functions read DATABASE_URL. This
  // assignment is process-local and only happens after disposable-branch
  // attestation succeeds.
  process.env.DATABASE_URL = config.databaseUrl;

  const { applySchemaMigrations } = await import("../src/lib/schema-migrations");
  const result = await applySchemaMigrations();

  console.log(
    `Schema migrations verified on disposable branch ${config.branchName}: ${result.requiredVersions.length}/${result.requiredVersions.length}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
