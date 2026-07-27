"use client";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CheckSquare2,
  Clock3,
  RefreshCw,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EmptyState, PageHeader, PriorityBadge } from "@/components/portal/portal-ui";

type Task = {
  id: string;
  matter_id: string;
  matter_title: string;
  title: string;
  description?: string | null;
  status: "open" | "in_progress" | "completed" | "cancelled";
  priority: string;
  due_date?: string | null;
  assignee_name?: string | null;
  stage_key?: string | null;
};

function formatDate(value?: string | null): string {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function MyWorkPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"open" | "overdue" | "completed">("open");
  const [updating, setUpdating] = useState("");
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/tasks?mine=1", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Assignments could not be loaded.");
      setTasks(data.tasks ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Assignments could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const visible = useMemo(() => tasks.filter((task) => {
    const matchesQuery = !query || `${task.title} ${task.matter_title}`.toLowerCase().includes(query.toLowerCase());
    if (!matchesQuery) return false;
    if (filter === "completed") return task.status === "completed";
    if (filter === "overdue") {
      return task.status !== "completed"
        && Boolean(task.due_date)
        && new Date(task.due_date!).getTime() < now;
    }
    return task.status !== "completed" && task.status !== "cancelled";
  }), [filter, now, query, tasks]);

  async function updateTask(task: Task, status: Task["status"]) {
    setUpdating(task.id);
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "The task could not be updated.");
    else setTasks((rows) => rows.map((row) => row.id === task.id ? { ...row, ...data.task } : row));
    setUpdating("");
  }

  const dueToday = tasks.filter((task) =>
    task.status !== "completed"
    && task.due_date
    && new Date(task.due_date).toDateString() === new Date().toDateString(),
  ).length;
  const overdue = tasks.filter((task) =>
    task.status !== "completed" && task.due_date && new Date(task.due_date).getTime() < now,
  ).length;

  return (
    <div className="portal-page">
      <PageHeader
        eyebrow="Priority queue"
        title="My work"
        description="Assignments, due dates and blocked work across your engagements."
        actions={<button className="portal-secondary-button" onClick={load}><RefreshCw size={14} />Refresh</button>}
      />

      <section className="portal-work-summary">
        <div><Clock3 size={17} /><span><strong>{dueToday}</strong>Due today</span></div>
        <div className={overdue ? "is-critical" : undefined}><AlertTriangle size={17} /><span><strong>{overdue}</strong>Overdue</span></div>
        <div><CheckCircle2 size={17} /><span><strong>{tasks.filter((task) => task.status === "completed").length}</strong>Completed</span></div>
      </section>

      <div className="portal-board-toolbar">
        <label className="portal-board-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assigned work" /></label>
        <div className="portal-work-filters">
          {(["open", "overdue", "completed"] as const).map((value) => (
            <button key={value} className={filter === value ? "is-active" : undefined} onClick={() => setFilter(value)}>{value}</button>
          ))}
        </div>
      </div>

      {error && <div className="portal-inline-error" role="alert">{error}</div>}
      <section className="portal-card portal-work-table">
        {loading ? (
          <div className="portal-board-loading">{Array.from({ length: 7 }, (_, index) => <span key={index} />)}</div>
        ) : visible.length === 0 ? (
          <EmptyState icon={CheckSquare2} title="No work in this view" description="Assigned tasks will appear here as engagements are organized." />
        ) : (
          <>
            <div className="portal-work-row portal-work-header"><span>Task</span><span>Engagement</span><span>Priority</span><span>Due</span><span>Status</span></div>
            {visible.map((task) => {
              const isOverdue = task.due_date && task.status !== "completed" && new Date(task.due_date).getTime() < now;
              return (
                <div className="portal-work-row" key={task.id}>
                  <span className="portal-work-task">
                    <button
                      className={task.status === "completed" ? "is-complete" : undefined}
                      onClick={() => updateTask(task, task.status === "completed" ? "open" : "completed")}
                      disabled={updating === task.id}
                      aria-label={`${task.status === "completed" ? "Reopen" : "Complete"} ${task.title}`}
                    >{task.status === "completed" && <Check size={12} />}</button>
                    <span><strong>{task.title}</strong>{task.description && <small>{task.description}</small>}</span>
                  </span>
                  <Link href={`/portal/matters/${task.matter_id}?section=work`}>{task.matter_title}</Link>
                  <span><PriorityBadge priority={task.priority} /></span>
                  <time className={isOverdue ? "is-overdue" : undefined}>{formatDate(task.due_date)}</time>
                  <span>
                    <select value={task.status} onChange={(event) => updateTask(task, event.target.value as Task["status"])} disabled={updating === task.id}>
                      <option value="open">Open</option><option value="in_progress">In progress</option>
                      <option value="completed">Completed</option><option value="cancelled">Cancelled</option>
                    </select>
                  </span>
                </div>
              );
            })}
          </>
        )}
      </section>
    </div>
  );
}
