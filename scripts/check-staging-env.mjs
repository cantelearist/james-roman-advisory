import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REQUIRED_SUPABASE_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const REQUIRED_SECURITY_KEYS = ["AUDIT_HASH_SECRET"];

const SENTRY_KEYS = [
  "NEXT_PUBLIC_SENTRY_DSN",
  "SENTRY_DSN",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
  "SENTRY_AUTH_TOKEN",
];

const STRIPE_KEYS = [
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_CONNECT_CLIENT_ID",
];

const STAGING_BRANCH = "staging-secure-office-foundation";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }

  return result.stdout;
}

function parseEnv(path) {
  const env = new Map();

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    env.set(key, rawValue.replace(/^['"]|['"]$/g, ""));
  }

  return env;
}

function pullEnv(environment, dir) {
  const target = join(dir, `${environment}.env`);
  run("npx", ["vercel", "env", "pull", target, "--environment", environment]);
  return parseEnv(target);
}

function listBranchEnv(environment, branch) {
  const output = run("npx", ["vercel", "env", "ls", environment, branch]);
  const names = new Set();

  for (const key of [...REQUIRED_SUPABASE_KEYS, ...REQUIRED_SECURITY_KEYS, ...SENTRY_KEYS, ...STRIPE_KEYS]) {
    if (new RegExp(`\\b${key}\\b`).test(output)) names.add(key);
  }

  return names;
}

function listEnvironmentEnv(environment) {
  const output = run("npx", ["vercel", "env", "ls", environment]);
  const names = new Set();

  for (const key of [...REQUIRED_SUPABASE_KEYS, ...REQUIRED_SECURITY_KEYS, ...SENTRY_KEYS, ...STRIPE_KEYS]) {
    if (new RegExp(`\\b${key}\\b`).test(output)) names.add(key);
  }

  return names;
}

function present(env, key) {
  return Boolean(env.get(key));
}

function stripeMode(value) {
  if (!value) return "missing";
  if (/^(pk|sk)_test_/.test(value)) return "test";
  if (/^(pk|sk)_live_/.test(value)) return "live";
  if (/^whsec_/.test(value)) return "webhook-secret";
  return "unknown";
}

function main() {
  const dir = mkdtempSync(join(tmpdir(), "jra-vercel-env-"));

  try {
    const branchScoped = listBranchEnv("preview", STAGING_BRANCH);
    const productionScoped = listEnvironmentEnv("production");
    const staging = pullEnv("preview", dir);
    const production = pullEnv("production", dir);
    const failures = [];
    const warnings = [];
    const branchScopedSupabase = REQUIRED_SUPABASE_KEYS.every((key) => branchScoped.has(key));

    for (const key of REQUIRED_SUPABASE_KEYS) {
      if (!branchScoped.has(key)) failures.push(`staging branch ${STAGING_BRANCH} is missing ${key}.`);
      if (!present(production, key)) failures.push(`production is missing ${key}.`);
      if (!branchScoped.has(key) && staging.get(key) && production.get(key) && staging.get(key) === production.get(key)) {
        failures.push(`staging and production share ${key}. staging must use a separate Supabase project.`);
      }
    }

    for (const key of REQUIRED_SECURITY_KEYS) {
      const stagingValue = staging.get(key);
      const productionValue = production.get(key);

      if (!branchScoped.has(key)) failures.push(`staging branch ${STAGING_BRANCH} is missing ${key}.`);
      if (!productionScoped.has(key)) failures.push(`production is missing ${key}.`);
      if (stagingValue && stagingValue.length < 32) failures.push(`staging ${key} is too short.`);
      if (productionValue && productionValue.length < 32) failures.push(`production ${key} is too short.`);
      if (stagingValue && productionValue && stagingValue === productionValue) {
        failures.push(`staging and production share ${key}.`);
      }
    }

    for (const key of STRIPE_KEYS) {
      const stagingValue = staging.get(key);
      const productionValue = production.get(key);
      const stagingMode = stripeMode(stagingValue);
      const productionMode = stripeMode(productionValue);

      if (!branchScoped.has(key)) {
        warnings.push(`staging branch ${STAGING_BRANCH} is missing ${key}; payments staging is not configured.`);
        continue;
      }

      if (key.includes("PUBLISHABLE") || key === "STRIPE_SECRET_KEY") {
        if (stagingValue && stagingMode !== "test") failures.push(`staging ${key} is not a Stripe test-mode key.`);
        if (productionValue && productionMode === "test") warnings.push(`production ${key} appears to be test-mode.`);
        if (stagingValue && productionValue && stagingValue === productionValue) failures.push(`staging and production share ${key}.`);
      }
    }

    if (!branchScoped.has("NEXT_PUBLIC_SENTRY_DSN") && !branchScoped.has("SENTRY_DSN")) {
      warnings.push(
        `staging branch ${STAGING_BRANCH} is missing Sentry DSN; errors remain in Vercel logs only until Sentry is configured.`,
      );
    }

    if (!productionScoped.has("NEXT_PUBLIC_SENTRY_DSN") && !productionScoped.has("SENTRY_DSN")) {
      warnings.push("production is missing Sentry DSN; add it before production handles real client files.");
    }

    for (const key of ["SENTRY_ORG", "SENTRY_PROJECT", "SENTRY_AUTH_TOKEN"]) {
      if (!branchScoped.has(key)) {
        warnings.push(`staging branch ${STAGING_BRANCH} is missing ${key}; Sentry source-map upload is not configured.`);
      }
    }

    if (warnings.length) {
      console.warn("Staging warnings:");
      for (const warning of warnings) console.warn(`- ${warning}`);
    }

    if (failures.length) {
      console.error("Staging environment check failed:");
      for (const failure of failures) console.error(`- ${failure}`);
      process.exit(1);
    }

    if (branchScopedSupabase) {
      console.log(`staging Supabase env is branch-scoped for ${STAGING_BRANCH}.`);
    }

    console.log("Staging environment check passed.");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main();
