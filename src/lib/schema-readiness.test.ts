import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { REQUIRED_SCHEMA_VERSIONS } from "@/lib/schema-migration-manifest";

const dbMocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: dbMocks.getDb,
}));

function ledgerSql(
  versions: readonly string[],
  options: { ledgerExists?: boolean } = {},
) {
  const ledgerExists = options.ledgerExists ?? true;
  return vi.fn(async (strings: TemplateStringsArray) => {
    const query = strings.join(" ");
    if (query.includes("to_regclass")) {
      return [{ relation: ledgerExists ? "app_schema_versions" : null }];
    }
    if (query.includes("SELECT version")) {
      return versions.map((version) => ({ version }));
    }
    throw new Error(`Unexpected schema-readiness query: ${query}`);
  });
}

describe("runtime schema readiness", () => {
  beforeEach(() => {
    vi.resetModules();
    dbMocks.getDb.mockReset();
  });

  it("returns no versions when the migration ledger is absent", async () => {
    dbMocks.getDb.mockReturnValue(
      ledgerSql([], { ledgerExists: false }),
    );
    const { getAppliedSchemaVersions } = await import("./schema-readiness");

    await expect(getAppliedSchemaVersions()).resolves.toEqual([]);
  });

  it("fails closed with the exact missing migration versions", async () => {
    const applied = REQUIRED_SCHEMA_VERSIONS.slice(0, -2);
    dbMocks.getDb.mockReturnValue(ledgerSql(applied));
    const { assertRequiredSchemaVersions } = await import("./schema-readiness");

    await expect(assertRequiredSchemaVersions()).rejects.toThrow(
      `Missing migrations: ${REQUIRED_SCHEMA_VERSIONS.slice(-2).join(", ")}`,
    );
  });

  it("shares a successful read-only assertion within a warm process", async () => {
    const sql = ledgerSql(REQUIRED_SCHEMA_VERSIONS);
    dbMocks.getDb.mockReturnValue(sql);
    const { assertRequiredSchemaVersions } = await import("./schema-readiness");

    const [first, second] = await Promise.all([
      assertRequiredSchemaVersions(),
      assertRequiredSchemaVersions(),
    ]);
    const third = await assertRequiredSchemaVersions();

    expect(first.requiredVersions).toEqual(REQUIRED_SCHEMA_VERSIONS);
    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed assertion", async () => {
    dbMocks.getDb
      .mockReturnValueOnce(ledgerSql([]))
      .mockReturnValueOnce(ledgerSql(REQUIRED_SCHEMA_VERSIONS));
    const { assertRequiredSchemaVersions } = await import("./schema-readiness");

    await expect(assertRequiredSchemaVersions()).rejects.toThrow(
      "Database schema is incomplete",
    );
    await expect(assertRequiredSchemaVersions()).resolves.toMatchObject({
      requiredVersions: REQUIRED_SCHEMA_VERSIONS,
    });
  });

  it("contains no schema or data mutation statements", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/schema-readiness.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE|TRUNCATE)\b/i,
    );
  });
});
