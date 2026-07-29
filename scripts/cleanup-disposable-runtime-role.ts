import { neon } from "@neondatabase/serverless";

import { assertDisposableDatabaseEnvironment } from "../src/lib/disposable-database";
import {
  getDisposableRuntimeRoleName,
  quotePostgresIdentifier,
} from "../src/lib/disposable-runtime-role";

async function main() {
  const config = assertDisposableDatabaseEnvironment(process.env);
  const roleName = getDisposableRuntimeRoleName(config.branchId);
  const quotedRoleName = quotePostgresIdentifier(roleName);
  const sql = neon(config.databaseUrl);

  const [role] = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = ${roleName}
    ) AS exists
  `;
  if (!role?.exists) {
    console.log("Disposable runtime login was not present; no role cleanup needed.");
    return;
  }

  await sql.query(`DROP OWNED BY ${quotedRoleName}`);
  await sql.query(`REVOKE ${quotedRoleName} FROM CURRENT_USER`);
  await sql.query(`DROP ROLE ${quotedRoleName}`);
  console.log(`Removed the disposable runtime login for ${config.branchName}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
