type Environment = Record<string, string | undefined>;

export type DisposableDatabaseConfig = {
  databaseUrl: string;
  branchId: string;
  branchName: string;
  endpointHost: string;
  expiresAt: Date;
};

const MAX_BRANCH_LIFETIME_MS = 24 * 60 * 60 * 1000;

function required(env: Environment, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`Disposable database safety check failed: ${key} is required.`);
  }
  return value;
}

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

/**
 * Validates the attestation emitted by the Neon create-branch workflow before
 * any integration test is allowed to write. This protects against accidental
 * use of the shared Vercel preview/production DATABASE_URL.
 */
export function assertDisposableDatabaseEnvironment(
  env: Environment,
  now = new Date(),
): DisposableDatabaseConfig {
  if (env.ALLOW_DATABASE_INTEGRATION !== "true") {
    throw new Error(
      "Disposable database safety check failed: set ALLOW_DATABASE_INTEGRATION=true explicitly.",
    );
  }
  if (env.VERCEL_ENV === "production") {
    throw new Error(
      "Disposable database safety check failed: production deployments are forbidden.",
    );
  }

  const databaseUrl = required(env, "INTEGRATION_DATABASE_URL");
  const branchId = required(env, "INTEGRATION_NEON_BRANCH_ID");
  const branchName = required(env, "INTEGRATION_NEON_BRANCH_NAME");
  const endpointHost = normalizeHost(
    required(env, "INTEGRATION_NEON_ENDPOINT_HOST"),
  );
  const expiresAtValue = required(env, "INTEGRATION_NEON_EXPIRES_AT");
  const branchType = required(env, "INTEGRATION_NEON_BRANCH_TYPE");

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error(
      "Disposable database safety check failed: INTEGRATION_DATABASE_URL is invalid.",
    );
  }

  if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol)) {
    throw new Error(
      "Disposable database safety check failed: only Postgres URLs are accepted.",
    );
  }

  const databaseHost = normalizeHost(parsedUrl.hostname);
  if (
    !databaseHost.endsWith(".neon.tech")
    || !databaseHost.split(".")[0]?.startsWith("ep-")
  ) {
    throw new Error(
      "Disposable database safety check failed: the database must use a Neon branch endpoint.",
    );
  }
  if (databaseHost !== endpointHost) {
    throw new Error(
      "Disposable database safety check failed: the attested endpoint does not match the database URL.",
    );
  }
  if (!/^br-[a-z0-9-]+$/.test(branchId)) {
    throw new Error(
      "Disposable database safety check failed: the Neon branch ID is invalid.",
    );
  }
  if (!branchName.startsWith("test/")) {
    throw new Error(
      "Disposable database safety check failed: branch names must start with test/.",
    );
  }
  if (branchType !== "schema-only") {
    throw new Error(
      "Disposable database safety check failed: only schema-only branches are accepted.",
    );
  }

  const expiresAt = new Date(expiresAtValue);
  const remainingLifetime = expiresAt.getTime() - now.getTime();
  if (
    Number.isNaN(expiresAt.getTime())
    || remainingLifetime <= 0
    || remainingLifetime > MAX_BRANCH_LIFETIME_MS
  ) {
    throw new Error(
      "Disposable database safety check failed: branch expiry must be within the next 24 hours.",
    );
  }

  for (const protectedUrl of [
    env.DATABASE_URL,
    env.PRODUCTION_DATABASE_URL,
  ]) {
    if (protectedUrl && protectedUrl === databaseUrl) {
      throw new Error(
        "Disposable database safety check failed: integration and protected database URLs match.",
      );
    }
  }

  return {
    databaseUrl,
    branchId,
    branchName,
    endpointHost,
    expiresAt,
  };
}

export function assertLoopbackMutationTarget(baseUrl: string): void {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new Error("Mutating E2E safety check failed: PLAYWRIGHT_BASE_URL is invalid.");
  }

  const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (!loopbackHosts.has(parsedUrl.hostname)) {
    throw new Error(
      "Mutating E2E safety check failed: mutating browser tests may target loopback only.",
    );
  }
}
