import { createHash, randomBytes } from "node:crypto";

import {
  assertDisposableDatabaseEnvironment,
  type DisposableDatabaseConfig,
} from "./disposable-database";

type Environment = Record<string, string | undefined>;

export const DISPOSABLE_RUNTIME_ROLE_PREFIX = "jra_runtime_";

function required(env: Environment, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(
      `Disposable runtime role safety check failed: ${key} is required.`,
    );
  }
  return value;
}

export function getDisposableRuntimeRoleName(branchId: string): string {
  if (!/^br-[a-z0-9-]+$/.test(branchId)) {
    throw new Error(
      "Disposable runtime role safety check failed: the Neon branch ID is invalid.",
    );
  }

  const suffix = createHash("sha256").update(branchId).digest("hex").slice(0, 20);
  return `${DISPOSABLE_RUNTIME_ROLE_PREFIX}${suffix}`;
}

export function quotePostgresIdentifier(identifier: string): string {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(identifier)) {
    throw new Error(
      "Disposable runtime role safety check failed: the Postgres identifier is invalid.",
    );
  }
  return `"${identifier}"`;
}

export function createDisposableRuntimeDatabaseUrl(
  ownerDatabaseUrl: string,
  roleName: string,
  password = randomBytes(32).toString("hex"),
): string {
  quotePostgresIdentifier(roleName);
  if (!/^[a-f0-9]{64}$/.test(password)) {
    throw new Error(
      "Disposable runtime role safety check failed: the generated password is invalid.",
    );
  }

  const runtimeUrl = new URL(ownerDatabaseUrl);
  runtimeUrl.username = roleName;
  runtimeUrl.password = password;
  return runtimeUrl.toString();
}

export type DisposableRuntimeRoleConfig = DisposableDatabaseConfig & {
  runtimeDatabaseUrl: string;
  roleName: string;
};

export function assertDisposableRuntimeRoleEnvironment(
  env: Environment,
  now = new Date(),
): DisposableRuntimeRoleConfig {
  const disposable = assertDisposableDatabaseEnvironment(env, now);
  const runtimeDatabaseUrl = required(env, "INTEGRATION_RUNTIME_DATABASE_URL");
  const roleName = required(env, "INTEGRATION_RUNTIME_DATABASE_ROLE");
  const expectedRoleName = getDisposableRuntimeRoleName(disposable.branchId);

  if (roleName !== expectedRoleName) {
    throw new Error(
      "Disposable runtime role safety check failed: the role does not match the attested branch.",
    );
  }

  let ownerUrl: URL;
  let runtimeUrl: URL;
  try {
    ownerUrl = new URL(disposable.databaseUrl);
    runtimeUrl = new URL(runtimeDatabaseUrl);
  } catch {
    throw new Error(
      "Disposable runtime role safety check failed: the runtime database URL is invalid.",
    );
  }

  if (
    runtimeDatabaseUrl === disposable.databaseUrl
    || runtimeUrl.protocol !== ownerUrl.protocol
    || runtimeUrl.hostname !== ownerUrl.hostname
    || runtimeUrl.port !== ownerUrl.port
    || runtimeUrl.pathname !== ownerUrl.pathname
    || runtimeUrl.username !== roleName
    || !runtimeUrl.password
  ) {
    throw new Error(
      "Disposable runtime role safety check failed: the runtime credential does not match the attested disposable database.",
    );
  }

  return {
    ...disposable,
    runtimeDatabaseUrl,
    roleName,
  };
}
