import type { Metadata } from "next";

import { LegalCallout, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Accessibility Statement",
  description: "James Roman Advisory's accessibility commitment and how to request help.",
  alternates: { canonical: "/accessibility" },
};

export default function AccessibilityPage() {
  return (
    <LegalPage
      title="Accessibility"
      lead="A practice that values precision in its work owes its readers no less. We are working toward an experience that is clear, usable, and available to people with disabilities."
    >
      <p className="legal-effective"><strong>Last reviewed:</strong> August 7, 2026</p>
      <LegalCallout title="Our standard">
        <p>James Roman Advisory targets WCAG 2.2 Level AA for public and Private Office experiences. This is an operating standard and review program, not a claim that every future document or change has already been independently certified.</p>
      </LegalCallout>

      <h2>How the site is designed</h2>
      <ul>
        <li>Semantic headings, landmarks, labels, and meaningful link text are used to support assistive technology.</li>
        <li>Keyboard focus is intended to remain visible on interactive elements, and core navigation is designed to work without a mouse.</li>
        <li>Color, typography, and interface states are designed with legibility and contrast in mind.</li>
        <li>Motion-sensitive visitors can request reduced motion through their operating-system preference.</li>
        <li>Forms provide visible labels and feedback for invalid or incomplete information.</li>
      </ul>

      <h2>Known limits and review</h2>
      <p>Accessibility must be checked after meaningful interface, content, and document changes. Generated PDFs, client-provided documents, and third-party services may require a separate review or an alternative format. We are adding automated accessibility checks and manual keyboard and screen-reader review to the release process.</p>

      <h2>Need assistance?</h2>
      <p>If you encounter an accessibility barrier or need information in another format, email <a href="mailto:roman@jamesroman.la">roman@jamesroman.la</a> with the subject line “Accessibility.” Please include the page or feature involved and the format that would help. We will respond directly and work to provide a reasonable alternative.</p>

      <h2>Ongoing review</h2>
      <p>We review this statement after significant product changes and at least annually. The date at the top identifies the latest review.</p>
    </LegalPage>
  );
}
