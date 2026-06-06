import Link from "next/link";
import { Activity, BriefcaseBusiness, FileLock2, MessageSquareText, Users } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireTeamContext } from "@/lib/crm/auth";
import { listAdminDashboard } from "@/lib/crm/data";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const context = await requireTeamContext();
  const dashboard = await listAdminDashboard(context);

  return (
    <main className="min-h-screen bg-[#f5f1e8] text-[#111318]">
      <header className="border-b border-[#111318]/10 bg-[#f5f1e8]/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <Link href="/" aria-label="James Roman Advisory home">
            <BrandLogo className="h-9 invert" />
          </Link>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="rounded-none uppercase tracking-[0.14em]">
              {context.profile.role}
            </Badge>
            <form action="/auth/sign-out" method="post">
              <Button variant="outline" size="sm" className="rounded-none">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-12">
        <p className="text-[0.68rem] uppercase tracking-[0.32em] text-[#5e5548]">Internal CRM</p>
        <h1 className="mt-4 font-heading text-5xl font-light leading-none">James Roman operating room</h1>

        <div className="mt-10 grid gap-4 md:grid-cols-5">
          {[
            { label: "Clients", value: dashboard.clients.length, icon: Users },
            { label: "Matters", value: dashboard.matters.length, icon: BriefcaseBusiness },
            { label: "Documents", value: dashboard.documents.length, icon: FileLock2 },
            { label: "Messages", value: dashboard.messages.length, icon: MessageSquareText },
            { label: "Audit", value: dashboard.auditLogs.length, icon: Activity },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="border border-[#111318]/10 bg-white/50 p-4">
                <Icon className="size-4 text-[#8a6f36]" aria-hidden />
                <p className="mt-8 text-xs uppercase tracking-[0.18em] text-[#5e5548]">{item.label}</p>
                <p className="mt-2 font-heading text-4xl">{item.value}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-2">
          <section>
            <h2 className="font-heading text-3xl font-light">Recent clients</h2>
            <div className="mt-5 border-y border-[#111318]/10">
              {dashboard.clients.map((client) => (
                <div key={client.id} className="grid gap-2 border-b border-[#111318]/10 py-4 last:border-b-0 md:grid-cols-[1fr_auto]">
                  <div>
                    <p className="text-lg">{client.display_name}</p>
                    <p className="text-sm text-[#5e5548]">{client.primary_email ?? "No email"}</p>
                  </div>
                  <p className="text-sm text-[#5e5548]">{client.primary_market ?? "Private"}</p>
                </div>
              ))}
              {!dashboard.clients.length ? <p className="py-5 text-sm text-[#5e5548]">No clients yet.</p> : null}
            </div>
          </section>

          <section>
            <h2 className="font-heading text-3xl font-light">Active matters</h2>
            <div className="mt-5 border-y border-[#111318]/10">
              {dashboard.matters.map((matter) => (
                <div key={matter.id} className="grid gap-2 border-b border-[#111318]/10 py-4 last:border-b-0 md:grid-cols-[1fr_auto]">
                  <div>
                    <p className="text-lg">{matter.title}</p>
                    <p className="text-sm text-[#5e5548]">{matter.market ?? "Private market"}</p>
                  </div>
                  <Badge variant="secondary" className="h-fit rounded-none uppercase tracking-[0.14em]">
                    {matter.status}
                  </Badge>
                </div>
              ))}
              {!dashboard.matters.length ? <p className="py-5 text-sm text-[#5e5548]">No matters yet.</p> : null}
            </div>
          </section>
        </div>

        <section className="mt-12">
          <h2 className="font-heading text-3xl font-light">Audit trail</h2>
          <div className="mt-5 border-y border-[#111318]/10">
            {dashboard.auditLogs.map((event) => (
              <div key={event.id} className="grid gap-2 border-b border-[#111318]/10 py-4 text-sm last:border-b-0 md:grid-cols-[1fr_auto]">
                <span>{event.action}</span>
                <span className="text-[#5e5548]">{event.resource_type}</span>
              </div>
            ))}
            {!dashboard.auditLogs.length ? <p className="py-5 text-sm text-[#5e5548]">No audit events yet.</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
