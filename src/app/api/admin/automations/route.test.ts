import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getAuthContext: vi.fn(),
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, getAuthContext: authMocks.getAuthContext };
});
vi.mock("@/lib/db", () => ({
  ensureEngagementOperationsTables: vi.fn(),
  getDb: vi.fn(),
}));
vi.mock("@/lib/access-control", () => ({
  logAccessAudit: vi.fn(),
}));

import { GET, PATCH } from "./route";

describe("Super Admin automation boundary", () => {
  beforeEach(() => {
    authMocks.getAuthContext.mockReset();
  });

  it("returns 401 without a session", async () => {
    authMocks.getAuthContext.mockResolvedValue(null);
    expect((await GET())!.status).toBe(401);
  });

  for (const role of ["admin", "contractor", "client"] as const) {
    it(`returns 403 to the ${role} role`, async () => {
      authMocks.getAuthContext.mockResolvedValue({
        userId: `${role}-1`,
        role,
        user: { id: `${role}-1`, name: role, email: `${role}@example.com`, role },
      });
      expect((await GET())!.status).toBe(403);
      expect((await PATCH(new Request("http://localhost/api/admin/automations", {
        method: "PATCH",
        body: JSON.stringify({ id: "automation-client-message", enabled: true, ownerUserId: "user-1" }),
      })))!.status).toBe(403);
    });
  }
});
