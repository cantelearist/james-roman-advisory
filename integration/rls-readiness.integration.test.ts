import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { assertDisposableDatabaseEnvironment } from "@/lib/disposable-database";
import { RLS_TABLE_NAMES } from "@/lib/rls-readiness";

const FIXTURE_ROLE = "integration_rls_runtime";
let databaseConfigured = false;

async function cleanupFixture() {
  const { getDb } = await import("@/lib/db");
  const sql = getDb();

  await sql`DROP TABLE IF EXISTS integration_rls_scope_fixture`;
  const [role] = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = ${FIXTURE_ROLE}
    ) AS exists
  `;
  if (role?.exists) {
    await sql`REVOKE integration_rls_runtime FROM CURRENT_USER`;
    await sql`DROP ROLE integration_rls_runtime`;
  }
}

beforeAll(async () => {
  const config = assertDisposableDatabaseEnvironment(process.env);
  process.env.DATABASE_URL = config.databaseUrl;
  databaseConfigured = true;

  const { ensureEngagementOperationsTables, getDb } = await import("@/lib/db");
  await ensureEngagementOperationsTables();
  await cleanupFixture();

  const sql = getDb();
  await sql`
    CREATE ROLE integration_rls_runtime
      NOLOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOREPLICATION
      NOBYPASSRLS
  `;
  await sql`GRANT integration_rls_runtime TO CURRENT_USER`;
  await sql`
    CREATE TABLE integration_rls_scope_fixture (
      id TEXT PRIMARY KEY,
      matter_id TEXT NOT NULL,
      payload TEXT NOT NULL
    )
  `;
  await sql`
    INSERT INTO integration_rls_scope_fixture (id, matter_id, payload)
    VALUES
      ('row-a', 'matter-a', 'allowed'),
      ('row-b', 'matter-b', 'blocked')
  `;
  await sql`ALTER TABLE integration_rls_scope_fixture ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE integration_rls_scope_fixture FORCE ROW LEVEL SECURITY`;
  await sql`
    CREATE POLICY integration_rls_scope_fixture_policy
      ON integration_rls_scope_fixture
      FOR ALL
      TO integration_rls_runtime
      USING (
        matter_id = NULLIF(current_setting('app.matter_id', TRUE), '')
      )
      WITH CHECK (
        matter_id = NULLIF(current_setting('app.matter_id', TRUE), '')
      )
  `;
  await sql`
    GRANT SELECT, INSERT
      ON integration_rls_scope_fixture
      TO integration_rls_runtime
  `;
});

afterAll(async () => {
  if (databaseConfigured) {
    await cleanupFixture();
  }
});

describe("RLS readiness on a disposable database", () => {
  it("matches the live public-schema inventory to the explicit classification", async () => {
    const { getDb } = await import("@/lib/db");
    const sql = getDb();
    const rows = await sql`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename <> 'integration_rls_scope_fixture'
      ORDER BY tablename
    `;

    expect(rows.map(({ tablename }) => tablename)).toEqual(
      [...RLS_TABLE_NAMES].sort(),
    );
  });

  it("records that the current migration owner bypasses RLS", async () => {
    const { getDb } = await import("@/lib/db");
    const sql = getDb();
    const [role] = await sql`
      SELECT rolbypassrls
      FROM pg_roles
      WHERE rolname = CURRENT_USER
    `;
    const ownerRows = await sql`
      SELECT id
      FROM integration_rls_scope_fixture
      ORDER BY id
    `;

    expect(role?.rolbypassrls).toBe(true);
    expect(ownerRows.map(({ id }) => id)).toEqual(["row-a", "row-b"]);
  });

  it("defaults the unprivileged runtime role to no rows without context", async () => {
    const { getDb } = await import("@/lib/db");
    const sql = getDb();
    const transaction = await sql.transaction((tx) => [
      tx`SET LOCAL ROLE integration_rls_runtime`,
      tx`SELECT id FROM integration_rls_scope_fixture ORDER BY id`,
    ]);

    expect(transaction[1]).toEqual([]);
  });

  it("keeps transaction-local scope from leaking across pooled requests", async () => {
    const { getDb } = await import("@/lib/db");
    const sql = getDb();
    const scopedTransaction = await sql.transaction((tx) => [
      tx`SET LOCAL ROLE integration_rls_runtime`,
      tx`SELECT set_config('app.matter_id', 'matter-a', TRUE)`,
      tx`SELECT id FROM integration_rls_scope_fixture ORDER BY id`,
    ]);
    const unscopedTransaction = await sql.transaction((tx) => [
      tx`SET LOCAL ROLE integration_rls_runtime`,
      tx`SELECT id FROM integration_rls_scope_fixture ORDER BY id`,
    ]);

    expect(scopedTransaction[2]).toEqual([{ id: "row-a" }]);
    expect(unscopedTransaction[1]).toEqual([]);
  });

  it("allows in-scope writes and rejects cross-scope writes", async () => {
    const { getDb } = await import("@/lib/db");
    const sql = getDb();
    await sql.transaction((tx) => [
      tx`SET LOCAL ROLE integration_rls_runtime`,
      tx`SELECT set_config('app.matter_id', 'matter-a', TRUE)`,
      tx`
        INSERT INTO integration_rls_scope_fixture (id, matter_id, payload)
        VALUES ('row-a-2', 'matter-a', 'allowed')
      `,
    ]);

    await expect(
      sql.transaction((tx) => [
        tx`SET LOCAL ROLE integration_rls_runtime`,
        tx`SELECT set_config('app.matter_id', 'matter-a', TRUE)`,
        tx`
          INSERT INTO integration_rls_scope_fixture (id, matter_id, payload)
          VALUES ('row-b-2', 'matter-b', 'blocked')
        `,
      ]),
    ).rejects.toThrow(/row-level security/i);
  });
});
