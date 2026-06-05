import Image from "next/image";
import Link from "next/link";
import {
  EyeOff,
  FileStack,
  FlaskConical,
  KeyRound,
  Quote,
  ScanLine,
  UserCheck,
  Vault,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BrandLogo } from "@/components/brand-logo";
import { ButtonLink } from "@/components/button-link";
import { ConsultationForm } from "@/components/consultation-form";
import { ExperienceGlow } from "@/components/experience-glow";
import { LuxuryIcon } from "@/components/luxury-icon";
import { SiteHeader } from "@/components/site-header";

const practiceCards: Array<{ num: string; title: string; text: string; icon: LucideIcon }> = [
  {
    num: "01",
    title: "Contractor Vetting",
    text: "License, insurance, bonding, and field performance reviewed before any crew steps on site.",
    icon: UserCheck,
  },
  {
    num: "02",
    title: "Hazardous Material Audit",
    text: "Asbestos, lead, heavy metals, and airborne particulate monitoring coordinated end-to-end.",
    icon: FlaskConical,
  },
  {
    num: "03",
    title: "Regulatory Navigation",
    text: "City, county, Coastal Commission, and AQMD requirements managed so nothing falls through.",
    icon: FileStack,
  },
  {
    num: "04",
    title: "Concierge Closeout",
    text: "Final clearance letters, document vault, and insurance reconciliation handled to completion.",
    icon: Vault,
  },
];

