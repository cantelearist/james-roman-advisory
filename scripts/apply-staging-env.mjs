import { spawnSync } from "node:child_process";

const STAGING_BRANCH = "staging-secure-office-foundation";

const REQUIRED_SUPABASE_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const OPTIONAL_STRIPE_KEYS = [
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_CONNECT_CLIENT_ID",
];

function run(command, args, input) {
  const result = spawnSync(command, args, {
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }

  return result.stdout;
}

function assertStagingValue(key, value, required = true) {
  if (!value && !required) return;
  if (!value) throw new Error(`${key} is missing from this shell environment.`);

  if (key === "NEXT_PUBLIC_SUPABASE_URL" && !/supabase\.co/.test(value)) {
    throw new Error(`${key} does not look like a Supabase project URL.`);
  }

  if (key === "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" && !value.startsWith("pk_test_")) {
    throw new Error(`${key} must be a Stripe test-mode publishable key.`);
  }

  if (key === "STRIPE_SECRET_KEY" && !value.startsWith("sk_test_")) {
    throw new Error(`${key} must be a Stripe test-mode secret key.`);
  }
}

try {
  for (const key of REQUIRED_SUPABASE_KEYS) {
    assertStagingValue(key, process.env[key]);
  }

  for (const key of OPTIONAL_STRIPE_KEYS) {
    assertStagingValue(key, process.env[key], false);
  }

  const keysToApply = [
    ...REQUIRED_SUPABASE_KEYS,
    ...OPTIONAL_STRIPE_KEYS.filter((key) => Boolean(process.env[key])),
  ];

  const missingStripeKeys = OPTIONAL_STRIPE_KEYS.filter((key) => !process.env[key]);
  if (missingStripeKeys.length === OPTIONAL_STRIPE_KEYS.length) {
    console.warn("staging payments env not configured; skipping Stripe keys for now.");
  } else if (missingStripeKeys.length) {
    console.warn(`staging payments env incomplete; skipping missing Stripe keys: ${missingStripeKeys.join(", ")}`);
  }

  for (const key of keysToApply) {
    const remove = spawnSync("npx", ["vercel", "env", "remove", key, "preview", STAGING_BRANCH, "--yes"], {
      input: "",
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    if (remove.status !== 0 && !/not found|No Environment Variable/i.test(remove.stderr || remove.stdout)) {
      throw new Error(`npx vercel env remove ${key} preview ${STAGING_BRANCH} failed:\n${remove.stderr || remove.stdout}`);
    }

    run("npx", ["vercel", "env", "add", key, "preview", STAGING_BRANCH], `${process.env[key]}\n`);
    console.log(`staging env set: ${key}`);
  }

  console.log(`staging env applied for branch ${STAGING_BRANCH}.`);
} catch (error) {
  console.error("staging env apply failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
