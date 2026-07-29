import { describe, expect, it } from "vitest";

import {
  assertProductionRuntimeRoleEnvironment,
  buildProductionRuntimeDatabaseUrl,
  fingerprintDatabaseUrl,
  getPooledNeonHost,
  PRODUCTION_RUNTIME_ROLE_NAME,
} from "@/lib/production-runtime-role";

const SHA = "ff29e4abec33ead5b0236d8d95ee6ee6383dcf80";
const DATABASE_HOST =
  "ep-fragrant-surf-aqmtz0he.c-8.us-east-1.aws.neon.tech";
const PASSWORD = "a".repeat(64);
const MIGRATION_URL =
  `postgresql://owner:secret@${DATABASE_HOST}/neondb?sslmode=require`;

function validEnvironment(
  overrides: Record<string, string | undefined> = {},
) {
  return {
    ALLOW_PRODUCTION_RUNTIME_ROLE: "true",
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REPOSITORY: "cantelearist/james-roman-advisory",
    GITHUB_WORKFLOW_REF:
      "cantelearist/james-roman-advisory/.github/workflows/production-runtime-role.yml@refs/heads/main",
    GITHUB_REF_NAME: "main",
    GITHUB_SHA: SHA,
    PRODUCTION_RUNTIME_ROLE_ENVIRONMENT: "production-database-migrations",
    RUNTIME_ROLE_MODE: "preflight",
    RUNTIME_ROLE_EXPECTED_SHA: SHA,
    RUNTIME_ROLE_CONFIRMATION:
      "inspect james-roman-advisory runtime role",
    MIGRATION_DATABASE_URL: MIGRATION_URL,
    MIGRATION_DATABASE_HOST: DATABASE_HOST,
    RUNTIME_DATABASE_PASSWORD: PASSWORD,
    ...overrides,
  };
}

describe("production runtime role safety", () => {
  it("accepts the reviewer-protected preflight boundary", () => {
    const result = assertProductionRuntimeRoleEnvironment(validEnvironment());
    const runtimeUrl = new URL(result.runtimeDatabaseUrl);

    expect(result.mode).toBe("preflight");
    expect(result.expectedSha).toBe(SHA);
    expect(runtimeUrl.username).toBe(PRODUCTION_RUNTIME_ROLE_NAME);
    expect(runtimeUrl.password).toBe(PASSWORD);
    expect(runtimeUrl.hostname).toBe(
      "ep-fragrant-surf-aqmtz0he-pooler.c-8.us-east-1.aws.neon.tech",
    );
  });

  it("requires the stronger provisioning phrase", () => {
    const result = assertProductionRuntimeRoleEnvironment(
      validEnvironment({
        RUNTIME_ROLE_MODE: "provision",
        RUNTIME_ROLE_CONFIRMATION:
          "provision james-roman-advisory runtime role",
      }),
    );

    expect(result.mode).toBe("provision");
  });

  it("derives the pooled endpoint without changing an existing pooler", () => {
    expect(getPooledNeonHost(DATABASE_HOST)).toContain(
      "ep-fragrant-surf-aqmtz0he-pooler.",
    );
    expect(
      getPooledNeonHost(
        "ep-fragrant-surf-aqmtz0he-pooler.c-8.us-east-1.aws.neon.tech",
      ),
    ).toBe(
      "ep-fragrant-surf-aqmtz0he-pooler.c-8.us-east-1.aws.neon.tech",
    );
  });

  it("creates a stable non-secret fingerprint for handoff verification", () => {
    const runtimeUrl = buildProductionRuntimeDatabaseUrl(
      MIGRATION_URL,
      PASSWORD,
    );

    expect(fingerprintDatabaseUrl(runtimeUrl)).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprintDatabaseUrl(runtimeUrl)).not.toContain(PASSWORD);
  });

  it.each([
    ["explicit authorization", { ALLOW_PRODUCTION_RUNTIME_ROLE: "false" }],
    ["manual dispatch", { GITHUB_EVENT_NAME: "push" }],
    ["repository", { GITHUB_REPOSITORY: "cantelearist/other" }],
    [
      "workflow source",
      {
        GITHUB_WORKFLOW_REF:
          "cantelearist/james-roman-advisory/.github/workflows/production-runtime-role.yml@refs/heads/feature",
      },
    ],
    ["main branch", { GITHUB_REF_NAME: "feature" }],
    [
      "protected environment",
      { PRODUCTION_RUNTIME_ROLE_ENVIRONMENT: "production" },
    ],
    ["ordinary runtime secret", { DATABASE_URL: "postgresql://runtime/db" }],
    ["matching SHA", { RUNTIME_ROLE_EXPECTED_SHA: "b".repeat(40) }],
    ["confirmation", { RUNTIME_ROLE_CONFIRMATION: "provision production" }],
    [
      "Neon endpoint",
      {
        MIGRATION_DATABASE_URL:
          "postgresql://owner:secret@db.example.com/neondb",
      },
    ],
    [
      "attested host",
      { MIGRATION_DATABASE_HOST: "ep-other.us-east-1.aws.neon.tech" },
    ],
    ["strong password", { RUNTIME_DATABASE_PASSWORD: "too-short" }],
  ])("rejects an invalid %s boundary", (_label, overrides) => {
    expect(() =>
      assertProductionRuntimeRoleEnvironment(validEnvironment(overrides)),
    ).toThrow(/Production runtime role safety check failed/);
  });

  it("does not include either database secret in validation errors", () => {
    const migrationSecret =
      "postgresql://owner:owner-secret@db.example.com/neondb";
    const runtimeSecret = "runtime-secret";

    expect(() =>
      assertProductionRuntimeRoleEnvironment(
        validEnvironment({
          MIGRATION_DATABASE_URL: migrationSecret,
          RUNTIME_DATABASE_PASSWORD: runtimeSecret,
        }),
      ),
    ).toThrowError(
      expect.not.objectContaining({
        message: expect.stringMatching(/owner-secret|runtime-secret/),
      }),
    );
  });
});
