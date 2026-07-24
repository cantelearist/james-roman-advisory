import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PortalPreview from "./page";

describe("Portal preview page", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = String(input);
        const payload = url.includes("/api/matters")
          ? {
              matters: [
                {
                  id: "matter-1",
                  title: "Private engagement",
                  type: "remediation",
                  status: "review",
                  property_address: "123 Coast Highway",
                  property_city: "Malibu",
                  document_count: 1,
                  updated_at: "2026-07-23T12:00:00.000Z",
                },
              ],
            }
          : {
              documents: [
                {
                  id: "document-1",
                  name: "Remediation protocol redline.pdf",
                  category: "remediation_plan",
                  size_bytes: 1024,
                  created_at: "2026-07-23T12:00:00.000Z",
                },
              ],
            };

        return Promise.resolve({
          json: () => Promise.resolve(payload),
        } as Response);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the private office identity and engagement status", async () => {
    render(<PortalPreview />);

    expect(screen.getByText("Private Office")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Engagements" })).toHaveAttribute(
      "href",
      "/portal/matters",
    );
    expect(await screen.findByText("Private engagement")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("123 Coast Highway, Malibu")).toBeInTheDocument();
  });

  it("renders live engagement and document summaries", async () => {
    render(<PortalPreview />);

    expect(await screen.findByText("Active engagements")).toBeInTheDocument();
    expect(screen.getByText("Documents in vault")).toBeInTheDocument();
    expect(screen.getByText("Total engagements")).toBeInTheDocument();
    expect(screen.getByText("Recent documents")).toBeInTheDocument();
    expect(screen.getByText("Remediation protocol redline.pdf")).toBeInTheDocument();
  });
});
