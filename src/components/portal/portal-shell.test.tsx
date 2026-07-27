import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PortalAccessSummary } from "@/lib/access-control";
import { PortalAccessProvider } from "./access-provider";
import { PortalShell } from "./portal-shell";

const navigationMocks = vi.hoisted(() => ({
  push: vi.fn(),
  pathname: "/portal",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationMocks.pathname,
  useRouter: () => ({ push: navigationMocks.push }),
}));

describe("PortalShell role-aware navigation", () => {
  const fetchMock = vi.fn<typeof fetch>();

  function renderShell(access: PortalAccessSummary) {
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
        <PortalShell><main>Workspace content</main></PortalShell>
      </PortalAccessProvider>,
    );
  }

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ notifications: [] }), { status: 200 }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the full operating and administration shell to Super Admin", async () => {
    renderShell({
      role: "super_admin",
      capabilities: [],
      scope: "global",
      permissionProfile: null,
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/portal/notifications",
      { cache: "no-store" },
    ));
    for (const label of ["Home", "Engagements", "My work", "Inbox", "Documents", "Finance", "People", "Access control", "Settings"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("shows an Admin only modules granted by its capability profile", () => {
    renderShell({
      role: "admin",
      capabilities: ["engagements.view", "timeline.view", "messages.view", "users.invite"],
      scope: "assigned",
      permissionProfile: { id: "profile-1", name: "Case administrator" },
    });

    expect(screen.getByRole("link", { name: "Engagements" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Inbox" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "People" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Finance" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Access control" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("keeps the Client shell intentionally limited to assigned engagement functions", () => {
    renderShell({
      role: "client",
      capabilities: ["engagements.view", "documents.view"],
      scope: "assigned",
      permissionProfile: null,
    });

    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Engagements" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Documents" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Inbox" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Finance" })).not.toBeInTheDocument();
    expect(screen.queryByText("Administration")).not.toBeInTheDocument();
  });
});
