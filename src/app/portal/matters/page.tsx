"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Columns3,
  Filter,
  GripVertical,
  Layers3,
  LayoutList,
  Plus,
  RefreshCw,
  Rows3,
  Save,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Fragment, useCallback, useEffect, useMemo, useState } from "react";

import { usePortalAccess } from "@/components/portal/access-provider";
import {
  EmptyState,
  HealthBadge,
  MATTER_STATUS_LABELS,
  PageHeader,
  PriorityBadge,
  StatusBadge,
} from "@/components/portal/portal-ui";
import {
  ENGAGEMENT_DENSITIES,
  ENGAGEMENT_GROUP_FIELDS,
  ENGAGEMENT_PAGE_SIZES,
  ENGAGEMENT_SORT_FIELDS,
  type EngagementDensity,
  type EngagementGroupField,
  type EngagementPageSize,
  type EngagementSortField,
  type SortDirection,
  isEngagementDensity,
  parseEngagementBoardQuery,
} from "@/lib/engagement-board";

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
type ColumnKey = "client" | "stage" | "owner" | "priority" | "health" | "next_action" | "due" | "work" | "activity";
type ColumnPreferences = {
  order: ColumnKey[];
  visible: ColumnKey[];
  density: EngagementDensity;
};
type SavedView = {
  id: string;
  name: string;
  view_type: ViewType;
  filters: Record<string, string>;
  sorting: Array<{ field: EngagementSortField; direction: SortDirection }>;
  grouping: { field: EngagementGroupField } | null;
  columns: ColumnKey[] | ColumnPreferences;
  sharing: "private" | "workspace";
};

const STATUSES = Object.keys(MATTER_STATUS_LABELS);
const PRIORITIES = ["low", "normal", "high", "urgent"];
const HEALTH_OPTIONS = ["on_track", "at_risk", "blocked"];
const COLUMN_DEFINITIONS: Array<{ key: ColumnKey; label: string; sort?: EngagementSortField }> = [
  { key: "client", label: "Client & property", sort: "client" },
  { key: "stage", label: "Stage", sort: "status" },
  { key: "owner", label: "Owner", sort: "owner" },
  { key: "priority", label: "Priority", sort: "priority" },
  { key: "health", label: "Health", sort: "health" },
  { key: "next_action", label: "Next action", sort: "next_action_due_at" },
  { key: "due", label: "Due date", sort: "due_date" },
  { key: "work", label: "Open work" },
  { key: "activity", label: "Last activity", sort: "updated_at" },
];
const DEFAULT_COLUMN_ORDER = COLUMN_DEFINITIONS.map(({ key }) => key);
const GROUP_LABELS: Record<EngagementGroupField, string> = {
  none: "No grouping",
  status: "Stage",
  owner: "Owner",
  priority: "Priority",
  health: "Health",
};
const SORT_LABELS: Record<EngagementSortField, string> = {
  updated_at: "Last activity",
  title: "Engagement",
  client: "Client",
  status: "Stage",
  owner: "Owner",
  priority: "Priority",
  health: "Health",
  due_date: "Due date",
  next_action_due_at: "Next action date",
};
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

function isColumnKey(value: unknown): value is ColumnKey {
  return typeof value === "string" && DEFAULT_COLUMN_ORDER.includes(value as ColumnKey);
}

function isViewType(value: unknown): value is ViewType {
  return value === "table" || value === "kanban" || value === "calendar" || value === "workload";
}

