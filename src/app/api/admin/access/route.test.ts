import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getAuthContext: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAuthContext: authMocks.getAuthContext,
  isSuperAdmin: (role?: string) => role === "super_admin",
}));

import { GET } from "./route";

describe("Super Admin access-management boundary", () => {
  beforeEach(() => {
    authMocks.getAuthContext.mockReset();
  });

  it("returns 401 without a valid session", async () => {
    authMocks.getAuthContext.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it.each(["admin", "contractor", "client"] as const)(
    "returns 403 to the %s role",
    async (role) => {
      authMocks.getAuthContext.mockResolvedValue({
        userId: `user-${role}`,
        user: {
          id: `user-${role}`,
          name: role,
          email: `${role}@example.com`,
          role,
        },
        role,
      });
      const response = await GET();
      expect(response.status).toBe(403);
    },
  );
});
