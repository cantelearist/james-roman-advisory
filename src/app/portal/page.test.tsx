import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PortalPreview from "./page";

describe("Portal preview page", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/api/matters")) {
        return new Response(JSON.stringify({
          matters: [{
            id: "matter-1",
            title: "Malibu remediation oversight",
            type: "mold",
            status: "review",
            property_address: "1 Broad Beach Rd",
            property_city: "Malibu",
            document_count: 1,
            updated_at: "2026-01-15T00:00:00.000Z",
          }],
        }), { status: 200 });
      }
      if (url.endsWith("/api/vault/documents")) {
        return new Response(JSON.stringify({
          documents: [{
            id: "doc-1",
            name: "Remediation protocol redline.pdf",
            category: "remediation_plan",
            size_bytes: 1024,
            created_at: "2026-01-14T00:00:00.000Z",
          }],
        }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the secure file room identity and status details", () => {
    render(<PortalPreview />);

    expect(screen.getByText("Private Office")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Engagements" })).toHaveAttribute("href", "/portal/matters");
    expect(screen.getByRole("link", { name: "Vault" })).toHaveAttribute("href", "/portal/vault");
    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/portal/admin");

    return waitFor(() => {
      expect(screen.getByText("Active engagements")).toBeInTheDocument();
      expect(screen.getByText("Malibu remediation oversight")).toBeInTheDocument();
      expect(screen.getByText("Review")).toBeInTheDocument();
    });
  });

  it("renders portal document, request, invoice, and advisor thread surfaces", () => {
    render(<PortalPreview />);

    return waitFor(() => {
      expect(screen.getByText("Recent documents")).toBeInTheDocument();
      expect(screen.getByText("Remediation protocol redline.pdf")).toBeInTheDocument();
      expect(screen.getByText("Documents in vault")).toBeInTheDocument();
    });
  });
});
