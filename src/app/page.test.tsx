import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home page", () => {
  it("renders the brand, navigation, and consultation entry points", () => {
    render(<Home />);

    expect(screen.getAllByRole("img", { name: "James Roman Advisory" }).length).toBeGreaterThanOrEqual(1);
    const practiceLinks = screen.getAllByRole("link", { name: "The Practice" });
    expect(practiceLinks.length).toBeGreaterThanOrEqual(1);
    practiceLinks.forEach((link) => expect(link).toHaveAttribute("href", "#the-practice"));
    expect(screen.getByRole("link", { name: "Inquire" })).toHaveAttribute("href", "#consultation");
    expect(screen.getByRole("link", { name: "Access private office" })).toHaveAttribute("href", "/portal");
  });

  it("renders the operating principle and practice areas", () => {
    render(<Home />);

    expect(screen.getByText("The operating principle")).toBeInTheDocument();
    expect(screen.getByText("Mold and Water Damage")).toBeInTheDocument();
    expect(screen.getByText("Contractor Procurement")).toBeInTheDocument();
    expect(screen.getByText(/No kickbacks/)).toBeInTheDocument();
  });

  it("renders the private office and trust commitments", () => {
    render(<Home />);

    expect(screen.getByText(/Broad Beach Rd/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Privacy" })).toBeInTheDocument();
    expect(screen.getByText("Transparency")).toBeInTheDocument();
    expect(screen.getByText("Access")).toBeInTheDocument();
    expect(screen.getByText("No portal trackers")).toBeInTheDocument();
  });

  it("renders the consultation form fields", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: /consultation/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Brief context")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Submit request/i })).toBeInTheDocument();
  });
});
