import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const automationMocks = vi.hoisted(() => ({
  runScheduledPortalAutomations: vi.fn(),
}));

vi.mock("@/lib/automations", () => ({
  runScheduledPortalAutomations: automationMocks.runScheduledPortalAutomations,
}));

import { GET } from "./route";

describe("Scheduled portal automation endpoint", () => {
  const priorSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    automationMocks.runScheduledPortalAutomations.mockReset();
  });

  afterEach(() => {
    if (priorSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = priorSecret;
  });

  it("stays unavailable until a deployment secret is configured", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(new Request("http://localhost/api/cron/portal-automations"))).status).toBe(503);
  });

  it("rejects an invalid scheduler credential", async () => {
    process.env.CRON_SECRET = "configured-secret";
    expect((await GET(new Request("http://localhost/api/cron/portal-automations", {
      headers: { Authorization: "Bearer wrong-secret" },
    }))).status).toBe(401);
    expect(automationMocks.runScheduledPortalAutomations).not.toHaveBeenCalled();
  });

  it("runs enabled recipes with the deployment scheduler credential", async () => {
    process.env.CRON_SECRET = "configured-secret";
    automationMocks.runScheduledPortalAutomations.mockResolvedValue({
      overdueTaskAlerts: 2,
      invoiceReminders: 1,
      failures: 0,
    });
    const response = await GET(new Request("http://localhost/api/cron/portal-automations", {
      headers: { Authorization: "Bearer configured-secret" },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      overdueTaskAlerts: 2,
      invoiceReminders: 1,
      failures: 0,
    });
  });
});
