import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PortalAccessProvider } from "@/components/portal/access-provider";
import type { PortalAccessSummary } from "@/lib/access-control";
import PortalHomePage from "./page";

describe("Portal command center", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const superAdminAccess: PortalAccessSummary = {
    role: "super_admin",
    capabilities: [
      "engagements.view",
      "engagements.create",
      "timeline.view",
      "messages.view",
      "documents.publish",
      "finance.view",
    ],
    scope: "global",
    permissionProfile: null,
  };

  const summary = {
    matters: [{
      id: "matter-1",
      title: "Malibu remediation oversight",
      status: "review",
      priority: "high",
      health: "at_risk",
      due_date: "2026-08-15",
      next_action: "Review consultant findings",
      client_name: "Private Client",
      property_address: "Broad Beach",
      owner_name: "Operations Lead",
      open_tasks: 2,
      updated_at: "2026-07-25T00:00:00.000Z",
    }],
    tasks: [{
      id: "task-1",
      matter_id: "matter-1",
      matter_title: "Malibu remediation oversight",
      title: "Review consultant findings",
      status: "open",
      priority: "high",
      due_date: "2026-08-01",
      assignee_name: "Portal User",
    }],
    metrics: {
      activeEngagements: 1,
      atRiskEngagements: 1,
      overdueTasks: 0,
      unreadNotifications: 2,
      pendingDocuments: 1,
      draftInvoices: 1,
      overdueInvoices: 0,
      outstandingCents: 125000,
    },
  };

  function renderPortal(access = superAdminAccess) {
    return render(
      <PortalAccessProvider
        user={{
          id: "user-1",
          name: "Portal User",
          email: "portal@example.com",
          role: access.role,
        }}
        access={access}
      >
        <PortalHomePage />
      </PortalAccessProvider>,
    );
  }

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response(JSON.stringify(summary), { status: 200 }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders an actionable operating summary", async () => {
    renderPortal();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Operations overview" })).toBeInTheDocument();
    });
    expect(screen.getByText("Active engagements")).toBeInTheDocument();
    expect(screen.getByText("Unread activity")).toBeInTheDocument();
    expect(screen.getAllByText("Malibu remediation oversight").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Review consultant findings").length).toBeGreaterThan(0);
  });

  it("limits a client dashboard to permitted modules and assigned records", async () => {
    renderPortal({
      role: "client",
      capabilities: ["engagements.view", "documents.view"],
      scope: "assigned",
      permissionProfile: null,
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Your Private Office" })).toBeInTheDocument();
    });
    expect(screen.getByText("Active engagements")).toBeInTheDocument();
    expect(screen.queryByText("Unread activity")).not.toBeInTheDocument();
    expect(screen.queryByText("Outstanding")).not.toBeInTheDocument();
    expect(screen.getAllByText("Malibu remediation oversight").length).toBeGreaterThan(0);
  });

  it("shows a stable recovery state when the summary API fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Temporary failure" }), { status: 503 }));
    renderPortal();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Workspace unavailable" })).toBeInTheDocument();
    });
    expect(screen.getByText("Temporary failure")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
