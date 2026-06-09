"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ConsultationForm } from "@/components/consultation-form";

const TITAN = "#b2a898";
const GOLD  = "#c9b58a";
const CREAM = "#ece6d6";
const BG    = "#0a0b0e";
const BODY  = "1.05rem";

export default function ContactPage() {
  return (
    <div style={{ background: BG, minHeight: "100vh", color: CREAM }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        className="px-[8%] py-5 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(178,168,152,0.07)" }}
      >
        <Link href="/" aria-label="Home">
          <BrandLogo className="h-9 opacity-80" />
        </Link>
        <Link
          href="/"
          className="flex items-center gap-2 text-[0.82rem] uppercase tracking-[0.2em] opacity-55 hover:opacity-100 transition-opacity duration-300"
          style={{ color: TITAN }}
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Link>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <main className="px-[8%] py-20 lg:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="grid gap-16 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">

            {/* Left — context */}
            <div>
              <p
                className="text-[0.72rem] uppercase tracking-[0.28em] mb-5"
                style={{ color: GOLD, opacity: 0.55 }}
              >
                Get in touch
              </p>
              <h1
                className="font-heading font-light leading-[1.05] tracking-[-0.025em] mb-8"
                style={{ fontSize: "clamp(2.1rem,3.5vw,3.4rem)", color: CREAM }}
              >
                Request a<br />
                <span style={{ color: TITAN }}>confidential</span>
                <br />
                consultation.
              </h1>
              <p
                className="leading-[1.9] max-w-md mb-10"
                style={{ color: TITAN, opacity: 0.88, fontSize: BODY }}
              >
                Share only what is necessary. Full document exchange happens
                after an engagement is accepted and secure client access is
                issued.
              </p>
              <div className="flex flex-wrap gap-2.5">
                {["CCPA/CPRA aware", "WCAG 2.2 AA target", "No portal trackers"].map((label) => (
                  <span
                    key={label}
                    className="text-[0.72rem] uppercase tracking-widest border px-2.5 py-1"
                    style={{ borderColor: "rgba(178,168,152,0.14)", color: TITAN, opacity: 0.55 }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Right — form */}
            <div
              className="border-t pt-8 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0"
              style={{ borderColor: "rgba(178,168,152,0.13)" }}
            >
              <ConsultationForm variant="integrated" />
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer
        className="px-[8%] py-10"
        style={{ borderTop: "1px solid rgba(178,168,152,0.07)" }}
      >
        <div className="max-w-5xl mx-auto flex items-center gap-5">
          <BrandLogo className="h-8 opacity-40" />
          <p className="text-[0.82rem]" style={{ color: TITAN, opacity: 0.36 }}>
            © 2026 James Roman Advisory LLC · Malibu, California
          </p>
        </div>
      </footer>

    </div>
  );
}
