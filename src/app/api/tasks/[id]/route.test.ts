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

import { PATCH } from "./route";

describe("Contractor task authority", () => {
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

  it("allows contractors to complete their own assigned task", async () => {
    sql
      .mockResolvedValueOnce([{
        id: "task-1",
        matter_id: "matter-1",
        title: "Site measurement",
        status: "open",
        audience: "contractor",
        assignee_user_id: "contractor-1",
      }])
      .mockResolvedValueOnce([{
        id: "task-1",
        matter_id: "matter-1",
        title: "Site measurement",
        status: "completed",
        audience: "contractor",
        assignee_user_id: "contractor-1",
      }]);

    const response = await PATCH(
      new Request("http://localhost/api/tasks/task-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      }),
      { params: Promise.resolve({ id: "task-1" }) },
    );

    expect(response.status).toBe(200);
    expect(dbMocks.logMatterEvent).toHaveBeenCalledWith(expect.objectContaining({
      matterId: "matter-1",
      userId: "contractor-1",
      eventType: "task_completed",
    }));
  });

  it("prevents contractors from editing task definitions", async () => {
    sql.mockResolvedValueOnce([{
      id: "task-1",
      matter_id: "matter-1",
      title: "Site measurement",
      status: "open",
      audience: "contractor",
      assignee_user_id: "contractor-1",
    }]);

    const response = await PATCH(
      new Request("http://localhost/api/tasks/task-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Changed scope" }),
      }),
      { params: Promise.resolve({ id: "task-1" }) },
    );

    expect(response.status).toBe(403);
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("prevents contractors from reopening a cancelled task", async () => {
    sql.mockResolvedValueOnce([{
      id: "task-1",
      matter_id: "matter-1",
      title: "Cancelled site visit",
      status: "cancelled",
      audience: "contractor",
      assignee_user_id: "contractor-1",
    }]);

    const response = await PATCH(
      new Request("http://localhost/api/tasks/task-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "open" }),
      }),
      { params: Promise.resolve({ id: "task-1" }) },
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Cancelled tasks are controlled by staff" });
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("hides tasks assigned to another user", async () => {
    sql.mockResolvedValueOnce([{
      id: "task-1",
      matter_id: "matter-1",
      title: "Site measurement",
      status: "open",
      audience: "contractor",
      assignee_user_id: "contractor-2",
    }]);

    const response = await PATCH(
      new Request("http://localhost/api/tasks/task-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      }),
      { params: Promise.resolve({ id: "task-1" }) },
    );

    expect(response.status).toBe(404);
    expect(sql).toHaveBeenCalledTimes(1);
  });
});
