import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./prototype/_components/intro", async () => {
  const React = await import("react");

  return {
    IntroSequence: ({ onComplete }: { onComplete: () => void }) => {
      React.useEffect(() => {
      onComplete();
      }, [onComplete]);

      return null;
    },
  };
});

import Home from "./page";

describe("Home page", () => {
  it("renders the hero headline and primary CTA", () => {
    render(<Home />);

    expect(screen.getByText("Protecting")).toBeInTheDocument();
    expect(screen.getByText("The Coast")).toBeInTheDocument();
    expect(screen.getByText("We Call")).toBeInTheDocument();
    expect(screen.getByText("Home.")).toBeInTheDocument();
    expect(screen.getByText("Owner-side advisory · No contractors · No conflicts")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /View practice/i })).toHaveAttribute("href", "#the-process");
    expect(screen.getByRole("link", { name: /Book inquiry/i })).toHaveAttribute("href", "/prototype/contact");
  });

  it("renders the founder origin story", () => {
    render(<Home />);
    expect(
      screen.getByText(/Stephen was born in Malibu/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Roman spent years overseeing construction/i)).toBeInTheDocument();
    expect(screen.getByText("Roman & Stephen · Malibu")).toBeInTheDocument();
  });

  it("renders The Origin section", () => {
    render(<Home />);
    expect(screen.getByText("The Origin")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Twiceinthirtyyears/i }),
    ).toBeInTheDocument();
  });

  it("renders all six practice areas", () => {
    render(<Home />);
    expect(screen.getByText("Mold and Water Damage")).toBeInTheDocument();
    expect(screen.getByText("Fire and Smoke Residue")).toBeInTheDocument();
    expect(screen.getByText("Asbestos and Legacy Materials")).toBeInTheDocument();
    expect(screen.getByText("Indoor Air Quality and VOCs")).toBeInTheDocument();
    expect(screen.getByText("Pre-Sale Diligence")).toBeInTheDocument();
    expect(screen.getByText("Contractor Procurement")).toBeInTheDocument();
    expect(screen.getByText("Advocacy,")).toBeInTheDocument();
  });

  it("renders the concierge experience section", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: /YourPrivateOffice/i })).toBeInTheDocument();
    expect(screen.getByText(/Broad Beach Rd/i)).toBeInTheDocument();
  });

  it("renders the three cornerstones", () => {
    render(<Home />);
    expect(screen.getByText("Privacy")).toBeInTheDocument();
    expect(screen.getByText("Transparency")).toBeInTheDocument();
    expect(screen.getByText("Concierge")).toBeInTheDocument();
    expect(screen.getAllByText("The Cornerstone").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("negotiate.")).toBeInTheDocument();
  });

  it("renders the integrated trust bar", () => {
    render(<Home />);
    expect(screen.getByText("CCPA/CPRA aware")).toBeInTheDocument();
    expect(screen.getByText("WCAG 2.2 AA target")).toBeInTheDocument();
    expect(screen.getByText("No portal trackers")).toBeInTheDocument();
  });

  it("renders the final CTA and legal consultation section", () => {
    render(<Home />);
    expect(screen.getByText("Get in touch")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Requestaconfidentialconsultation/i })).toBeInTheDocument();
    expect(screen.getByText("CCPA/CPRA aware")).toBeInTheDocument();
    expect(screen.getByText("WCAG 2.2 AA target")).toBeInTheDocument();
    expect(screen.getByText("No portal trackers")).toBeInTheDocument();
  });
});
