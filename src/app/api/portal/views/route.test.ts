import { beforeEach, describe, expect, it, vi } from "vitest";

const sql = vi.fn();
const authMocks = vi.hoisted(() => ({ getAuthContext: vi.fn() }));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => sql) }));
vi.mock("@/lib/schema-readiness", () => ({
  assertRequiredSchemaVersions: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/auth", () => ({ getAuthContext: authMocks.getAuthContext }));

import { POST } from "./route";

describe("saved engagement board views", () => {
  beforeEach(() => {
    sql.mockReset();
    authMocks.getAuthContext.mockReset();
    authMocks.getAuthContext.mockResolvedValue({
      userId: "admin-1",
      role: "admin",
      user: { id: "admin-1", name: "Admin", email: "admin@example.com", role: "admin" },
    });
  });

  it("persists sorting, grouping, column order, visibility, and density", async () => {
    sql.mockResolvedValue([{ id: "view-1", name: "Owner review" }]);

    const response = await POST(new Request("http://localhost/api/portal/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module: "engagements",
        name: "Owner review",
        viewType: "table",
        filters: { health: "at_risk" },
        sorting: [{ field: "owner", direction: "asc" }],
        grouping: { field: "owner" },
        columns: {
          order: ["owner", "client", "stage"],
          visible: ["owner", "client"],
          density: "compact",
        },
        sharing: "workspace",
      }),
    }));

    expect(response.status).toBe(201);
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("rejects unsupported density values before touching the database", async () => {
    const response = await POST(new Request("http://localhost/api/portal/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module: "engagements",
        name: "Broken view",
        columns: { order: [], visible: [], density: "tiny" },
      }),
    }));

    expect(response.status).toBe(400);
    expect(sql).not.toHaveBeenCalled();
  });
});
