import { describe, expect, it } from "vitest";

import {
  assertDisposableRuntimeRoleEnvironment,
  createDisposableRuntimeDatabaseUrl,
  getDisposableRuntimeRoleName,
  quotePostgresIdentifier,
} from "@/lib/disposable-runtime-role";

const now = new Date("2026-07-28T04:00:00.000Z");
const ownerUrl =
  "postgresql://owner:secret@ep-test-branch-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require";
const branchId = "br-test-branch-123";
const roleName = getDisposableRuntimeRoleName(branchId);
const password = "a".repeat(64);
const runtimeUrl = createDisposableRuntimeDatabaseUrl(
  ownerUrl,
  roleName,
  password,
);

function validEnvironment(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    ALLOW_DATABASE_INTEGRATION: "true",
    INTEGRATION_DATABASE_URL: ownerUrl,
    INTEGRATION_RUNTIME_DATABASE_URL: runtimeUrl,
    INTEGRATION_RUNTIME_DATABASE_ROLE: roleName,
    INTEGRATION_NEON_BRANCH_ID: branchId,
    INTEGRATION_NEON_BRANCH_NAME: "test/jra-access-123",
    INTEGRATION_NEON_ENDPOINT_HOST:
      "ep-test-branch-pooler.us-east-2.aws.neon.tech",
    INTEGRATION_NEON_EXPIRES_AT: "2026-07-28T06:00:00.000Z",
    INTEGRATION_NEON_BRANCH_TYPE: "schema-only",
    ...overrides,
  };
}

describe("disposable runtime database role safety", () => {
  it("derives a stable restricted identifier without exposing the branch ID", () => {
    expect(roleName).toMatch(/^jra_runtime_[a-f0-9]{20}$/);
    expect(getDisposableRuntimeRoleName(branchId)).toBe(roleName);
    expect(roleName).not.toContain("test_branch");
  });

  it("creates a same-endpoint URL with only the login credential changed", () => {
    const parsed = new URL(runtimeUrl);

    expect(parsed.username).toBe(roleName);
    expect(parsed.password).toBe(password);
    expect(parsed.hostname).toBe(
      "ep-test-branch-pooler.us-east-2.aws.neon.tech",
    );
    expect(parsed.pathname).toBe("/neondb");
    expect(parsed.searchParams.get("sslmode")).toBe("require");
  });

  it("accepts the real-login credential only for the attested branch", () => {
    const result = assertDisposableRuntimeRoleEnvironment(validEnvironment(), now);

    expect(result.roleName).toBe(roleName);
    expect(result.runtimeDatabaseUrl).toBe(runtimeUrl);
  });

  it.each([
    [
      "the owner credential",
      { INTEGRATION_RUNTIME_DATABASE_URL: ownerUrl },
    ],
    [
      "a different endpoint",
      {
        INTEGRATION_RUNTIME_DATABASE_URL: runtimeUrl.replace(
          "ep-test-branch-pooler",
          "ep-other-branch-pooler",
        ),
      },
    ],
    [
      "a different database",
      {
        INTEGRATION_RUNTIME_DATABASE_URL: runtimeUrl.replace(
          "/neondb?",
          "/other?",
        ),
      },
    ],
    [
      "a mismatched role",
      { INTEGRATION_RUNTIME_DATABASE_ROLE: "jra_runtime_deadbeefdeadbeefdead" },
    ],
  ])("rejects %s", (_label, overrides) => {
    expect(() =>
      assertDisposableRuntimeRoleEnvironment(
        validEnvironment(overrides),
        now,
      ),
    ).toThrow(/runtime role safety check failed/i);
  });

  it.each([
    'role"; DROP TABLE users; --',
    "UPPERCASE",
    "_leading_underscore",
    "a".repeat(64),
  ])("rejects unsafe identifier %s", (identifier) => {
    expect(() => quotePostgresIdentifier(identifier)).toThrow(
      /identifier is invalid/i,
    );
  });
});
