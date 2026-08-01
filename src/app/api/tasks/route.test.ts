import { beforeEach, describe, expect, it, vi } from "vitest";

const sql = vi.fn();
const authMocks = vi.hoisted(() => ({ getAuthContext: vi.fn() }));
const accessMocks = vi.hoisted(() => ({
  getPortalAccessSummary: vi.fn(),
  authorizeCapability: vi.fn(),
}));
const dbMocks = vi.hoisted(() => ({ logMatterEvent: vi.fn() }));
const notificationMocks = vi.hoisted(() => ({ notifyEngagementMembers: vi.fn() }));

vi.mock("@/lib/auth", () => ({ getAuthContext: authMocks.getAuthContext }));
vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => sql),
  logMatterEvent: dbMocks.logMatterEvent,
}));
vi.mock("@/lib/notifications", () => ({
  notifyEngagementMembers: notificationMocks.notifyEngagementMembers,
}));
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

import { POST } from "./route";

describe("Task creation", () => {
  beforeEach(() => {
    sql.mockReset();
    authMocks.getAuthContext.mockReset();
    accessMocks.getPortalAccessSummary.mockReset();
    accessMocks.authorizeCapability.mockReset();
    dbMocks.logMatterEvent.mockReset();
    notificationMocks.notifyEngagementMembers.mockReset();
    authMocks.getAuthContext.mockResolvedValue({
      userId: "super-admin-1",
      role: "super_admin",
      user: { id: "super-admin-1", name: "Super Admin", email: "admin@example.com", role: "super_admin" },
    });
    accessMocks.getPortalAccessSummary.mockResolvedValue({
      role: "super_admin",
      capabilities: ["timeline.manage"],
      scope: "global",
      permissionProfile: null,
    });
    accessMocks.authorizeCapability.mockResolvedValue(true);
  });

  it("returns the assignee name with a newly created task", async () => {
    const matterId = "1b95e82c-2e82-45aa-ad2d-3bf8db667692";
    sql
      .mockResolvedValueOnce([{ id: matterId, title: "Test engagement" }])
      .mockResolvedValueOnce([{ id: "contractor-1", name: "Contractor" }])
      .mockResolvedValueOnce([{
        id: "task-1",
        matter_id: matterId,
        title: "Verify assigned work",
        assignee_user_id: "contractor-1",
        audience: "contractor",
      }]);

    const response = await POST(new Request("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matterId,
        title: "Verify assigned work",
        assigneeUserId: "contractor-1",
        audience: "contractor",
      }),
    }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      task: expect.objectContaining({
        assignee_user_id: "contractor-1",
        assignee_name: "Contractor",
      }),
    });
  });
});
