import type { Metadata } from "next";

import { LegalCallout, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "The limited cookies used by the James Roman Advisory website and Private Office.",
  alternates: { canonical: "/cookies" },
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      lead="The public site does not use advertising or analytics cookies. The Private Office uses only the cookies required to keep an authenticated session and, where applicable, complete multi-factor authentication."
    >
      <p className="legal-effective"><strong>Last updated:</strong> August 7, 2026</p>
      <LegalCallout title="The short version">
        <p>There is no advertising, social-media pixel, session-recording, heatmap, or cross-site behavioral tracking code in the current public application.</p>
      </LegalCallout>

      <h2>Strictly necessary cookies</h2>
      <p>The Private Office uses the following first-party cookies only when a person uses authenticated features:</p>
      <ul>
        <li><strong>jra_session</strong> — an HttpOnly, secure session cookie used to maintain an authenticated Private Office session.</li>
        <li><strong>jra_mfa_challenge</strong> — a short-lived, HttpOnly challenge cookie used while an eligible staff user completes multi-factor authentication.</li>
      </ul>
      <p>These cookies are not advertising identifiers and are not used to track a person across unrelated sites. Disabling them prevents secure sign-in or authenticated portal use.</p>

      <h2>What we do not use</h2>
      <ul>
        <li>No advertising or marketing cookies.</li>
        <li>No social-media pixels.</li>
        <li>No browser fingerprinting, replay, or heatmap tooling.</li>
        <li>No cross-context behavioral advertising technology.</li>
      </ul>

      <h2>Server and security logs</h2>
      <p>Hosting, security, and application services may process ordinary request information to operate the site, prevent abuse, investigate security events, and maintain service reliability. These records are not browser cookies and cannot be controlled through browser cookie settings.</p>

      <h2>Your choices</h2>
      <p>Most browsers allow you to inspect or delete stored cookies. Removing necessary Private Office cookies signs you out. If we introduce any non-essential cookie category, this policy and the consent mechanism will be updated before that category is enabled.</p>

      <h2>Contact</h2>
      <p>Questions about this policy may be sent to <a href="mailto:roman@jamesroman.la">roman@jamesroman.la</a>. For more detail on personal-information handling, read the <a href="/privacy">Privacy Notice</a>.</p>
    </LegalPage>
  );
}
