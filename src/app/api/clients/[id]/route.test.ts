import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ getAuthContext: vi.fn() }));
const accessMocks = vi.hoisted(() => ({ getPortalAccessSummary: vi.fn() }));
const dbMocks = vi.hoisted(() => {
  const tx = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    text: strings.join("?"),
    values,
  }));
  const transaction = vi.fn();
  const sql = Object.assign(vi.fn(), { transaction });
  return { sql, transaction, tx };
});

vi.mock("@/lib/auth", () => ({ getAuthContext: authMocks.getAuthContext }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => dbMocks.sql) }));
vi.mock("@/lib/schema-readiness", () => ({
  assertRequiredSchemaVersions: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/access-control", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/access-control")>();
  return { ...actual, getPortalAccessSummary: accessMocks.getPortalAccessSummary };
});

import { PATCH } from "./route";

const request = () => new Request("http://localhost/api/clients/client-1", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Roman Cantelearist",
    email: "roman@ecosremodeling.com",
    phone: "310-555-0100",
  }),
});

describe("Client identity updates", () => {
  beforeEach(() => {
    authMocks.getAuthContext.mockReset();
    accessMocks.getPortalAccessSummary.mockReset();
    dbMocks.sql.mockReset();
    dbMocks.transaction.mockReset();
    dbMocks.tx.mockClear();
  });

  it("updates the client and mandatory audit event atomically for Super Admin", async () => {
    authMocks.getAuthContext.mockResolvedValue({
      userId: "super-admin-1",
      role: "super_admin",
      user: { id: "super-admin-1", name: "Super Admin", email: "admin@example.com", role: "super_admin" },
    });
    accessMocks.getPortalAccessSummary.mockResolvedValue({
      role: "super_admin",
      capabilities: [],
      scope: "global",
      permissionProfile: null,
    });
    dbMocks.sql.mockResolvedValueOnce([{
      id: "client-1",
      name: "Alexandra Voss",
      email: "avoss@example.com",
      phone: null,
    }]);
    dbMocks.transaction.mockImplementation(async (build) => {
      const queries = build(dbMocks.tx);
      expect(queries).toHaveLength(2);
      expect(queries[0].text).toContain("UPDATE clients");
      expect(queries[1].text).toContain("INSERT INTO access_audit_events");
      return [[{
        id: "client-1",
        name: "Roman Cantelearist",
        email: "roman@ecosremodeling.com",
        phone: "310-555-0100",
      }], []];
    });

    const response = await PATCH(request(), { params: Promise.resolve({ id: "client-1" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      client: expect.objectContaining({ email: "roman@ecosremodeling.com" }),
    });
    expect(dbMocks.transaction).toHaveBeenCalledOnce();
  });

  it("prevents an assigned Admin from changing a shared client record", async () => {
    authMocks.getAuthContext.mockResolvedValue({
      userId: "admin-1",
      role: "admin",
      user: { id: "admin-1", name: "Admin", email: "admin@example.com", role: "admin" },
    });
    accessMocks.getPortalAccessSummary.mockResolvedValue({
      role: "admin",
      capabilities: ["clients.manage"],
      scope: "assigned",
      permissionProfile: { id: "profile-1", name: "Operations Admin" },
    });

    const response = await PATCH(request(), { params: Promise.resolve({ id: "client-1" }) });

    expect(response.status).toBe(403);
    expect(dbMocks.sql).not.toHaveBeenCalled();
    expect(dbMocks.transaction).not.toHaveBeenCalled();
  });
});
