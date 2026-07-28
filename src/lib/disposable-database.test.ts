import { describe, expect, it } from "vitest";

import {
  assertDisposableDatabaseEnvironment,
  assertLoopbackMutationTarget,
} from "@/lib/disposable-database";

const now = new Date("2026-07-28T04:00:00.000Z");

function validEnvironment(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    ALLOW_DATABASE_INTEGRATION: "true",
    INTEGRATION_DATABASE_URL:
      "postgresql://owner:secret@ep-test-branch-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
    INTEGRATION_NEON_BRANCH_ID: "br-test-branch-123",
    INTEGRATION_NEON_BRANCH_NAME: "test/jra-access-123",
    INTEGRATION_NEON_ENDPOINT_HOST:
      "ep-test-branch-pooler.us-east-2.aws.neon.tech",
    INTEGRATION_NEON_EXPIRES_AT: "2026-07-28T06:00:00.000Z",
    INTEGRATION_NEON_BRANCH_TYPE: "schema-only",
    ...overrides,
  };
}

describe("disposable database safety", () => {
  it("accepts a short-lived schema-only Neon test branch", () => {
    const result = assertDisposableDatabaseEnvironment(validEnvironment(), now);

    expect(result.branchId).toBe("br-test-branch-123");
    expect(result.branchName).toBe("test/jra-access-123");
  });

  it.each([
    ["missing explicit authorization", { ALLOW_DATABASE_INTEGRATION: undefined }],
    ["production execution", { VERCEL_ENV: "production" }],
    ["a non-test branch name", { INTEGRATION_NEON_BRANCH_NAME: "main" }],
    ["a data-bearing branch", { INTEGRATION_NEON_BRANCH_TYPE: "default" }],
    [
      "an endpoint mismatch",
      {
        INTEGRATION_NEON_ENDPOINT_HOST:
          "ep-other-branch-pooler.us-east-2.aws.neon.tech",
      },
    ],
    [
      "a non-Neon database",
      {
        INTEGRATION_DATABASE_URL:
          "postgresql://owner:secret@db.example.com/neondb",
        INTEGRATION_NEON_ENDPOINT_HOST: "db.example.com",
      },
    ],
    [
      "an expired branch",
      { INTEGRATION_NEON_EXPIRES_AT: "2026-07-28T03:59:59.000Z" },
    ],
    [
      "an overlong branch lifetime",
      { INTEGRATION_NEON_EXPIRES_AT: "2026-07-29T04:00:01.000Z" },
    ],
  ])("rejects %s", (_label, overrides) => {
    expect(() =>
      assertDisposableDatabaseEnvironment(validEnvironment(overrides), now),
    ).toThrow(/safety check failed/i);
  });

  it("rejects a database URL that matches a protected URL", () => {
    const env = validEnvironment();
    env.PRODUCTION_DATABASE_URL = env.INTEGRATION_DATABASE_URL;

    expect(() => assertDisposableDatabaseEnvironment(env, now)).toThrow(
      /protected database URLs match/i,
    );
  });

  it.each([
    "https://www.jamesroman.la",
    "https://preview.example.com",
    "not-a-url",
  ])("rejects non-loopback mutation target %s", (url) => {
    expect(() => assertLoopbackMutationTarget(url)).toThrow(
      /Mutating E2E safety check failed/i,
    );
  });

  it.each([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://[::1]:3000",
  ])("accepts loopback mutation target %s", (url) => {
    expect(() => assertLoopbackMutationTarget(url)).not.toThrow();
  });
});
