import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home page", () => {
  it("renders the hero headline and primary CTA", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: /Protecting The Coast We Call Home/i }),
    ).toBeInTheDocument();

    const ctaLinks = screen.getAllByRole("link", { name: /Book a Confidential Inquiry/i });
    expect(ctaLinks.length).toBeGreaterThanOrEqual(1);
    ctaLinks.forEach((link) => expect(link).toHaveAttribute("href", "#consultation"));
  });

  it("renders the founder quote", () => {
    render(<Home />);
    expect(
      screen.getByText(/We lost our home twice in 30 years/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Roman & Stephen/i)).toBeInTheDocument();
  });

  it("renders The Origin section", () => {
    render(<Home />);
    expect(screen.getByText("The Origin")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Twice in thirty years/i }),
    ).toBeInTheDocument();
  });

  it("renders all four practice cards", () => {
    render(<Home />);
    expect(screen.getByText("Contractor Vetting")).toBeInTheDocument();
    expect(screen.getByText("Hazardous Material Audit")).toBeInTheDocument();
    expect(screen.getByText("Regulatory Navigation")).toBeInTheDocument();
    expect(screen.getByText("Concierge Closeout")).toBeInTheDocument();
    expect(screen.getByText("Advocacy, not remediation.")).toBeInTheDocument();
  });

  it("renders the concierge experience section", () => {
    render(<Home />);
    expect(screen.getByText("Your Private Office.")).toBeInTheDocument();
    expect(screen.getByText(/Broad Beach Rd/i)).toBeInTheDocument();
  });

  it("renders the three cornerstones", () => {
    render(<Home />);
    expect(screen.getByText("Privacy")).toBeInTheDocument();
    expect(screen.getByText("Transparency")).toBeInTheDocument();
    expect(screen.getByText("Concierge")).toBeInTheDocument();
    expect(screen.getByText("The terms we don't negotiate.")).toBeInTheDocument();
  });

  it("renders certifications bar", () => {
    render(<Home />);
    expect(screen.getByText("CSLB Licensed")).toBeInTheDocument();
    expect(screen.getByText("IICRC Master Fire & Smoke")).toBeInTheDocument();
    expect(screen.getByText("Cal/OSHA Certified")).toBeInTheDocument();
  });

  it("renders the final CTA and legal consultation section", () => {
    render(<Home />);
    expect(
      screen.getByText(/Your home is your sanctuary/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Request a confidential consultation/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("CCPA/CPRA aware")).toBeInTheDocument();
    expect(screen.getByText("WCAG 2.2 AA target")).toBeInTheDocument();
    expect(screen.getByText("No portal trackers")).toBeInTheDocument();
  });
});
