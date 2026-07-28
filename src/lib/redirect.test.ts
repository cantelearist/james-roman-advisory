import { describe, expect, it } from "vitest";

import { safeAuthRedirect } from "./redirect";

describe("safeAuthRedirect", () => {
  it.each([
    [null, "/portal"],
    [undefined, "/portal"],
    ["", "/portal"],
    ["portal", "/portal"],
    ["https://evil.example", "/portal"],
    ["//evil.example", "/portal"],
    ["///evil.example", "/portal"],
    ["/\\evil.example", "/portal"],
    ["\\evil.example", "/portal"],
    ["/portal\n//evil.example", "/portal"],
    ["javascript:alert(1)", "/portal"],
  ])("maps %s to %s", (value, expected) => {
    expect(safeAuthRedirect(value)).toBe(expected);
  });

  it.each([
    ["/portal", "/portal"],
    ["/portal/matters/engagement-1", "/portal/matters/engagement-1"],
    ["/portal?section=documents", "/portal?section=documents"],
    ["/portal#activity", "/portal#activity"],
  ])("preserves safe application path %s", (value, expected) => {
    expect(safeAuthRedirect(value)).toBe(expected);
  });
});
