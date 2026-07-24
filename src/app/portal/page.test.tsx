import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PortalPreview from "./page";

describe("Portal preview page", () => {
  it("renders the secure file room identity and status details", () => {
    render(<PortalPreview />);

    expect(screen.getByRole("img", { name: "James Roman Advisory" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /public site/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("heading", { level: 1, name: "Private engagement" })).toBeInTheDocument();
    expect(screen.getByText("Controlled review")).toBeInTheDocument();
    expect(screen.getByText("Need-to-know")).toBeInTheDocument();
    expect(screen.getByText("Advisor-controlled progress tracking.")).toBeInTheDocument();
  });

  it("renders portal document, request, invoice, and advisor thread surfaces", () => {
    render(<PortalPreview />);

    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.getByText("Open requests")).toBeInTheDocument();
    expect(screen.getByText("Invoices")).toBeInTheDocument();
    expect(screen.getByText("Remediation protocol redline.pdf")).toBeInTheDocument();
    expect(screen.getByText(/Contractor response received/)).toBeInTheDocument();
  });
});
