import { beforeEach, describe, expect, it, vi } from "vitest";

const sql = vi.fn();
const authMocks = vi.hoisted(() => ({ getAuthContext: vi.fn() }));
const accessMocks = vi.hoisted(() => ({
  getPortalAccessSummary: vi.fn(),
  authorizeCapability: vi.fn(),
}));
const dbMocks = vi.hoisted(() => ({ logMatterEvent: vi.fn() }));

vi.mock("@/lib/auth", () => ({ getAuthContext: authMocks.getAuthContext }));
vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => sql),
  logMatterEvent: dbMocks.logMatterEvent,
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

import { PATCH, POST } from "./route";

const itemId = "79f57a89-fb93-48cb-b120-c472f510d5cf";

describe("Contractor workflow authority", () => {
  beforeEach(() => {
    sql.mockReset();
    authMocks.getAuthContext.mockReset();
    accessMocks.getPortalAccessSummary.mockReset();
    accessMocks.authorizeCapability.mockReset();
    dbMocks.logMatterEvent.mockReset();
    authMocks.getAuthContext.mockResolvedValue({
      userId: "contractor-1",
      role: "contractor",
      user: {
        id: "contractor-1",
        name: "Contractor",
        email: "contractor@example.com",
        role: "contractor",
      },
    });
    accessMocks.getPortalAccessSummary.mockResolvedValue({
      role: "contractor",
      capabilities: ["timeline.view", "timeline.manage"],
      scope: "assigned",
      permissionProfile: null,
    });
    accessMocks.authorizeCapability.mockResolvedValue(true);
  });

  it("prevents contractors from defining workflow requirements", async () => {
    const response = await POST(
      new Request("http://localhost/api/matters/matter-1/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageKey: "assessment", title: "Inspect conditions" }),
      }),
      { params: Promise.resolve({ id: "matter-1" }) },
    );

    expect(response.status).toBe(403);
    expect(sql).not.toHaveBeenCalled();
  });

  it("returns the assignee name with a newly created requirement", async () => {
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
    sql
      .mockResolvedValueOnce([{ id: "matter-1" }])
      .mockResolvedValueOnce([{ id: "contractor-1", name: "Contractor" }])
      .mockResolvedValueOnce([{
        id: itemId,
        matter_id: "matter-1",
        title: "Inspect conditions",
        assignee_user_id: "contractor-1",
      }]);

    const response = await POST(
      new Request("http://localhost/api/matters/matter-1/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageKey: "assessment",
          title: "Inspect conditions",
          assigneeUserId: "contractor-1",
        }),
      }),
      { params: Promise.resolve({ id: "matter-1" }) },
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      item: expect.objectContaining({
        assignee_user_id: "contractor-1",
        assignee_name: "Contractor",
      }),
    });
  });

  it("hides an unassigned workflow item from contractor updates", async () => {
    sql.mockResolvedValueOnce([{ id: itemId, matter_id: "matter-1", assignee_user_id: null }]);

    const response = await PATCH(
      new Request("http://localhost/api/matters/matter-1/workflow", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, status: "completed" }),
      }),
      { params: Promise.resolve({ id: "matter-1" }) },
    );

    expect(response.status).toBe(404);
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("allows contractors to complete their own assigned requirement", async () => {
    sql
      .mockResolvedValueOnce([{
        id: itemId,
        matter_id: "matter-1",
        title: "Inspect conditions",
        assignee_user_id: "contractor-1",
      }])
      .mockResolvedValueOnce([{
        id: itemId,
        matter_id: "matter-1",
        title: "Inspect conditions",
        status: "completed",
        assignee_user_id: "contractor-1",
      }]);

    const response = await PATCH(
      new Request("http://localhost/api/matters/matter-1/workflow", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, status: "completed" }),
      }),
      { params: Promise.resolve({ id: "matter-1" }) },
    );

    expect(response.status).toBe(200);
    expect(dbMocks.logMatterEvent).toHaveBeenCalledWith(expect.objectContaining({
      matterId: "matter-1",
      userId: "contractor-1",
      eventType: "workflow_completed",
    }));
  });
});
