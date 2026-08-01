"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Download,
  FileText,
  FolderOpen,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
  title: string;
  type: string;
  status: string;
  notes?: string | null;
  client_name: string;
  client_email?: string | null;
  client_phone?: string | null;
  property_address?: string | null;
  property_city?: string | null;
  property_state?: string | null;
  owner_user_id?: string | null;
  owner_name?: string | null;
  priority: string;
  health: string;
  start_date?: string | null;
  due_date?: string | null;
  next_action?: string | null;
  next_action_due_at?: string | null;
  version: number;
  updated_at: string;
};

type WorkflowItem = {
  id: string;
  stage_key: string;
  title: string;
  item_type: "requirement" | "deliverable" | "approval";
  is_required: boolean;
  status: "pending" | "in_progress" | "completed" | "blocked" | "waived";
  assignee_name?: string | null;
  due_date?: string | null;
  blocker_reason?: string | null;
  evidence_document_name?: string | null;
};

type Task = {
  id: string;
  matter_id: string;
  stage_key?: string | null;
  title: string;
  description?: string | null;
  status: "open" | "in_progress" | "completed" | "cancelled";
  priority: string;
  assignee_user_id?: string | null;
  assignee_name?: string | null;
  due_date?: string | null;
  audience: "internal" | "contractor" | "client";
};

type Message = {
  id: string;
  sender_name: string;
  sender_role: string;
  sender_id: string;
  body: string;
  audience: "internal" | "contractor" | "client";
  subject?: string | null;
  thread_id?: string | null;
  parent_message_id?: string | null;
  created_at: string;
  attachments?: Attachment[];
};

type Attachment = {
  id: string;
  name: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
};

type Document = {
  id: string;
  name: string;
  original_name: string;
  category: string;
  size_bytes: number;
  content_type: string;
  visibility?: string;
  publication_status?: string;
  created_at: string;
};

type Event = {
  id: string;
  event_type: string;
  content?: string | null;
  visibility: string;
  created_at: string;
};

type FinanceRecord = {
  id: string;
  status: string;
  invoice_number?: string;
  contract_number?: string;
  change_order_number?: string;
  title?: string;
  total_cents?: string | number;
  original_amount_cents?: string | number;
  amount_cents?: string | number;
  due_date?: string | null;
};

type Person = { id: string; name: string; role: string };
type Tab = "overview" | "work" | "updates" | "files" | "finance" | "activity";

const STAGES = Object.keys(MATTER_STATUS_LABELS);
const TABS: Array<{ value: Tab; label: string; icon: typeof Activity }> = [
  { value: "overview", label: "Overview", icon: ClipboardList },
  { value: "work", label: "Work", icon: CheckCircle2 },
  { value: "updates", label: "Updates", icon: MessageSquare },
  { value: "files", label: "Files", icon: FolderOpen },
  { value: "finance", label: "Finance", icon: CircleDollarSign },
  { value: "activity", label: "Activity", icon: Activity },
];

