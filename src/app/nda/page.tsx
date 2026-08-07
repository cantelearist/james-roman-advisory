import type { Metadata } from "next";

import { LegalCallout, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Mutual Non-Disclosure Agreement",
  description: "Sample mutual NDA used as a starting point for James Roman Advisory engagements.",
  alternates: { canonical: "/nda" },
};

export default function NdaPage() {
  return (
    <LegalPage
      eyebrow="Standing form"
      title="Mutual Non-Disclosure"
      lead="Discretion is a contractual obligation, not a marketing claim. The form below is the starting point used for a prospective engagement; the operative version is separately dated and signed."
    >
      <LegalCallout title="Sample only — counsel review required">
        <p>This is a sample agreement for review. It is not an executed agreement, does not create an engagement, and is not legal advice. The operative agreement for any matter is delivered, dated, and signed separately.</p>
      </LegalCallout>

      <h2>Mutual Non-Disclosure Agreement</h2>
      <p>This Mutual Non-Disclosure Agreement (the “Agreement”) is entered into as of [Effective Date] by and between James Roman Advisory, LLC, a California limited liability company (“JRA”), and [Client Name] (“Client”). JRA and Client are each a “Party” and together the “Parties.”</p>

      <h2>1. Purpose</h2>
      <p>The Parties wish to evaluate and, if mutually agreed, undertake a confidential professional engagement relating to advisory services in connection with one or more residential properties (the “Purpose”). In furtherance of the Purpose, each Party may disclose confidential or proprietary information to the other.</p>

      <h2>2. Confidential information</h2>
      <p>“Confidential Information” means any non-public information disclosed by one Party to the other, in any form, that is identified as confidential or that a reasonable person would understand to be confidential given its nature or the circumstances of disclosure. It includes:</p>
      <ul>
        <li>the identities of the Parties, their family members, household staff, agents, and counsel;</li>
        <li>property addresses, parcel numbers, location information, and the existence or nature of a contemplated engagement;</li>
        <li>test results, sampling data, photographs, reports, correspondence, and deliverables;</li>
        <li>vendor names, scopes of work, fee arrangements, bid materials, and insurance, financial, medical, or household information; and</li>
        <li>JRA&apos;s proprietary methods, vendor relationships, sampling protocols, and analytical templates.</li>
      </ul>

      <h2>3. Exclusions</h2>
      <p>Confidential Information does not include information the Receiving Party can demonstrate by competent evidence: (a) was generally available to the public at the time of disclosure; (b) became public after disclosure other than through breach of this Agreement; (c) was rightfully in the Receiving Party&apos;s possession before receipt without an obligation of confidentiality; or (d) was independently developed without use of the other Party&apos;s Confidential Information.</p>

      <h2>4. Obligations</h2>
      <p>The Receiving Party shall:</p>
      <ol>
        <li>hold Confidential Information in strict confidence and use no less than reasonable care to protect it;</li>
        <li>use it solely for the Purpose;</li>
        <li>disclose it only to personnel and professional advisors with a bona fide need to know who are bound by confidentiality obligations at least as protective as this Agreement;</li>
        <li>not reproduce, summarize, or excerpt it except as reasonably necessary for the Purpose; and</li>
        <li>maintain administrative, technical, and physical safeguards designed to prevent unauthorized access or disclosure.</li>
      </ol>

      <h2>5. Compelled disclosure</h2>
      <p>If a Receiving Party is required by law, subpoena, regulatory process, or court order to disclose Confidential Information, it shall, to the extent legally permitted, notify the Disclosing Party promptly, cooperate with reasonable efforts to obtain protection, and disclose only the portion legally required.</p>

      <h2>6. No public reference</h2>
      <p>Neither Party may use the other&apos;s name, identity, property, or any reference to the engagement in marketing, a case study, press inquiry, social-media post, search listing, or other public communication without prior written consent of the other Party.</p>

      <h2>7. Independence</h2>
      <p>JRA represents that it does not accept referral fees, commissions, kickbacks, or other compensation from contractors, vendors, laboratories, or service providers recommended in connection with the Purpose. JRA&apos;s compensation is the fee agreed with Client in the operative engagement letter.</p>

      <h2>8. Term and survival</h2>
      <p>This Agreement continues for five (5) years from its Effective Date. Obligations relating to a Client&apos;s identity, property address, trade secrets, or information restricted by law survive for as long as permitted by applicable law.</p>

      <h2>9. Return or destruction</h2>
      <p>Upon written request or at the end of a contemplated engagement, the Receiving Party shall, at the Disclosing Party&apos;s election, return or securely destroy Confidential Information, except for records a Party is required to retain by law, professional obligation, or the applicable engagement documents, and a single archival copy retained by outside counsel solely to confirm compliance.</p>

      <h2>10. Remedies</h2>
      <p>Each Party acknowledges that breach may cause irreparable harm for which monetary damages may be inadequate. The non-breaching Party may seek equitable relief, including injunctive relief and specific performance, in addition to other remedies available at law or in equity.</p>

      <h2>11. No license</h2>
      <p>Nothing in this Agreement grants a license or other right in Confidential Information except the limited right to use it for the Purpose.</p>

      <h2>12. Governing law and venue</h2>
      <p>This Agreement is governed by California law, without regard to conflict-of-laws principles. Any dispute arising from this Agreement shall be brought exclusively in the state or federal courts located in Los Angeles County, California, and each Party consents to their jurisdiction.</p>

      <h2>13. Entire agreement and amendment</h2>
      <p>This Agreement contains the Parties&apos; entire understanding with respect to its subject matter and supersedes prior discussions on that subject. It may be amended only in a writing signed by both Parties.</p>

      <h2>14. Counterparts</h2>
      <p>This Agreement may be executed in counterparts, each deemed an original and all constituting one instrument. Electronic signatures are valid and binding to the extent permitted by law.</p>

      <section className="mt-16 border-y border-white/[0.12] py-10">
        <p className="mb-8 text-[0.72rem] uppercase tracking-[0.16em] text-[#ece6d6]/55">In witness whereof, the Parties have executed this Agreement as of the Effective Date.</p>
        <div className="grid gap-9 sm:grid-cols-2">
          <div><strong>JAMES ROMAN ADVISORY, LLC</strong><p>By: James Roman, Founder</p><p>Date: ___________________</p></div>
          <div><strong>CLIENT</strong><p>By: ___________________</p><p>Date: ___________________</p></div>
        </div>
      </section>
    </LegalPage>
  );
}
