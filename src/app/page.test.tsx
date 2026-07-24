import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./prototype/_components/intro", async () => {
  const React = await import("react");

  return {
    IntroSequence: ({ onComplete }: { onComplete: () => void }) => {
      React.useEffect(onComplete, [onComplete]);
      return null;
    },
  };
});

import Home from "./page";

function compactText(value: string | null) {
  return value?.replace(/\s+/g, "").toLowerCase() ?? "";
}

function getHeadingText(text: string) {
  const expected = compactText(text);
  return screen.getByText((_, element) => {
    if (!element || !/^H[1-6]$/.test(element.tagName)) return false;
    return compactText(element.textContent).startsWith(expected);
  });
}

describe("Home page", () => {
  it("renders the owner-side hero headline and primary CTA", async () => {
    render(<Home />);

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "On your side.Not the contractor's.Not the insurer's.",
    );

    const ctaLinks = screen.getAllByRole("link", { name: /Book a Confidential Inquiry/i });
    expect(ctaLinks.length).toBeGreaterThanOrEqual(1);
    ctaLinks.forEach((link) => expect(link).toHaveAttribute("href", "#consultation"));
  });

  it("renders the founder quote", () => {
    render(<Home />);
    expect(
      getHeadingText("We lost our home twice in thirty years. We don't just know the risk — we live it."),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Roman & Stephen/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders The Origin section", () => {
    render(<Home />);
    expect(screen.getByText("The Origin")).toBeInTheDocument();
    expect(getHeadingText("Twice in thirty years")).toBeInTheDocument();
  });

  it("renders the six current practice areas", () => {
    render(<Home />);
    expect(screen.getByText("Mold and Water Damage")).toBeInTheDocument();
    expect(screen.getByText("Fire and Smoke Residue")).toBeInTheDocument();
    expect(screen.getByText("Asbestos and Legacy Materials")).toBeInTheDocument();
    expect(screen.getByText("Indoor Air Quality and VOCs")).toBeInTheDocument();
    expect(screen.getByText("Pre-Sale Diligence")).toBeInTheDocument();
    expect(screen.getByText("Contractor Procurement")).toBeInTheDocument();
    expect(getHeadingText("Advocacy, not remediation.")).toBeInTheDocument();
  });

  it("renders the concierge experience section", () => {
    render(<Home />);
    expect(getHeadingText("Your Private Office.")).toBeInTheDocument();
    expect(screen.getByText(/Broad Beach Rd/i)).toBeInTheDocument();
  });

  it("renders the three cornerstones", () => {
    render(<Home />);
    expect(screen.getByText("Privacy")).toBeInTheDocument();
    expect(screen.getByText("Transparency")).toBeInTheDocument();
    expect(screen.getByText("Access")).toBeInTheDocument();
    expect(getHeadingText("The terms we don't negotiate.")).toBeInTheDocument();
  });

  it("renders certifications bar", () => {
    render(<Home />);
    expect(screen.getByText("CSLB Licensed")).toBeInTheDocument();
    expect(screen.getByText("IICRC Master Fire & Smoke")).toBeInTheDocument();
    expect(screen.getByText("Cal/OSHA Certified")).toBeInTheDocument();
  });

  it("renders the final CTA and legal consultation section", () => {
    render(<Home />);
    expect(getHeadingText("Your home is your sanctuary")).toBeInTheDocument();
    expect(getHeadingText("Request a confidential consultation")).toBeInTheDocument();
    expect(screen.getByText("CCPA/CPRA compliant")).toBeInTheDocument();
    expect(screen.getByText("No portal trackers")).toBeInTheDocument();
  });
});
