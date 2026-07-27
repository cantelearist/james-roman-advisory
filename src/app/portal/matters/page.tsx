"use client";

import {
  CalendarDays,
  Check,
  ChevronDown,
  Columns3,
  Filter,
  LayoutList,
  Plus,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { usePortalAccess } from "@/components/portal/access-provider";
import {
  EmptyState,
  HealthBadge,
  MATTER_STATUS_LABELS,
  PageHeader,
  PriorityBadge,
  StatusBadge,
} from "@/components/portal/portal-ui";

type Matter = {
  id: string;
  client_id: string;
  client_name: string;
  property_address?: string | null;
  property_city?: string | null;
  title: string;
  type: string;
  status: string;
  owner_user_id?: string | null;
  owner_name?: string | null;
  priority: string;
  health: string;
  start_date?: string | null;
  due_date?: string | null;
  next_action?: string | null;
  next_action_due_at?: string | null;
  version: number;
  open_task_count: number;
  unread_message_count: number;
  pending_document_count: number;
  invoice_balance_cents: string | number;
  updated_at: string;
};

type Client = { id: string; name: string; email?: string };
type Person = { id: string; name: string; role: string };
type ViewType = "table" | "kanban" | "calendar" | "workload";
type SavedView = {
  id: string;
  name: string;
  view_type: ViewType;
  filters: Record<string, string>;
  columns: string[];
  sharing: "private" | "workspace";
};

const STATUSES = Object.keys(MATTER_STATUS_LABELS);
const PRIORITIES = ["low", "normal", "high", "urgent"];
const HEALTH_OPTIONS = ["on_track", "at_risk", "blocked"];
const VIEW_OPTIONS: Array<{ value: ViewType; label: string; icon: typeof LayoutList }> = [
  { value: "table", label: "Table", icon: LayoutList },
  { value: "kanban", label: "Kanban", icon: Columns3 },
  { value: "calendar", label: "Calendar", icon: CalendarDays },
  { value: "workload", label: "Workload", icon: Users },
];

function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

function NewEngagementDialog({
  clients,
  onClose,
  onCreated,
}: {
  clients: Client[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { can } = usePortalAccess();
  const [mode, setMode] = useState<"existing" | "new">(clients.length > 0 ? "existing" : "new");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      let clientId = String(form.get("clientId") ?? "");
      if (mode === "new") {
        const response = await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.get("clientName"),
            email: form.get("clientEmail") || null,
            phone: form.get("clientPhone") || null,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Client could not be created.");
        clientId = data.client.id;
      }
      if (!clientId) throw new Error("Select a client.");

      let propertyId: string | null = null;
      if (String(form.get("propertyAddress") ?? "").trim()) {
        const response = await fetch("/api/properties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId,
            address: form.get("propertyAddress"),
            city: form.get("propertyCity") || "Malibu",
            state: "CA",
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Property could not be created.");
        propertyId = data.property.id;
      }

      const response = await fetch("/api/matters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          propertyId,
          title: form.get("title"),
          type: form.get("type"),
          notes: form.get("notes"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Engagement could not be created.");
      onCreated();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Engagement could not be created.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="portal-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="new-engagement-title">
      <button className="portal-command-scrim" onClick={onClose} aria-label="Close dialog" />
      <section className="portal-dialog portal-engagement-dialog">
        <header>
          <div><p className="portal-eyebrow">New record</p><h2 id="new-engagement-title">Create engagement</h2></div>
          <button className="portal-icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        <form onSubmit={submit}>
          {can("clients.manage") && (
            <div className="portal-segmented">
              <button type="button" className={mode === "existing" ? "is-active" : undefined} onClick={() => setMode("existing")} disabled={clients.length === 0}>Existing client</button>
              <button type="button" className={mode === "new" ? "is-active" : undefined} onClick={() => setMode("new")}>New client</button>
            </div>
          )}
          {mode === "existing" ? (
            <label className="portal-field">
              <span>Client</span>
              <select name="clientId" required defaultValue="">
                <option value="" disabled>Select client</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}{client.email ? ` · ${client.email}` : ""}</option>)}
              </select>
            </label>
          ) : (
            <div className="portal-form-grid">
              <label className="portal-field portal-field-wide"><span>Client name</span><input name="clientName" required autoFocus /></label>
              <label className="portal-field"><span>Email</span><input name="clientEmail" type="email" /></label>
              <label className="portal-field"><span>Phone</span><input name="clientPhone" /></label>
            </div>
          )}
          <div className="portal-form-divider"><span>Engagement</span></div>
          <div className="portal-form-grid">
            <label className="portal-field portal-field-wide"><span>Engagement title</span><input name="title" required placeholder="Clear, specific internal title" /></label>
            <label className="portal-field">
              <span>Type</span>
              <select name="type" defaultValue="other">
                <option value="mold">Mold</option><option value="smoke_damage">Smoke damage</option>
                <option value="asbestos">Asbestos</option><option value="lead_paint">Lead paint</option>
                <option value="water_intrusion">Water intrusion</option>
                <option value="transaction_review">Transaction review</option><option value="other">Other</option>
              </select>
            </label>
            <label className="portal-field"><span>Property address</span><input name="propertyAddress" /></label>
            <label className="portal-field"><span>City</span><input name="propertyCity" defaultValue="Malibu" /></label>
            <label className="portal-field portal-field-wide"><span>Internal context</span><textarea name="notes" rows={3} /></label>
          </div>
          {error && <p className="portal-form-error" role="alert">{error}</p>}
          <footer>
            <button type="button" className="portal-secondary-button" onClick={onClose}>Cancel</button>
            <button className="portal-primary-button" disabled={saving}>{saving ? "Creating…" : "Create engagement"}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default function EngagementBoardPage() {
  const { can, access } = usePortalAccess();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [matters, setMatters] = useState<Matter[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [priority, setPriority] = useState(searchParams.get("priority") ?? "");
  const [health, setHealth] = useState(searchParams.get("health") ?? "");
  const [owner, setOwner] = useState(searchParams.get("owner_id") ?? "");
  const [view, setView] = useState<ViewType>((searchParams.get("view") as ViewType) || "table");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [showCreate, setShowCreate] = useState(searchParams.get("new") === "1");
  const [showSave, setShowSave] = useState(false);
  const [savingCell, setSavingCell] = useState("");
  const [now] = useState(() => Date.now());
  const [visibleColumns, setVisibleColumns] = useState([
    "client", "stage", "owner", "priority", "health", "next_action", "due", "work", "activity",
  ]);

  const updateUrl = useCallback((patch: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("new");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    if (health) params.set("health", health);
    if (owner) params.set("owner_id", owner);
    try {
      const responses = await Promise.all([
        fetch(`/api/matters?${params.toString()}`, { cache: "no-store" }),
        can("clients.view") ? fetch("/api/clients", { cache: "no-store" }) : Promise.resolve(null),
        (access.role === "super_admin" || access.role === "admin") ? fetch("/api/portal/people", { cache: "no-store" }) : Promise.resolve(null),
        fetch("/api/portal/views?module=engagements", { cache: "no-store" }),
      ]);
      const matterData = await responses[0].json();
      if (!responses[0].ok) throw new Error(matterData.error ?? "Engagements could not be loaded.");
      setMatters(matterData.matters ?? []);
      if (responses[1]?.ok) setClients((await responses[1].json()).clients ?? []);
      if (responses[2]?.ok) setPeople((await responses[2].json()).people ?? []);
      if (responses[3].ok) setSavedViews((await responses[3].json()).views ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Engagements could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [access.role, can, health, owner, priority, query, status]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      updateUrl({ q: query, status, priority, health, owner_id: owner, view });
      void load();
    }, query ? 220 : 0);
    return () => window.clearTimeout(timeout);
  }, [health, load, owner, priority, query, status, updateUrl, view]);

  async function patchMatter(matter: Matter, patch: Record<string, unknown>) {
    const key = `${matter.id}-${Object.keys(patch)[0]}`;
    setSavingCell(key);
    const before = matters;
    setMatters((rows) => rows.map((row) => row.id === matter.id ? { ...row, ...patch } as Matter : row));
    const response = await fetch(`/api/matters/${matter.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch, version: matter.version }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMatters(before);
      setError(data.error ?? "The engagement could not be updated.");
    } else {
      setMatters((rows) => rows.map((row) => row.id === matter.id ? { ...row, ...data.matter } : row));
    }
    setSavingCell("");
  }

  async function bulkUpdate(field: "priority" | "health", value: string) {
    const targets = matters.filter((matter) => selected.has(matter.id));
    for (const matter of targets) await patchMatter(matter, { [field]: value });
    setSelected(new Set());
  }

  async function saveView(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/portal/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module: "engagements",
        name: form.get("name"),
        viewType: view,
        filters: { q: query, status, priority, health, owner_id: owner },
        columns: visibleColumns,
        sharing: form.get("sharing") === "workspace" ? "workspace" : "private",
      }),
    });
    if (response.ok) {
      setShowSave(false);
      await load();
    } else {
      const data = await response.json();
      setError(data.error ?? "The view could not be saved.");
    }
  }

  function applySavedView(saved: SavedView) {
    setQuery(saved.filters.q ?? "");
    setStatus(saved.filters.status ?? "");
    setPriority(saved.filters.priority ?? "");
    setHealth(saved.filters.health ?? "");
    setOwner(saved.filters.owner_id ?? "");
    setView(saved.view_type);
    if (Array.isArray(saved.columns) && saved.columns.length > 0) {
      setVisibleColumns(saved.columns);
    }
  }

  const activeFilters = [status, priority, health, owner].filter(Boolean).length;
  const groupedByStatus = useMemo(
    () => STATUSES.map((stage) => ({ stage, matters: matters.filter((matter) => matter.status === stage) })),
    [matters],
  );
  const workload = useMemo(() => {
    const groups = new Map<string, { name: string; matters: Matter[] }>();
    for (const matter of matters) {
      const id = matter.owner_user_id ?? "unassigned";
      const current = groups.get(id) ?? { name: matter.owner_name ?? "Unassigned", matters: [] };
      current.matters.push(matter);
      groups.set(id, current);
    }
    return [...groups.values()].sort((a, b) => b.matters.length - a.matters.length);
  }, [matters]);

  return (
    <div className="portal-page portal-board-page">
      <PageHeader
        eyebrow="Operating board"
        title="Engagements"
        description={`${matters.length} visible engagement${matters.length === 1 ? "" : "s"} · Ownership, urgency and next actions`}
        actions={
          <>
            <button className="portal-secondary-button" onClick={load}><RefreshCw size={14} />Refresh</button>
            {can("engagements.create") && <button className="portal-primary-button" onClick={() => setShowCreate(true)}><Plus size={15} />New engagement</button>}
          </>
        }
      />

      <div className="portal-view-strip">
        <div className="portal-saved-views">
          <button className={!searchParams.get("saved") ? "is-active" : undefined} onClick={() => {
            setQuery(""); setStatus(""); setPriority(""); setHealth(""); setOwner("");
          }}>All engagements</button>
          {savedViews.map((saved) => <button key={saved.id} onClick={() => applySavedView(saved)}>{saved.name}{saved.sharing === "workspace" && <Users size={11} />}</button>)}
          <button className="portal-save-view-button" onClick={() => setShowSave(true)}><Save size={12} />Save view</button>
        </div>
        <div className="portal-view-switcher" aria-label="View type">
          {VIEW_OPTIONS.map((option) => {
            const Icon = option.icon;
            return <button key={option.value} className={view === option.value ? "is-active" : undefined} onClick={() => setView(option.value)}><Icon size={14} /><span>{option.label}</span></button>;
          })}
        </div>
      </div>

      <div className="portal-board-toolbar">
        <label className="portal-board-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search engagements, clients or properties" /></label>
        <button className={activeFilters ? "portal-toolbar-button is-active" : "portal-toolbar-button"} onClick={() => setShowFilters((value) => !value)}><Filter size={14} />Filter{activeFilters > 0 && <span>{activeFilters}</span>}<ChevronDown size={13} /></button>
        {view === "table" && <button className="portal-toolbar-button" onClick={() => setShowColumns((value) => !value)}><SlidersHorizontal size={14} />Columns</button>}
        {selected.size > 0 && (
          <div className="portal-bulk-actions">
            <strong>{selected.size} selected</strong>
            <select defaultValue="" onChange={(event) => event.target.value && bulkUpdate("priority", event.target.value)}><option value="">Set priority…</option>{PRIORITIES.map((item) => <option key={item}>{item}</option>)}</select>
            <select defaultValue="" onChange={(event) => event.target.value && bulkUpdate("health", event.target.value)}><option value="">Set health…</option>{HEALTH_OPTIONS.map((item) => <option key={item} value={item}>{item.replace("_", " ")}</option>)}</select>
            <button onClick={() => setSelected(new Set())}><X size={13} />Clear</button>
          </div>
        )}
      </div>

      {showFilters && (
        <div className="portal-filter-bar">
          <label><span>Stage</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All stages</option>{STATUSES.map((item) => <option key={item} value={item}>{MATTER_STATUS_LABELS[item]}</option>)}</select></label>
          <label><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">All priorities</option>{PRIORITIES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Health</span><select value={health} onChange={(event) => setHealth(event.target.value)}><option value="">All health states</option>{HEALTH_OPTIONS.map((item) => <option key={item} value={item}>{item.replace("_", " ")}</option>)}</select></label>
          <label><span>Owner</span><select value={owner} onChange={(event) => setOwner(event.target.value)}><option value="">All owners</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
          <button onClick={() => { setStatus(""); setPriority(""); setHealth(""); setOwner(""); }}>Clear filters</button>
        </div>
      )}

      {showColumns && (
        <div className="portal-column-menu">
          {[
            ["client", "Client & property"], ["stage", "Stage"], ["owner", "Owner"],
            ["priority", "Priority"], ["health", "Health"], ["next_action", "Next action"],
            ["due", "Due date"], ["work", "Open work"], ["activity", "Last activity"],
          ].map(([key, label]) => (
            <label key={key}><input type="checkbox" checked={visibleColumns.includes(key)} onChange={() => setVisibleColumns((columns) => columns.includes(key) ? columns.filter((column) => column !== key) : [...columns, key])} /><span><Check size={12} /></span>{label}</label>
          ))}
        </div>
      )}

      {error && <div className="portal-inline-error" role="alert"><span>{error}</span><button onClick={() => setError("")}><X size={14} /></button></div>}

      {loading ? (
        <div className="portal-board-loading">{Array.from({ length: 8 }, (_, index) => <span key={index} />)}</div>
      ) : matters.length === 0 ? (
        <div className="portal-card">
          <EmptyState
            icon={LayoutList}
            title="No engagements match this view"
            description={activeFilters || query ? "Clear or adjust the current filters." : "No engagement records are available to your account."}
            action={can("engagements.create") && !activeFilters && !query ? { href: "/portal/matters?new=1", label: "Create engagement" } : undefined}
          />
        </div>
      ) : view === "table" ? (
        <div className="portal-board-table-wrap portal-card">
          <div className="portal-board-table" style={{ "--portal-board-columns": visibleColumns.length } as React.CSSProperties}>
            <div className="portal-board-row portal-board-header">
              <span className="portal-select-cell"><input type="checkbox" aria-label="Select all engagements" checked={selected.size === matters.length && matters.length > 0} onChange={(event) => setSelected(event.target.checked ? new Set(matters.map((matter) => matter.id)) : new Set())} /></span>
              <span className="portal-board-title-cell">Engagement</span>
              {visibleColumns.includes("client") && <span>Client & property</span>}
              {visibleColumns.includes("stage") && <span>Stage</span>}
              {visibleColumns.includes("owner") && <span>Owner</span>}
              {visibleColumns.includes("priority") && <span>Priority</span>}
              {visibleColumns.includes("health") && <span>Health</span>}
              {visibleColumns.includes("next_action") && <span>Next action</span>}
              {visibleColumns.includes("due") && <span>Due</span>}
              {visibleColumns.includes("work") && <span>Open work</span>}
              {visibleColumns.includes("activity") && <span>Last activity</span>}
            </div>
            {matters.map((matter) => (
              <div className="portal-board-row" key={matter.id}>
                <span className="portal-select-cell"><input type="checkbox" aria-label={`Select ${matter.title}`} checked={selected.has(matter.id)} onChange={(event) => setSelected((current) => {
                  const next = new Set(current); if (event.target.checked) next.add(matter.id); else next.delete(matter.id); return next;
                })} /></span>
                <Link className="portal-board-title-cell" href={`/portal/matters/${matter.id}`}><strong>{matter.title}</strong><small>{matter.type.replaceAll("_", " ")}</small></Link>
                {visibleColumns.includes("client") && <span className="portal-board-secondary"><strong>{matter.client_name}</strong><small>{matter.property_address || "No property"}</small></span>}
                {visibleColumns.includes("stage") && <span><StatusBadge status={matter.status} /></span>}
                {visibleColumns.includes("owner") && <span>{matter.owner_name || <em>Unassigned</em>}</span>}
                {visibleColumns.includes("priority") && <span className="portal-inline-select"><select aria-label={`Priority for ${matter.title}`} value={matter.priority} disabled={savingCell === `${matter.id}-priority` || !can("engagements.update")} onChange={(event) => patchMatter(matter, { priority: event.target.value })}>{PRIORITIES.map((item) => <option key={item}>{item}</option>)}</select><PriorityBadge priority={matter.priority} /></span>}
                {visibleColumns.includes("health") && <span className="portal-inline-select"><select aria-label={`Health for ${matter.title}`} value={matter.health} disabled={savingCell === `${matter.id}-health` || !can("engagements.update")} onChange={(event) => patchMatter(matter, { health: event.target.value })}>{HEALTH_OPTIONS.map((item) => <option key={item} value={item}>{item.replace("_", " ")}</option>)}</select><HealthBadge health={matter.health} /></span>}
                {visibleColumns.includes("next_action") && <span className="portal-board-next-action">{matter.next_action || <em>Not set</em>}</span>}
                {visibleColumns.includes("due") && <span className={matter.due_date && new Date(matter.due_date).getTime() < now ? "is-overdue" : undefined}>{formatDate(matter.due_date)}</span>}
                {visibleColumns.includes("work") && <span className="portal-work-counts"><strong>{matter.open_task_count}</strong>{matter.unread_message_count > 0 && <small>{matter.unread_message_count} unread</small>}</span>}
                {visibleColumns.includes("activity") && <span>{formatDate(matter.updated_at)}</span>}
              </div>
            ))}
          </div>
        </div>
      ) : view === "kanban" ? (
        <div className="portal-kanban">
          {groupedByStatus.map((group) => (
            <section key={group.stage}>
              <header><StatusBadge status={group.stage} /><span>{group.matters.length}</span></header>
              <div>{group.matters.length === 0 ? <p>No engagements</p> : group.matters.map((matter) => (
                <Link href={`/portal/matters/${matter.id}`} key={matter.id}>
                  <strong>{matter.title}</strong><span>{matter.client_name}</span>
                  <div><PriorityBadge priority={matter.priority} /><HealthBadge health={matter.health} /></div>
                  <small>{matter.next_action || "No next action set"}</small>
                </Link>
              ))}</div>
            </section>
          ))}
        </div>
      ) : view === "calendar" ? (
        <div className="portal-card portal-calendar-list">
          {matters.filter((matter) => matter.due_date || matter.next_action_due_at).length === 0 ? <EmptyState icon={CalendarDays} title="No engagement dates" description="Due dates and next-action dates will appear here." /> : matters.filter((matter) => matter.due_date || matter.next_action_due_at).sort((a, b) => new Date(a.due_date || a.next_action_due_at!).getTime() - new Date(b.due_date || b.next_action_due_at!).getTime()).map((matter) => (
            <Link href={`/portal/matters/${matter.id}`} key={matter.id}><time>{formatDate(matter.due_date || matter.next_action_due_at)}</time><div><strong>{matter.title}</strong><span>{matter.next_action || matter.client_name}</span></div><StatusBadge status={matter.status} /></Link>
          ))}
        </div>
      ) : (
        <div className="portal-workload-grid">
          {workload.map((group) => (
            <section className="portal-card" key={group.name}>
              <header><span className="portal-avatar">{group.name.slice(0, 1)}</span><div><strong>{group.name}</strong><span>{group.matters.length} engagement{group.matters.length === 1 ? "" : "s"} · {group.matters.reduce((total, matter) => total + Number(matter.open_task_count), 0)} open tasks</span></div></header>
              {group.matters.map((matter) => <Link href={`/portal/matters/${matter.id}`} key={matter.id}><div><strong>{matter.title}</strong><span>{matter.client_name}</span></div><HealthBadge health={matter.health} /><small>{matter.open_task_count}</small></Link>)}
            </section>
          ))}
        </div>
      )}

      {showCreate && <NewEngagementDialog clients={clients} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); void load(); }} />}
      {showSave && (
        <div className="portal-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="save-view-title">
          <button className="portal-command-scrim" onClick={() => setShowSave(false)} aria-label="Close dialog" />
          <section className="portal-dialog portal-save-dialog">
            <header><div><p className="portal-eyebrow">Workspace view</p><h2 id="save-view-title">Save current view</h2></div><button className="portal-icon-button" onClick={() => setShowSave(false)}><X size={17} /></button></header>
            <form onSubmit={saveView}>
              <label className="portal-field"><span>View name</span><input name="name" required autoFocus /></label>
              {(access.role === "super_admin" || access.role === "admin") && <label className="portal-check-field"><input type="checkbox" name="sharing" value="workspace" />Share with the workspace</label>}
              <footer><button type="button" className="portal-secondary-button" onClick={() => setShowSave(false)}>Cancel</button><button className="portal-primary-button">Save view</button></footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
