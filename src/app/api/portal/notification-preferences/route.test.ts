import { beforeEach, describe, expect, it, vi } from "vitest";

const sql = vi.fn();
const authMocks = vi.hoisted(() => ({ getAuthContext: vi.fn() }));

vi.mock("@/lib/auth", () => ({ getAuthContext: authMocks.getAuthContext }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => sql) }));
vi.mock("@/lib/schema-readiness", () => ({
  assertRequiredSchemaVersions: vi.fn().mockResolvedValue(undefined),
}));

import { GET, PATCH } from "./route";

const context = {
  userId: "client-1",
  role: "client" as const,
  user: { id: "client-1", name: "Client", email: "client@example.com", role: "client" as const },
};

describe("Personal notification preferences", () => {
  beforeEach(() => {
    sql.mockReset();
    authMocks.getAuthContext.mockReset().mockResolvedValue(context);
  });

  it("returns enabled defaults when no personal record exists", async () => {
    sql.mockResolvedValueOnce([]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      preferences: {
        email: { messages: true, documents: true, finance: true, tasks: true },
      },
    });
  });

  it("writes only the authenticated user's preference key", async () => {
    sql.mockResolvedValueOnce(undefined);
    const preferences = {
      email: { messages: false, documents: true, finance: false, tasks: true },
    };
    const response = await PATCH(new Request("http://localhost/api/portal/notification-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preferences),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ preferences });
    expect(sql.mock.calls[0].slice(1)).toContain("notifications:client-1");
    expect(sql.mock.calls[0].slice(1)).toContain("client-1");
  });
});
