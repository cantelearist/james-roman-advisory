import { beforeEach, describe, expect, it, vi } from "vitest";

const sql = Object.assign(vi.fn(), { transaction: vi.fn() });
const authMocks = vi.hoisted(() => ({ getAuthContext: vi.fn() }));
const passwordMocks = vi.hoisted(() => ({ verifyPassword: vi.fn() }));
const ratelimitMocks = vi.hoisted(() => ({ ratelimit: vi.fn() }));
const mfaMocks = vi.hoisted(() => ({
  createOtpAuthUri: vi.fn(),
  createRecoveryCodes: vi.fn(),
  decryptMfaSecret: vi.fn(),
  encryptMfaSecret: vi.fn(),
  generateTotpSecret: vi.fn(),
  hashAuthToken: vi.fn(),
  normalizeRecoveryCode: vi.fn(),
  verifyTotp: vi.fn(),
}));
const auditMocks = vi.hoisted(() => ({ accessAuditQuery: vi.fn(() => Promise.resolve()) }));

vi.mock("@/lib/auth", () => ({ getAuthContext: authMocks.getAuthContext }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => sql) }));
vi.mock("@/lib/password", () => ({ verifyPassword: passwordMocks.verifyPassword }));
vi.mock("@/lib/ratelimit", () => ({ ratelimit: ratelimitMocks.ratelimit }));
vi.mock("@/lib/mfa", () => mfaMocks);
vi.mock("@/lib/access-control", () => ({ accessAuditQuery: auditMocks.accessAuditQuery }));
vi.mock("@/lib/schema-readiness", () => ({
  assertRequiredSchemaVersions: vi.fn().mockResolvedValue(undefined),
}));

import { GET, POST } from "./route";

const context = {
  userId: "user-1",
  role: "client" as const,
  user: { id: "user-1", name: "Client", email: "client@example.com", role: "client" as const },
};

describe("Personal MFA API", () => {
  beforeEach(() => {
    sql.mockReset();
    sql.transaction.mockReset();
    authMocks.getAuthContext.mockReset().mockResolvedValue(context);
    passwordMocks.verifyPassword.mockReset().mockResolvedValue(true);
    ratelimitMocks.ratelimit.mockReset().mockResolvedValue({ available: true, blocked: false });
    mfaMocks.createRecoveryCodes.mockReset().mockReturnValue(["AAAA-BBBB-CCCC-DDDD"]);
    mfaMocks.decryptMfaSecret.mockReset().mockReturnValue("secret");
    mfaMocks.encryptMfaSecret.mockReset().mockReturnValue("encrypted-secret");
    mfaMocks.generateTotpSecret.mockReset().mockReturnValue("SETUPKEY");
    mfaMocks.hashAuthToken.mockReset().mockReturnValue("code-hash");
    mfaMocks.normalizeRecoveryCode.mockReset().mockImplementation((value: string) => value);
    mfaMocks.verifyTotp.mockReset().mockReturnValue(123);
    auditMocks.accessAuditQuery.mockClear();
  });

  it("rejects unauthenticated MFA reads", async () => {
    authMocks.getAuthContext.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns the authenticated user's MFA status without secrets", async () => {
    sql
      .mockResolvedValueOnce([{ enabledAt: "2026-08-07T00:00:00.000Z" }])
      .mockResolvedValueOnce([{ count: 6 }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      enabled: true,
      enabledAt: "2026-08-07T00:00:00.000Z",
      recoveryCodesRemaining: 6,
    });
  });

  it("requires the current password before creating an MFA enrollment secret", async () => {
    sql.mockResolvedValueOnce([{ password_hash: "password-hash" }]);
    passwordMocks.verifyPassword.mockResolvedValueOnce(false);
    const response = await POST(new Request("http://localhost/api/portal/account/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "begin_enrollment", currentPassword: "wrong password" }),
    }));
    expect(response.status).toBe(401);
    expect(sql.transaction).not.toHaveBeenCalled();
  });

  it("does not confirm enrollment without a pending MFA method", async () => {
    sql.mockResolvedValueOnce([]);
    const response = await POST(new Request("http://localhost/api/portal/account/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm_enrollment", code: "123456" }),
    }));
    expect(response.status).toBe(409);
    expect(sql.transaction).not.toHaveBeenCalled();
  });

  it("fails closed when account-security rate limiting is unavailable", async () => {
    ratelimitMocks.ratelimit.mockResolvedValueOnce({ available: false, blocked: true });
    const response = await POST(new Request("http://localhost/api/portal/account/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "begin_enrollment", currentPassword: "current password" }),
    }));
    expect(response.status).toBe(503);
  });
});
