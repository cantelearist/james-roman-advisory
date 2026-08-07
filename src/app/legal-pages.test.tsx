import { render, screen } from "@testing-library/react";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import AccessibilityPage from "./accessibility/page";
import CookiesPage from "./cookies/page";
import NdaPage from "./nda/page";
import PrivacyPage from "./privacy/page";
import sitemap from "./sitemap";
import { proxy } from "../proxy";

describe("public legal pages", () => {
  it("renders the recovered privacy notice with current service disclosures", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("heading", { name: "Privacy Notice" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Service providers and disclosures" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "roman@jamesroman.la" })[0]).toHaveAttribute("href", "mailto:roman@jamesroman.la");
  });

  it("renders the recovered accessibility and cookie statements", () => {
    const accessibility = render(<AccessibilityPage />);
    expect(screen.getByRole("heading", { name: "Accessibility" })).toBeInTheDocument();
    expect(screen.getByText(/WCAG 2.2 Level AA/)).toBeInTheDocument();
    accessibility.unmount();

    render(<CookiesPage />);
    expect(screen.getByRole("heading", { name: "Cookie Policy" })).toBeInTheDocument();
    expect(screen.getByText("jra_session")).toBeInTheDocument();
  });

  it("publishes the NDA only as a clearly marked sample", () => {
    render(<NdaPage />);

    expect(screen.getByText("Sample only — counsel review required")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mutual Non-Disclosure Agreement" })).toBeInTheDocument();
  });

  it("lists the legal pages in the public sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).toEqual(expect.arrayContaining([
      "https://www.jamesroman.la/privacy",
      "https://www.jamesroman.la/cookies",
      "https://www.jamesroman.la/terms",
      "https://www.jamesroman.la/nda",
      "https://www.jamesroman.la/accessibility",
    ]));
  });

  it("does not send public legal routes to sign-in", () => {
    const response = proxy(new NextRequest("https://www.jamesroman.la/privacy"));

    expect(response.headers.get("location")).toBeNull();
  });
});
