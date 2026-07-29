import { neon } from "@neondatabase/serverless";

import {
  assertProductionRuntimeRoleEnvironment,
  PRODUCTION_RUNTIME_ROLE_NAME,
} from "../src/lib/production-runtime-role";

const QUOTED_RUNTIME_ROLE = `"${PRODUCTION_RUNTIME_ROLE_NAME}"`;

async function main() {
  const config = assertProductionRuntimeRoleEnvironment(process.env);
  if (config.mode !== "provision") {
    throw new Error(
      "Production runtime role cleanup refused: cleanup requires provision mode.",
    );
  }

  const sql = neon(config.databaseUrl);
  const [role] = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = ${PRODUCTION_RUNTIME_ROLE_NAME}
    ) AS exists
  `;
  if (!role?.exists) {
    console.log(
      "Production runtime role was not present; no failure cleanup needed.",
    );
    return;
  }

  const [ownership] = await sql`
    SELECT COUNT(*)::INT AS count
    FROM pg_class
    WHERE relowner = (
      SELECT oid
      FROM pg_roles
      WHERE rolname = ${PRODUCTION_RUNTIME_ROLE_NAME}
    )
  `;
  if (ownership?.count !== 0) {
    throw new Error(
      "Production runtime role cleanup refused: the role owns relations.",
    );
  }

  await sql.query(`GRANT ${QUOTED_RUNTIME_ROLE} TO CURRENT_USER`);
  await sql.query(`DROP OWNED BY ${QUOTED_RUNTIME_ROLE}`);
  await sql.query(`REVOKE ${QUOTED_RUNTIME_ROLE} FROM CURRENT_USER`);
  await sql.query(`DROP ROLE ${QUOTED_RUNTIME_ROLE}`);
  console.log("Removed the failed production runtime role.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
