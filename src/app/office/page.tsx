import Link from "next/link";
import { ArrowLeft, FileLock2, MessageSquareText, ReceiptText, ShieldCheck } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAuthContext } from "@/lib/crm/auth";
import { listOfficeDashboard } from "@/lib/crm/data";

export const dynamic = "force-dynamic";

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export default async function OfficePage() {
  const context = await requireAuthContext();
  const dashboard = await listOfficeDashboard(context);

  return (
    <main className="min-h-screen bg-[#070809] text-[#ece6d6]">
      <header className="border-b border-[#b2a898]/12 bg-[#070809]/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <Link href="/" aria-label="James Roman Advisory home">
            <BrandLogo className="h-9" />
          </Link>
          <form action="/auth/sign-out" method="post">
            <Button variant="ghost" size="sm" className="text-[#b2a898]">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-[#b2a898]/70">
          <ArrowLeft className="size-3" /> Public site
        </Link>
        <div className="mt-10 flex flex-wrap items-end justify-between gap-6 border-b border-[#b2a898]/12 pb-8">
          <div>
            <p className="text-[0.68rem] uppercase tracking-[0.32em] text-[#b2a898]/60">
              Secure Client Office
            </p>
            <h1 className="mt-4 font-heading text-5xl font-light leading-none">Private matter room</h1>
          </div>
          <Badge variant="secondary" className="rounded-none">
            {context.profile.role}
          </Badge>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            { label: "Matters", value: dashboard.matters.length, icon: ShieldCheck },
            { label: "Documents", value: dashboard.documents.length, icon: FileLock2 },
            { label: "Messages", value: dashboard.messages.length, icon: MessageSquareText },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="border border-[#b2a898]/12 p-5">
                <Icon className="size-4 text-[#c9b58a]" aria-hidden />
                <p className="mt-8 text-sm text-[#b2a898]/65">{item.label}</p>
                <p className="mt-2 font-heading text-4xl">{item.value}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <section>
            <p className="mb-5 text-[0.68rem] uppercase tracking-[0.28em] text-[#b2a898]/60">
              Matter status
            </p>
            <div className="border-y border-[#b2a898]/12">
              {dashboard.matters.length ? (
                dashboard.matters.map((matter) => (
                  <div key={matter.id} className="grid gap-2 border-b border-[#b2a898]/12 py-5 last:border-b-0 md:grid-cols-[1fr_auto]">
                    <div>
                      <p className="font-heading text-2xl">{matter.title}</p>
                      <p className="mt-1 text-sm text-[#b2a898]/65">{matter.market ?? "Private market"}</p>
                    </div>
                    <Badge variant="outline" className="h-fit rounded-none uppercase tracking-[0.16em]">
                      {matter.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="py-6 text-sm leading-7 text-[#b2a898]/65">
                  No active matter access is assigned to this account yet.
                </p>
              )}
            </div>
          </section>

          <section className="grid gap-8">
            <div>
              <p className="mb-5 text-[0.68rem] uppercase tracking-[0.28em] text-[#b2a898]/60">
                Recent documents
              </p>
              <div className="border-y border-[#b2a898]/12">
                {dashboard.documents.length ? (
                  dashboard.documents.map((document) => (
                    <div key={document.id} className="flex items-center gap-3 border-b border-[#b2a898]/12 py-4 text-sm last:border-b-0">
                      <FileLock2 className="size-4 text-[#c9b58a]" aria-hidden />
                      <span>{document.title}</span>
                    </div>
                  ))
                ) : (
                  <p className="py-5 text-sm text-[#b2a898]/65">No documents available.</p>
                )}
              </div>
            </div>

            <div>
              <p className="mb-5 text-[0.68rem] uppercase tracking-[0.28em] text-[#b2a898]/60">
                Invoice visibility
              </p>
              <div className="border-y border-[#b2a898]/12">
                {dashboard.invoices.length ? (
                  dashboard.invoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between gap-4 border-b border-[#b2a898]/12 py-4 text-sm last:border-b-0">
                      <span className="inline-flex items-center gap-3">
                        <ReceiptText className="size-4 text-[#c9b58a]" aria-hidden />
                        {invoice.invoice_number}
                      </span>
                      <span className="text-[#b2a898]/70">{money(invoice.amount_cents, invoice.currency)}</span>
                    </div>
                  ))
                ) : (
                  <p className="py-5 text-sm text-[#b2a898]/65">No invoices visible.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
