import { redirect } from "next/navigation";
import { describe, expect, it } from "vitest";

import PortalRedirect from "./page";

describe("Portal route", () => {
  it("redirects legacy portal traffic to the secure office", () => {
    expect(() => PortalRedirect()).toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/office");
  });
});
