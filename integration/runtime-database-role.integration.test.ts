import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { assertDisposableRuntimeRoleEnvironment } from "@/lib/disposable-runtime-role";
import {
  REQUIRED_SCHEMA_VERSIONS,
  SCHEMA_MIGRATION_MANIFEST,
} from "@/lib/schema-migration-manifest";

const APP_TABLE_NAMES = [
  "app_schema_versions",
  ...SCHEMA_MIGRATION_MANIFEST.flatMap(({ tables }) => tables),
].sort();

let runtimeDatabaseUrl = "";
let roleName = "";
let fixtureId = "";

beforeAll(() => {
  const config = assertDisposableRuntimeRoleEnvironment(process.env);
  runtimeDatabaseUrl = config.runtimeDatabaseUrl;
  roleName = config.roleName;
  fixtureId = `runtime-role-${crypto.randomUUID()}`;
  process.env.DATABASE_URL = runtimeDatabaseUrl;
});

afterAll(async () => {
  if (!runtimeDatabaseUrl || !fixtureId) return;

  const sql = neon(runtimeDatabaseUrl);
  await sql`DELETE FROM consultations WHERE id = ${fixtureId}`;
});

describe("real disposable runtime login", () => {
  it("has no administrative, ownership, database-create, or schema-create power", async () => {
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
    const [privileges] = await sql`
      SELECT
        has_database_privilege(CURRENT_USER, current_database(), 'CONNECT') AS can_connect,
        has_database_privilege(CURRENT_USER, current_database(), 'CREATE') AS can_create_database_objects,
        has_schema_privilege(CURRENT_USER, 'public', 'USAGE') AS can_use_public,
        has_schema_privilege(CURRENT_USER, 'public', 'CREATE') AS can_create_in_public
    `;
    const [ownership] = await sql`
      SELECT COUNT(*)::INT AS owned_relations
      FROM pg_class
      WHERE relowner = (
        SELECT oid
        FROM pg_roles
        WHERE rolname = CURRENT_USER
      )
    `;

    expect(role).toMatchObject({
      current_user: roleName,
      rolsuper: false,
      rolcreaterole: false,
      rolcreatedb: false,
      rolinherit: false,
      rolreplication: false,
      rolbypassrls: false,
    });
    expect(privileges).toEqual({
      can_connect: true,
      can_create_database_objects: false,
      can_use_public: true,
      can_create_in_public: false,
    });
    expect(ownership?.owned_relations).toBe(0);
  });

  it("can read the complete migration ledger without modifying it", async () => {
    const sql = neon(runtimeDatabaseUrl);
    const { assertRequiredSchemaVersions } = await import(
      "@/lib/schema-readiness"
    );
    const readiness = await assertRequiredSchemaVersions();
    const [privileges] = await sql`
      SELECT
        has_table_privilege(
          CURRENT_USER,
          'public.app_schema_versions',
          'SELECT'
        ) AS can_select,
        has_table_privilege(
          CURRENT_USER,
          'public.app_schema_versions',
          'INSERT, UPDATE, DELETE'
        ) AS can_mutate
    `;

    expect(readiness.appliedVersions).toEqual(
      expect.arrayContaining(REQUIRED_SCHEMA_VERSIONS),
    );
    expect(readiness.requiredVersions).toEqual(REQUIRED_SCHEMA_VERSIONS);
    expect(privileges).toEqual({
      can_select: true,
      can_mutate: false,
    });
  });

  it("has the application DML matrix on every application table", async () => {
    const sql = neon(runtimeDatabaseUrl);
    const rows = await sql`
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

    expect(rows.map(({ table_name }) => table_name)).toEqual(APP_TABLE_NAMES);
    for (const row of rows) {
      expect(row.can_select, `${row.table_name}: SELECT`).toBe(true);
      expect(row.can_insert, `${row.table_name}: INSERT`).toBe(
        row.table_name !== "app_schema_versions",
      );
      expect(row.can_update, `${row.table_name}: UPDATE`).toBe(
        row.table_name !== "app_schema_versions",
      );
      expect(row.can_delete, `${row.table_name}: DELETE`).toBe(
        row.table_name !== "app_schema_versions",
      );
      expect(row.can_truncate, `${row.table_name}: TRUNCATE`).toBe(false);
      expect(row.can_reference, `${row.table_name}: REFERENCES`).toBe(false);
      expect(row.can_trigger, `${row.table_name}: TRIGGER`).toBe(false);
    }
  });

  it("performs the read and write operations required by application routes", async () => {
    const sql = neon(runtimeDatabaseUrl);
    const referenceId = `JRA-RUNTIME-${crypto.randomUUID()}`;

    await sql`
      INSERT INTO consultations (
        id,
        reference_id,
        name,
        email,
        market,
        matter,
        message
      )
      VALUES (
        ${fixtureId},
        ${referenceId},
        'Runtime Role Fixture',
        'runtime-role@example.invalid',
        'Los Angeles',
        'other',
        'Disposable least-privilege verification'
      )
    `;
    const [inserted] = await sql`
      SELECT message
      FROM consultations
      WHERE id = ${fixtureId}
    `;
    await sql`
      UPDATE consultations
      SET message = 'Runtime role update verified'
      WHERE id = ${fixtureId}
    `;
    const [updated] = await sql`
      SELECT message
      FROM consultations
      WHERE id = ${fixtureId}
    `;
    await sql`DELETE FROM consultations WHERE id = ${fixtureId}`;
    const [deleted] = await sql`
      SELECT COUNT(*)::INT AS count
      FROM consultations
      WHERE id = ${fixtureId}
    `;

    expect(inserted?.message).toBe("Disposable least-privilege verification");
    expect(updated?.message).toBe("Runtime role update verified");
    expect(deleted?.count).toBe(0);
  });

  it.each([
    [
      "create tables",
      "CREATE TABLE integration_runtime_forbidden (id TEXT PRIMARY KEY)",
    ],
    [
      "alter application tables",
      "ALTER TABLE consultations ADD COLUMN integration_runtime_forbidden TEXT",
    ],
    [
      "create roles",
      "CREATE ROLE integration_runtime_forbidden NOLOGIN",
    ],
  ])("cannot %s", async (_label, statement) => {
    const sql = neon(runtimeDatabaseUrl);

    await expect(
      sql.transaction([
        sql.query(statement),
        sql`SELECT 1 / 0 AS force_transaction_rollback`,
      ]),
    ).rejects.toMatchObject({
      code: "42501",
    });
  });
});
