import { createHash } from "node:crypto";

type Environment = Record<string, string | undefined>;

const EXPECTED_REPOSITORY = "cantelearist/james-roman-advisory";
const EXPECTED_WORKFLOW_REF =
  "cantelearist/james-roman-advisory/.github/workflows/production-runtime-role.yml@refs/heads/main";
const EXPECTED_ENVIRONMENT = "production-database-migrations";
const EXPECTED_BRANCH = "main";

export const PRODUCTION_RUNTIME_ROLE_NAME = "jra_app_runtime";

export type ProductionRuntimeRoleMode = "preflight" | "provision";

export type ProductionRuntimeRoleConfig = {
  databaseUrl: string;
  databaseHost: string;
  expectedSha: string;
  mode: ProductionRuntimeRoleMode;
  runtimeDatabaseUrl: string;
  runtimeDatabaseFingerprint: string;
  runtimePassword: string;
};

function required(env: Environment, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(
      `Production runtime role safety check failed: ${key} is required.`,
    );
  }
  return value;
}

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function expectedConfirmation(mode: ProductionRuntimeRoleMode): string {
  return mode === "provision"
    ? "provision james-roman-advisory runtime role"
    : "inspect james-roman-advisory runtime role";
}

export function getPooledNeonHost(host: string): string {
  const normalized = normalizeHost(host);
  const labels = normalized.split(".");
  const endpoint = labels[0] ?? "";
  if (
    !endpoint.startsWith("ep-")
    || !normalized.endsWith(".neon.tech")
  ) {
    throw new Error(
      "Production runtime role safety check failed: migration target must be a Neon endpoint.",
    );
  }

  if (!endpoint.endsWith("-pooler")) {
    labels[0] = `${endpoint}-pooler`;
  }
  return labels.join(".");
}

export function buildProductionRuntimeDatabaseUrl(
  migrationDatabaseUrl: string,
  runtimePassword: string,
): string {
  if (!/^[a-f0-9]{64}$/.test(runtimePassword)) {
    throw new Error(
      "Production runtime role safety check failed: the runtime password must be 256-bit lowercase hexadecimal.",
    );
  }

  let runtimeUrl: URL;
  try {
    runtimeUrl = new URL(migrationDatabaseUrl);
  } catch {
    throw new Error(
      "Production runtime role safety check failed: migration database URL is invalid.",
    );
  }

  if (runtimeUrl.pathname !== "/neondb" || runtimeUrl.port) {
    throw new Error(
      "Production runtime role safety check failed: expected the default Neon database without a custom port.",
    );
  }

  const pooledHost = getPooledNeonHost(runtimeUrl.hostname);
  const deterministicRuntimeUrl = new URL(
    `postgresql://${PRODUCTION_RUNTIME_ROLE_NAME}:${runtimePassword}@${pooledHost}/neondb`,
  );
  deterministicRuntimeUrl.searchParams.set("sslmode", "require");
  return deterministicRuntimeUrl.toString();
}

export function fingerprintDatabaseUrl(databaseUrl: string): string {
  return createHash("sha256").update(databaseUrl).digest("hex");
}

/**
 * Restricts permanent production-role provisioning to one manually dispatched
 * workflow sourced from main and approved through the migration environment.
 */
export function assertProductionRuntimeRoleEnvironment(
  env: Environment,
): ProductionRuntimeRoleConfig {
  if (env.ALLOW_PRODUCTION_RUNTIME_ROLE !== "true") {
    throw new Error(
      "Production runtime role safety check failed: explicit authorization is required.",
    );
  }
  if (
    env.GITHUB_ACTIONS !== "true"
    || env.GITHUB_EVENT_NAME !== "workflow_dispatch"
  ) {
    throw new Error(
      "Production runtime role safety check failed: manual GitHub Actions dispatch is required.",
    );
  }
  if (required(env, "GITHUB_REPOSITORY") !== EXPECTED_REPOSITORY) {
    throw new Error(
      "Production runtime role safety check failed: unexpected GitHub repository.",
    );
  }
  if (required(env, "GITHUB_WORKFLOW_REF") !== EXPECTED_WORKFLOW_REF) {
    throw new Error(
      "Production runtime role safety check failed: workflow must be sourced from main.",
    );
  }
  if (required(env, "GITHUB_REF_NAME") !== EXPECTED_BRANCH) {
    throw new Error(
      "Production runtime role safety check failed: only the main branch is allowed.",
    );
  }
  if (
    required(env, "PRODUCTION_RUNTIME_ROLE_ENVIRONMENT")
    !== EXPECTED_ENVIRONMENT
  ) {
    throw new Error(
      "Production runtime role safety check failed: protected environment mismatch.",
    );
  }
  if (env.DATABASE_URL?.trim()) {
    throw new Error(
      "Production runtime role safety check failed: DATABASE_URL must be unset.",
    );
  }

  const mode = required(env, "RUNTIME_ROLE_MODE");
  if (mode !== "preflight" && mode !== "provision") {
    throw new Error(
      "Production runtime role safety check failed: mode must be preflight or provision.",
    );
  }

  const githubSha = required(env, "GITHUB_SHA").toLowerCase();
  const expectedSha = required(env, "RUNTIME_ROLE_EXPECTED_SHA").toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(expectedSha) || expectedSha !== githubSha) {
    throw new Error(
      "Production runtime role safety check failed: expected SHA must match the dispatched main commit.",
    );
  }
  if (
    required(env, "RUNTIME_ROLE_CONFIRMATION")
    !== expectedConfirmation(mode)
  ) {
    throw new Error(
      `Production runtime role safety check failed: confirmation phrase does not authorize ${mode}.`,
    );
  }

  const databaseUrl = required(env, "MIGRATION_DATABASE_URL");
  const databaseHost = normalizeHost(
    required(env, "MIGRATION_DATABASE_HOST"),
  );
  let migrationUrl: URL;
  try {
    migrationUrl = new URL(databaseUrl);
  } catch {
    throw new Error(
      "Production runtime role safety check failed: migration database URL is invalid.",
    );
  }

  if (!["postgres:", "postgresql:"].includes(migrationUrl.protocol)) {
    throw new Error(
      "Production runtime role safety check failed: only Postgres URLs are accepted.",
    );
  }
  const urlHost = normalizeHost(migrationUrl.hostname);
  getPooledNeonHost(urlHost);
  if (urlHost !== databaseHost) {
    throw new Error(
      "Production runtime role safety check failed: attested host does not match the migration URL.",
    );
  }

  const runtimePassword = required(env, "RUNTIME_DATABASE_PASSWORD");
  const runtimeDatabaseUrl = buildProductionRuntimeDatabaseUrl(
    databaseUrl,
    runtimePassword,
  );
  if (runtimeDatabaseUrl === databaseUrl) {
    throw new Error(
      "Production runtime role safety check failed: runtime and migration credentials must differ.",
    );
  }

  return {
    databaseUrl,
    databaseHost,
    expectedSha,
    mode,
    runtimeDatabaseUrl,
    runtimeDatabaseFingerprint: fingerprintDatabaseUrl(runtimeDatabaseUrl),
    runtimePassword,
  };
}
