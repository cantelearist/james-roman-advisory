import { describe, expect, it, vi } from "vitest";

const ensureTables = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(),
}));
vi.mock("@/lib/schema-readiness", () => ({
  assertRequiredSchemaVersions: ensureTables,
}));

import { logAccessAudit } from "./access-control";

describe("logAccessAudit failure contract", () => {
  it("fails closed and emits structured diagnostics", async () => {
    const cause = new Error("database unavailable");
    ensureTables.mockRejectedValue(cause);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      logAccessAudit({
        actorId: "super-admin-1",
        action: "user.access_configured",
      }),
    ).rejects.toThrow("Mandatory access audit write failed");
    expect(console.error).toHaveBeenCalledWith(
      "access_audit.write.failed",
      expect.objectContaining({
        actorId: "super-admin-1",
        action: "user.access_configured",
        error: cause,
      }),
    );
  });
});
