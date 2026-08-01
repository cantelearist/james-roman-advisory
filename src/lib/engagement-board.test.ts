import { describe, expect, it } from "vitest";

import { isEngagementDensity, parseEngagementBoardQuery } from "./engagement-board";

describe("engagement board query state", () => {
  it("returns restrained defaults for an empty query", () => {
    expect(parseEngagementBoardQuery(new URLSearchParams())).toEqual({
      sort: "updated_at",
      direction: "desc",
      group: "none",
      page: 1,
      pageSize: 25,
      limit: 100,
      offset: 0,
    });
  });

  it("calculates a stable server-side page offset", () => {
    const state = parseEngagementBoardQuery(new URLSearchParams({
      sort: "client",
      direction: "asc",
      group: "owner",
      page: "3",
      page_size: "50",
    }));

    expect(state).toMatchObject({
      sort: "client",
      direction: "asc",
      group: "owner",
      page: 3,
      pageSize: 50,
      limit: 50,
      offset: 100,
    });
  });

  it("preserves the legacy high-limit contract used by finance and document selectors", () => {
    const state = parseEngagementBoardQuery(new URLSearchParams({ limit: "250" }));

    expect(state).toMatchObject({ page: 1, pageSize: 25, limit: 250, offset: 0 });
  });

  it("rejects unsupported, fractional, and unbounded query values", () => {
    const state = parseEngagementBoardQuery(new URLSearchParams({
      sort: "DROP TABLE matters",
      direction: "sideways",
      group: "client",
      page: "2.5",
      page_size: "250",
    }));

    expect(state).toMatchObject({
      sort: "updated_at",
      direction: "desc",
      group: "none",
      page: 1,
      pageSize: 25,
      offset: 0,
    });
  });

  it("recognizes only supported row densities", () => {
    expect(isEngagementDensity("comfortable")).toBe(true);
    expect(isEngagementDensity("compact")).toBe(true);
    expect(isEngagementDensity("tiny")).toBe(false);
  });
});
