import type { Metadata } from "next";

import { LegalCallout, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Notice",
  description: "How James Roman Advisory handles inquiry and Private Office information.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Notice"
      lead="Discretion is the first commitment we make in every engagement. This notice explains what information the site and Private Office use, why, and the choices available to you."
    >
      <p className="legal-effective"><strong>Last updated:</strong> August 7, 2026</p>
      <LegalCallout title="A note on this notice">
        <p>This notice reflects the current James Roman Advisory application and its service providers. It should be reviewed by California counsel before broad client onboarding or any material change to the service.</p>
      </LegalCallout>

      <h2>Information we collect</h2>
      <h3>When you contact us</h3>
      <ul>
        <li><strong>Identifiers</strong> — your name and email address.</li>
        <li><strong>Inquiry context</strong> — the market, matter type, and message you choose to provide.</li>
        <li><strong>Correspondence</strong> — follow-up communications and consultation notes.</li>
      </ul>
      <h3>If you use the Private Office</h3>
      <ul>
        <li><strong>Account and security information</strong> — account identity, access role, session records, and staff multi-factor authentication records where applicable.</li>
        <li><strong>Engagement information</strong> — engagement scope, documents, messages, workflow activity, and permitted client or contractor contacts.</li>
        <li><strong>Commercial records</strong> — contracts, invoices, change orders, and payment-status records. Payment-card details are handled by the payment processor, not stored by James Roman Advisory.</li>
      </ul>
      <h3>Technical information</h3>
      <p>Our hosting and security systems process ordinary request and security information, including IP address, user-agent information, request time, and page or API request. The Private Office also uses strictly necessary session and authentication cookies described in the <a href="/cookies">Cookie Policy</a>.</p>

      <h2>How we use information</h2>
      <ol>
        <li>To respond to an inquiry and arrange a consultation.</li>
        <li>To deliver an engagement, communicate with permitted participants, and maintain the engagement record.</li>
        <li>To authenticate users, enforce access scope, protect the system, and investigate misuse or unauthorized access.</li>
        <li>To issue, administer, and reconcile commercial records and payments.</li>
        <li>To comply with legal, professional, accounting, and recordkeeping obligations.</li>
      </ol>
      <p>We do not operate advertising trackers or build marketing profiles from Private Office activity. We do not use engagement information to make solely automated decisions about you.</p>

      <h2>Service providers and disclosures</h2>
      <p>We use carefully selected providers to operate the service, including Vercel for hosting and private file storage, Neon for application data, Resend for transactional email, Stripe for payment processing, and a distributed rate-limit provider where configured. They process information only as needed to provide their services to us.</p>
      <p>We may disclose engagement information to counsel, insurers, laboratories, contractors, or other professionals only where the engagement, your instructions, or applicable law permits it. We may also disclose information when legally compelled and, where permitted, will notify the affected client first.</p>

      <h2>California privacy rights</h2>
      <p>California residents may have rights to request access to, correction of, or deletion of personal information, and to obtain information about its collection and disclosure. We will verify a requestor&apos;s identity and respond within the period required by applicable law. Some requests may be limited by legal, professional, security, and recordkeeping obligations.</p>
      <p>To make a privacy request, email <a href="mailto:roman@jamesroman.la">roman@jamesroman.la</a> with the subject line “Privacy Request.” Authorized agents may be asked to provide proof of authority and may require separate identity verification.</p>

      <h2>Retention and security</h2>
      <p>We retain information only for as long as reasonably necessary for the purpose for which it was collected, the engagement terms, and applicable obligations. Retention periods for engagement records are subject to the operative engagement documents and the firm&apos;s counsel-approved retention schedule.</p>
      <p>We use administrative, technical, and physical safeguards designed to protect information. No system is immune from risk; if an incident materially affects information, we will respond in accordance with applicable law and the relevant engagement obligations.</p>

      <h2>Changes and contact</h2>
      <p>We may update this notice as the service, its providers, or applicable requirements change. The date at the top identifies the latest revision. Questions about this notice may be sent to <a href="mailto:roman@jamesroman.la">roman@jamesroman.la</a>.</p>
    </LegalPage>
  );
}
