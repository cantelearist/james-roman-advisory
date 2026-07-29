import {
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const DDL_FACADE =
  /\bensure(?:UsersTable|AuthTables|ConsultationsTable|VaultTables|AccessControlTables|EngagementOperationsTables)\b/;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(path) ? [path] : [];
  });
}

describe("runtime schema ownership boundary", () => {
  it("keeps DDL compatibility facades exclusive to migration code", () => {
    const sourceRoot = resolve(process.cwd(), "src");
    const allowed = new Set([
      resolve(sourceRoot, "lib/db.ts"),
      resolve(sourceRoot, "lib/schema-migrations.ts"),
      resolve(sourceRoot, "lib/schema-runtime-boundary.test.ts"),
    ]);
    const offenders = sourceFiles(sourceRoot)
      .filter((path) => !allowed.has(path))
      .filter((path) => DDL_FACADE.test(readFileSync(path, "utf8")))
      .map((path) => relative(process.cwd(), path));

    expect(offenders).toEqual([]);
  });
});
