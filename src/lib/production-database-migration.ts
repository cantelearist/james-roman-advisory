type Environment = Record<string, string | undefined>;

const EXPECTED_REPOSITORY = "cantelearist/james-roman-advisory";
const EXPECTED_WORKFLOW_REF =
  "cantelearist/james-roman-advisory/.github/workflows/production-database-migration.yml@refs/heads/main";
const EXPECTED_ENVIRONMENT = "production-database-migrations";
const EXPECTED_BRANCH = "main";

export type ProductionMigrationMode = "preflight" | "apply";

export type ProductionMigrationConfig = {
  databaseUrl: string;
  databaseHost: string;
  expectedSha: string;
  mode: ProductionMigrationMode;
};

function required(env: Environment, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`Production migration safety check failed: ${key} is required.`);
  }
  return value;
}

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function expectedConfirmation(mode: ProductionMigrationMode): string {
  return mode === "apply"
    ? "migrate james-roman-advisory production"
    : "inspect james-roman-advisory production";
}

/**
 * Restricts production migration access to one manually dispatched workflow
 * sourced from main and approved through the protected GitHub environment.
 * The database URL is accepted only through the dedicated migration secret.
 */
export function assertProductionMigrationEnvironment(
  env: Environment,
): ProductionMigrationConfig {
  if (env.ALLOW_PRODUCTION_DATABASE_MIGRATIONS !== "true") {
    throw new Error(
      "Production migration safety check failed: explicit authorization is required.",
    );
  }
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_EVENT_NAME !== "workflow_dispatch") {
    throw new Error(
      "Production migration safety check failed: manual GitHub Actions dispatch is required.",
    );
  }
  if (required(env, "GITHUB_REPOSITORY") !== EXPECTED_REPOSITORY) {
    throw new Error(
      "Production migration safety check failed: unexpected GitHub repository.",
    );
  }
  if (required(env, "GITHUB_WORKFLOW_REF") !== EXPECTED_WORKFLOW_REF) {
    throw new Error(
      "Production migration safety check failed: workflow must be sourced from main.",
    );
  }
  if (required(env, "GITHUB_REF_NAME") !== EXPECTED_BRANCH) {
    throw new Error(
      "Production migration safety check failed: only the main branch is allowed.",
    );
  }
  if (
    required(env, "PRODUCTION_MIGRATION_ENVIRONMENT") !== EXPECTED_ENVIRONMENT
  ) {
    throw new Error(
      "Production migration safety check failed: protected environment mismatch.",
    );
  }
  if (env.DATABASE_URL?.trim()) {
    throw new Error(
      "Production migration safety check failed: DATABASE_URL must be unset; use the dedicated migration secret.",
    );
  }

  const mode = required(env, "MIGRATION_MODE");
  if (mode !== "preflight" && mode !== "apply") {
    throw new Error(
      "Production migration safety check failed: MIGRATION_MODE must be preflight or apply.",
    );
  }

  const githubSha = required(env, "GITHUB_SHA").toLowerCase();
  const expectedSha = required(env, "MIGRATION_EXPECTED_SHA").toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(expectedSha) || expectedSha !== githubSha) {
    throw new Error(
      "Production migration safety check failed: expected SHA must match the dispatched main commit.",
    );
  }

  if (
    required(env, "MIGRATION_CONFIRMATION") !== expectedConfirmation(mode)
  ) {
    throw new Error(
      `Production migration safety check failed: confirmation phrase does not authorize ${mode}.`,
    );
  }

  const databaseUrl = required(env, "MIGRATION_DATABASE_URL");
  const databaseHost = normalizeHost(required(env, "MIGRATION_DATABASE_HOST"));
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error(
      "Production migration safety check failed: migration database URL is invalid.",
    );
  }

  if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol)) {
    throw new Error(
      "Production migration safety check failed: only Postgres URLs are accepted.",
    );
  }

  const urlHost = normalizeHost(parsedUrl.hostname);
  if (
    !urlHost.endsWith(".neon.tech") ||
    !urlHost.split(".")[0]?.startsWith("ep-")
  ) {
    throw new Error(
      "Production migration safety check failed: migration target must be a Neon endpoint.",
    );
  }
  if (urlHost !== databaseHost) {
    throw new Error(
      "Production migration safety check failed: attested host does not match the migration URL.",
    );
  }

  return {
    databaseUrl,
    databaseHost,
    expectedSha,
    mode,
  };
}
