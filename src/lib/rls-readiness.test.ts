import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  RLS_TABLE_CLASSIFICATION,
  RLS_TABLE_NAMES,
} from "@/lib/rls-readiness";

describe("RLS table classification", () => {
  it("classifies every table declared by the schema bootstrap exactly once", () => {
    const dbSource = readFileSync(
      resolve(process.cwd(), "src/lib/db.ts"),
      "utf8",
    );
    const declaredTables = Array.from(
      dbSource.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z_]+)/g),
      (match) => match[1],
    ).sort();
    const classifiedTables = [...RLS_TABLE_NAMES].sort();

    expect(new Set(classifiedTables).size).toBe(classifiedTables.length);
    expect(classifiedTables).toEqual(declaredTables);
  });

  it("does not leave any table with an empty policy family or scope root", () => {
    for (const classification of RLS_TABLE_CLASSIFICATION) {
      expect(classification.family, classification.table).not.toBe("");
      expect(classification.root, classification.table).not.toBe("");
    }
  });
});
