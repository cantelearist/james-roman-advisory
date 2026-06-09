"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Clock, FileText, ChevronRight, User,
  MapPin, StickyNote, CheckCircle2, AlertCircle,
  Send, Loader2, Download,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type MatterStatus =
  | "intake" | "assessment" | "review"
  | "vendor_evaluation" | "oversight" | "clearance" | "closed";

type MatterType =
  | "mold" | "smoke_damage" | "asbestos" | "lead_paint"
  | "water_intrusion" | "transaction_review" | "other";

type MatterEventType =
  | "created" | "status_changed" | "note_added"
  | "document_uploaded" | "document_downloaded"
  | "document_deleted" | "client_access_granted";

interface Matter {
  id: string;
  client_id: string;
  property_id?: string;
  client_name: string;
  client_email?: string;
  client_phone?: string;
  property_address?: string;
  property_city?: string;
  property_state?: string;
  title: string;
  type: MatterType;
  status: MatterStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface MatterEvent {
  id: string;
  matter_id: string;
  user_id: string;
  event_type: MatterEventType;
  content?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface Document {
  id: string;
  name: string;
  original_name: string;
  category: string;
  size_bytes?: number;
  content_type?: string;
  created_at: string;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const GOLD  = "#c9b58a";
const CREAM = "#ece6d6";
const TITAN = "#b2a898";
const BG    = "#0a0b0e";
const CARD  = "#0d0f14";

const STATUS_CONFIG: Record<MatterStatus, { label: string; dot: string; ring: string }> = {
  intake:            { label: "Intake",            dot: "#8a8070", ring: "rgba(138,128,112,0.3)" },
  assessment:        { label: "Assessment",        dot: "#f59e0b", ring: "rgba(245,158,11,0.3)"  },
  review:            { label: "Review",            dot: "#c9b58a", ring: "rgba(201,181,138,0.3)" },
  vendor_evaluation: { label: "Vendor Evaluation", dot: "#f97316", ring: "rgba(249,115,22,0.3)"  },
  oversight:         { label: "Oversight",         dot: "#8b5cf6", ring: "rgba(139,92,246,0.3)"  },
  clearance:         { label: "Clearance",         dot: "#4ade80", ring: "rgba(74,222,128,0.3)"  },
  closed:            { label: "Closed",            dot: "#64748b", ring: "rgba(100,116,139,0.3)" },
};

const STATUS_ORDER: MatterStatus[] = [
  "intake", "assessment", "review", "vendor_evaluation", "oversight", "clearance", "closed",
];

const TYPE_LABELS: Record<MatterType, string> = {
  mold:               "Mold",
  smoke_damage:       "Smoke Damage",
  asbestos:           "Asbestos",
  lead_paint:         "Lead Paint",
  water_intrusion:    "Water Intrusion",
  transaction_review: "Transaction Review",
  other:              "Other",
};

const EVENT_CONFIG: Record<MatterEventType, { icon: string; color: string; label: string }> = {
  created:              { icon: "●",  color: GOLD,      label: "Matter created"          },
  status_changed:       { icon: "◆",  color: "#8b5cf6", label: "Status changed"          },
  note_added:           { icon: "○",  color: TITAN,     label: "Note"                    },
  document_uploaded:    { icon: "▲",  color: "#4ade80", label: "Document uploaded"       },
  document_downloaded:  { icon: "▼",  color: "#60a5fa", label: "Document downloaded"     },
  document_deleted:     { icon: "✕",  color: "#f87171", label: "Document deleted"        },
  client_access_granted:{ icon: "◉",  color: GOLD,      label: "Client access granted"   },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function fmtTime(date: string) {
  return new Date(date).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "2-digit",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function fmtBytes(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Stage progress bar ───────────────────────────────────────────────────────
function StageProgress({ status }: { status: MatterStatus }) {
  const idx = STATUS_ORDER.indexOf(status);
  return (
    <div className="flex items-center gap-0">
      {STATUS_ORDER.map((s, i) => {
        const cfg = STATUS_CONFIG[s];
        const active = i === idx;
        const done = i < idx;
        const isLast = i === STATUS_ORDER.length - 1;
        return (
          <div key={s} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1.5" style={{ minWidth: 0 }}>
              <div
                className="size-2 rounded-full flex-shrink-0 transition-all duration-500"
                style={{
                  background: active ? cfg.dot : done ? cfg.dot : "rgba(201,181,138,0.15)",
                  boxShadow: active ? `0 0 8px ${cfg.dot}` : "none",
                  opacity: done ? 0.5 : 1,
                }}
              />
              <p
                className="text-[0.56rem] uppercase tracking-[0.14em] text-center hidden md:block"
                style={{
                  color: active ? cfg.dot : done ? TITAN : "rgba(178,168,152,0.3)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "72px",
                }}
              >
                {cfg.label}
              </p>
            </div>
            {!isLast && (
              <div
                className="h-px flex-1 mx-1 transition-all duration-500"
                style={{ background: done ? "rgba(201,181,138,0.3)" : "rgba(201,181,138,0.1)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Status selector ──────────────────────────────────────────────────────────
function StatusSelector({
  current,
  onChange,
}: {
  current: MatterStatus;
  onChange: (s: MatterStatus) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const cfg = STATUS_CONFIG[current];

  async function pick(s: MatterStatus) {
    if (s === current) { setOpen(false); return; }
    setSaving(true);
    await onChange(s);
    setSaving(false);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={saving}
        className="flex items-center gap-2 border px-3 py-1.5 text-[0.72rem] uppercase tracking-[0.18em] transition-all hover:opacity-90 disabled:opacity-50"
        style={{ borderColor: cfg.ring, background: cfg.ring, color: cfg.dot }}
      >
        <span className="size-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
        {cfg.label}
        <ChevronRight size={10} style={{ transform: open ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s" }} />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-30 border min-w-[170px] py-1"
          style={{ background: "#0e1016", borderColor: "rgba(201,181,138,0.18)" }}
        >
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => pick(s)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[0.72rem] uppercase tracking-[0.14em] hover:bg-white/5 transition-colors text-left"
              style={{ color: s === current ? GOLD : TITAN }}
            >
              <span className="size-1.5 rounded-full" style={{ background: STATUS_CONFIG[s].dot }} />
              {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Timeline event row ───────────────────────────────────────────────────────
function TimelineEvent({ event }: { event: MatterEvent }) {
  const cfg = EVENT_CONFIG[event.event_type] ?? {
    icon: "·", color: TITAN, label: event.event_type,
  };

  const meta = event.metadata as Record<string, string> | undefined;

  return (
    <div className="flex gap-4">
      {/* Icon column */}
      <div className="flex flex-col items-center gap-0">
        <div
          className="size-7 rounded-full flex items-center justify-center flex-shrink-0 text-[0.7rem] font-mono border"
          style={{
            background: cfg.color + "18",
            borderColor: cfg.color + "40",
            color: cfg.color,
          }}
        >
          {cfg.icon}
        </div>
        <div className="w-px flex-1 mt-1" style={{ background: "rgba(201,181,138,0.08)" }} />
      </div>

      {/* Content */}
      <div className="pb-6 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-[0.72rem] uppercase tracking-[0.16em]" style={{ color: cfg.color }}>
            {cfg.label}
          </p>
          <p className="text-[0.68rem] flex-shrink-0" style={{ color: TITAN, opacity: 0.45 }}>
            {fmtTime(event.created_at)}
          </p>
        </div>

        {event.event_type === "status_changed" && meta ? (
          <p className="text-[0.82rem]" style={{ color: CREAM, opacity: 0.8 }}>
            <span style={{ color: TITAN }}>{STATUS_CONFIG[meta.from as MatterStatus]?.label ?? meta.from}</span>
            {" → "}
            <span style={{ color: STATUS_CONFIG[meta.to as MatterStatus]?.dot ?? GOLD }}>
              {STATUS_CONFIG[meta.to as MatterStatus]?.label ?? meta.to}
            </span>
          </p>
        ) : event.content ? (
          <p
            className="text-[0.84rem] leading-relaxed whitespace-pre-wrap"
            style={{ color: event.event_type === "note_added" ? CREAM : TITAN, opacity: event.event_type === "note_added" ? 1 : 0.75 }}
          >
            {event.content}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MatterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [matter, setMatter]     = useState<Matter | null>(null);
  const [events, setEvents]     = useState<MatterEvent[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading]   = useState(true);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [noteError, setNoteError]   = useState("");
  const timelineEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/matters/${id}`);
    if (res.status === 404) { router.replace("/portal/matters"); return; }
    if (!res.ok) return;
    const data = await res.json();
    setMatter(data.matter);
    setEvents(data.events ?? []);
    setDocuments(data.documents ?? []);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  // Scroll timeline to bottom when events load
  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  async function handleStatusChange(status: MatterStatus) {
    if (!matter) return;
    await fetch(`/api/matters/${matter.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setMatter((m) => m ? { ...m, status } : m);
    await load();
  }

  async function submitNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim() || !matter) return;
    setAddingNote(true);
    setNoteError("");
    const res = await fetch(`/api/matters/${matter.id}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: noteText.trim() }),
    });
    if (!res.ok) {
      setNoteError("Failed to add note.");
    } else {
      const { event } = await res.json();
      setEvents((prev) => [...prev, event]);
      setNoteText("");
    }
    setAddingNote(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <Loader2 size={20} className="animate-spin" style={{ color: GOLD, opacity: 0.5 }} />
      </div>
    );
  }

  if (!matter) return null;

  const statusCfg = STATUS_CONFIG[matter.status];

  return (
    <div className="min-h-screen" style={{ background: BG, color: CREAM }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header
        className="px-8 py-4 flex items-center justify-between border-b sticky top-0 z-20"
        style={{
          borderColor: "rgba(201,181,138,0.1)",
          background: "rgba(10,11,14,0.94)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div className="flex items-center gap-5">
          <Link
            href="/portal/matters"
            className="flex items-center gap-1.5 text-[0.72rem] uppercase tracking-[0.22em] opacity-45 hover:opacity-90 transition-opacity"
            style={{ color: TITAN }}
          >
            <ArrowLeft size={12} />
            Engagements
          </Link>
          <span style={{ color: "rgba(201,181,138,0.18)" }}>/</span>
          <span className="text-[0.75rem] truncate max-w-[200px]" style={{ color: CREAM, opacity: 0.7 }}>
            {matter.title}
          </span>
        </div>

        <StatusSelector current={matter.status} onChange={handleStatusChange} />
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-10">

        {/* ── LEFT: Timeline ───────────────────────────────────────────── */}
        <div>

          {/* Header block */}
          <div className="mb-8">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] mb-2" style={{ color: GOLD, opacity: 0.55 }}>
              {TYPE_LABELS[matter.type]}
            </p>
            <h1 className="font-heading font-light text-[2rem] tracking-[-0.025em] leading-tight mb-5" style={{ color: CREAM }}>
              {matter.title}
            </h1>

            {/* Stage progress */}
            <div className="border p-5 mb-3" style={{ borderColor: "rgba(201,181,138,0.1)", background: CARD }}>
              <p className="text-[0.62rem] uppercase tracking-[0.26em] mb-4" style={{ color: TITAN, opacity: 0.5 }}>
                Workflow stage
              </p>
              <StageProgress status={matter.status} />
            </div>

            <p className="text-[0.7rem]" style={{ color: TITAN, opacity: 0.4 }}>
              Opened {fmt(matter.created_at)} · Last updated {fmt(matter.updated_at)}
            </p>
          </div>

          {/* Timeline */}
          <div className="mb-6">
            <p className="text-[0.65rem] uppercase tracking-[0.26em] mb-6" style={{ color: TITAN, opacity: 0.5 }}>
              Activity timeline
            </p>

            {events.length === 0 ? (
              <div className="border py-12 text-center" style={{ borderColor: "rgba(201,181,138,0.08)", background: CARD }}>
                <Clock size={20} style={{ color: TITAN, opacity: 0.2, margin: "0 auto 8px" }} />
                <p className="text-[0.76rem]" style={{ color: TITAN, opacity: 0.35 }}>No activity yet</p>
              </div>
            ) : (
              <div>
                {events.map((event) => (
                  <TimelineEvent key={event.id} event={event} />
                ))}
                <div ref={timelineEndRef} />
              </div>
            )}
          </div>

          {/* Add note */}
          <div className="border" style={{ borderColor: "rgba(201,181,138,0.12)", background: CARD }}>
            <form onSubmit={submitNote}>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note to the timeline…"
                rows={3}
                className="w-full bg-transparent px-5 pt-4 pb-2 text-[0.86rem] outline-none resize-none placeholder:opacity-25"
                style={{ color: CREAM, borderBottom: "1px solid rgba(201,181,138,0.1)" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitNote(e as unknown as React.FormEvent);
                }}
              />
              <div className="px-5 py-3 flex items-center justify-between">
                {noteError ? (
                  <p className="text-[0.75rem] flex items-center gap-1.5" style={{ color: "#f87171" }}>
                    <AlertCircle size={12} /> {noteError}
                  </p>
                ) : (
                  <p className="text-[0.68rem]" style={{ color: TITAN, opacity: 0.3 }}>⌘ + Enter to submit</p>
                )}
                <button
                  type="submit"
                  disabled={!noteText.trim() || addingNote}
                  className="flex items-center gap-2 text-[0.76rem] uppercase tracking-[0.2em] disabled:opacity-30 transition-opacity hover:opacity-80"
                  style={{ color: GOLD }}
                >
                  {addingNote ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Send size={12} />
                  )}
                  Add note
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ── RIGHT: Sidebar ───────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Client */}
          <div className="border p-5" style={{ borderColor: "rgba(201,181,138,0.1)", background: CARD }}>
            <div className="flex items-center gap-2 mb-4">
              <User size={12} style={{ color: GOLD, opacity: 0.6 }} />
              <p className="text-[0.63rem] uppercase tracking-[0.26em]" style={{ color: TITAN, opacity: 0.55 }}>
                Client
              </p>
            </div>
            <p className="text-[0.92rem] mb-1" style={{ color: CREAM }}>{matter.client_name}</p>
            {matter.client_email && (
              <p className="text-[0.78rem]" style={{ color: TITAN, opacity: 0.6 }}>{matter.client_email}</p>
            )}
            {matter.client_phone && (
              <p className="text-[0.78rem] mt-0.5" style={{ color: TITAN, opacity: 0.6 }}>{matter.client_phone}</p>
            )}
          </div>

          {/* Property */}
          {matter.property_address && (
            <div className="border p-5" style={{ borderColor: "rgba(201,181,138,0.1)", background: CARD }}>
              <div className="flex items-center gap-2 mb-4">
                <MapPin size={12} style={{ color: GOLD, opacity: 0.6 }} />
                <p className="text-[0.63rem] uppercase tracking-[0.26em]" style={{ color: TITAN, opacity: 0.55 }}>
                  Property
                </p>
              </div>
              <p className="text-[0.88rem]" style={{ color: CREAM }}>{matter.property_address}</p>
              <p className="text-[0.78rem] mt-0.5" style={{ color: TITAN, opacity: 0.55 }}>
                {matter.property_city}, {matter.property_state}
              </p>
            </div>
          )}

          {/* Status detail */}
          <div className="border p-5" style={{ borderColor: "rgba(201,181,138,0.1)", background: CARD }}>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 size={12} style={{ color: GOLD, opacity: 0.6 }} />
              <p className="text-[0.63rem] uppercase tracking-[0.26em]" style={{ color: TITAN, opacity: 0.55 }}>
                Current stage
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="size-2.5 rounded-full" style={{ background: statusCfg.dot }} />
              <p className="text-[0.9rem]" style={{ color: CREAM }}>{statusCfg.label}</p>
            </div>
            <div className="mt-4 space-y-1.5">
              {STATUS_ORDER.map((s, i) => {
                const sCfg = STATUS_CONFIG[s];
                const idx = STATUS_ORDER.indexOf(matter.status);
                const done = i < idx;
                const active = i === idx;
                return (
                  <div key={s} className="flex items-center gap-2">
                    <span
                      className="size-1.5 rounded-full flex-shrink-0"
                      style={{
                        background: active ? sCfg.dot : done ? "rgba(201,181,138,0.3)" : "rgba(201,181,138,0.1)",
                      }}
                    />
                    <p
                      className="text-[0.72rem] uppercase tracking-[0.12em]"
                      style={{
                        color: active ? sCfg.dot : done ? TITAN : "rgba(178,168,152,0.3)",
                      }}
                    >
                      {sCfg.label}
                    </p>
                    {done && (
                      <CheckCircle2 size={9} style={{ color: TITAN, opacity: 0.35, marginLeft: "auto" }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Documents */}
          <div className="border p-5" style={{ borderColor: "rgba(201,181,138,0.1)", background: CARD }}>
            <div className="flex items-center gap-2 mb-4">
              <FileText size={12} style={{ color: GOLD, opacity: 0.6 }} />
              <p className="text-[0.63rem] uppercase tracking-[0.26em]" style={{ color: TITAN, opacity: 0.55 }}>
                Documents ({documents.length})
              </p>
            </div>

            {documents.length === 0 ? (
              <p className="text-[0.76rem]" style={{ color: TITAN, opacity: 0.3 }}>
                No documents attached
              </p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-start justify-between gap-2 py-2 border-b last:border-b-0"
                    style={{ borderColor: "rgba(201,181,138,0.07)" }}
                  >
                    <div className="min-w-0">
                      <p className="text-[0.78rem] truncate" style={{ color: CREAM }}>{doc.original_name}</p>
                      <p className="text-[0.65rem] mt-0.5" style={{ color: TITAN, opacity: 0.45 }}>
                        {doc.category.replace(/_/g, " ")}
                        {doc.size_bytes ? ` · ${fmtBytes(doc.size_bytes)}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        const res = await fetch(`/api/vault/download/${doc.id}`);
                        if (res.ok) {
                          const { url } = await res.json();
                          window.open(url, "_blank");
                        }
                      }}
                      className="opacity-35 hover:opacity-80 transition-opacity flex-shrink-0 mt-0.5"
                    >
                      <Download size={12} style={{ color: CREAM }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          {matter.notes && (
            <div className="border p-5" style={{ borderColor: "rgba(201,181,138,0.1)", background: CARD }}>
              <div className="flex items-center gap-2 mb-3">
                <StickyNote size={12} style={{ color: GOLD, opacity: 0.6 }} />
                <p className="text-[0.63rem] uppercase tracking-[0.26em]" style={{ color: TITAN, opacity: 0.55 }}>
                  Notes
                </p>
              </div>
              <p className="text-[0.82rem] leading-relaxed whitespace-pre-wrap" style={{ color: TITAN, opacity: 0.75 }}>
                {matter.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
