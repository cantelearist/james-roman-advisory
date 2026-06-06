import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { ConsultationForm } from "@/components/consultation-form";

const TITAN = "#b2a898";
const GOLD = "#c9b58a";
const CREAM = "#ece6d6";
const NAVY = "#06111f";

export default function PrototypeContactPage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-[8%] py-8" style={{ background:NAVY, color:CREAM }}>
      <div aria-hidden className="absolute inset-0 opacity-70"
        style={{ background:"linear-gradient(135deg, rgba(201,181,138,0.055) 0%, transparent 36%, rgba(0,0,0,0.18) 100%)" }} />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-6">
          <Link href="/prototype" aria-label="Back to prototype">
            <BrandLogo className="h-10 opacity-88 md:!h-[4.2rem]" />
          </Link>
          <Link
            href="/prototype"
            className="inline-flex items-center gap-3 text-[0.78rem] uppercase tracking-[0.22em] transition-opacity duration-300 hover:opacity-80"
            style={{ color:GOLD }}
          >
            <ArrowLeft className="size-3.5" />
            Back
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-14 py-16 lg:grid-cols-[0.74fr_1.26fr]">
          <div className="lg:pr-10">
            <p className="mb-7 text-[0.78rem] uppercase tracking-[0.34em]" style={{ color:TITAN, opacity:0.82 }}>
              Private inquiry
            </p>
            <h1
              className="font-heading font-light leading-[1.02] tracking-[-0.025em]"
              style={{
                color:CREAM,
                fontSize:"clamp(2.18rem,3.55vw,4.5rem)",
                textShadow:"0 2px 12px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.4)",
              }}
            >
              Request a confidential consultation.
            </h1>
            <p className="mt-8 max-w-md text-[1.05rem] leading-[1.9]" style={{ color:TITAN, opacity:0.88 }}>
              Share enough context to determine fit. Detailed records, photos, reports, and sensitive
              documents belong inside the secure client process.
            </p>
            <div className="mt-12 grid gap-4 text-[0.72rem] uppercase tracking-[0.2em]" style={{ color:TITAN, opacity:0.52 }}>
              <p>Owner-side only</p>
              <p>NDA-first intake</p>
              <p>Coastal Los Angeles</p>
            </div>
          </div>

          <div
            className="border-t pt-8 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0"
            style={{ borderColor:"rgba(178,168,152,0.13)" }}
          >
            <ConsultationForm variant="integrated" />
          </div>
        </section>
      </div>
    </main>
  );
}
