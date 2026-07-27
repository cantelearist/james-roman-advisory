import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  Circle,
  Clock3,
  Minus,
} from "lucide-react";
import Link from "next/link";

export type PortalPriority = "low" | "normal" | "high" | "urgent";
export type PortalHealth = "on_track" | "at_risk" | "blocked";

export const MATTER_STATUS_LABELS: Record<string, string> = {
  intake: "Intake",
  assessment: "Assessment",
  review: "Review",
  vendor_evaluation: "Vendor evaluation",
  oversight: "Oversight",
  clearance: "Clearance",
  closed: "Closed",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`portal-status portal-status-${status}`}>
      <span />
      {MATTER_STATUS_LABELS[status] ?? status.replaceAll("_", " ")}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority?: string | null }) {
  const value = (priority ?? "normal") as PortalPriority;
  const Icon = value === "urgent" || value === "high" ? ArrowUp : value === "low" ? ArrowDown : Minus;
  return (
    <span className={`portal-priority portal-priority-${value}`}>
      <Icon size={12} />
      {value}
    </span>
  );
}

export function HealthBadge({ health }: { health?: string | null }) {
  const value = (health ?? "on_track") as PortalHealth;
  const Icon = value === "blocked" ? AlertTriangle : value === "at_risk" ? Clock3 : Check;
  return (
    <span className={`portal-health portal-health-${value}`}>
      <Icon size={12} />
      {value.replace("_", " ")}
    </span>
  );
}

export function EmptyState({
  icon: Icon = Circle,
  title,
  description,
  action,
}: {
  icon?: typeof Circle;
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="portal-empty">
      <span className="portal-empty-icon"><Icon size={21} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <Link className="portal-secondary-button" href={action.href}>
          {action.label}
          <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="portal-page-header">
      <div>
        {eyebrow && <p className="portal-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="portal-page-actions">{actions}</div>}
    </header>
  );
}
