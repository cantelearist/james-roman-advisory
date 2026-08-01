import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PortalAccessProvider } from "@/components/portal/access-provider";
import EngagementBoardPage from "./page";

const navigationMocks = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/portal/matters",
  useRouter: () => ({ replace: navigationMocks.replace }),
  useSearchParams: () => new URLSearchParams(),
}));

const matter = {
  id: "matter-1",
  client_id: "client-1",
  client_name: "Private Client",
  property_address: "Broad Beach",
  title: "Remediation oversight",
  type: "mold",
  status: "assessment",
  owner_user_id: "owner-1",
  owner_name: "Operations Lead",
  priority: "high",
  health: "at_risk",
  due_date: "2026-08-15",
  next_action: "Review consultant findings",
  next_action_due_at: "2026-08-04",
  version: 2,
  open_task_count: 2,
  unread_message_count: 1,
  pending_document_count: 0,
  invoice_balance_cents: 0,
  updated_at: "2026-08-01T00:00:00.000Z",
};

describe("engagement operating board", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    navigationMocks.replace.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.startsWith("/api/matters?")) {
        return new Response(JSON.stringify({ matters: [matter], page: { number: 1, limit: 25, offset: 0, hasMore: true } }), { status: 200 });
      }
      if (url === "/api/clients") return new Response(JSON.stringify({ clients: [] }), { status: 200 });
      if (url === "/api/portal/people") return new Response(JSON.stringify({ people: [] }), { status: 200 });
      if (url.startsWith("/api/portal/views") && init?.method === "POST") {
        return new Response(JSON.stringify({ view: { id: "view-1" } }), { status: 201 });
      }
      if (url.startsWith("/api/portal/views")) return new Response(JSON.stringify({ views: [] }), { status: 200 });
      return new Response(JSON.stringify({ error: "Unexpected request" }), { status: 500 });
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderBoard() {
    return render(
      <PortalAccessProvider
        user={{ id: "super-1", name: "Super Admin", email: "admin@example.com", role: "super_admin" }}
        access={{ role: "super_admin", capabilities: [], scope: "global", permissionProfile: null }}
      >
        <EngagementBoardPage />
      </PortalAccessProvider>,
    );
  }

  it("exposes sortable, groupable, paginated, and configurable table controls", async () => {
    const user = userEvent.setup();
    renderBoard();

    expect(await screen.findByText("Remediation oversight")).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort engagements" }), "client");
    await user.selectOptions(screen.getByRole("combobox", { name: "Group engagements" }), "owner");
    await user.selectOptions(screen.getByRole("combobox", { name: "Table density" }), "compact");
    await user.click(screen.getByRole("button", { name: "Columns" }));
    await user.click(screen.getByRole("button", { name: "Move Client & property right" }));
    await user.click(screen.getByRole("button", { name: "Next page" }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => {
        const url = String(input);
        return url.includes("sort=client") && url.includes("group=owner") && url.includes("page=2");
      })).toBe(true);
    });
    expect(navigationMocks.replace).toHaveBeenCalledWith(
      expect.stringContaining("density=compact"),
      { scroll: false },
    );
  });

  it("saves the complete table configuration", async () => {
    const user = userEvent.setup();
    renderBoard();
    expect(await screen.findByText("Remediation oversight")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Group engagements" }), "owner");
    await user.selectOptions(screen.getByRole("combobox", { name: "Table density" }), "compact");
    await user.click(screen.getAllByRole("button", { name: "Save view" }).at(-1)!);
    await user.type(screen.getByRole("textbox", { name: "View name" }), "Owner review");
    await user.click(screen.getAllByRole("button", { name: "Save view" }).at(-1)!);

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([input, init]) => String(input) === "/api/portal/views" && init?.method === "POST");
      expect(post).toBeDefined();
      const body = JSON.parse(String(post?.[1]?.body));
      expect(body).toMatchObject({
        grouping: { field: "owner" },
        columns: { density: "compact" },
      });
      expect(body.sorting).toEqual([{ field: "updated_at", direction: "desc" }]);
      expect(body.columns.order).toHaveLength(9);
      expect(body.columns.visible).toHaveLength(9);
    });
  });
});