const cornerstones: Array<{ title: string; text: string; icon: LucideIcon }> = [
  {
    title: "Privacy",
    text: "NDA-protected engagements, no public client list. Your property and your family context stay tightly held.",
    icon: EyeOff,
  },
  {
    title: "Transparency",
    text: "Every test result, invoice, and report is logged to your Private Office. Nothing circulates informally.",
    icon: ScanLine,
  },
  {
    title: "Concierge",
    text: "A direct line to the founding partner. We limit engagements to six projects annually — intentionally.",
    icon: KeyRound,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <SiteHeader />
      <ExperienceGlow />

      {/* 1 · HERO */}
      <section className="relative">
        <div className="absolute inset-0 motion-soft-reveal">
          <Image
            src="/images/jra-hero.jpg"
            alt="Malibu coastline at golden hour"
            fill
            priority
            className="slow-drift object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-background/55 sm:bg-gradient-to-b sm:from-background/70 sm:via-background/50 sm:to-background/75" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,11,14,0.28),rgba(10,11,14,0.82))]" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background to-transparent" />
        </div>

        <div className="relative mx-auto flex min-h-[min(920px,calc(100vh-4rem))] max-w-7xl flex-col items-center justify-center px-4 pb-16 pt-24 text-center sm:px-6 lg:px-8">
          <p className="motion-fade-up mb-6 text-[0.62rem] uppercase tracking-[0.32em] text-foreground/50">
            Private advisory · Los Angeles coastal estates
          </p>
          <h1 className="motion-fade-up font-heading text-5xl font-semibold leading-[0.95] tracking-normal text-foreground sm:text-6xl lg:text-7xl xl:text-8xl">
            Protecting The Coast<br className="hidden sm:block" /> We Call Home.
          </h1>
          <p className="motion-fade-up motion-delay-1 mx-auto mt-7 max-w-2xl text-lg leading-8 text-foreground/80 sm:text-xl sm:text-muted-foreground">
            Ultra-discreet hazardous materials remediation advisory and structural inspection
            oversight for coastal estate owners where cost, liability, and pressure arrive together.
          </p>

          {/* Founder quote */}
          <div className="motion-fade-up motion-delay-2 mx-auto mt-10 max-w-xl border-y border-primary/20 py-6">
            <Quote className="mx-auto mb-3 size-5 text-primary/50" aria-hidden />
            <p className="font-heading text-xl leading-snug text-foreground/90 sm:text-2xl">
              We lost our home twice in 30 years. We don&apos;t just know the risk — we live it.
            </p>
            <p className="mt-3 text-xs uppercase tracking-[0.22em] text-primary/70">
              Roman &amp; Stephen · Founders
            </p>
          </div>

          {/* Founders — Malibu beach */}
          <div className="motion-fade-up motion-delay-3 mt-10 flex justify-center">
            <div className="relative h-36 w-56 overflow-hidden sm:h-44 sm:w-72">
              <Image
                src="/images/founders/founders-malibu.png"
                alt="Roman and Stephen, co-founders of James Roman Advisory, on the Malibu coast"
                fill
                className="luxury-image object-cover object-center saturate-[0.82] contrast-[0.90]"
                sizes="288px"
              />
              <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-background/90 to-transparent" />
              <p className="absolute bottom-2 left-0 right-0 text-center text-[0.6rem] uppercase tracking-[0.2em] text-foreground/80">
                Malibu, California
              </p>
            </div>
          </div>

          <div className="motion-fade-up motion-delay-3 mt-10">
            <ButtonLink href="#consultation" size="lg">
              Book a Confidential Inquiry
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* 2 · THE ORIGIN */}
      <section id="story" className="scroll-reveal mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-12 border-y border-primary/15 py-14 lg:grid-cols-[0.68fr_1.32fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="mb-4 text-[0.64rem] uppercase tracking-[0.28em] text-muted-foreground">
              The Origin
            </p>
            <h2 className="font-heading text-4xl font-semibold leading-tight sm:text-5xl">
              Twice in thirty years, the canyon claimed the ridge.
            </h2>
          </div>
          <div className="space-y-5 text-base leading-8 text-muted-foreground">
            <p>
              Stephen was born in Malibu. He watched his family&apos;s home burn in 1993 and again
              in 2018. Both times, the hardest part wasn&apos;t the loss — it was what came after:
              contractors who couldn&apos;t be trusted, regulators who moved slowly, and advisors
              who worked for the insurance company, not the homeowner.
            </p>
            <p>
              Roman spent years overseeing construction across Los Angeles and watched, repeatedly,
              how quickly standards drift when no one is clearly standing for the person paying the
              bill. The debris gets cleared. The permits get filed. But the record — the defensible,
              organized, owner-side record — almost never gets built.
            </p>
            <p>
              James Roman Advisory exists because both of them needed it, years before they
              built it. We don&apos;t remediate. We don&apos;t inspect. We sit on your side of
              the table and make sure the people who do those things answer to you.
            </p>
          </div>
        </div>
      </section>

      {/* 3 · THE PRACTICE */}
      <section id="process" className="scroll-reveal border-y bg-card">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mb-12 max-w-2xl">
            <p className="mb-4 text-[0.64rem] uppercase tracking-[0.28em] text-muted-foreground">
              The Practice
            </p>
            <h2 className="font-heading text-4xl font-semibold leading-tight sm:text-5xl">
              Advocacy, not remediation.
            </h2>
            <p className="mt-5 text-base leading-7 text-muted-foreground">
              We carry no hammers, file no invoices for work, and hold no remediation licenses.
              Our only product is judgment — applied exclusively on behalf of the owner.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {practiceCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.num}
                  className="dossier-panel luxury-hover group flex flex-col gap-5 border p-6"
                >
                  <p className="text-xs text-primary/60">{card.num}</p>
                  <LuxuryIcon icon={Icon} />
                  <div>
                    <h3 className="font-heading text-2xl leading-tight">{card.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{card.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4 · THE CONCIERGE EXPERIENCE */}
      <section id="concierge" className="scroll-reveal mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <p className="mb-4 text-[0.64rem] uppercase tracking-[0.28em] text-muted-foreground">
              The Concierge Experience
            </p>
            <h2 className="font-heading text-4xl font-semibold leading-tight sm:text-5xl">
              Your Private Office.
            </h2>
            <p className="mt-5 text-base leading-7 text-muted-foreground">
              Every client receives a dedicated digital workspace — real-time transparency on
              compliance status, document custody, and site activity, visible only to them.
            </p>

            {/* Dashboard mockup */}
            <div className="dossier-panel mt-8 border p-5">
              <div className="flex items-start justify-between border-b border-primary/15 pb-4">
                <div>
                  <p className="font-heading text-xl">Engagement file</p>
                  <p className="mt-1 text-xs text-muted-foreground">Broad Beach Rd · Active</p>
                </div>
                <Badge variant="secondary" className="text-[0.6rem] uppercase tracking-wider">
                  Restricted
                </Badge>
              </div>
              <div className="mt-4 space-y-4 border-b border-primary/15 pb-4">
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-foreground/80">Current Phase</span>
                    <span className="text-primary/80">02 — Asbestos Containment</span>
                  </div>
                  <Progress value={42} className="h-1.5" />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-foreground/80">Document Custody</span>
                    <span className="text-primary/80">14 files</span>
                  </div>
                  <Progress value={88} className="h-1.5" />
                </div>
              </div>
              <div className="mt-4 space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-green-500/70" />
                  <span className="text-foreground/70">Safety Compliance</span>
                  <span className="ml-auto text-primary/70">All 14 staff cleared</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-green-500/70" />
                  <span className="text-foreground/70">Air Quality</span>
                  <span className="ml-auto text-primary/70">0.003 mg/m³ — Below EPA</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4-image grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { src: "/images/jra-hero.jpg", label: "Feed 01", caption: "Site containment barrier" },
              { src: "/images/founders/stephen.jpg", label: "Sensor Node 04", caption: "Air quality station" },
              { src: "/images/founders/roman.jpg", label: "Permit Log", caption: "Regulatory filings" },
              { src: "/images/jra-hero.png", label: "Site Plan", caption: "Architectural detail" },
            ].map((item) => (
              <div key={item.label} className="group relative aspect-[4/3] overflow-hidden border border-primary/10">
                <Image
                  src={item.src}
                  alt={item.caption}
                  fill
                  className="luxury-image object-cover saturate-[0.65] contrast-[0.85]"
                  sizes="(min-width: 1024px) 320px, 50vw"
                />
                <div className="absolute inset-0 bg-background/40" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-[0.58rem] uppercase tracking-[0.22em] text-primary/80">{item.label}</p>
                  <p className="text-[0.65rem] text-foreground/60">{item.caption}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5 · OUR CORNERSTONES */}
      <section id="cornerstones" className="scroll-reveal border-y bg-card">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <p className="mb-4 text-[0.64rem] uppercase tracking-[0.28em] text-muted-foreground">
              Our Cornerstones
            </p>
            <h2 className="font-heading text-4xl font-semibold leading-tight sm:text-5xl">
              The terms we don&apos;t negotiate.
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {cornerstones.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="dossier-panel luxury-hover group flex flex-col gap-5 border p-7"
                >
                  <LuxuryIcon icon={Icon} />
                  <div>
                    <h3 className="font-heading text-3xl leading-tight">{item.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6 · CERTIFICATIONS BAR */}
      <section id="certifications" className="bg-secondary py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {[
              "CSLB Licensed",
              "IICRC Master Fire & Smoke",
              "AIHA Corporate Member",
              "Cal/OSHA Certified",
              "Malibu Chamber of Commerce",
            ].map((cert, i, arr) => (
              <li key={cert} className="flex items-center gap-5">
                <span className="text-[0.65rem] uppercase tracking-[0.28em] text-muted-foreground">
                  {cert}
                </span>
                {i < arr.length - 1 && (
                  <span className="hidden text-primary/30 sm:inline" aria-hidden>·</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 7 · FINAL CTA */}
      <section className="scroll-reveal mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <h2 className="font-heading text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
          Your home is your sanctuary.<br className="hidden sm:block" /> Ensure it stays that way.
        </h2>
        <div className="mt-10">
          <ButtonLink href="#consultation" size="lg">
            Book a Confidential Inquiry
          </ButtonLink>
        </div>
      </section>

      {/* 8 · CONSULTATION / LEGAL — UNTOUCHED */}
      <section
        id="consultation"
        className="scroll-reveal mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8"
      >
        <div>
          <p className="mb-4 text-[0.64rem] uppercase tracking-[0.28em] text-muted-foreground">
            Get in touch
          </p>
          <h2 className="font-heading text-4xl font-semibold leading-tight">
            Request a confidential consultation.
          </h2>
          <p className="mt-5 text-base leading-7 text-muted-foreground">
            Share only what is necessary. Full document exchange happens after an engagement is
            accepted and secure client access is issued.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {["CCPA/CPRA aware", "WCAG 2.2 AA target", "No portal trackers"].map((label) => (
              <Badge key={label} variant="secondary">
                {label}
              </Badge>
            ))}
          </div>
        </div>
        <ConsultationForm />
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <BrandLogo className="h-7 opacity-80" />
            <div>
              <p>© 2026 James Roman Advisory LLC</p>
              <p className="text-xs text-muted-foreground/60">
                Malibu, California · Fully Certified · Privacy Guaranteed
              </p>
            </div>
          </div>
          <div className="flex gap-5">
            <Link href="#process">The Process</Link>
            <Link href="#certifications">Certifications</Link>
            <Link href="/portal">Client portal</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
