import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const portalStyles = stylesheet.split("/* Private Office application system */")[1] ?? "";

describe("Private Office typography and alignment", () => {
  it("uses a 15px operational type size with a readable metadata floor", () => {
    expect(portalStyles).toContain("--portal-font-body: 15px;");
    expect(portalStyles).toContain("--portal-font-meta: 12px;");
    expect(portalStyles).toContain("font-size: var(--portal-font-body);");

    const pixelSizes = Array.from(portalStyles.matchAll(/font-size:\s*(\d+)px/g), (match) => Number(match[1]));
    expect(pixelSizes.length).toBeGreaterThan(0);
    expect(Math.min(...pixelSizes)).toBe(12);
  });

  it("keeps controls and operational rows on a consistent vertical rhythm", () => {
    expect(portalStyles).toMatch(/\.portal-primary-button,[\s\S]*?min-height: 42px;/);
    expect(portalStyles).toMatch(/\.portal-filter-bar select,[\s\S]*?min-height: 42px;/);
    expect(portalStyles).toMatch(/\.portal-board-row \{[\s\S]*?min-height: 60px;/);
    expect(portalStyles).toMatch(/\.portal-workflow-row \{[\s\S]*?min-height: 64px;/);
  });
});
