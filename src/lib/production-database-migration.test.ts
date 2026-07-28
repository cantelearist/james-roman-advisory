import { describe, expect, it } from "vitest";

import { assertProductionMigrationEnvironment } from "@/lib/production-database-migration";

const SHA = "c99c114a0dd7bc047124467cc51416992c77f3d6";
const DATABASE_HOST = "ep-example-pooler.us-east-2.aws.neon.tech";

function validEnvironment(
  overrides: Record<string, string | undefined> = {},
) {
  return {
    ALLOW_PRODUCTION_DATABASE_MIGRATIONS: "true",
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REPOSITORY: "cantelearist/james-roman-advisory",
    GITHUB_WORKFLOW_REF:
      "cantelearist/james-roman-advisory/.github/workflows/production-database-migration.yml@refs/heads/main",
    GITHUB_REF_NAME: "main",
    GITHUB_SHA: SHA,
    PRODUCTION_MIGRATION_ENVIRONMENT: "production-database-migrations",
    MIGRATION_MODE: "preflight",
    MIGRATION_EXPECTED_SHA: SHA,
    MIGRATION_CONFIRMATION: "inspect james-roman-advisory production",
    MIGRATION_DATABASE_URL: `postgresql://owner:secret@${DATABASE_HOST}/neondb?sslmode=require`,
    MIGRATION_DATABASE_HOST: DATABASE_HOST,
    ...overrides,
  };
}

describe("production database migration safety", () => {
  it("accepts a protected read-only preflight", () => {
    const result = assertProductionMigrationEnvironment(validEnvironment());

    expect(result.mode).toBe("preflight");
    expect(result.databaseHost).toBe(DATABASE_HOST);
    expect(result.expectedSha).toBe(SHA);
  });

  it("requires a stronger phrase for apply mode", () => {
    const result = assertProductionMigrationEnvironment(
      validEnvironment({
        MIGRATION_MODE: "apply",
        MIGRATION_CONFIRMATION: "migrate james-roman-advisory production",
      }),
    );

    expect(result.mode).toBe("apply");
  });

  it.each([
    ["explicit authorization", { ALLOW_PRODUCTION_DATABASE_MIGRATIONS: "false" }],
    ["manual dispatch", { GITHUB_EVENT_NAME: "push" }],
    ["repository", { GITHUB_REPOSITORY: "cantelearist/other" }],
    [
      "workflow source",
      {
        GITHUB_WORKFLOW_REF:
          "cantelearist/james-roman-advisory/.github/workflows/production-database-migration.yml@refs/heads/feature",
      },
    ],
    ["main branch", { GITHUB_REF_NAME: "feature" }],
    ["protected environment", { PRODUCTION_MIGRATION_ENVIRONMENT: "production" }],
    ["dedicated secret", { DATABASE_URL: "postgresql://runtime.example/db" }],
    ["matching SHA", { MIGRATION_EXPECTED_SHA: "a".repeat(40) }],
    ["confirmation", { MIGRATION_CONFIRMATION: "migrate production" }],
    ["Neon endpoint", { MIGRATION_DATABASE_URL: "postgresql://owner:secret@db.example.com/db" }],
    ["attested host", { MIGRATION_DATABASE_HOST: "ep-other.us-east-2.aws.neon.tech" }],
  ])("rejects an invalid %s boundary", (_label, overrides) => {
    expect(() =>
      assertProductionMigrationEnvironment(validEnvironment(overrides)),
    ).toThrow(/Production migration safety check failed/);
  });

  it("does not include the database URL in validation errors", () => {
    const secretUrl =
      "postgresql://owner:highly-sensitive-value@db.example.com/neondb";

    expect(() =>
      assertProductionMigrationEnvironment(
        validEnvironment({ MIGRATION_DATABASE_URL: secretUrl }),
      ),
    ).toThrowError(
      expect.not.objectContaining({ message: expect.stringContaining(secretUrl) }),
    );
  });
});
