import {
  neon,
  type NeonQueryFunction,
} from "@neondatabase/serverless";

import {
  assertProductionRuntimeRoleEnvironment,
  PRODUCTION_RUNTIME_ROLE_NAME,
} from "../src/lib/production-runtime-role";
import {
  REQUIRED_SCHEMA_VERSIONS,
  SCHEMA_MIGRATION_MANIFEST,
} from "../src/lib/schema-migration-manifest";

const APP_TABLE_NAMES = [
  "app_schema_versions",
  ...SCHEMA_MIGRATION_MANIFEST.flatMap(({ tables }) => tables),
].sort();
const QUOTED_RUNTIME_ROLE = `"${PRODUCTION_RUNTIME_ROLE_NAME}"`;

function quoteDatabaseName(databaseName: string): string {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(databaseName)) {
    throw new Error(
      "Production runtime role safety check failed: database identifier is invalid.",
    );
  }
  return `"${databaseName}"`;
}

function postgresErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object"
    && error !== null
    && "code" in error
    && typeof error.code === "string"
  ) {
    return error.code;
  }
  return undefined;
}

async function assertStatementDenied(
  sql: NeonQueryFunction<false, false>,
  statement: string,
): Promise<void> {
  try {
    await sql.transaction([
      sql.query(statement),
      sql`SELECT 1 / 0 AS force_transaction_rollback`,
    ]);
  } catch (error) {
    if (postgresErrorCode(error) === "42501") return;
    throw error;
  }
  throw new Error(
    "Production runtime role validation failed: a forbidden statement succeeded.",
  );
}

async function validateRuntimeCredential(
  runtimeDatabaseUrl: string,
): Promise<void> {
  const sql = neon(runtimeDatabaseUrl);
  const [role] = await sql`
    SELECT
      current_user AS current_user,
      rolsuper,
      rolcreaterole,
      rolcreatedb,
      rolinherit,
      rolreplication,
      rolbypassrls
    FROM pg_roles
    WHERE rolname = CURRENT_USER
  `;
  if (
    role?.current_user !== PRODUCTION_RUNTIME_ROLE_NAME
    || role.rolsuper
    || role.rolcreaterole
    || role.rolcreatedb
    || role.rolinherit
    || role.rolreplication
    || role.rolbypassrls
  ) {
    throw new Error(
      "Production runtime role validation failed: unsafe role attributes.",
    );
  }

  const [privileges] = await sql`
    SELECT
      has_database_privilege(
        CURRENT_USER,
        current_database(),
        'CONNECT'
      ) AS can_connect,
      has_database_privilege(
        CURRENT_USER,
        current_database(),
        'CREATE'
      ) AS can_create_database_objects,
      has_schema_privilege(
        CURRENT_USER,
        'public',
        'USAGE'
      ) AS can_use_public,
      has_schema_privilege(
        CURRENT_USER,
        'public',
        'CREATE'
      ) AS can_create_in_public
  `;
  if (
    !privileges?.can_connect
    || privileges.can_create_database_objects
    || !privileges.can_use_public
    || privileges.can_create_in_public
  ) {
    throw new Error(
      "Production runtime role validation failed: unsafe database or schema privileges.",
    );
  }

  const [ownership] = await sql`
    SELECT COUNT(*)::INT AS count
    FROM pg_class
    WHERE relowner = (
      SELECT oid
      FROM pg_roles
      WHERE rolname = CURRENT_USER
    )
  `;
  if (ownership?.count !== 0) {
    throw new Error(
      "Production runtime role validation failed: runtime role owns relations.",
    );
  }

  const [memberships] = await sql`
    SELECT COUNT(*)::INT AS count
    FROM pg_auth_members
    WHERE member = (
      SELECT oid
      FROM pg_roles
      WHERE rolname = CURRENT_USER
    )
  `;
  if (memberships?.count !== 0) {
    throw new Error(
      "Production runtime role validation failed: runtime role inherits another role.",
    );
  }

  const versions = await sql`
    SELECT version
    FROM app_schema_versions
    ORDER BY version
  `;
  const appliedVersions = new Set(
    versions.map(({ version }) => String(version)),
  );
  const missingVersions = REQUIRED_SCHEMA_VERSIONS.filter(
    (version) => !appliedVersions.has(version),
  );
  if (missingVersions.length > 0) {
    throw new Error(
      "Production runtime role validation failed: required schema versions are missing.",
    );
  }

  const tablePrivileges = await sql`
    SELECT
      c.relname AS table_name,
      has_table_privilege(CURRENT_USER, c.oid, 'SELECT') AS can_select,
      has_table_privilege(CURRENT_USER, c.oid, 'INSERT') AS can_insert,
      has_table_privilege(CURRENT_USER, c.oid, 'UPDATE') AS can_update,
      has_table_privilege(CURRENT_USER, c.oid, 'DELETE') AS can_delete,
      has_table_privilege(CURRENT_USER, c.oid, 'TRUNCATE') AS can_truncate,
      has_table_privilege(CURRENT_USER, c.oid, 'REFERENCES') AS can_reference,
      has_table_privilege(CURRENT_USER, c.oid, 'TRIGGER') AS can_trigger
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname = ANY(${APP_TABLE_NAMES})
    ORDER BY c.relname
  `;
  if (
    tablePrivileges.length !== APP_TABLE_NAMES.length
    || tablePrivileges.some((row) => (
      !row.can_select
      || row.can_insert !== (row.table_name !== "app_schema_versions")
      || row.can_update !== (row.table_name !== "app_schema_versions")
      || row.can_delete !== (row.table_name !== "app_schema_versions")
      || row.can_truncate
      || row.can_reference
      || row.can_trigger
    ))
  ) {
    throw new Error(
      "Production runtime role validation failed: application table privilege matrix mismatch.",
    );
  }

  const [rls] = await sql`
    SELECT COUNT(*)::INT AS enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY(${APP_TABLE_NAMES})
      AND c.relrowsecurity
  `;
  if (rls?.enabled !== 0) {
    throw new Error(
      "Production runtime role validation failed: RLS changed during the credential-only stage.",
    );
  }

  await assertStatementDenied(
    sql,
    "CREATE TABLE production_runtime_forbidden (id TEXT PRIMARY KEY)",
  );
  await assertStatementDenied(
    sql,
    "ALTER TABLE consultations ADD COLUMN production_runtime_forbidden TEXT",
  );
  await assertStatementDenied(
    sql,
    "CREATE ROLE production_runtime_forbidden NOLOGIN",
  );
}

