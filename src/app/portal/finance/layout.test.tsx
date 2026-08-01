import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthContext: vi.fn(),
  getPortalAccessSummary: vi.fn(),
  hasCapability: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("@/lib/auth", () => ({ requireAuthContext: mocks.requireAuthContext }));
vi.mock("@/lib/access-control", () => ({
  getPortalAccessSummary: mocks.getPortalAccessSummary,
  hasCapability: mocks.hasCapability,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import FinanceLayout from "./layout";

describe("Finance layout authorization", () => {
  beforeEach(() => {
    mocks.requireAuthContext.mockReset().mockResolvedValue({
      userId: "user-1",
      role: "contractor",
    });
    mocks.getPortalAccessSummary.mockReset().mockResolvedValue({
      role: "contractor",
      capabilities: [],
      scope: "assigned",
      permissionProfile: null,
    });
    mocks.hasCapability.mockReset();
    mocks.redirect.mockClear();
  });

  it("redirects users without finance visibility before rendering the page", async () => {
    mocks.hasCapability.mockReturnValue(false);

    await expect(FinanceLayout({ children: "finance" })).rejects.toThrow("redirect:/portal");
    expect(mocks.redirect).toHaveBeenCalledWith("/portal");
  });

  it("renders finance for an authorized role", async () => {
    mocks.hasCapability.mockReturnValue(true);

    await expect(FinanceLayout({ children: "finance" })).resolves.toBe("finance");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
