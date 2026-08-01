import { beforeEach, describe, expect, it, vi } from "vitest";

const sql = vi.fn();
const authMocks = vi.hoisted(() => ({ getAuthContext: vi.fn() }));
const accessMocks = vi.hoisted(() => ({
  getPortalAccessSummary: vi.fn(),
  authorizeCapability: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthContext: authMocks.getAuthContext }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => sql) }));
vi.mock("@/lib/schema-readiness", () => ({
  assertRequiredSchemaVersions: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/access-control", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/access-control")>();
  return {
    ...actual,
    getPortalAccessSummary: accessMocks.getPortalAccessSummary,
    authorizeCapability: accessMocks.authorizeCapability,
  };
});

import { PATCH } from "./route";

const context = {
  userId: "client-1",
  role: "client" as const,
  user: { id: "client-1", name: "Client", email: "client@example.com", role: "client" as const },
};
const access = {
  role: "client" as const,
  capabilities: ["messages.view"],
  scope: "assigned" as const,
  permissionProfile: null,
};
const threadId = "11111111-1111-4111-8111-111111111111";

function request(body: unknown) {
  return new Request("http://localhost/api/portal/inbox", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Portal inbox thread read state", () => {
  beforeEach(() => {
    sql.mockReset();
    authMocks.getAuthContext.mockReset().mockResolvedValue(context);
    accessMocks.getPortalAccessSummary.mockReset().mockResolvedValue(access);
    accessMocks.authorizeCapability.mockReset();
  });

  it("rejects malformed thread identifiers before reading the database", async () => {
    const response = await PATCH(request({ threadId: "invalid" }));
    expect(response.status).toBe(400);
    expect(sql).not.toHaveBeenCalled();
  });

  it("does not mark a thread outside the user's engagement scope", async () => {
    sql.mockResolvedValueOnce([{ matter_id: "matter-2" }]);
    accessMocks.authorizeCapability.mockResolvedValue(false);
    const response = await PATCH(request({ threadId }));
    expect(response.status).toBe(404);
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("marks every message in an authorized thread as read", async () => {
    sql
      .mockResolvedValueOnce([{ matter_id: "matter-1" }])
      .mockResolvedValueOnce(undefined);
    accessMocks.authorizeCapability.mockResolvedValue(true);
    const response = await PATCH(request({ threadId }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ updated: true });
    expect(sql).toHaveBeenCalledTimes(2);
    expect(sql.mock.calls[1].slice(1)).toContain(threadId);
    expect(sql.mock.calls[1].slice(1)).toContain("matter-1");
  });
});
