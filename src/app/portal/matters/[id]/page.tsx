"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Clock, FileText, ChevronRight, User,
  MapPin, StickyNote, CheckCircle2, AlertCircle,
  Send, Loader2, Download, GitBranch, Activity, X,
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
  created:               { icon: "●", color: GOLD,      label: "Matter created"         },
  status_changed:        { icon: "◆", color: "#8b5cf6", label: "Status changed"         },
  note_added:            { icon: "○", color: TITAN,     label: "Note"                   },
  document_uploaded:     { icon: "▲", color: "#4ade80", label: "Document uploaded"      },
  document_downloaded:   { icon: "▼", color: "#60a5fa", label: "Document downloaded"    },
  document_deleted:      { icon: "✕", color: "#f87171", label: "Document deleted"       },
  client_access_granted: { icon: "◉", color: GOLD,      label: "Client access granted"  },
};

// ─── Workflow engine config ───────────────────────────────────────────────────
interface StageConfig {
  description: string;
  objective: string;
  requirements: string[];
  deliverables: string[];
  typicalDuration: string;
}

const WORKFLOW_CONFIG: Record<MatterStatus, StageConfig> = {
  intake: {
    description: "Initial client and property information is gathered. The engagement is logged and assigned.",
    objective: "Establish the full scope and context of the matter before any advisory work begins.",
    requirements: [
      "Client contact information confirmed",
      "Property address and ownership verified",
      "Nature of concern documented (mold, asbestos, smoke damage, etc.)",
      "Initial client communication logged",
      "Conflict check completed",
    ],
    deliverables: [
      "Completed intake form",
      "Signed engagement letter",
    ],
    typicalDuration: "1–2 business days",
  },
  assessment: {
    description: "On-site or remote evaluation of conditions. Third-party inspectors may be engaged.",
    objective: "Establish an objective baseline of the property's condition and identify the scope of any hazard.",
    requirements: [
      "Site inspection scheduled and confirmed",
      "Qualified inspector identified (CDPH, CSLB, or specialty certified)",
      "Client briefed on inspection protocol",
      "Property access coordinated with all parties",
      "Preliminary findings documented",
    ],
    deliverables: [
      "Inspection report (third-party)",
      "Photo documentation",
      "Lab samples submitted (if applicable)",
    ],
    typicalDuration: "3–7 business days",
  },
  review: {
    description: "Lab results, inspection reports, and other technical documents are reviewed and interpreted.",
    objective: "Translate technical findings into actionable advisory recommendations for the client.",
    requirements: [
      "All lab results received and reviewed",
      "Inspection report reviewed in full",
      "Findings compared against applicable thresholds (Cal/OSHA, CDPH, EPA)",
      "Risk level assessed (low / moderate / high / immediate action)",
      "Preliminary advisory memo drafted",
    ],
    deliverables: [
      "Advisory memo to client",
      "Risk assessment summary",
      "Regulatory threshold comparison",
    ],
    typicalDuration: "2–5 business days",
  },
  vendor_evaluation: {
    description: "Remediation contractors and specialist vendors are identified, vetted, and compared.",
    objective: "Ensure the client selects a qualified, licensed, and cost-appropriate vendor for remediation.",
    requirements: [
      "Minimum 3 contractor proposals solicited",
      "CSLB license status verified for each contractor",
      "Insurance certificates (GL + Workers Comp) obtained",
      "Scope of work reviewed for completeness",
      "Red flags and discrepancies noted",
      "Recommendation prepared with rationale",
    ],
    deliverables: [
      "Vendor comparison matrix",
      "License and insurance verification",
      "Recommended contractor with rationale",
    ],
    typicalDuration: "5–10 business days",
  },
  oversight: {
    description: "Active remediation or repair work is underway. James Roman Advisory monitors progress and quality.",
    objective: "Ensure remediation is executed per scope, on schedule, and in compliance with applicable regulations.",
    requirements: [
      "Work order and scope of work signed by all parties",
      "Progress check-ins scheduled (weekly minimum)",
      "Interim clearance testing plan established",
      "Any scope deviations documented and approved",
      "Change orders reviewed before authorization",
      "Regulatory notification filed if required (Cal/OSHA, CDPH)",
    ],
    deliverables: [
      "Weekly progress reports",
      "Photo documentation (before / during)",
      "Change order log",
    ],
    typicalDuration: "Variable (1 week – 3+ months)",
  },
  clearance: {
    description: "Post-remediation testing is conducted. Final clearance is pending lab confirmation.",
    objective: "Confirm that the property meets applicable clearance thresholds and is safe for occupancy.",
    requirements: [
      "Post-remediation inspection scheduled",
      "Independent clearance testing conducted (not by remediator)",
      "Lab results received and reviewed",
      "All clearance thresholds met (per Cal/OSHA, CDPH, or EPA)",
      "Final advisory sign-off prepared",
      "Client briefed on results and any residual conditions",
    ],
    deliverables: [
      "Post-remediation clearance report",
      "Final lab results",
      "Clearance letter to client",
    ],
    typicalDuration: "3–7 business days",
  },
  closed: {
    description: "The engagement is complete. All deliverables have been provided and the file is archived.",
    objective: "Formally close the matter with a complete record of the engagement and all advisory deliverables.",
    requirements: [
      "Final report delivered to client",
      "All open items resolved",
      "File archived with all documents",
      "Final invoice issued and confirmed",
      "Client satisfaction follow-up conducted",
    ],
    deliverables: [
      "Final engagement report",
      "Archived matter file",
    ],
    typicalDuration: "Closed",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(date: string) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
    <div className="flex items-center">
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
                  opacity: done ? 0.55 : 1,
                }}
              />
              <p
                className="text-[0.56rem] uppercase tracking-[0.14em] text-center hidden md:block"
                style={{
                  color: active ? cfg.dot : done ? TITAN : "rgba(178,168,152,0.3)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "72px",
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

// ─── Status selector (header) ─────────────────────────────────────────────────
function StatusSelector({ current, onChange }: { current: MatterStatus; onChange: (s: MatterStatus) => Promise<void> }) {
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
        onClick={() => setOpen((o) => !o)} disabled={saving}
        className="flex items-center gap-2 border px-3 py-1.5 text-[0.72rem] uppercase tracking-[0.18em] hover:opacity-90 disabled:opacity-50 transition-all"
        style={{ borderColor: cfg.ring, background: cfg.ring, color: cfg.dot }}
      >
        <span className="size-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
        {cfg.label}
        <ChevronRight size={10} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-30 border min-w-[170px] py-1"
          style={{ background: "#0e1016", borderColor: "rgba(201,181,138,0.18)" }}>
          {STATUS_ORDER.map((s) => (
            <button key={s} onClick={() => pick(s)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[0.72rem] uppercase tracking-[0.14em] hover:bg-white/5 transition-colors text-left"
              style={{ color: s === current ? GOLD : TITAN }}>
              <span className="size-1.5 rounded-full" style={{ background: STATUS_CONFIG[s].dot }} />
              {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Timeline event ───────────────────────────────────────────────────────────
function TimelineEvent({ event }: { event: MatterEvent }) {
  const cfg = EVENT_CONFIG[event.event_type] ?? { icon: "·", color: TITAN, label: event.event_type };
  const meta = event.metadata as Record<string, string> | undefined;

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center gap-0">
        <div className="size-7 rounded-full flex items-center justify-center flex-shrink-0 text-[0.7rem] font-mono border"
          style={{ background: cfg.color + "18", borderColor: cfg.color + "40", color: cfg.color }}>
          {cfg.icon}
        </div>
        <div className="w-px flex-1 mt-1" style={{ background: "rgba(201,181,138,0.08)" }} />
      </div>
      <div className="pb-6 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-[0.72rem] uppercase tracking-[0.16em]" style={{ color: cfg.color }}>{cfg.label}</p>
          <p className="text-[0.68rem] flex-shrink-0" style={{ color: TITAN, opacity: 0.45 }}>{fmtTime(event.created_at)}</p>
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
          <p className="text-[0.84rem] leading-relaxed whitespace-pre-wrap"
            style={{ color: event.event_type === "note_added" ? CREAM : TITAN, opacity: event.event_type === "note_added" ? 1 : 0.75 }}>
            {event.content}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ─── Advance confirmation modal ───────────────────────────────────────────────
function AdvanceModal({
  to, onConfirm, onCancel, saving,
}: {
  from: MatterStatus; to: MatterStatus; onConfirm: () => void; onCancel: () => void; saving: boolean;
}) {
  const toCfg = STATUS_CONFIG[to];
  const toWorkflow = WORKFLOW_CONFIG[to];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-lg border p-8 relative" style={{ background: CARD, borderColor: "rgba(201,181,138,0.15)" }}>
        <button onClick={onCancel} className="absolute top-5 right-5 opacity-40 hover:opacity-100 transition-opacity">
          <X size={16} style={{ color: CREAM }} />
        </button>

        <p className="text-[0.62rem] uppercase tracking-[0.3em] mb-2" style={{ color: GOLD, opacity: 0.6 }}>
          Stage transition
        </p>
        <h2 className="font-heading font-light text-[1.5rem] tracking-[-0.02em] mb-1" style={{ color: CREAM }}>
          Move to {toCfg.label}
        </h2>
        <p className="text-[0.82rem] mb-6 leading-relaxed" style={{ color: TITAN, opacity: 0.7 }}>
          {toWorkflow.description}
        </p>

        <div className="border-t border-b py-5 mb-6 space-y-2"
          style={{ borderColor: "rgba(201,181,138,0.1)" }}>
          <p className="text-[0.64rem] uppercase tracking-[0.26em] mb-3" style={{ color: TITAN, opacity: 0.5 }}>
            Stage requirements
          </p>
          {toWorkflow.requirements.map((req) => (
            <div key={req} className="flex items-start gap-2.5">
              <span className="size-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: toCfg.dot, opacity: 0.6 }} />
              <p className="text-[0.8rem]" style={{ color: TITAN, opacity: 0.75 }}>{req}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={onCancel} disabled={saving}
            className="text-[0.76rem] uppercase tracking-[0.18em] opacity-45 hover:opacity-80 transition-opacity"
            style={{ color: TITAN }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={saving}
            className="flex items-center gap-2 border px-5 py-2.5 text-[0.78rem] uppercase tracking-[0.2em] disabled:opacity-40 transition-all hover:opacity-90"
            style={{ borderColor: toCfg.ring, background: toCfg.ring, color: toCfg.dot }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
            Advance to {toCfg.label}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Workflow panel ───────────────────────────────────────────────────────────
function WorkflowPanel({
  matter,
  onAdvance,
}: {
  matter: Matter;
  onAdvance: (status: MatterStatus) => Promise<void>;
}) {
  const currentIdx = STATUS_ORDER.indexOf(matter.status);
  const nextStatus = currentIdx < STATUS_ORDER.length - 1 ? STATUS_ORDER[currentIdx + 1] : null;
  const prevStatus = currentIdx > 0 ? STATUS_ORDER[currentIdx - 1] : null;
  const currentCfg = STATUS_CONFIG[matter.status];
  const currentWorkflow = WORKFLOW_CONFIG[matter.status];

  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceSaving, setAdvanceSaving] = useState(false);
  const [retreating, setRetreating] = useState(false);

  async function confirmAdvance() {
    if (!nextStatus) return;
    setAdvanceSaving(true);
    await onAdvance(nextStatus);
    setAdvanceSaving(false);
    setShowAdvanceModal(false);
  }

  async function handleRetreat() {
    if (!prevStatus) return;
    setRetreating(true);
    await onAdvance(prevStatus);
    setRetreating(false);
  }

  const isOpen = matter.status !== "closed";

  return (
    <>
      <div className="space-y-5">

        {/* Current stage detail */}
        <div className="border p-6" style={{ borderColor: "rgba(201,181,138,0.12)", background: CARD }}>
          <div className="flex items-center gap-2.5 mb-4">
            <span className="size-2 rounded-full" style={{ background: currentCfg.dot, boxShadow: `0 0 8px ${currentCfg.dot}` }} />
            <p className="text-[0.63rem] uppercase tracking-[0.26em]" style={{ color: currentCfg.dot }}>
              {currentCfg.label}
            </p>
            <span className="text-[0.62rem] ml-auto" style={{ color: TITAN, opacity: 0.4 }}>
              Stage {currentIdx + 1} of {STATUS_ORDER.length}
            </span>
          </div>

          <p className="text-[0.85rem] leading-relaxed mb-4" style={{ color: CREAM, opacity: 0.8 }}>
            {currentWorkflow.description}
          </p>

          <div className="rounded-sm p-3 mb-5 text-[0.78rem] leading-relaxed"
            style={{ background: "rgba(201,181,138,0.05)", borderLeft: `2px solid ${currentCfg.dot}40`, color: TITAN, opacity: 0.8 }}>
            <strong style={{ color: currentCfg.dot, opacity: 0.9 }}>Objective: </strong>{currentWorkflow.objective}
          </div>

          <p className="text-[0.62rem] uppercase tracking-[0.24em] mb-3" style={{ color: TITAN, opacity: 0.45 }}>
            Stage requirements
          </p>
          <div className="space-y-2.5 mb-5">
            {currentWorkflow.requirements.map((req) => (
              <div key={req} className="flex items-start gap-2.5">
                <span className="size-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: currentCfg.dot, opacity: 0.55 }} />
                <p className="text-[0.8rem]" style={{ color: TITAN, opacity: 0.75 }}>{req}</p>
              </div>
            ))}
          </div>

          {currentWorkflow.deliverables.length > 0 && (
            <>
              <p className="text-[0.62rem] uppercase tracking-[0.24em] mb-2.5" style={{ color: TITAN, opacity: 0.45 }}>
                Deliverables
              </p>
              <div className="space-y-1.5 mb-5">
                {currentWorkflow.deliverables.map((d) => (
                  <div key={d} className="flex items-center gap-2.5">
                    <FileText size={10} style={{ color: GOLD, opacity: 0.45, flexShrink: 0 }} />
                    <p className="text-[0.78rem]" style={{ color: TITAN, opacity: 0.65 }}>{d}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex items-center gap-1.5 pt-3 border-t"
            style={{ borderColor: "rgba(201,181,138,0.08)" }}>
            <Clock size={10} style={{ color: TITAN, opacity: 0.35 }} />
            <p className="text-[0.7rem]" style={{ color: TITAN, opacity: 0.4 }}>
              Typical duration: {currentWorkflow.typicalDuration}
            </p>
          </div>
        </div>

        {/* Advance / Retreat controls — only for non-closed matters */}
        {isOpen && (
          <div className="border p-5 space-y-3" style={{ borderColor: "rgba(201,181,138,0.1)", background: CARD }}>
            <p className="text-[0.62rem] uppercase tracking-[0.26em] mb-4" style={{ color: TITAN, opacity: 0.45 }}>
              Stage controls
            </p>

            {nextStatus && (
              <button
                onClick={() => setShowAdvanceModal(true)}
                className="w-full flex items-center justify-between border px-4 py-3 text-[0.78rem] uppercase tracking-[0.18em] hover:opacity-90 transition-all"
                style={{
                  borderColor: STATUS_CONFIG[nextStatus].ring,
                  background: STATUS_CONFIG[nextStatus].ring,
                  color: STATUS_CONFIG[nextStatus].dot,
                }}>
                <span>Advance to {STATUS_CONFIG[nextStatus].label}</span>
                <ArrowRight size={13} />
              </button>
            )}

            {prevStatus && (
              <button
                onClick={handleRetreat}
                disabled={retreating}
                className="w-full flex items-center justify-between px-4 py-2.5 text-[0.74rem] uppercase tracking-[0.16em] border hover:opacity-70 disabled:opacity-30 transition-all"
                style={{ borderColor: "rgba(201,181,138,0.1)", color: TITAN }}>
                {retreating ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <span>← Return to {STATUS_CONFIG[prevStatus].label}</span>
                )}
              </button>
            )}
          </div>
        )}

        {/* Full workflow map */}
        <div className="border p-5" style={{ borderColor: "rgba(201,181,138,0.1)", background: CARD }}>
          <p className="text-[0.62rem] uppercase tracking-[0.26em] mb-5" style={{ color: TITAN, opacity: 0.45 }}>
            Workflow map
          </p>
          <div className="space-y-0">
            {STATUS_ORDER.map((s, i) => {
              const sCfg = STATUS_CONFIG[s];
              const sWorkflow = WORKFLOW_CONFIG[s];
              const done = i < currentIdx;
              const active = i === currentIdx;
              const future = i > currentIdx;
              const isLast = i === STATUS_ORDER.length - 1;

              return (
                <div key={s} className="flex gap-3">
                  {/* Spine */}
                  <div className="flex flex-col items-center" style={{ minWidth: 20 }}>
                    <div
                      className="size-3 rounded-full flex-shrink-0 mt-0.5 transition-all"
                      style={{
                        background: active ? sCfg.dot : done ? sCfg.dot : "rgba(201,181,138,0.12)",
                        boxShadow: active ? `0 0 6px ${sCfg.dot}` : "none",
                        opacity: done ? 0.5 : 1,
                      }}
                    />
                    {!isLast && (
                      <div className="w-px flex-1 mt-1 mb-1" style={{ background: done ? "rgba(201,181,138,0.2)" : "rgba(201,181,138,0.07)", minHeight: 20 }} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="pb-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p
                        className="text-[0.74rem] uppercase tracking-[0.14em]"
                        style={{ color: active ? sCfg.dot : done ? TITAN : "rgba(178,168,152,0.3)" }}>
                        {sCfg.label}
                      </p>
                      {done && <CheckCircle2 size={10} style={{ color: TITAN, opacity: 0.35 }} />}
                      {active && (
                        <span className="text-[0.58rem] uppercase tracking-[0.2em] px-1.5 py-0.5 rounded-sm"
                          style={{ background: sCfg.dot + "22", color: sCfg.dot }}>
                          Current
                        </span>
                      )}
                    </div>
                    {!future && (
                      <p className="text-[0.72rem] leading-snug" style={{ color: TITAN, opacity: active ? 0.6 : 0.3 }}>
                        {sWorkflow.objective.slice(0, 80)}{sWorkflow.objective.length > 80 ? "…" : ""}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showAdvanceModal && nextStatus && (
        <AdvanceModal
          from={matter.status}
          to={nextStatus}
          onConfirm={confirmAdvance}
          onCancel={() => setShowAdvanceModal(false)}
          saving={advanceSaving}
        />
      )}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
type Tab = "timeline" | "workflow";

export default function MatterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [matter, setMatter]         = useState<Matter | null>(null);
  const [events, setEvents]         = useState<MatterEvent[]>([]);
  const [documents, setDocuments]   = useState<Document[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState<Tab>("timeline");
  const [noteText, setNoteText]     = useState("");
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

  useEffect(() => {
    if (activeTab === "timeline") {
      setTimeout(() => timelineEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [events.length, activeTab]);

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

  return (
    <div className="min-h-screen" style={{ background: BG, color: CREAM }}>

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <header className="px-8 py-4 flex items-center justify-between border-b sticky top-0 z-20"
        style={{ borderColor: "rgba(201,181,138,0.1)", background: "rgba(10,11,14,0.94)", backdropFilter: "blur(10px)" }}>
        <div className="flex items-center gap-5">
          <Link href="/portal/matters"
            className="flex items-center gap-1.5 text-[0.72rem] uppercase tracking-[0.22em] opacity-45 hover:opacity-90 transition-opacity"
            style={{ color: TITAN }}>
            <ArrowLeft size={12} />
            Engagements
          </Link>
          <span style={{ color: "rgba(201,181,138,0.18)" }}>/</span>
          <span className="text-[0.75rem] truncate max-w-[220px]" style={{ color: CREAM, opacity: 0.7 }}>
            {matter.title}
          </span>
        </div>
        <StatusSelector current={matter.status} onChange={handleStatusChange} />
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-10">

        {/* ── LEFT ──────────────────────────────────────────────────────── */}
        <div>

          {/* Header */}
          <div className="mb-7">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] mb-2" style={{ color: GOLD, opacity: 0.55 }}>
              {TYPE_LABELS[matter.type]}
            </p>
            <h1 className="font-heading font-light text-[2rem] tracking-[-0.025em] leading-tight mb-5" style={{ color: CREAM }}>
              {matter.title}
            </h1>
            <div className="border p-5 mb-3" style={{ borderColor: "rgba(201,181,138,0.1)", background: CARD }}>
              <p className="text-[0.62rem] uppercase tracking-[0.26em] mb-4" style={{ color: TITAN, opacity: 0.5 }}>
                Workflow stage
              </p>
              <StageProgress status={matter.status} />
            </div>
            <p className="text-[0.7rem]" style={{ color: TITAN, opacity: 0.4 }}>
              Opened {fmt(matter.created_at)} · Updated {fmt(matter.updated_at)}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 mb-7 border-b" style={{ borderColor: "rgba(201,181,138,0.1)" }}>
            {([
              { key: "timeline" as Tab, label: "Activity", icon: Activity },
              { key: "workflow" as Tab, label: "Workflow", icon: GitBranch },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="flex items-center gap-2 px-5 py-3 text-[0.72rem] uppercase tracking-[0.2em] border-b-2 -mb-px transition-all"
                style={{
                  borderColor: activeTab === key ? GOLD : "transparent",
                  color: activeTab === key ? GOLD : TITAN,
                  opacity: activeTab === key ? 1 : 0.45,
                }}>
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>

          {/* Tab: Timeline */}
          {activeTab === "timeline" && (
            <div>
              {events.length === 0 ? (
                <div className="border py-12 text-center" style={{ borderColor: "rgba(201,181,138,0.08)", background: CARD }}>
                  <Clock size={20} style={{ color: TITAN, opacity: 0.2, margin: "0 auto 8px" }} />
                  <p className="text-[0.76rem]" style={{ color: TITAN, opacity: 0.35 }}>No activity yet</p>
                </div>
              ) : (
                <div className="mb-6">
                  {events.map((event) => <TimelineEvent key={event.id} event={event} />)}
                  <div ref={timelineEndRef} />
                </div>
              )}

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
                    <button type="submit" disabled={!noteText.trim() || addingNote}
                      className="flex items-center gap-2 text-[0.76rem] uppercase tracking-[0.2em] disabled:opacity-30 transition-opacity hover:opacity-80"
                      style={{ color: GOLD }}>
                      {addingNote ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                      Add note
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Tab: Workflow */}
          {activeTab === "workflow" && (
            <WorkflowPanel matter={matter} onAdvance={handleStatusChange} />
          )}
        </div>

        {/* ── RIGHT: Sidebar ────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Client */}
          <div className="border p-5" style={{ borderColor: "rgba(201,181,138,0.1)", background: CARD }}>
            <div className="flex items-center gap-2 mb-4">
              <User size={12} style={{ color: GOLD, opacity: 0.6 }} />
              <p className="text-[0.63rem] uppercase tracking-[0.26em]" style={{ color: TITAN, opacity: 0.55 }}>Client</p>
            </div>
            <p className="text-[0.92rem] mb-1" style={{ color: CREAM }}>{matter.client_name}</p>
            {matter.client_email && <p className="text-[0.78rem]" style={{ color: TITAN, opacity: 0.6 }}>{matter.client_email}</p>}
            {matter.client_phone && <p className="text-[0.78rem] mt-0.5" style={{ color: TITAN, opacity: 0.6 }}>{matter.client_phone}</p>}
          </div>

          {/* Property */}
          {matter.property_address && (
            <div className="border p-5" style={{ borderColor: "rgba(201,181,138,0.1)", background: CARD }}>
              <div className="flex items-center gap-2 mb-4">
                <MapPin size={12} style={{ color: GOLD, opacity: 0.6 }} />
                <p className="text-[0.63rem] uppercase tracking-[0.26em]" style={{ color: TITAN, opacity: 0.55 }}>Property</p>
              </div>
              <p className="text-[0.88rem]" style={{ color: CREAM }}>{matter.property_address}</p>
              <p className="text-[0.78rem] mt-0.5" style={{ color: TITAN, opacity: 0.55 }}>
                {matter.property_city}, {matter.property_state}
              </p>
            </div>
          )}

          {/* Progress strip */}
          <div className="border p-5" style={{ borderColor: "rgba(201,181,138,0.1)", background: CARD }}>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 size={12} style={{ color: GOLD, opacity: 0.6 }} />
              <p className="text-[0.63rem] uppercase tracking-[0.26em]" style={{ color: TITAN, opacity: 0.55 }}>Progress</p>
            </div>
            <div className="space-y-1.5">
              {STATUS_ORDER.map((s, i) => {
                const sCfg = STATUS_CONFIG[s];
                const idx = STATUS_ORDER.indexOf(matter.status);
                const done = i < idx;
                const active = i === idx;
                return (
                  <div key={s} className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full flex-shrink-0"
                      style={{ background: active ? sCfg.dot : done ? "rgba(201,181,138,0.3)" : "rgba(201,181,138,0.1)" }} />
                    <p className="text-[0.72rem] uppercase tracking-[0.12em] flex-1"
                      style={{ color: active ? sCfg.dot : done ? TITAN : "rgba(178,168,152,0.3)" }}>
                      {sCfg.label}
                    </p>
                    {done && <CheckCircle2 size={9} style={{ color: TITAN, opacity: 0.35 }} />}
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
              <p className="text-[0.76rem]" style={{ color: TITAN, opacity: 0.3 }}>No documents attached</p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-start justify-between gap-2 py-2 border-b last:border-b-0"
                    style={{ borderColor: "rgba(201,181,138,0.07)" }}>
                    <div className="min-w-0">
                      <p className="text-[0.78rem] truncate" style={{ color: CREAM }}>{doc.original_name}</p>
                      <p className="text-[0.65rem] mt-0.5" style={{ color: TITAN, opacity: 0.45 }}>
                        {doc.category.replace(/_/g, " ")}{doc.size_bytes ? ` · ${fmtBytes(doc.size_bytes)}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        const res = await fetch(`/api/vault/download/${doc.id}`);
                        if (res.ok) { const { url } = await res.json(); window.open(url, "_blank"); }
                      }}
                      className="opacity-35 hover:opacity-80 transition-opacity flex-shrink-0 mt-0.5">
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
                <p className="text-[0.63rem] uppercase tracking-[0.26em]" style={{ color: TITAN, opacity: 0.55 }}>Notes</p>
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
