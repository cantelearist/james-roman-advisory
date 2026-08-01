import { beforeEach, describe, expect, it, vi } from "vitest";

const ensureTables = vi.hoisted(() => vi.fn());
const sql = vi.hoisted(() => vi.fn());
const resendSend = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => sql),
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSend };
  },
}));
vi.mock("@/lib/schema-readiness", () => ({
  assertRequiredSchemaVersions: ensureTables,
}));

import { notifyEngagementMembers } from "./notifications";

const options = {
  matterId: "matter-1",
  actorId: "user-1",
  audience: "client" as const,
  eventType: "message_received" as const,
  subject: "New message",
  preview: "A private message is available.",
  path: "/portal/matters/matter-1",
};

describe("notifyEngagementMembers failure contract", () => {
  beforeEach(() => {
    ensureTables.mockReset();
    sql.mockReset();
    resendSend.mockReset();
    vi.unstubAllEnvs();
  });

  it("contains infrastructure failures and reports degraded delivery", async () => {
    const error = new Error("database unavailable");
    ensureTables.mockRejectedValue(error);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(notifyEngagementMembers(options)).resolves.toEqual({
      sent: 0,
      failed: 1,
      degraded: true,
    });
    expect(console.error).toHaveBeenCalledWith(
      "notification.delivery.failed",
      expect.objectContaining({
        matterId: options.matterId,
        eventType: options.eventType,
        error,
      }),
    );
  });

  it("keeps the in-app record but skips email when the recipient disabled that event", async () => {
    vi.stubEnv("RESEND_API_KEY", "resend-test-key");
    ensureTables.mockResolvedValue(undefined);
    sql.mockImplementation((strings: TemplateStringsArray) => {
      const query = strings.join(" ");
      if (query.includes("FROM portal_settings WHERE key = 'workspace'")) return Promise.resolve([{ value: {} }]);
      if (query.includes("SELECT DISTINCT u.id")) {
        return Promise.resolve([{
          id: "client-2",
          name: "Client Two",
          email: "client2@example.com",
          role: "client",
          notification_preferences: { email: { messages: false, documents: true, finance: true, tasks: true } },
        }]);
      }
      return Promise.resolve([]);
    });

    await expect(notifyEngagementMembers(options)).resolves.toEqual({
      sent: 0,
      failed: 0,
      degraded: false,
    });
    expect(resendSend).not.toHaveBeenCalled();
    expect(sql.mock.calls.some((call) => String(call[0]).includes("INSERT INTO portal_notifications"))).toBe(true);
    expect(sql.mock.calls.some((call) => call.slice(1).includes("user_disabled"))).toBe(true);
  });
});