function normalizedColumnOrder(value: unknown): ColumnKey[] {
  const supplied = Array.isArray(value) ? value.filter(isColumnKey) : [];
  return [...new Set([...supplied, ...DEFAULT_COLUMN_ORDER])];
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
  const initialBoardQuery = parseEngagementBoardQuery(new URLSearchParams(searchParams.toString()));
  const [matters, setMatters] = useState<Matter[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [priority, setPriority] = useState(searchParams.get("priority") ?? "");
  const [health, setHealth] = useState(searchParams.get("health") ?? "");
  const [owner, setOwner] = useState(searchParams.get("owner_id") ?? "");
  const [view, setView] = useState<ViewType>(isViewType(searchParams.get("view")) ? searchParams.get("view") as ViewType : "table");
  const [sort, setSort] = useState<EngagementSortField>(initialBoardQuery.sort);
  const [direction, setDirection] = useState<SortDirection>(initialBoardQuery.direction);
  const [group, setGroup] = useState<EngagementGroupField>(initialBoardQuery.group);
  const [page, setPage] = useState(initialBoardQuery.page);
  const [pageSize, setPageSize] = useState<EngagementPageSize>(initialBoardQuery.pageSize);
  const [hasMore, setHasMore] = useState(false);
  const [density, setDensity] = useState<EngagementDensity>(
    isEngagementDensity(searchParams.get("density")) ? searchParams.get("density") as EngagementDensity : "comfortable",
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [showCreate, setShowCreate] = useState(searchParams.get("new") === "1");
  const [showSave, setShowSave] = useState(false);
  const [savingCell, setSavingCell] = useState("");
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [now] = useState(() => Date.now());
  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(DEFAULT_COLUMN_ORDER);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_COLUMN_ORDER);

  const updateUrl = useCallback((patch: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("new");
    const queryString = params.toString();
    if (queryString !== searchParams.toString()) {
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    }
  }, [pathname, router, searchParams]);

  const loadSavedViews = useCallback(async () => {
    const response = await fetch("/api/portal/views?module=engagements", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Saved views could not be loaded.");
    setSavedViews(data.views ?? []);
  }, []);

  const loadReferenceData = useCallback(async () => {
    try {
      const [clientResponse, peopleResponse] = await Promise.all([
        can("clients.view") ? fetch("/api/clients", { cache: "no-store" }) : Promise.resolve(null),
        (access.role === "super_admin" || access.role === "admin") ? fetch("/api/portal/people", { cache: "no-store" }) : Promise.resolve(null),
      ]);
      if (clientResponse) {
        const data = await clientResponse.json();
        if (!clientResponse.ok) throw new Error(data.error ?? "Clients could not be loaded.");
        setClients(data.clients ?? []);
      }
      if (peopleResponse) {
        const data = await peopleResponse.json();
        if (!peopleResponse.ok) throw new Error(data.error ?? "People could not be loaded.");
        setPeople(data.people ?? []);
      }
    } catch (referenceError) {
      setError(referenceError instanceof Error ? referenceError.message : "Board reference data could not be loaded.");
    }
  }, [access.role, can]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    if (health) params.set("health", health);
    if (owner) params.set("owner_id", owner);
    params.set("sort", sort);
    params.set("direction", direction);
    params.set("group", group);
    params.set("page", String(page));
    params.set("page_size", String(pageSize));
    try {
      const response = await fetch(`/api/matters?${params.toString()}`, { cache: "no-store" });
      const matterData = await response.json();
      if (!response.ok) throw new Error(matterData.error ?? "Engagements could not be loaded.");
      setMatters(matterData.matters ?? []);
      setHasMore(Boolean(matterData.page?.hasMore));
      setSelected(new Set());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Engagements could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [direction, group, health, owner, page, pageSize, priority, query, sort, status]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadReferenceData();
      void loadSavedViews().catch((viewError) => {
        setError(viewError instanceof Error ? viewError.message : "Saved views could not be loaded.");
      });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadReferenceData, loadSavedViews]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      updateUrl({
        q: query,
        status,
        priority,
        health,
        owner_id: owner,
        view,
        sort,
        direction,
        group,
        density,
        page: String(page),
        page_size: String(pageSize),
      });
      void load();
    }, query ? 220 : 0);
    return () => window.clearTimeout(timeout);
  }, [density, direction, group, health, load, owner, page, pageSize, priority, query, sort, status, updateUrl, view]);

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
        sorting: [{ field: sort, direction }],
        grouping: group === "none" ? null : { field: group },
        columns: { order: columnOrder, visible: visibleColumns, density },
        sharing: form.get("sharing") === "workspace" ? "workspace" : "private",
      }),
    });
    if (response.ok) {
      setShowSave(false);
      try {
        await loadSavedViews();
      } catch (viewError) {
        setError(viewError instanceof Error ? viewError.message : "Saved views could not be refreshed.");
      }
    } else {
      const data = await response.json();
      setError(data.error ?? "The view could not be saved.");
    }
  }

  function applySavedView(saved: SavedView) {
    setActiveViewId(saved.id);
    const filters = saved.filters ?? {};
    setQuery(filters.q ?? "");
    setStatus(filters.status ?? "");
    setPriority(filters.priority ?? "");
    setHealth(filters.health ?? "");
    setOwner(filters.owner_id ?? "");
    setView(saved.view_type);
    const savedSort = saved.sorting?.[0];
    if (savedSort && ENGAGEMENT_SORT_FIELDS.includes(savedSort.field)) {
      setSort(savedSort.field);
      setDirection(savedSort.direction === "asc" ? "asc" : "desc");
    }
    const savedGroup = saved.grouping?.field;
    setGroup(savedGroup && ENGAGEMENT_GROUP_FIELDS.includes(savedGroup) ? savedGroup : "none");
    if (Array.isArray(saved.columns)) {
      const legacyColumns = saved.columns.filter(isColumnKey);
      if (legacyColumns.length > 0) {
        setColumnOrder(normalizedColumnOrder(legacyColumns));
        setVisibleColumns(legacyColumns);
      }
    } else if (saved.columns) {
      const nextOrder = normalizedColumnOrder(Array.isArray(saved.columns.order) ? saved.columns.order : []);
      const nextVisible = Array.isArray(saved.columns.visible) ? saved.columns.visible.filter(isColumnKey) : [];
      setColumnOrder(nextOrder);
      setVisibleColumns(nextVisible.length > 0 ? nextVisible : DEFAULT_COLUMN_ORDER);
      setDensity(isEngagementDensity(saved.columns.density) ? saved.columns.density : "comfortable");
    }
    setPage(1);
  }

  function resetBoard() {
    setActiveViewId(null);
    setQuery("");
    setStatus("");
    setPriority("");
    setHealth("");
    setOwner("");
    setSort("updated_at");
    setDirection("desc");
    setGroup("none");
    setPage(1);
    setPageSize(25);
    setDensity("comfortable");
    setView("table");
    setColumnOrder(DEFAULT_COLUMN_ORDER);
    setVisibleColumns(DEFAULT_COLUMN_ORDER);
  }

  function chooseSort(field: EngagementSortField) {
    if (sort === field) setDirection((value) => value === "asc" ? "desc" : "asc");
    else {
      setSort(field);
      setDirection(field === "updated_at" || field === "due_date" || field === "next_action_due_at" ? "desc" : "asc");
    }
    setPage(1);
  }

  function moveColumn(column: ColumnKey, target: ColumnKey) {
    if (column === target) return;
    setColumnOrder((current) => {
      const next = current.filter((item) => item !== column);
      next.splice(next.indexOf(target), 0, column);
      return next;
    });
  }

  function shiftColumn(column: ColumnKey, offset: -1 | 1) {
    setColumnOrder((current) => {
      const index = current.indexOf(column);
      const target = index + offset;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const activeFilters = [status, priority, health, owner].filter(Boolean).length;
  const orderedVisibleColumns = columnOrder.filter((column) => visibleColumns.includes(column));
  const groupedByStatus = useMemo(
    () => STATUSES.map((stage) => ({ stage, matters: matters.filter((matter) => matter.status === stage) })),
    [matters],
  );
  const tableGroups = useMemo(() => {
    if (group === "none") return [{ key: "all", label: "", matters }];
    const groups = new Map<string, Matter[]>();
    for (const matter of matters) {
      const key = group === "status" ? matter.status
        : group === "owner" ? matter.owner_user_id ?? "unassigned"
        : group === "priority" ? matter.priority
        : matter.health;
      groups.set(key, [...(groups.get(key) ?? []), matter]);
    }
    const order = group === "status" ? STATUSES
      : group === "priority" ? PRIORITIES
      : group === "health" ? HEALTH_OPTIONS
      : [...groups.keys()].sort((left, right) => {
        if (left === "unassigned") return 1;
        if (right === "unassigned") return -1;
        const leftName = groups.get(left)?.[0]?.owner_name ?? "";
        const rightName = groups.get(right)?.[0]?.owner_name ?? "";
        return leftName.localeCompare(rightName);
      });
    return order.filter((key) => groups.has(key)).map((key) => ({
      key,
      label: group === "status" ? MATTER_STATUS_LABELS[key] ?? key
        : group === "owner" ? groups.get(key)?.[0]?.owner_name ?? "Unassigned"
        : key.replaceAll("_", " "),
      matters: groups.get(key) ?? [],
    }));
  }, [group, matters]);
  const kanbanGroups = useMemo(() => {
    if (group === "none" || group === "status") {
      return groupedByStatus.map((statusGroup) => ({
        key: statusGroup.stage,
        label: MATTER_STATUS_LABELS[statusGroup.stage] ?? statusGroup.stage,
        status: statusGroup.stage,
        matters: statusGroup.matters,
      }));
    }
    return tableGroups.map((tableGroup) => ({ ...tableGroup, status: null }));
  }, [group, groupedByStatus, tableGroups]);
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

  function renderSortIcon(field: EngagementSortField) {
    if (sort !== field) return <ArrowUpDown size={12} />;
    return direction === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  }

  function renderMatterCell(column: ColumnKey, matter: Matter) {
    switch (column) {
      case "client":
        return <span key={column} className="portal-board-secondary"><strong>{matter.client_name}</strong><small>{matter.property_address || "No property"}</small></span>;
      case "stage":
        return <span key={column}><StatusBadge status={matter.status} /></span>;
      case "owner":
        return <span key={column}>{matter.owner_name || <em>Unassigned</em>}</span>;
      case "priority":
        return <span key={column} className="portal-inline-select"><select aria-label={`Priority for ${matter.title}`} value={matter.priority} disabled={savingCell === `${matter.id}-priority` || !can("engagements.update")} onChange={(event) => patchMatter(matter, { priority: event.target.value })}>{PRIORITIES.map((item) => <option key={item}>{item}</option>)}</select><PriorityBadge priority={matter.priority} /></span>;
      case "health":
        return <span key={column} className="portal-inline-select"><select aria-label={`Health for ${matter.title}`} value={matter.health} disabled={savingCell === `${matter.id}-health` || !can("engagements.update")} onChange={(event) => patchMatter(matter, { health: event.target.value })}>{HEALTH_OPTIONS.map((item) => <option key={item} value={item}>{item.replace("_", " ")}</option>)}</select><HealthBadge health={matter.health} /></span>;
      case "next_action":
        return <span key={column} className="portal-board-next-action">{matter.next_action || <em>Not set</em>}</span>;
      case "due":
        return <span key={column} className={matter.due_date && new Date(matter.due_date).getTime() < now ? "is-overdue" : undefined}>{formatDate(matter.due_date)}</span>;
      case "work":
        return <span key={column} className="portal-work-counts"><strong>{matter.open_task_count}</strong>{matter.unread_message_count > 0 && <small>{matter.unread_message_count} unread</small>}</span>;
      case "activity":
        return <span key={column}>{formatDate(matter.updated_at)}</span>;
    }
  }

  return (
    <div className="portal-page portal-board-page">
      <PageHeader
        eyebrow={access.role === "client" ? "Engagement file" : access.role === "contractor" ? "Assigned portfolio" : "Operating board"}
        title="Engagements"
        description={matters.length > 0
          ? `Showing ${((page - 1) * pageSize) + 1}–${((page - 1) * pageSize) + matters.length} · ${access.role === "client" ? "Your active advisory records" : access.role === "contractor" ? "Work permitted for your assignments" : "Ownership, urgency and next actions"}`
          : access.role === "client" ? "Your active advisory records" : access.role === "contractor" ? "Work permitted for your assignments" : "Ownership, urgency and next actions"}
        actions={
          <>
            <button className="portal-secondary-button" onClick={load}><RefreshCw size={14} />Refresh</button>
            {can("engagements.create") && <button className="portal-primary-button" onClick={() => setShowCreate(true)}><Plus size={15} />New engagement</button>}
          </>
        }
      />

      <div className="portal-view-strip">
        <div className="portal-saved-views">
          <button className={!activeViewId ? "is-active" : undefined} onClick={resetBoard}>All engagements</button>
          {savedViews.map((saved) => <button className={activeViewId === saved.id ? "is-active" : undefined} key={saved.id} onClick={() => applySavedView(saved)}>{saved.name}{saved.sharing === "workspace" && <Users size={11} />}</button>)}
          <button className="portal-save-view-button" onClick={() => setShowSave(true)}><Save size={12} />Save view</button>
        </div>
        <div className="portal-view-switcher" aria-label="View type">
          {VIEW_OPTIONS.map((option) => {
            const Icon = option.icon;
            return <button key={option.value} className={view === option.value ? "is-active" : undefined} onClick={() => { setView(option.value); setPage(1); }}><Icon size={14} /><span>{option.label}</span></button>;
          })}
        </div>
      </div>

      <div className="portal-board-toolbar">
        <label className="portal-board-search"><Search size={15} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search engagements, clients or properties" /></label>
        <button className={activeFilters ? "portal-toolbar-button is-active" : "portal-toolbar-button"} onClick={() => setShowFilters((value) => !value)}><Filter size={14} />Filter{activeFilters > 0 && <span>{activeFilters}</span>}<ChevronDown size={13} /></button>
        {(view === "table" || view === "kanban") && <><label className="portal-toolbar-select"><ArrowUpDown size={14} /><span>Sort</span><select aria-label="Sort engagements" value={sort} onChange={(event) => { setSort(event.target.value as EngagementSortField); setPage(1); }}>{ENGAGEMENT_SORT_FIELDS.map((field) => <option value={field} key={field}>{SORT_LABELS[field]}</option>)}</select></label>
        <button className="portal-toolbar-button portal-direction-button" aria-label={`Sort ${direction === "asc" ? "descending" : "ascending"}`} title={`Sort ${direction === "asc" ? "descending" : "ascending"}`} onClick={() => { setDirection((value) => value === "asc" ? "desc" : "asc"); setPage(1); }}>{direction === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}</button>
        <label className="portal-toolbar-select"><Layers3 size={14} /><span>Group</span><select aria-label="Group engagements" value={group} onChange={(event) => { setGroup(event.target.value as EngagementGroupField); setPage(1); }}>{ENGAGEMENT_GROUP_FIELDS.map((field) => <option value={field} key={field}>{GROUP_LABELS[field]}</option>)}</select></label></>}
        {view === "table" && <label className="portal-toolbar-select"><Rows3 size={14} /><span>Density</span><select aria-label="Table density" value={density} onChange={(event) => setDensity(event.target.value as EngagementDensity)}>{ENGAGEMENT_DENSITIES.map((value) => <option key={value} value={value}>{value === "comfortable" ? "Comfortable" : "Compact"}</option>)}</select></label>}
        {view === "table" && <div className="portal-columns-control">
          <button className="portal-toolbar-button" onClick={() => setShowColumns((value) => !value)}><SlidersHorizontal size={14} />Columns</button>
          {showColumns && (
            <div className="portal-column-menu">
              <header><strong>Columns</strong><span>Drag or use arrows to reorder</span></header>
              {columnOrder.map((key, index) => {
                const definition = COLUMN_DEFINITIONS.find((column) => column.key === key)!;
                return (
                  <div
                    className={draggedColumn === key ? "portal-column-menu-row is-dragging" : "portal-column-menu-row"}
                    draggable
                    key={key}
                    onDragStart={() => setDraggedColumn(key)}
                    onDragEnd={() => setDraggedColumn(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => { if (draggedColumn) moveColumn(draggedColumn, key); setDraggedColumn(null); }}
                  >
                    <GripVertical size={14} aria-hidden="true" />
                    <label><input type="checkbox" checked={visibleColumns.includes(key)} onChange={() => setVisibleColumns((columns) => columns.includes(key) ? columns.filter((column) => column !== key) : [...columns, key])} /><span><Check size={12} /></span>{definition.label}</label>
                    <div className="portal-column-order-actions">
                      <button aria-label={`Move ${definition.label} left`} disabled={index === 0} onClick={() => shiftColumn(key, -1)}><ChevronLeft size={13} /></button>
                      <button aria-label={`Move ${definition.label} right`} disabled={index === columnOrder.length - 1} onClick={() => shiftColumn(key, 1)}><ChevronRight size={13} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>}
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
          <label><span>Stage</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All stages</option>{STATUSES.map((item) => <option key={item} value={item}>{MATTER_STATUS_LABELS[item]}</option>)}</select></label>
          <label><span>Priority</span><select value={priority} onChange={(event) => { setPriority(event.target.value); setPage(1); }}><option value="">All priorities</option>{PRIORITIES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Health</span><select value={health} onChange={(event) => { setHealth(event.target.value); setPage(1); }}><option value="">All health states</option>{HEALTH_OPTIONS.map((item) => <option key={item} value={item}>{item.replace("_", " ")}</option>)}</select></label>
          <label><span>Owner</span><select value={owner} onChange={(event) => { setOwner(event.target.value); setPage(1); }}><option value="">All owners</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
          <button onClick={() => { setStatus(""); setPriority(""); setHealth(""); setOwner(""); setPage(1); }}>Clear filters</button>
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
        <div className={`portal-board-table-wrap portal-card is-${density}`}>
          <div className="portal-board-table" style={{ minWidth: `${258 + (orderedVisibleColumns.length * 132)}px` }}>
            <div className="portal-board-row portal-board-header">
              <span className="portal-select-cell"><input type="checkbox" aria-label="Select all engagements" checked={selected.size === matters.length && matters.length > 0} onChange={(event) => setSelected(event.target.checked ? new Set(matters.map((matter) => matter.id)) : new Set())} /></span>
              <span className="portal-board-title-cell"><button onClick={() => chooseSort("title")}>Engagement{renderSortIcon("title")}</button></span>
              {orderedVisibleColumns.map((column) => {
                const definition = COLUMN_DEFINITIONS.find((item) => item.key === column)!;
                return <span key={column}>{definition.sort ? <button onClick={() => chooseSort(definition.sort!)}>{definition.label}{renderSortIcon(definition.sort)}</button> : definition.label}</span>;
              })}
            </div>
            {tableGroups.map((tableGroup) => (
              <Fragment key={tableGroup.key}>
                {group !== "none" && <div className="portal-board-group-row"><span><Layers3 size={13} /><strong>{tableGroup.label}</strong><small>{tableGroup.matters.length}</small></span></div>}
                {tableGroup.matters.map((matter) => (
                  <div className="portal-board-row" key={matter.id}>
                    <span className="portal-select-cell"><input type="checkbox" aria-label={`Select ${matter.title}`} checked={selected.has(matter.id)} onChange={(event) => setSelected((current) => {
                      const next = new Set(current); if (event.target.checked) next.add(matter.id); else next.delete(matter.id); return next;
                    })} /></span>
                    <Link className="portal-board-title-cell" href={`/portal/matters/${matter.id}`}><strong>{matter.title}</strong><small>{matter.type.replaceAll("_", " ")}</small></Link>
                    {orderedVisibleColumns.map((column) => renderMatterCell(column, matter))}
                  </div>
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      ) : view === "kanban" ? (
        <div className="portal-kanban">
          {kanbanGroups.map((kanbanGroup) => (
            <section key={kanbanGroup.key}>
              <header>{kanbanGroup.status ? <StatusBadge status={kanbanGroup.status} /> : <strong>{kanbanGroup.label}</strong>}<span>{kanbanGroup.matters.length}</span></header>
              <div>{kanbanGroup.matters.length === 0 ? <p>No engagements</p> : kanbanGroup.matters.map((matter) => (
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

      {!loading && (matters.length > 0 || page > 1) && (
        <nav className="portal-board-pagination" aria-label="Engagement pages">
          <span>{matters.length > 0 ? `${((page - 1) * pageSize) + 1}–${((page - 1) * pageSize) + matters.length}` : "No records on this page"}</span>
          <label>Rows<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value) as EngagementPageSize); setPage(1); }}>{ENGAGEMENT_PAGE_SIZES.map((size) => <option value={size} key={size}>{size}</option>)}</select></label>
          <button aria-label="Previous page" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={15} />Previous</button>
          <strong>Page {page}</strong>
          <button aria-label="Next page" disabled={!hasMore} onClick={() => setPage((value) => value + 1)}>Next<ChevronRight size={15} /></button>
        </nav>
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
