import { beforeEach, describe, expect, it, vi } from "vitest";

const sql = vi.fn();
const authMocks = vi.hoisted(() => ({ getAuthContext: vi.fn() }));
const policyMocks = vi.hoisted(() => ({ getPortalAccessSummary: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => sql),
  logMatterEvent: vi.fn(),
}));
vi.mock("@/lib/schema-readiness", () => ({
  assertRequiredSchemaVersions: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/auth", () => ({ getAuthContext: authMocks.getAuthContext }));
vi.mock("@/lib/access-control", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/access-control")>();
  return { ...actual, getPortalAccessSummary: policyMocks.getPortalAccessSummary };
});

import { GET } from "./route";

describe("engagement board list endpoint", () => {
  beforeEach(() => {
    sql.mockReset();
    authMocks.getAuthContext.mockReset();
    policyMocks.getPortalAccessSummary.mockReset();
    authMocks.getAuthContext.mockResolvedValue({
      userId: "super-1",
      role: "super_admin",
      user: { id: "super-1", name: "Super Admin", email: "admin@example.com", role: "super_admin" },
    });
    policyMocks.getPortalAccessSummary.mockResolvedValue({
      role: "super_admin",
      capabilities: [],
      scope: "global",
      permissionProfile: null,
    });
  });

  it("requires an authenticated portal session", async () => {
    authMocks.getAuthContext.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/matters"));

    expect(response.status).toBe(401);
    expect(sql).not.toHaveBeenCalled();
  });

  it("uses one look-ahead row to return exact page boundaries", async () => {
    sql.mockResolvedValue(Array.from({ length: 26 }, (_, index) => ({
      id: `matter-${index + 1}`,
      title: `Matter ${index + 1}`,
      client_email: "client@example.com",
    })));

    const response = await GET(new Request(
      "http://localhost/api/matters?sort=client&direction=asc&group=owner&page=2&page_size=25",
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.matters).toHaveLength(25);
    expect(body.page).toEqual({ number: 2, limit: 25, offset: 25, hasMore: true });
  });

  it("does not expose client email without the client-view capability", async () => {
    policyMocks.getPortalAccessSummary.mockResolvedValue({
      role: "admin",
      capabilities: ["engagements.view"],
      scope: "global",
      permissionProfile: null,
    });
    authMocks.getAuthContext.mockResolvedValue({
      userId: "admin-1",
      role: "admin",
      user: { id: "admin-1", name: "Admin", email: "admin@example.com", role: "admin" },
    });
    sql.mockResolvedValue([{ id: "matter-1", title: "Matter", client_email: "private@example.com" }]);

    const response = await GET(new Request("http://localhost/api/matters?page_size=25"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.matters[0]).not.toHaveProperty("client_email");
  });
});
