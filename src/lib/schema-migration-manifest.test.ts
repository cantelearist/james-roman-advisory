import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { RLS_TABLE_NAMES } from "@/lib/rls-readiness";
import {
  REQUIRED_SCHEMA_VERSIONS,
  SCHEMA_MIGRATION_MANIFEST,
} from "@/lib/schema-migration-manifest";

describe("schema migration manifest", () => {
  it("assigns every application table to exactly one ordered migration", () => {
    const migratedTables = SCHEMA_MIGRATION_MANIFEST.flatMap(
      ({ tables }) => tables,
    ).sort();
    const expectedTables = RLS_TABLE_NAMES.filter(
      (table) => table !== "app_schema_versions",
    ).sort();

    expect(new Set(migratedTables).size).toBe(migratedTables.length);
    expect(migratedTables).toEqual(expectedTables);
  });

  it("uses unique immutable version identifiers", () => {
    expect(new Set(REQUIRED_SCHEMA_VERSIONS).size).toBe(
      REQUIRED_SCHEMA_VERSIONS.length,
    );
    for (const version of REQUIRED_SCHEMA_VERSIONS) {
      expect(version).toMatch(/^\d{4}-\d{2}-\d{2}-[a-z-]+-v\d+$/);
    }
  });

  it("binds every version identifier to the migration implementation", () => {
    const databaseSource = readFileSync(
      resolve(process.cwd(), "src/lib/db.ts"),
      "utf8",
    );
    const migrationSource = readFileSync(
      resolve(process.cwd(), "src/lib/schema-migrations.ts"),
      "utf8",
    );
    const implementationSource = `${databaseSource}\n${migrationSource}`;

    for (const { domain } of SCHEMA_MIGRATION_MANIFEST) {
      expect(implementationSource).toContain(
        `SCHEMA_MIGRATION_VERSIONS.${domain}`,
      );
    }
  });
});
