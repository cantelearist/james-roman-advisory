import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getAuthContext: vi.fn(),
}));
const dbMocks = vi.hoisted(() => {
  const tx = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    text: strings.join("?"),
    values,
  }));
  const transaction = vi.fn();
  const sql = vi.fn();
  Object.assign(sql, { transaction });
  return { sql, transaction, tx };
});

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, getAuthContext: authMocks.getAuthContext };
});
vi.mock("@/lib/db", () => ({
  ensureEngagementOperationsTables: vi.fn(),
  ensureAccessControlTables: vi.fn(),
  getDb: vi.fn(() => dbMocks.sql),
}));

import { GET, PATCH } from "./route";

describe("Super Admin automation boundary", () => {
  beforeEach(() => {
    authMocks.getAuthContext.mockReset();
    dbMocks.sql.mockReset();
    dbMocks.tx.mockClear();
    dbMocks.transaction.mockReset();
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

  it("commits an automation mutation and its access audit atomically", async () => {
    authMocks.getAuthContext.mockResolvedValue({
      userId: "super-admin-1",
      role: "super_admin",
      user: {
        id: "super-admin-1",
        name: "Super Admin",
        email: "admin@example.com",
        role: "super_admin",
      },
    });
    dbMocks.sql.mockResolvedValueOnce([{
      id: "automation-client-message",
      recipe_key: "client-message",
      action_type: "create_task",
      configuration: {},
    }]);
    dbMocks.transaction.mockImplementation(async (build) => {
      const queries = build(dbMocks.tx);
      expect(queries).toHaveLength(2);
      expect(queries[0].text).toContain("UPDATE portal_automations");
      expect(queries[1].text).toContain("INSERT INTO access_audit_events");
      return [[{ id: "automation-client-message", enabled: false }], []];
    });

    const response = await PATCH(
      new Request("http://localhost/api/admin/automations", {
        method: "PATCH",
        body: JSON.stringify({
          id: "automation-client-message",
          enabled: false,
          ownerUserId: null,
        }),
      }),
    );

    expect(response).toBeDefined();
    expect(response!.status).toBe(200);
    expect(dbMocks.transaction).toHaveBeenCalledOnce();
  });
});
