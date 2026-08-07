import type { ReactNode } from "react";
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";

export function LegalPage({
  eyebrow = "Legal",
  title,
  lead,
  children,
}: {
  eyebrow?: string;
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a0b0e] text-[#ece6d6]">
      <header className="border-b border-white/[0.08] bg-[#0a0b0e]/95 backdrop-blur">
        <div className="mx-auto flex min-h-[4.5rem] max-w-7xl items-center justify-between gap-6 px-5 py-4 sm:px-8 lg:px-12">
          <Link href="/" aria-label="James Roman Advisory home">
            <BrandLogo className="h-9" priority />
          </Link>
          <nav className="flex items-center gap-5 text-[0.68rem] uppercase tracking-[0.18em] text-[#ece6d6]/55 sm:gap-7" aria-label="Primary navigation">
            <Link href="/" className="transition-colors hover:text-[#ece6d6]">Home</Link>
            <Link href="/portal" className="transition-colors hover:text-[#ece6d6]">Private Office</Link>
          </nav>
        </div>
      </header>

      <main id="main-content">
        <section className="border-b border-white/[0.08] px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(20rem,1.15fr)] lg:items-end lg:gap-24">
            <div>
              <p className="text-[0.67rem] uppercase tracking-[0.24em] text-[#c9b58a]">{eyebrow}</p>
              <h1 className="mt-5 font-heading text-5xl leading-[0.94] tracking-[-0.03em] text-[#ece6d6] sm:text-6xl lg:text-7xl">{title}</h1>
            </div>
            <p className="max-w-[42rem] font-heading text-2xl leading-relaxed text-[#ece6d6]/70 sm:text-3xl">{lead}</p>
          </div>
        </section>

        <article className="legal-article mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
          {children}
        </article>
      </main>

      <footer className="border-t border-white/[0.08] px-5 py-9 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#ece6d6]/45">© 2026 James Roman Advisory LLC · Malibu, California</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-3 text-[0.68rem] uppercase tracking-[0.16em] text-[#ece6d6]/55" aria-label="Legal navigation">
            <Link href="/privacy" className="hover:text-[#ece6d6]">Privacy</Link>
            <Link href="/cookies" className="hover:text-[#ece6d6]">Cookies</Link>
            <Link href="/terms" className="hover:text-[#ece6d6]">Terms</Link>
            <Link href="/accessibility" className="hover:text-[#ece6d6]">Accessibility</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export function LegalCallout({ children, title }: { children: ReactNode; title: string }) {
  return <aside className="legal-callout"><strong>{title}</strong><div>{children}</div></aside>;
}
