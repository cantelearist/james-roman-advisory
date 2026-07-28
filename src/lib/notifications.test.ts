import { beforeEach, describe, expect, it, vi } from "vitest";

const ensureTables = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  ensureEngagementOperationsTables: ensureTables,
  getDb: vi.fn(),
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
});
