import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PortalAccessProvider } from "@/components/portal/access-provider";
import type { PortalAccessSummary } from "@/lib/access-control";
import FinancePage from "./page";

type DeferredResponse = {
  promise: Promise<Response>;
  resolve: (response: Response) => void;
};

function deferredResponse(): DeferredResponse {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((fulfill) => {
    resolve = fulfill;
  });
  return { promise, resolve };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("Finance page", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const superAdminAccess: PortalAccessSummary = {
    role: "super_admin",
    capabilities: [],
    scope: "global",
    permissionProfile: null,
  };

  function renderFinance() {
    return render(
      <PortalAccessProvider
        user={{
          id: "user-1",
          name: "Portal User",
          email: "portal@example.com",
          role: "super_admin",
        }}
        access={superAdminAccess}
      >
        <FinancePage />
      </PortalAccessProvider>,
    );
  }

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not present zero-valued finance totals while the initial request is pending", async () => {
    const responses = [deferredResponse(), deferredResponse(), deferredResponse(), deferredResponse()];
    fetchMock.mockImplementation(() => responses.shift()!.promise);

    renderFinance();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });
    expect(screen.getByLabelText("Loading financial records")).toBeInTheDocument();
    expect(screen.queryByText("Outstanding")).not.toBeInTheDocument();
  });

  it("shows totals only after the financial records have loaded", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ matters: [{ id: "matter-1", title: "Test engagement" }] }))
      .mockResolvedValueOnce(jsonResponse({ contracts: [] }))
      .mockResolvedValueOnce(jsonResponse({
        invoices: [{
          id: "invoice-1",
          matter_id: "matter-1",
          matter_title: "Test engagement",
          client_name: "Test client",
          invoice_number: "JRA-INV-TEST",
          status: "issued",
          total_cents: 900000,
          due_date: null,
          issued_at: "2026-08-01T00:00:00.000Z",
          created_at: "2026-08-01T00:00:00.000Z",
          line_items: [],
          payments: [],
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({ changeOrders: [] }));

    renderFinance();

    await waitFor(() => {
      expect(screen.getByText("Outstanding")).toBeInTheDocument();
    });
    expect(screen.getAllByText("$9,000.00").length).toBeGreaterThan(0);
    expect(screen.getByText("JRA-INV-TEST")).toBeInTheDocument();
  });

  it("keeps totals hidden when the initial records request fails", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ matters: [] }))
      .mockResolvedValueOnce(jsonResponse({ contracts: [] }))
      .mockResolvedValueOnce(jsonResponse({ error: "Temporary failure" }, 503))
      .mockResolvedValueOnce(jsonResponse({ changeOrders: [] }));

    renderFinance();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Financial records unavailable" })).toBeInTheDocument();
    });
    expect(screen.getByText("Temporary failure")).toBeInTheDocument();
    expect(screen.queryByText("Outstanding")).not.toBeInTheDocument();
  });
});
