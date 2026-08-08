import { beforeEach, describe, expect, it, vi } from "vitest";

const sql = Object.assign(vi.fn(), { transaction: vi.fn() });
const authMocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getAuthContext: vi.fn(),
  hashSessionToken: vi.fn(),
}));
const passwordMocks = vi.hoisted(() => ({
  assertPassword: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));
const ratelimitMocks = vi.hoisted(() => ({ ratelimit: vi.fn() }));
const auditMocks = vi.hoisted(() => ({ accessAuditQuery: vi.fn(() => Promise.resolve()) }));

vi.mock("next/headers", () => ({ cookies: authMocks.cookies }));
vi.mock("@/lib/auth", () => ({
  getAuthContext: authMocks.getAuthContext,
  hashSessionToken: authMocks.hashSessionToken,
  SESSION_COOKIE: "jra_session",
}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => sql) }));
vi.mock("@/lib/password", () => passwordMocks);
vi.mock("@/lib/ratelimit", () => ({ ratelimit: ratelimitMocks.ratelimit }));
vi.mock("@/lib/access-control", () => ({ accessAuditQuery: auditMocks.accessAuditQuery }));
vi.mock("@/lib/schema-readiness", () => ({
  assertRequiredSchemaVersions: vi.fn().mockResolvedValue(undefined),
}));

import { GET, PATCH, POST } from "./route";

const context = {
  userId: "user-1",
  role: "client" as const,
  user: { id: "user-1", name: "Client", email: "client@example.com", role: "client" as const },
};

describe("Personal account API", () => {
  beforeEach(() => {
    sql.mockReset();
    sql.transaction.mockReset();
    authMocks.getAuthContext.mockReset().mockResolvedValue(context);
    authMocks.hashSessionToken.mockReset().mockReturnValue("current-session-hash");
    authMocks.cookies.mockReset().mockResolvedValue({ get: vi.fn(() => ({ value: "session-token" })) });
    passwordMocks.assertPassword.mockReset();
    passwordMocks.hashPassword.mockReset().mockResolvedValue("new-password-hash");
    passwordMocks.verifyPassword.mockReset().mockResolvedValue(true);
    ratelimitMocks.ratelimit.mockReset().mockResolvedValue({ available: true, blocked: false });
    auditMocks.accessAuditQuery.mockClear();
  });

  it("rejects unauthenticated account reads", async () => {
    authMocks.getAuthContext.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns only the current user's account and active sessions", async () => {
    sql
      .mockResolvedValueOnce([{ name: "Client", email: "client@example.com", role: "client", lastActiveAt: null }])
      .mockResolvedValueOnce([{ id: "session-1", isCurrent: true, createdAt: "2026-08-07T00:00:00.000Z", expiresAt: "2026-08-07T12:00:00.000Z" }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      profile: { name: "Client", email: "client@example.com", role: "client", lastActiveAt: null },
      sessions: [{ id: "session-1", isCurrent: true, createdAt: "2026-08-07T00:00:00.000Z", expiresAt: "2026-08-07T12:00:00.000Z" }],
    });
    expect(sql.mock.calls[0].slice(1)).toContain("user-1");
    expect(sql.mock.calls[1].slice(1)).toContain("user-1");
    expect(sql.mock.calls[1].slice(1)).toContain("current-session-hash");
  });

  it("updates only the authenticated user's name and records the change", async () => {
    sql.transaction.mockImplementationOnce(async (callback) => {
      callback(sql);
      return [[{ name: "Updated", email: "client@example.com", role: "client" }], undefined];
    });
    const response = await PATCH(new Request("http://localhost/api/portal/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ profile: { name: "Updated", email: "client@example.com", role: "client" } });
    expect(auditMocks.accessAuditQuery).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      actorId: "user-1", action: "account.profile_updated", targetUserId: "user-1",
    }));
  });

  it("rejects an incorrect current password before changing credentials", async () => {
    sql.mockResolvedValueOnce([{ password_hash: "old-password-hash" }]);
    passwordMocks.verifyPassword.mockResolvedValueOnce(false);
    const response = await POST(new Request("http://localhost/api/portal/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "change_password", currentPassword: "wrong password", newPassword: "a secure new password" }),
    }));
    expect(response.status).toBe(401);
    expect(sql.transaction).not.toHaveBeenCalled();
  });

  it("revokes only other sessions and records the security action", async () => {
    sql.transaction.mockImplementationOnce(async (callback) => {
      callback(sql);
      return [undefined, undefined];
    });
    const response = await POST(new Request("http://localhost/api/portal/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke_other_sessions" }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revoked: true });
    expect(auditMocks.accessAuditQuery).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: "account.sessions_revoked", metadata: { scope: "other_sessions" },
    }));
  });
});
