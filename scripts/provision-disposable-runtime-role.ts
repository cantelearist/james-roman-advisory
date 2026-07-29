import { appendFile } from "node:fs/promises";

import { neon } from "@neondatabase/serverless";

import { assertDisposableDatabaseEnvironment } from "../src/lib/disposable-database";
import {
  createDisposableRuntimeDatabaseUrl,
  getDisposableRuntimeRoleName,
  quotePostgresIdentifier,
} from "../src/lib/disposable-runtime-role";

function requireGitHubEnvironmentFile(): string {
  const path = process.env.GITHUB_ENV?.trim();
  if (!path) {
    throw new Error(
      "Disposable runtime role safety check failed: GITHUB_ENV is required.",
    );
  }
  return path;
}

async function main() {
  const config = assertDisposableDatabaseEnvironment(process.env);
  const githubEnvironmentFile = requireGitHubEnvironmentFile();
  const roleName = getDisposableRuntimeRoleName(config.branchId);
  const quotedRoleName = quotePostgresIdentifier(roleName);
  const runtimeDatabaseUrl = createDisposableRuntimeDatabaseUrl(
    config.databaseUrl,
    roleName,
  );
  const runtimePassword = new URL(runtimeDatabaseUrl).password;
  const sql = neon(config.databaseUrl);

  console.log(`::add-mask::${runtimePassword}`);
  console.log(`::add-mask::${runtimeDatabaseUrl}`);

  const [database] = await sql`SELECT current_database() AS name`;
  const databaseName = String(database?.name ?? "");
  const quotedDatabaseName = quotePostgresIdentifier(databaseName);

  const [existingRole] = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = ${roleName}
    ) AS exists
  `;
  if (existingRole?.exists) {
    throw new Error(
      "Disposable runtime role safety check failed: the derived role already exists.",
    );
  }

  const quotedPassword = `'${runtimePassword}'`;
  await sql.query(
    `CREATE ROLE ${quotedRoleName}
      LOGIN
      PASSWORD ${quotedPassword}
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOREPLICATION
      NOBYPASSRLS`,
  );
  await sql.query(`GRANT CONNECT ON DATABASE ${quotedDatabaseName} TO ${quotedRoleName}`);
  await sql.query(`GRANT USAGE ON SCHEMA public TO ${quotedRoleName}`);
  await sql.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${quotedRoleName}`,
  );
  await sql.query(
    `REVOKE INSERT, UPDATE, DELETE ON TABLE public.app_schema_versions FROM ${quotedRoleName}`,
  );
  await sql.query(
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${quotedRoleName}`,
  );

  await appendFile(
    githubEnvironmentFile,
    [
      `INTEGRATION_RUNTIME_DATABASE_URL=${runtimeDatabaseUrl}`,
      `INTEGRATION_RUNTIME_DATABASE_ROLE=${roleName}`,
      "",
    ].join("\n"),
    { encoding: "utf8", mode: 0o600 },
  );

  console.log(
    `Provisioned a disposable least-privilege runtime login for ${config.branchName}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
