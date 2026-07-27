import { beforeEach, describe, expect, it, vi } from "vitest";

const sql = vi.fn();
const authMocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  setSessionCookie: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  ensureAccessControlTables: vi.fn().mockResolvedValue(undefined),
  getDb: vi.fn(() => sql),
}));
vi.mock("@/lib/auth", () => ({
  createSession: authMocks.createSession,
  setSessionCookie: authMocks.setSessionCookie,
}));
vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed-password"),
}));

import { POST } from "./route";

describe("Private Office registration boundary", () => {
  beforeEach(() => {
    sql.mockReset();
    authMocks.createSession.mockReset();
    authMocks.setSessionCookie.mockReset();
  });

  it("rejects an unknown self-service account without an invitation", async () => {
    sql.mockResolvedValueOnce([]);
    const response = await POST(new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Uninvited User",
        email: "uninvited@example.com",
        password: "LongPassword123!",
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("invitation");
    expect(authMocks.createSession).not.toHaveBeenCalled();
  });
});
