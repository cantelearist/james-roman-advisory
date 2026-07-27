"use client";

import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  CheckSquare2,
  CircleDollarSign,
  FileClock,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { usePortalAccess } from "@/components/portal/access-provider";
import {
  EmptyState,
  HealthBadge,
  PageHeader,
  PriorityBadge,
  StatusBadge,
} from "@/components/portal/portal-ui";

type SummaryMatter = {
  id: string;
  title: string;
  status: string;
  priority: string;
  health: string;
  due_date?: string | null;
  next_action?: string | null;
  next_action_due_at?: string | null;
  client_name?: string;
  property_address?: string;
  owner_name?: string | null;
  open_tasks: number;
  updated_at: string;
};

type SummaryTask = {
  id: string;
  matter_id: string;
  matter_title: string;
  title: string;
  status: string;
  priority: string;
  due_date?: string | null;
  assignee_name?: string | null;
};

type Metrics = {
  activeEngagements: number;
  atRiskEngagements: number;
  overdueTasks: number;
  unreadNotifications: number;
  pendingDocuments: number;
  draftInvoices: number;
  overdueInvoices: number;
  outstandingCents: number;
};

type Summary = {
  matters: SummaryMatter[];
  tasks: SummaryTask[];
  metrics: Metrics;
};

function dateLabel(value?: string | null): string {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function PortalHomePage() {
  const { user, access, can } = usePortalAccess();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/portal/summary", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The workspace could not be loaded.");
      setSummary(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The workspace could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const attention = useMemo(
    () => summary?.matters.filter((matter) =>
      matter.health === "at_risk"
      || matter.health === "blocked"
      || (matter.due_date && new Date(matter.due_date).getTime() < now),
    ).slice(0, 6) ?? [],
    [now, summary],
  );

  if (loading) {
    return (
      <div className="portal-page">
        <PageHeader eyebrow="Command center" title={`Good ${new Date().getHours() < 12 ? "morning" : "afternoon"}, ${user.name.split(" ")[0]}`} />
        <div className="portal-skeleton-grid" aria-label="Loading workspace">
          {Array.from({ length: 8 }, (_, index) => <span key={index} />)}
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="portal-page">
        <PageHeader eyebrow="Command center" title="Workspace unavailable" />
        <div className="portal-error-state" role="alert">
          <AlertTriangle size={20} />
          <div><strong>We could not load current operations.</strong><p>{error}</p></div>
          <button className="portal-secondary-button" onClick={load}><RefreshCw size={14} />Retry</button>
        </div>
      </div>
    );
  }

  const metricCards = [
    {
      label: "Active engagements",
      value: summary.metrics.activeEngagements,
      detail: `${summary.metrics.atRiskEngagements} require attention`,
      href: "/portal/matters",
      icon: BriefcaseBusiness,
      tone: summary.metrics.atRiskEngagements > 0 ? "warning" : "neutral",
      show: can("engagements.view"),
    },
    {
      label: "Overdue work",
      value: summary.metrics.overdueTasks,
      detail: `${summary.tasks.length} open assignments`,
      href: "/portal/work?filter=overdue",
      icon: CheckSquare2,
      tone: summary.metrics.overdueTasks > 0 ? "critical" : "neutral",
      show: can("timeline.view"),
    },
    {
      label: "Unread activity",
      value: summary.metrics.unreadNotifications,
      detail: "Messages and record changes",
      href: "/portal/inbox",
      icon: Bell,
      tone: summary.metrics.unreadNotifications > 0 ? "accent" : "neutral",
      show: can("messages.view"),
    },
    {
      label: "Document review",
      value: summary.metrics.pendingDocuments,
      detail: "Awaiting publication",
      href: "/portal/vault?status=pending_review",
      icon: FileClock,
      tone: summary.metrics.pendingDocuments > 0 ? "warning" : "neutral",
      show: can("documents.publish"),
    },
    {
      label: "Outstanding",
      value: money(summary.metrics.outstandingCents),
      detail: `${summary.metrics.overdueInvoices} overdue invoices`,
      href: "/portal/finance?status=outstanding",
      icon: CircleDollarSign,
      tone: summary.metrics.overdueInvoices > 0 ? "critical" : "neutral",
      show: can("finance.view"),
    },
  ].filter((card) => card.show);

  return (
    <div className="portal-page">
      <PageHeader
        eyebrow="Command center"
        title={`${access.role === "client" ? "Your Private Office" : "Operations overview"}`}
        description={access.role === "client"
          ? "Your engagements, documents and correspondence in one confidential record."
          : `Current priorities and exceptions across the advisory practice. Updated ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.`}
        actions={<button className="portal-secondary-button" onClick={load}><RefreshCw size={14} />Refresh</button>}
      />

      <section className="portal-metric-grid" aria-label="Operational metrics">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} href={card.href} className={`portal-metric-card portal-metric-${card.tone}`}>
              <span className="portal-metric-icon"><Icon size={17} /></span>
              <div>
                <p>{card.label}</p>
                <strong>{card.value}</strong>
                <span>{card.detail}</span>
              </div>
              <ArrowRight size={14} />
            </Link>
          );
        })}
      </section>

      <div className="portal-dashboard-grid">
        <section className="portal-card portal-dashboard-panel">
          <header className="portal-panel-header">
            <div><p className="portal-eyebrow">Priority queue</p><h2>My work</h2></div>
            <Link href="/portal/work">View all <ArrowRight size={13} /></Link>
          </header>
          {summary.tasks.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No open assignments"
              description="Assigned tasks and due dates will appear here."
            />
          ) : (
            <div className="portal-task-list">
              {summary.tasks.slice(0, 7).map((task) => (
                <Link href={`/portal/matters/${task.matter_id}?section=work`} key={task.id}>
                  <span className={`portal-task-check portal-task-${task.status}`} />
                  <div>
                    <strong>{task.title}</strong>
                    <span>{task.matter_title}</span>
                  </div>
                  <PriorityBadge priority={task.priority} />
                  <time className={task.due_date && new Date(task.due_date).getTime() < now ? "is-overdue" : undefined}>
                    {dateLabel(task.due_date)}
                  </time>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="portal-card portal-dashboard-panel">
          <header className="portal-panel-header">
            <div><p className="portal-eyebrow">Exceptions</p><h2>Requires attention</h2></div>
            <Link href="/portal/matters?view=attention">Open view <ArrowRight size={13} /></Link>
          </header>
          {attention.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No current exceptions"
              description="At-risk, blocked and overdue engagements will be surfaced here."
            />
          ) : (
            <div className="portal-attention-list">
              {attention.map((matter) => (
                <Link href={`/portal/matters/${matter.id}`} key={matter.id}>
                  <div>
                    <strong>{matter.title}</strong>
                    <span>{matter.client_name}{matter.owner_name ? ` · ${matter.owner_name}` : ""}</span>
                  </div>
                  <HealthBadge health={matter.health} />
                  <span className="portal-attention-action">{matter.next_action || "Review engagement"}</span>
                  <ArrowRight size={14} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="portal-card portal-dashboard-panel portal-recent-engagements">
        <header className="portal-panel-header">
          <div><p className="portal-eyebrow">Portfolio</p><h2>Recent engagements</h2></div>
          <Link href="/portal/matters">All engagements <ArrowRight size={13} /></Link>
        </header>
        {summary.matters.length === 0 ? (
          <EmptyState
            icon={BriefcaseBusiness}
            title="No engagements"
            description={can("engagements.create")
              ? "Create the first engagement to establish its secure operating record."
              : "No engagement has been assigned to your account."}
            action={can("engagements.create") ? { href: "/portal/matters?new=1", label: "Create engagement" } : undefined}
          />
        ) : (
          <div className="portal-data-table portal-dashboard-table">
            <div className="portal-data-row portal-data-header">
              <span>Engagement</span><span>Stage</span><span>Health</span><span>Owner</span><span>Open work</span><span>Last activity</span>
            </div>
            {summary.matters.slice(0, 8).map((matter) => (
              <Link className="portal-data-row" href={`/portal/matters/${matter.id}`} key={matter.id}>
                <span><strong>{matter.title}</strong><small>{matter.client_name}{matter.property_address ? ` · ${matter.property_address}` : ""}</small></span>
                <span><StatusBadge status={matter.status} /></span>
                <span><HealthBadge health={matter.health} /></span>
                <span>{matter.owner_name || "Unassigned"}</span>
                <span>{matter.open_tasks}</span>
                <span>{dateLabel(matter.updated_at)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