async function main() {
  const config = assertProductionRuntimeRoleEnvironment(process.env);
  const owner = neon(config.databaseUrl);
  const [database] = await owner`SELECT current_database() AS name`;
  const databaseName = quoteDatabaseName(String(database?.name ?? ""));
  const [existingRole] = await owner`
    SELECT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = ${PRODUCTION_RUNTIME_ROLE_NAME}
    ) AS exists
  `;
  const versions = await owner`
    SELECT version
    FROM app_schema_versions
    ORDER BY version
  `;
  const appliedVersions = new Set(
    versions.map(({ version }) => String(version)),
  );
  const missingVersions = REQUIRED_SCHEMA_VERSIONS.filter(
    (version) => !appliedVersions.has(version),
  );
  if (missingVersions.length > 0) {
    throw new Error(
      "Production runtime role safety check failed: production schema is incomplete.",
    );
  }

  if (config.mode === "preflight") {
    if (existingRole?.exists) {
      throw new Error(
        "Production runtime role preflight failed: the target role already exists.",
      );
    }
    console.log(
      `Production runtime role preflight: ${REQUIRED_SCHEMA_VERSIONS.length}/${REQUIRED_SCHEMA_VERSIONS.length} schema versions present; target role absent.`,
    );
    console.log(
      `Runtime credential fingerprint: ${config.runtimeDatabaseFingerprint}`,
    );
    return;
  }

  if (existingRole?.exists) {
    throw new Error(
      "Production runtime role provisioning failed: the target role already exists.",
    );
  }

  const passwordLiteral = `'${config.runtimePassword}'`;
  await owner.transaction([
    owner.query(
      `CREATE ROLE ${QUOTED_RUNTIME_ROLE}
        LOGIN
        PASSWORD ${passwordLiteral}
        NOSUPERUSER
        NOCREATEDB
        NOCREATEROLE
        NOINHERIT
        NOREPLICATION
        NOBYPASSRLS`,
    ),
    owner.query(
      `GRANT CONNECT ON DATABASE ${databaseName} TO ${QUOTED_RUNTIME_ROLE}`,
    ),
    owner.query(`GRANT USAGE ON SCHEMA public TO ${QUOTED_RUNTIME_ROLE}`),
    owner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${QUOTED_RUNTIME_ROLE}`,
    ),
    owner.query(
      `REVOKE INSERT, UPDATE, DELETE ON TABLE public.app_schema_versions FROM ${QUOTED_RUNTIME_ROLE}`,
    ),
    owner.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${QUOTED_RUNTIME_ROLE}`,
    ),
  ]);

  await validateRuntimeCredential(config.runtimeDatabaseUrl);
  console.log(
    `Production runtime role verified: ${APP_TABLE_NAMES.length} application tables, ${REQUIRED_SCHEMA_VERSIONS.length}/${REQUIRED_SCHEMA_VERSIONS.length} schema versions, RLS unchanged.`,
  );
  console.log(
    `Runtime credential fingerprint: ${config.runtimeDatabaseFingerprint}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