function formatDate(value?: string | null, includeTime = false): string {
  if (!value) return "Not set";
  return new Date(value).toLocaleString("en-US", includeTime
    ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" });
}

function money(value?: string | number): string {
  return (Number(value ?? 0) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function EngagementWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, access, can } = usePortalAccess();
  const requestedSection = searchParams.get("section");
  const [tab, setTab] = useState<Tab>(
    requestedSection === "messages" ? "updates"
      : requestedSection === "documents" ? "files"
      : requestedSection === "workflow" ? (access.role === "client" ? "overview" : "work")
      : TABS.some((item) => item.value === requestedSection)
        ? (requestedSection === "work" && access.role === "client" ? "overview" : requestedSection as Tab)
        : "overview",
  );
  const [matter, setMatter] = useState<Matter | null>(null);
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [invoices, setInvoices] = useState<FinanceRecord[]>([]);
  const [contracts, setContracts] = useState<FinanceRecord[]>([]);
  const [changeOrders, setChangeOrders] = useState<FinanceRecord[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const [messageAttachmentCount, setMessageAttachmentCount] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [showTask, setShowTask] = useState(false);
  const [showRequirement, setShowRequirement] = useState(false);
  const [workflowReason, setWorkflowReason] = useState<{
    item: WorkflowItem;
    status: "blocked" | "waived";
  } | null>(null);
  const [transition, setTransition] = useState<{ status: string; blockers: WorkflowItem[]; overrideAvailable: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const responses = await Promise.all([
        fetch(`/api/matters/${id}`, { cache: "no-store" }),
        fetch(`/api/matters/${id}/workflow`, { cache: "no-store" }),
        can("messages.view") ? fetch(`/api/matters/${id}/messages`, { cache: "no-store" }) : Promise.resolve(null),
        can("finance.view") ? fetch(`/api/invoices?matter_id=${id}`, { cache: "no-store" }) : Promise.resolve(null),
        can("contracts.view") ? fetch(`/api/contracts?matter_id=${id}`, { cache: "no-store" }) : Promise.resolve(null),
        can("contracts.view") ? fetch(`/api/change-orders?matter_id=${id}`, { cache: "no-store" }) : Promise.resolve(null),
        (access.role === "super_admin" || access.role === "admin") ? fetch("/api/portal/people", { cache: "no-store" }) : Promise.resolve(null),
      ]);
      const detail = await responses[0].json();
      if (responses[0].status === 404) {
        router.replace("/portal/matters");
        return;
      }
      if (!responses[0].ok) throw new Error(detail.error ?? "The engagement could not be loaded.");
      setMatter(detail.matter);
      setDocuments(detail.documents ?? []);
      setEvents(detail.events ?? []);
      if (responses[1].ok) {
        const workflow = await responses[1].json();
        setItems(workflow.items ?? []);
        setTasks(workflow.tasks ?? []);
      }
      if (responses[2]?.ok) setMessages((await responses[2].json()).messages ?? []);
      if (responses[3]?.ok) setInvoices((await responses[3].json()).invoices ?? []);
      if (responses[4]?.ok) setContracts((await responses[4].json()).contracts ?? []);
      if (responses[5]?.ok) setChangeOrders((await responses[5].json()).changeOrders ?? []);
      if (responses[6]?.ok) setPeople((await responses[6].json()).people ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The engagement could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [access.role, can, id, router]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const workflowByStage = useMemo(() => STAGES.map((stage) => ({
    stage,
    items: items.filter((item) => item.stage_key === stage),
    tasks: tasks.filter((task) => task.stage_key === stage),
  })), [items, tasks]);

  async function patchMatter(patch: Record<string, unknown>, overrideReason?: string) {
    if (!matter) return false;
    setSaving("matter");
    setError("");
    const response = await fetch(`/api/matters/${matter.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch, version: matter.version, overrideReason }),
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 409 && data.blockers) {
        setTransition({
          status: String(patch.status),
          blockers: data.blockers,
          overrideAvailable: Boolean(data.overrideAvailable),
        });
      } else setError(data.error ?? "The engagement could not be updated.");
      setSaving("");
      return false;
    }
    setMatter((current) => current ? { ...current, ...data.matter } : current);
    setTransition(null);
    setSaving("");
    return true;
  }

  async function updateWorkflow(item: WorkflowItem, status: WorkflowItem["status"], blockerReason?: string, overrideReason?: string) {
    setSaving(item.id);
    const response = await fetch(`/api/matters/${id}/workflow`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id, status, blockerReason, overrideReason }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "The workflow item could not be updated.");
    else setItems((rows) => rows.map((row) => row.id === item.id ? { ...row, ...data.item } : row));
    setSaving("");
  }

  async function updateTask(task: Task, status: Task["status"]) {
    setSaving(task.id);
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "The task could not be updated.");
    else setTasks((rows) => rows.map((row) => row.id === task.id ? { ...row, ...data.task } : row));
    setSaving("");
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving("task");
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matterId: id,
        title: form.get("title"),
        description: form.get("description") || null,
        stageKey: form.get("stageKey") || matter?.status,
        priority: form.get("priority"),
        assigneeUserId: form.get("assigneeUserId") || null,
        dueDate: form.get("dueDate") || null,
        audience: form.get("audience"),
      }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "The task could not be created.");
    else {
      setTasks((rows) => [...rows, data.task]);
      setShowTask(false);
    }
    setSaving("");
  }

  async function createRequirement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving("requirement");
    const response = await fetch(`/api/matters/${id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stageKey: form.get("stageKey"),
        title: form.get("title"),
        itemType: form.get("itemType"),
        isRequired: form.get("isRequired") === "on",
        assigneeUserId: form.get("assigneeUserId") || null,
        dueDate: form.get("dueDate") || null,
      }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "The workflow item could not be created.");
    else {
      setItems((rows) => [...rows, data.item]);
      setShowRequirement(false);
    }
    setSaving("");
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSaving("message");
    const response = await fetch(`/api/matters/${id}/messages`, {
      method: "POST",
      body: data,
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "The update could not be sent.");
    else {
      form.reset();
      setMessageAttachmentCount(0);
      setMessages((rows) => [...rows, result.message]);
    }
    setSaving("");
  }

  async function download(document: Document) {
    setSaving(document.id);
    try {
      const response = await fetch(`/api/vault/documents/${document.id}`);
      if (!response.ok) throw new Error("Document download failed.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = document.original_name || document.name;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Document download failed.");
    } finally {
      setSaving("");
    }
  }

  async function downloadAttachment(attachment: Attachment) {
    setSaving(attachment.id);
    setError("");
    try {
      const response = await fetch(`/api/messages/attachments/${attachment.id}`);
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error ?? "Attachment download failed.");
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = attachment.original_name || attachment.name;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Attachment download failed.");
    } finally {
      setSaving("");
    }
  }

  if (loading) {
    return <div className="portal-page"><div className="portal-skeleton-grid">{Array.from({ length: 8 }, (_, index) => <span key={index} />)}</div></div>;
  }
  if (!matter) {
    return <div className="portal-page"><div className="portal-error-state"><AlertTriangle size={20} /><div><strong>Engagement unavailable</strong><p>{error || "The record could not be found."}</p></div></div></div>;
  }

  const outstanding = invoices.filter((invoice) => ["issued", "processing", "overdue"].includes(invoice.status)).reduce((sum, invoice) => sum + Number(invoice.total_cents ?? 0), 0);
  const openTasks = tasks.filter((task) => !["completed", "cancelled"].includes(task.status));
  const currentStageItems = items.filter((item) => item.stage_key === matter.status && item.is_required);
  const currentStageComplete = currentStageItems.length > 0
    && currentStageItems.every((item) => ["completed", "waived"].includes(item.status));

  return (
    <div className="portal-page portal-engagement-page">
      <Link className="portal-back-link" href="/portal/matters"><ArrowLeft size={13} />Engagements</Link>
      <PageHeader
        eyebrow={`${matter.type.replaceAll("_", " ")} · ${matter.client_name}`}
        title={matter.title}
        description={matter.property_address ? `${matter.property_address}, ${matter.property_city}, ${matter.property_state}` : "No property attached"}
        actions={
          <>
            <button className="portal-secondary-button" onClick={load}><RefreshCw size={14} />Refresh</button>
            {can("engagements.update") && <button className="portal-secondary-button" onClick={() => setShowDetails(true)}><Settings2 size={14} />Edit details</button>}
            <button className="portal-icon-button portal-more-button" aria-label="More engagement actions"><MoreHorizontal size={17} /></button>
          </>
        }
      />

      <section className="portal-engagement-controlbar">
        <div><span>Stage</span>{can("engagements.update") ? <select value={matter.status} disabled={saving === "matter"} onChange={(event) => patchMatter({ status: event.target.value })}>{STAGES.map((stage) => <option key={stage} value={stage}>{MATTER_STATUS_LABELS[stage]}</option>)}</select> : <StatusBadge status={matter.status} />}</div>
        <div><span>Owner</span><strong>{matter.owner_name || "Unassigned"}</strong></div>
        <div><span>Priority</span><PriorityBadge priority={matter.priority} /></div>
        <div><span>Health</span><HealthBadge health={matter.health} /></div>
        <div className="portal-control-next"><span>Next action</span><strong>{matter.next_action || "Not set"}</strong><small>{formatDate(matter.next_action_due_at)}</small></div>
        <div><span>Due</span><strong>{formatDate(matter.due_date)}</strong></div>
      </section>

      {access.role !== "client" && <section className="portal-stage-rail" aria-label="Engagement stages">
        {workflowByStage.map((stage, index) => {
          const currentIndex = STAGES.indexOf(matter.status);
          const required = stage.items.filter((item) => item.is_required);
          const completed = required.filter((item) => ["completed", "waived"].includes(item.status)).length;
          return (
            <button key={stage.stage} onClick={() => { setTab("work"); document.getElementById(`stage-${stage.stage}`)?.scrollIntoView({ behavior: "smooth" }); }} className={stage.stage === matter.status ? "is-current" : index < currentIndex ? "is-past" : undefined}>
              <span>{index + 1}</span>
              <div><strong>{MATTER_STATUS_LABELS[stage.stage]}</strong><small>{required.length ? `${completed}/${required.length} required` : index < currentIndex ? "Past stage" : "No requirements"}</small></div>
            </button>
          );
        })}
      </section>}

      <nav className="portal-engagement-tabs" aria-label="Engagement sections">
        {TABS.filter((item) =>
          item.value !== "work" || (access.role !== "client" && can("timeline.view"))
        ).filter((item) =>
          item.value !== "updates" || can("messages.view")
        ).filter((item) =>
          item.value !== "finance" || can("finance.view")
        ).filter((item) =>
          item.value !== "files" || can("documents.view")
        ).map((item) => {
          const Icon = item.icon;
          const count = item.value === "work" ? openTasks.length
            : item.value === "updates" ? messages.filter((message) => message.sender_id !== user.id).length
            : item.value === "files" ? documents.length : null;
          return <button key={item.value} className={tab === item.value ? "is-active" : undefined} onClick={() => setTab(item.value)}><Icon size={14} />{item.label}{count !== null && count > 0 && <span>{count}</span>}</button>;
        })}
      </nav>

      {error && <div className="portal-inline-error" role="alert"><span>{error}</span><button onClick={() => setError("")}><X size={14} /></button></div>}

      {tab === "overview" && (
        <div className="portal-engagement-overview">
          <div>
            <section className="portal-card portal-record-panel">
              <header><div><p className="portal-eyebrow">Current mandate</p><h2>Operating summary</h2></div></header>
              <dl>
                <div><dt>Next action</dt><dd>{matter.next_action || "No next action has been recorded."}</dd></div>
                <div><dt>Next action due</dt><dd>{formatDate(matter.next_action_due_at)}</dd></div>
                <div><dt>Open tasks</dt><dd>{openTasks.length}</dd></div>
                <div><dt>Current-stage requirements</dt><dd>{currentStageItems.length === 0 ? "No requirements configured" : currentStageComplete ? "All resolved" : `${currentStageItems.filter((item) => !["completed", "waived"].includes(item.status)).length} unresolved`}</dd></div>
                <div><dt>Outstanding balance</dt><dd>{can("finance.view") ? money(outstanding) : "Restricted"}</dd></div>
                <div><dt>Last updated</dt><dd>{formatDate(matter.updated_at, true)}</dd></div>
              </dl>
            </section>
            <section className="portal-card portal-record-panel">
              <header><div><p className="portal-eyebrow">Internal record</p><h2>Engagement context</h2></div></header>
              {matter.notes ? <p className="portal-record-copy">{matter.notes}</p> : <EmptyState icon={ClipboardList} title="No context recorded" description="Internal engagement context can be added through Edit details." />}
            </section>
          </div>
          <aside>
            <section className="portal-card portal-record-panel">
              <header><div><p className="portal-eyebrow">Principal</p><h2>Client</h2></div></header>
              <dl className="portal-contact-list">
                <div><dt>Name</dt><dd>{matter.client_name}</dd></div>
                {matter.client_email && <div><dt>Email</dt><dd><a href={`mailto:${matter.client_email}`}>{matter.client_email}</a></dd></div>}
                {matter.client_phone && <div><dt>Phone</dt><dd>{matter.client_phone}</dd></div>}
              </dl>
            </section>
            <section className="portal-card portal-record-panel">
              <header><div><p className="portal-eyebrow">Schedule</p><h2>Dates</h2></div></header>
              <dl className="portal-contact-list">
                <div><dt>Start date</dt><dd>{formatDate(matter.start_date)}</dd></div>
                <div><dt>Target date</dt><dd>{formatDate(matter.due_date)}</dd></div>
              </dl>
            </section>
          </aside>
        </div>
      )}

      {tab === "work" && (
        <div className="portal-workspace-work">
          <header className="portal-section-actions">
            <div><p className="portal-eyebrow">Truthful workflow</p><h2>Requirements and assigned work</h2><span>Stage completion is based only on persisted requirements below.</span></div>
            {can("timeline.manage") && <div><button className="portal-secondary-button" onClick={() => setShowRequirement(true)}><Plus size={14} />Requirement</button><button className="portal-primary-button" onClick={() => setShowTask(true)}><Plus size={14} />Task</button></div>}
          </header>
          <div className="portal-workflow-stages">
            {workflowByStage.map((stage) => {
              const required = stage.items.filter((item) => item.is_required);
              const completed = required.filter((item) => ["completed", "waived"].includes(item.status)).length;
              return (
                <section className="portal-card portal-workflow-stage" id={`stage-${stage.stage}`} key={stage.stage}>
                  <header>
                    <div><StatusBadge status={stage.stage} /><span>{stage.stage === matter.status ? "Current stage" : ""}</span></div>
                    <strong>{required.length ? `${completed} of ${required.length} required resolved` : "No requirements configured"}</strong>
                  </header>
                  {stage.items.length === 0 && stage.tasks.length === 0 ? (
                    <div className="portal-stage-empty">No persisted requirements or tasks for this stage.</div>
                  ) : (
                    <>
                      {stage.items.map((item) => (
                        <div className={`portal-workflow-row portal-workflow-${item.status}`} key={item.id}>
                          <button
                            disabled={!can("timeline.manage") || saving === item.id}
                            onClick={() => updateWorkflow(item, item.status === "completed" ? "pending" : "completed")}
                            aria-label={`${item.status === "completed" ? "Reopen" : "Complete"} ${item.title}`}
                          >{item.status === "completed" && <Check size={12} />}</button>
                          <div><strong>{item.title}</strong><span>{item.item_type}{item.is_required ? " · required" : " · optional"}{item.assignee_name ? ` · ${item.assignee_name}` : ""}</span>{item.blocker_reason && <small><ShieldAlert size={11} />{item.blocker_reason}</small>}</div>
                          <span className={`portal-workflow-state portal-workflow-state-${item.status}`}>{item.status.replace("_", " ")}</span>
                          <time>{formatDate(item.due_date)}</time>
                          {can("timeline.manage") && item.status !== "completed" && <select value="" onChange={(event) => {
                            const value = event.target.value as WorkflowItem["status"];
                            if (value === "blocked" || value === "waived") {
                              setWorkflowReason({ item, status: value });
                            } else if (value) void updateWorkflow(item, value);
                          }}><option value="">Change…</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option>{access.role === "super_admin" && <option value="waived">Waive</option>}</select>}
                        </div>
                      ))}
                      {stage.tasks.map((task) => (
                        <div className={`portal-workflow-row portal-task-workflow portal-workflow-${task.status}`} key={task.id}>
                          <button disabled={!can("timeline.manage") || saving === task.id} onClick={() => updateTask(task, task.status === "completed" ? "open" : "completed")}>{task.status === "completed" && <Check size={12} />}</button>
                          <div><strong>{task.title}</strong><span>Task{task.assignee_name ? ` · ${task.assignee_name}` : " · unassigned"} · {task.audience}</span></div>
                          <PriorityBadge priority={task.priority} />
                          <time>{formatDate(task.due_date)}</time>
                          {can("timeline.manage") && <select value={task.status} onChange={(event) => updateTask(task, event.target.value as Task["status"])}><option value="open">Open</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select>}
                        </div>
                      ))}
                    </>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}

      {tab === "updates" && (
        <div className="portal-card portal-engagement-updates">
          <header className="portal-section-actions"><div><p className="portal-eyebrow">Engagement record</p><h2>Updates</h2><span>Audience controls determine who can read each update.</span></div><Link href="/portal/inbox" className="portal-secondary-button">Open inbox</Link></header>
          <div className="portal-update-list">
            {messages.length === 0 ? <EmptyState icon={MessageSquare} title="No updates" description="The first engagement message will establish this correspondence record." /> : messages.map((message) => (
              <article key={message.id}>
                <span className="portal-avatar">{message.sender_name.slice(0, 1)}</span>
                <div><header><strong>{message.sender_name}</strong><span>{message.sender_role.replace("_", " ")} · {formatDate(message.created_at, true)}</span><em className={`portal-audience portal-audience-${message.audience}`}>{message.audience === "internal" ? <Lock size={11} /> : <Users size={11} />}{message.audience}</em></header><p>{message.body}</p>{Boolean(message.attachments?.length) && <div className="portal-message-attachments">{message.attachments?.map((attachment) => <button type="button" key={attachment.id} onClick={() => downloadAttachment(attachment)} disabled={saving === attachment.id}><Paperclip size={13} /><span>{attachment.name}</span><small>{Math.max(1, Math.round(attachment.size_bytes / 1024))} KB</small><Download size={13} /></button>)}</div>}</div>
              </article>
            ))}
          </div>
          {can("messages.send") && (
            <form className="portal-engagement-compose" onSubmit={sendMessage}>
              <textarea name="body" required maxLength={10_000} placeholder="Write an engagement update…" />
              <footer>
                {(access.role === "super_admin" || access.role === "admin") ? <select name="audience" defaultValue="client"><option value="client">Client visible</option><option value="contractor">Contractor visible</option>{can("messages.internal_view") && <option value="internal">Internal only</option>}</select> : <input type="hidden" name="audience" value={access.role === "client" ? "client" : "contractor"} />}
                <label className="portal-attachment-button"><Paperclip size={14} />{messageAttachmentCount ? `${messageAttachmentCount} file${messageAttachmentCount === 1 ? "" : "s"}` : "Attach files"}<input type="file" name="attachments" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.heic,.txt,.csv" onChange={(event) => setMessageAttachmentCount(event.target.files?.length ?? 0)} /></label>
                <button className="portal-primary-button" disabled={saving === "message"}><Send size={14} />{saving === "message" ? "Sending…" : "Send update"}</button>
              </footer>
            </form>
          )}
        </div>
      )}

      {tab === "files" && (
        <div className="portal-card portal-files-panel">
          <header className="portal-section-actions"><div><p className="portal-eyebrow">Secure record</p><h2>Files</h2><span>Published and permitted documents associated with this engagement.</span></div><Link href={`/portal/vault?matter_id=${id}`} className="portal-primary-button">{can("documents.upload") ? "Manage files" : "Open vault"}</Link></header>
          {documents.length === 0 ? <EmptyState icon={FolderOpen} title="No files" description="Permitted engagement documents will appear here." /> : (
            <div className="portal-file-table">
              <div className="portal-file-row portal-file-header"><span>Document</span><span>Category</span><span>Audience</span><span>Published</span><span /></div>
              {documents.map((document) => (
                <div className="portal-file-row" key={document.id}>
                  <span><FileText size={15} /><div><strong>{document.name}</strong><small>{document.original_name}</small></div></span>
                  <span>{document.category.replaceAll("_", " ")}</span>
                  <span>{document.visibility || "Permitted"}</span>
                  <span>{document.publication_status?.replace("_", " ") || formatDate(document.created_at)}</span>
                  <button className="portal-icon-button" onClick={() => download(document)} disabled={saving === document.id} aria-label={`Download ${document.name}`}><Download size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "finance" && (
        <div className="portal-finance-workspace">
          <section className="portal-metric-grid">
            <div className="portal-metric-card"><span className="portal-metric-icon"><CircleDollarSign size={17} /></span><div><p>Outstanding</p><strong>{money(outstanding)}</strong><span>{invoices.filter((invoice) => ["issued", "processing", "overdue"].includes(invoice.status)).length} open invoice(s)</span></div></div>
            <div className="portal-metric-card"><span className="portal-metric-icon"><FileText size={17} /></span><div><p>Contracts</p><strong>{contracts.length}</strong><span>{contracts.filter((record) => record.status === "accepted").length} accepted</span></div></div>
            <div className="portal-metric-card"><span className="portal-metric-icon"><ClipboardList size={17} /></span><div><p>Change orders</p><strong>{changeOrders.length}</strong><span>{changeOrders.filter((record) => record.status === "issued").length} awaiting decision</span></div></div>
          </section>
          <section className="portal-card portal-finance-records">
            <header className="portal-section-actions"><div><p className="portal-eyebrow">Billing record</p><h2>Invoices and amendments</h2></div><Link href={`/portal/finance?matter_id=${id}`} className="portal-primary-button">{can("finance.manage") ? "Manage finance" : "Open finance"}</Link></header>
            {[...invoices, ...changeOrders].length === 0 ? <EmptyState icon={CircleDollarSign} title="No financial records" description="Issued contracts, invoices and change orders will appear here." /> : [...invoices, ...changeOrders].map((record) => (
              <div className="portal-finance-record" key={record.id}><div><strong>{record.invoice_number || record.change_order_number || record.title}</strong><span>{record.title || "Invoice"} · {record.status}</span></div><span>{money(record.total_cents ?? record.amount_cents)}</span><time>{formatDate(record.due_date)}</time><ChevronRight size={14} /></div>
            ))}
          </section>
        </div>
      )}

      {tab === "activity" && (
        <div className="portal-card portal-activity-panel">
          <header className="portal-section-actions"><div><p className="portal-eyebrow">Immutable record</p><h2>Activity</h2><span>System and user actions recorded for this engagement.</span></div></header>
          {events.length === 0 ? <EmptyState icon={Activity} title="No recorded activity" description="Audited engagement actions will appear here." /> : <div className="portal-activity-list">{events.slice().reverse().map((event) => (
            <article key={event.id}><span><Activity size={13} /></span><div><strong>{event.event_type.replaceAll("_", " ")}</strong><p>{event.content || "System activity recorded."}</p></div><em>{event.visibility}</em><time>{formatDate(event.created_at, true)}</time></article>
          ))}</div>}
        </div>
      )}

      {showDetails && (
        <div className="portal-drawer-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-engagement-title">
          <button className="portal-command-scrim" onClick={() => setShowDetails(false)} aria-label="Close details" />
          <aside className="portal-drawer">
            <header><div><p className="portal-eyebrow">Operating details</p><h2 id="edit-engagement-title">Edit engagement</h2></div><button className="portal-icon-button" onClick={() => setShowDetails(false)}><X size={18} /></button></header>
            <form onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const updated = await patchMatter({
                title: form.get("title"), ownerUserId: form.get("ownerUserId") || null,
                priority: form.get("priority"), health: form.get("health"),
                startDate: form.get("startDate") || null, dueDate: form.get("dueDate") || null,
                nextAction: form.get("nextAction") || null, nextActionDueAt: form.get("nextActionDueAt") || null,
                notes: form.get("notes"),
              });
              if (updated) setShowDetails(false);
            }}>
              <label className="portal-field"><span>Title</span><input name="title" defaultValue={matter.title} required /></label>
              <label className="portal-field"><span>Owner</span><select name="ownerUserId" defaultValue={matter.owner_user_id || ""}><option value="">Unassigned</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.role}</option>)}</select></label>
              <div className="portal-form-grid">
                <label className="portal-field"><span>Priority</span><select name="priority" defaultValue={matter.priority}><option>low</option><option>normal</option><option>high</option><option>urgent</option></select></label>
                <label className="portal-field"><span>Health</span><select name="health" defaultValue={matter.health}><option value="on_track">On track</option><option value="at_risk">At risk</option><option value="blocked">Blocked</option></select></label>
                <label className="portal-field"><span>Start date</span><input name="startDate" type="date" defaultValue={matter.start_date?.slice(0, 10) || ""} /></label>
                <label className="portal-field"><span>Target date</span><input name="dueDate" type="date" defaultValue={matter.due_date?.slice(0, 10) || ""} /></label>
              </div>
              <label className="portal-field"><span>Next action</span><input name="nextAction" defaultValue={matter.next_action || ""} /></label>
              <label className="portal-field"><span>Next action due</span><input name="nextActionDueAt" type="datetime-local" defaultValue={matter.next_action_due_at?.slice(0, 16) || ""} /></label>
              <label className="portal-field"><span>Internal context</span><textarea name="notes" rows={7} defaultValue={matter.notes || ""} /></label>
              <footer><button type="button" className="portal-secondary-button" onClick={() => setShowDetails(false)}>Cancel</button><button className="portal-primary-button" disabled={saving === "matter"}>{saving === "matter" ? "Saving…" : "Save changes"}</button></footer>
            </form>
          </aside>
        </div>
      )}

      {(showTask || showRequirement) && (
        <div className="portal-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="new-work-title">
          <button className="portal-command-scrim" onClick={() => { setShowTask(false); setShowRequirement(false); }} aria-label="Close dialog" />
          <section className="portal-dialog portal-save-dialog">
            <header><div><p className="portal-eyebrow">Engagement work</p><h2 id="new-work-title">{showTask ? "Create task" : "Add requirement"}</h2></div><button className="portal-icon-button" onClick={() => { setShowTask(false); setShowRequirement(false); }}><X size={17} /></button></header>
            <form onSubmit={showTask ? createTask : createRequirement}>
              <label className="portal-field"><span>Title</span><input name="title" required autoFocus /></label>
              {showTask && <label className="portal-field"><span>Description</span><textarea name="description" rows={3} /></label>}
              <label className="portal-field"><span>Workflow stage</span><select name="stageKey" defaultValue={matter.status}>{STAGES.map((stage) => <option key={stage} value={stage}>{MATTER_STATUS_LABELS[stage]}</option>)}</select></label>
              <label className="portal-field"><span>Assignee</span><select name="assigneeUserId" defaultValue=""><option value="">Unassigned</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
              <label className="portal-field"><span>Due date</span><input type="date" name="dueDate" /></label>
              {showTask ? (
                <div className="portal-form-grid">
                  <label className="portal-field"><span>Priority</span><select name="priority" defaultValue="normal"><option>low</option><option>normal</option><option>high</option><option>urgent</option></select></label>
                  <label className="portal-field"><span>Audience</span><select name="audience" defaultValue="internal"><option value="internal">Internal</option><option value="contractor">Contractor</option><option value="client">Client</option></select></label>
                </div>
              ) : (
                <>
                  <label className="portal-field"><span>Type</span><select name="itemType" defaultValue="requirement"><option value="requirement">Requirement</option><option value="deliverable">Deliverable</option><option value="approval">Approval</option></select></label>
                  <label className="portal-check-field"><input name="isRequired" type="checkbox" defaultChecked />Required before stage advancement</label>
                </>
              )}
              <footer><button type="button" className="portal-secondary-button" onClick={() => { setShowTask(false); setShowRequirement(false); }}>Cancel</button><button className="portal-primary-button" disabled={saving === "task" || saving === "requirement"}>Create</button></footer>
            </form>
          </section>
        </div>
      )}

      {workflowReason && (
        <div className="portal-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="workflow-reason-title">
          <button className="portal-command-scrim" onClick={() => setWorkflowReason(null)} aria-label="Close dialog" />
          <section className="portal-dialog portal-save-dialog">
            <header><div><p className="portal-eyebrow">{workflowReason.status === "waived" ? "Super Admin override" : "Workflow blocker"}</p><h2 id="workflow-reason-title">{workflowReason.status === "waived" ? "Waive required item" : "Record blocker"}</h2></div><button className="portal-icon-button" onClick={() => setWorkflowReason(null)}><X size={17} /></button></header>
            <form onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const reason = String(form.get("reason") ?? "");
              await updateWorkflow(
                workflowReason.item,
                workflowReason.status,
                workflowReason.status === "blocked" ? reason : undefined,
                workflowReason.status === "waived" ? reason : undefined,
              );
              setWorkflowReason(null);
            }}>
              <p className="portal-dialog-copy">{workflowReason.item.title}</p>
              <label className="portal-field"><span>{workflowReason.status === "waived" ? "Override reason" : "Blocker and next step"}</span><textarea name="reason" required minLength={5} rows={4} autoFocus /></label>
              <footer><button type="button" className="portal-secondary-button" onClick={() => setWorkflowReason(null)}>Cancel</button><button className={workflowReason.status === "waived" ? "portal-danger-button" : "portal-primary-button"} disabled={saving === workflowReason.item.id}>{workflowReason.status === "waived" ? "Confirm waiver" : "Record blocker"}</button></footer>
            </form>
          </section>
        </div>
      )}

      {transition && (
        <div className="portal-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="workflow-gate-title">
          <button className="portal-command-scrim" onClick={() => setTransition(null)} aria-label="Close dialog" />
          <section className="portal-dialog portal-save-dialog">
            <header><div><p className="portal-eyebrow">Workflow gate</p><h2 id="workflow-gate-title">Stage cannot advance</h2></div><button className="portal-icon-button" onClick={() => setTransition(null)}><X size={17} /></button></header>
            <form onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              await patchMatter({ status: transition.status }, String(form.get("overrideReason") ?? ""));
            }}>
              <p className="portal-dialog-copy">Resolve these required items before advancing to {MATTER_STATUS_LABELS[transition.status]}.</p>
              <ul className="portal-blocker-list">{transition.blockers.map((blocker) => <li key={blocker.id}><AlertTriangle size={13} /><span>{blocker.title}<small>{blocker.status}</small></span></li>)}</ul>
              {transition.overrideAvailable && <label className="portal-field"><span>Super Admin override reason</span><textarea name="overrideReason" required minLength={5} rows={3} /></label>}
              <footer><button type="button" className="portal-secondary-button" onClick={() => { setTransition(null); setTab("work"); }}>Review workflow</button>{transition.overrideAvailable && <button className="portal-primary-button">Override and advance</button>}</footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
