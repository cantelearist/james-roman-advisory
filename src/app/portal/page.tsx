import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileLock2,
  FileText,
  LockKeyhole,
  MessageSquareText,
  ReceiptText,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/brand-logo";
import { ButtonLink } from "@/components/button-link";
import { LuxuryIcon } from "@/components/luxury-icon";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

const milestones = [
  { label: "Engagement accepted", status: "Complete", icon: CheckCircle2 },
  { label: "Initial documents reviewed", status: "Complete", icon: CheckCircle2 },
  { label: "Protocol comments issued", status: "In review", icon: Clock3 },
  { label: "Clearance package pending", status: "Next", icon: FileText },
];

const recentDocuments = [
  "Remediation protocol redline.pdf",
  "Structural observations summary.pdf",
  "Contractor response matrix.xlsx",
];

const matterDetails = [
  ["Matter type", "Remediation oversight"],
  ["Market", "Malibu"],
  ["Access", "MFA required"],
  ["Circulation", "Need-to-know"],
];

export default function PortalPreview() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="James Roman Advisory home">
            <BrandLogo priority className="h-9" />
          </Link>
          <div className="flex items-center gap-3">
            <ButtonLink href="/portal/matters" size="sm" variant="ghost">
              Engagements
            </ButtonLink>
            <ButtonLink href="/portal/vault" size="sm">
              <FileLock2 data-icon="inline-start" />
              Document Vault
            </ButtonLink>
            <ButtonLink href="/" variant="ghost" size="sm">
              <ArrowLeft data-icon="inline-start" />
              Public site
            </ButtonLink>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-primary/15 pb-6">
          <div>
            <p className="text-[0.64rem] uppercase tracking-[0.28em] text-muted-foreground">
              Secure file room / preview
            </p>
            <h1 className="mt-4 font-heading text-5xl leading-none">Private engagement</h1>
          </div>
          <Badge variant="secondary">Client-scoped</Badge>
        </div>

        <div className="grid gap-10 lg:grid-cols-[0.66fr_1.34fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="dossier-panel border p-5">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                    Matter status
                  </p>
                  <p className="mt-4 font-heading text-4xl leading-tight">Controlled review</p>
                </div>
                <LuxuryIcon icon={LockKeyhole} />
              </div>
              <div className="mt-7">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span>Overall progress</span>
                  <span className="text-muted-foreground">68%</span>
                </div>
                <Progress value={68} />
              </div>
              <Separator className="my-6" />
              <div className="grid gap-0 border-y border-primary/15 text-sm">
                {matterDetails.map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[0.78fr_1fr] border-b border-primary/15 py-3 last:border-b-0">
                    <span className="text-muted-foreground">{label}</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm leading-6 text-muted-foreground">
                This preview represents the intended tone of the client portal: restrained,
                traceable, and organized around the matter record.
              </p>
            </div>
          </aside>

          <div className="grid gap-10">
            <div className="grid gap-0 border-y border-primary/15 md:grid-cols-3">
              {[
                { label: "Documents", value: "12", icon: FileLock2 },
                { label: "Open requests", value: "3", icon: MessageSquareText },
                { label: "Invoices", value: "2", icon: ReceiptText },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="group border-b border-primary/15 p-5 md:border-b-0 md:border-r md:last:border-r-0">
                    <LuxuryIcon icon={Icon} />
                    <p className="mt-8 text-sm text-muted-foreground">{item.label}</p>
                    <p className="mt-2 font-heading text-4xl">{item.value}</p>
                  </div>
                );
              })}
            </div>

            <section className="grid gap-5">
              <div>
                <p className="text-[0.64rem] uppercase tracking-[0.28em] text-muted-foreground">
                  Milestones
                </p>
                <h2 className="mt-3 font-heading text-3xl">Advisor-controlled progress tracking.</h2>
              </div>
              <div className="border-y border-primary/15">
                {milestones.map((milestone) => {
                  const Icon = milestone.icon;
                  return (
                    <div key={milestone.label} className="record-row flex items-center justify-between gap-4 border-b border-primary/15 py-4 last:border-b-0">
                      <div className="flex items-center gap-3">
                        <Icon className="size-4 text-primary" aria-hidden />
                        <span>{milestone.label}</span>
                      </div>
                      <Badge variant="outline">{milestone.status}</Badge>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="grid gap-10 lg:grid-cols-2">
              <section>
                <div className="flex items-center justify-between">
                  <p className="text-[0.64rem] uppercase tracking-[0.28em] text-muted-foreground">
                    Recent documents
                  </p>
                  <Link
                    href="/portal/vault"
                    className="text-[0.64rem] uppercase tracking-[0.2em] text-primary/70 transition-colors hover:text-primary"
                  >
                    Open vault →
                  </Link>
                </div>
                <div className="mt-5 border-y border-primary/15">
                  {recentDocuments.map((document) => (
                    <div key={document} className="record-row flex items-center gap-3 border-b border-primary/15 py-4 last:border-b-0">
                      <FileText className="size-4 text-muted-foreground" aria-hidden />
                      <span className="text-sm">{document}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <p className="text-[0.64rem] uppercase tracking-[0.28em] text-muted-foreground">
                  Advisor thread
                </p>
                <div className="mt-5 flex flex-col gap-3 text-sm">
                  <div className="border border-primary/15 bg-muted/40 p-4">
                    Contractor response received. Advisor review is pending before any client acceptance.
                  </div>
                  <div className="border p-4">
                    Client request: confirm whether clearance criteria address accessible concealed cavities.
                  </div>
                </div>
              </section>
            </div>

            <section className="border-y border-primary/15 py-6">
              <p className="max-w-3xl font-heading text-3xl leading-snug">
                The portal should not feel like software trying to impress the client. It should feel
                like a private record room that happens to live online.
              </p>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
