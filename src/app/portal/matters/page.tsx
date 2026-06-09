"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, Plus, X, ChevronRight, FileText } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type MatterStatus =
  | "intake" | "assessment" | "review"
  | "vendor_evaluation" | "oversight" | "clearance" | "closed";

type MatterType =
  | "mold" | "smoke_damage" | "asbestos" | "lead_paint"
  | "water_intrusion" | "transaction_review" | "other";

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  created_at: string;
}

interface Matter {
  id: string;
  client_id: string;
  property_id?: string;
  client_name: string;
  client_email?: string;
  property_address?: string;
  property_city?: string;
  property_state?: string;
  title: string;
  type: MatterType;
  status: MatterStatus;
  notes?: string;
  document_count: number;
  created_at: string;
  updated_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const GOLD   = "#c9b58a";
const CREAM  = "#ece6d6";
const TITAN  = "#b2a898";
const BG     = "#0a0b0e";
const CARD   = "#0d0f14";

const STATUS_CONFIG: Record<MatterStatus, { label: string; color: string; dot: string }> = {
  intake:            { label: "Intake",            color: "rgba(178,168,152,0.55)", dot: "#8a8070" },
  assessment:        { label: "Assessment",        color: "rgba(251,191,36,0.7)",   dot: "#f59e0b" },
  review:            { label: "Review",            color: "rgba(201,181,138,0.8)",  dot: "#c9b58a" },
  vendor_evaluation: { label: "Vendor Evaluation", color: "rgba(251,146,60,0.7)",   dot: "#f97316" },
  oversight:         { label: "Oversight",         color: "rgba(139,92,246,0.7)",   dot: "#8b5cf6" },
  clearance:         { label: "Clearance",         color: "rgba(74,222,128,0.7)",   dot: "#4ade80" },
  closed:            { label: "Closed",            color: "rgba(100,116,139,0.5)",  dot: "#64748b" },
};

const TYPE_LABELS: Record<MatterType, string> = {
  mold:               "Mold",
  smoke_damage:       "Smoke Damage",
  asbestos:           "Asbestos",
  lead_paint:         "Lead Paint",
  water_intrusion:    "Water Intrusion",
  transaction_review: "Transaction Review",
  other:              "Other",
};

const STATUS_ORDER: MatterStatus[] = [
  "intake", "assessment", "review", "vendor_evaluation", "oversight", "clearance", "closed",
];

// ─── Status pill ──────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: MatterStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.68rem] uppercase tracking-[0.18em] px-2.5 py-1 rounded-sm border"
      style={{ color: cfg.color, borderColor: cfg.dot + "44", background: cfg.dot + "14" }}>
      <span className="size-1.5 rounded-full" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3;

interface ModalState {
  step: Step;
  // Step 1 — client
  clientMode: "new" | "existing";
  selectedClientId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  // Step 2 — property
  skipProperty: boolean;
  propertyAddress: string;
  propertyCity: string;
  // Step 3 — matter
  matterTitle: string;
  matterType: MatterType;
  matterNotes: string;
}

const DEFAULT_MODAL: ModalState = {
  step: 1,
  clientMode: "new",
  selectedClientId: "",
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  skipProperty: false,
  propertyAddress: "",
  propertyCity: "Malibu",
  matterTitle: "",
  matterType: "other",
  matterNotes: "",
};

function NewEngagementModal({
  clients,
  onClose,
  onCreated,
}: {
  clients: Client[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [state, setState] = useState<ModalState>(DEFAULT_MODAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (patch: Partial<ModalState>) => setState((s) => ({ ...s, ...patch }));

  const canAdvance1 = state.clientMode === "existing"
    ? !!state.selectedClientId
    : !!state.clientName.trim();

  const canAdvance2 = true; // property is optional

  const canSubmit = !!state.matterTitle.trim();

  async function submit() {
    setSaving(true);
    setError("");
    try {
      let clientId = state.selectedClientId;

      // Create client if new
      if (state.clientMode === "new") {
        const res = await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: state.clientName,
            email: state.clientEmail || undefined,
            phone: state.clientPhone || undefined,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const { client } = await res.json();
        clientId = client.id;
      }

      // Create property if provided
      let propertyId: string | undefined;
      if (!state.skipProperty && state.propertyAddress.trim()) {
        const res = await fetch("/api/properties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId,
            address: state.propertyAddress,
            city: state.propertyCity || "Malibu",
            state: "CA",
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const { property } = await res.json();
        propertyId = property.id;
      }

      // Create matter
      const res = await fetch("/api/matters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          propertyId,
          title: state.matterTitle,
          type: state.matterType,
          notes: state.matterNotes || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());

      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full bg-transparent border-b py-2 text-[0.88rem] outline-none focus:border-opacity-100 transition-colors placeholder-opacity-30";
  const inputStyle = { borderColor: "rgba(201,181,138,0.25)", color: CREAM };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-md border p-8 relative"
        style={{ background: CARD, borderColor: "rgba(201,181,138,0.15)" }}>

        {/* Close */}
        <button onClick={onClose} className="absolute top-5 right-5 opacity-40 hover:opacity-100 transition-opacity">
          <X size={16} style={{ color: CREAM }} />
        </button>

        {/* Header */}
        <div className="mb-8">
          <p className="text-[0.62rem] uppercase tracking-[0.34em] mb-2" style={{ color: GOLD, opacity: 0.7 }}>
            Step {state.step} of 3
          </p>
          <div className="flex gap-1 mb-5">
            {([1, 2, 3] as Step[]).map((s) => (
              <div key={s} className="h-px flex-1 transition-all duration-500"
                style={{ background: s <= state.step ? GOLD : "rgba(201,181,138,0.15)" }} />
            ))}
          </div>
          <h2 className="font-heading font-light text-[1.4rem] tracking-[-0.02em]" style={{ color: CREAM }}>
            {state.step === 1 && "Client"}
            {state.step === 2 && "Property"}
            {state.step === 3 && "Engagement"}
          </h2>
          <p className="text-[0.8rem] mt-1" style={{ color: TITAN, opacity: 0.7 }}>
            {state.step === 1 && "Select an existing client or create a new one."}
            {state.step === 2 && "Add a property address, or skip if not applicable."}
            {state.step === 3 && "Define the matter type and initial scope."}
          </p>
        </div>

        {/* Step 1 — Client */}
        {state.step === 1 && (
          <div className="space-y-5">
            <div className="flex gap-3">
              {(["new", "existing"] as const).map((mode) => (
                <button key={mode} onClick={() => set({ clientMode: mode })}
                  className="flex-1 py-2 text-[0.72rem] uppercase tracking-[0.18em] border transition-all"
                  style={{
                    borderColor: state.clientMode === mode ? GOLD : "rgba(201,181,138,0.15)",
                    color: state.clientMode === mode ? GOLD : TITAN,
                    background: state.clientMode === mode ? "rgba(201,181,138,0.06)" : "transparent",
                  }}>
                  {mode === "new" ? "New Client" : "Existing"}
                </button>
              ))}
            </div>

            {state.clientMode === "new" ? (
              <>
                <input className={inputCls} style={inputStyle} placeholder="Full name *"
                  value={state.clientName} onChange={(e) => set({ clientName: e.target.value })} />
                <input className={inputCls} style={inputStyle} placeholder="Email"
                  type="email" value={state.clientEmail} onChange={(e) => set({ clientEmail: e.target.value })} />
                <input className={inputCls} style={inputStyle} placeholder="Phone"
                  type="tel" value={state.clientPhone} onChange={(e) => set({ clientPhone: e.target.value })} />
              </>
            ) : (
              <select className={inputCls} style={inputStyle}
                value={state.selectedClientId}
                onChange={(e) => set({ selectedClientId: e.target.value })}>
                <option value="">Select a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id} style={{ background: CARD }}>{c.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Step 2 — Property */}
        {state.step === 2 && (
          <div className="space-y-5">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={state.skipProperty}
                onChange={(e) => set({ skipProperty: e.target.checked })}
                className="accent-[#c9b58a]" />
              <span className="text-[0.8rem]" style={{ color: TITAN }}>No property address</span>
            </label>
            {!state.skipProperty && (
              <>
                <input className={inputCls} style={inputStyle} placeholder="Street address *"
                  value={state.propertyAddress} onChange={(e) => set({ propertyAddress: e.target.value })} />
                <input className={inputCls} style={inputStyle} placeholder="City"
                  value={state.propertyCity} onChange={(e) => set({ propertyCity: e.target.value })} />
              </>
            )}
          </div>
        )}

        {/* Step 3 — Matter */}
        {state.step === 3 && (
          <div className="space-y-5">
            <input className={inputCls} style={inputStyle} placeholder="Engagement title *"
              value={state.matterTitle} onChange={(e) => set({ matterTitle: e.target.value })} />
            <select className={inputCls} style={inputStyle}
              value={state.matterType}
              onChange={(e) => set({ matterType: e.target.value as MatterType })}>
              <option value="mold" style={{ background: CARD }}>Mold</option>
              <option value="smoke_damage" style={{ background: CARD }}>Smoke Damage</option>
              <option value="asbestos" style={{ background: CARD }}>Asbestos</option>
              <option value="lead_paint" style={{ background: CARD }}>Lead Paint</option>
              <option value="water_intrusion" style={{ background: CARD }}>Water Intrusion</option>
              <option value="transaction_review" style={{ background: CARD }}>Transaction Review</option>
              <option value="other" style={{ background: CARD }}>Other</option>
            </select>
            <textarea className={inputCls} style={inputStyle} placeholder="Initial notes (optional)"
              rows={3} value={state.matterNotes}
              onChange={(e) => set({ matterNotes: e.target.value })} />
          </div>
        )}

        {error && (
          <p className="mt-4 text-[0.78rem]" style={{ color: "#f87171" }}>{error}</p>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          {state.step > 1 ? (
            <button onClick={() => set({ step: (state.step - 1) as Step })}
              className="text-[0.76rem] uppercase tracking-[0.18em] opacity-50 hover:opacity-100 transition-opacity"
              style={{ color: TITAN }}>
              Back
            </button>
          ) : <div />}

          {state.step < 3 ? (
            <button
              disabled={state.step === 1 ? !canAdvance1 : !canAdvance2}
              onClick={() => set({ step: (state.step + 1) as Step })}
              className="flex items-center gap-2 text-[0.82rem] uppercase tracking-[0.2em] disabled:opacity-30 transition-opacity"
              style={{ color: GOLD }}>
              Continue <ChevronRight size={14} />
            </button>
          ) : (
            <button disabled={!canSubmit || saving} onClick={submit}
              className="flex items-center gap-2 text-[0.82rem] uppercase tracking-[0.2em] disabled:opacity-30 transition-opacity"
              style={{ color: GOLD }}>
              {saving ? "Creating…" : "Create engagement"} <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Status inline editor ─────────────────────────────────────────────────────
function StatusEditor({
  matter,
  onUpdated,
}: {
  matter: Matter;
  onUpdated: (id: string, status: MatterStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function change(status: MatterStatus) {
    if (status === matter.status) { setOpen(false); return; }
    setSaving(true);
    await fetch(`/api/matters/${matter.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    onUpdated(matter.id, status);
    setSaving(false);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} disabled={saving}
        className="hover:opacity-80 transition-opacity">
        <StatusPill status={matter.status} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-20 border min-w-[160px] py-1"
          style={{ background: CARD, borderColor: "rgba(201,181,138,0.2)" }}>
          {STATUS_ORDER.map((s) => (
            <button key={s} onClick={() => change(s)}
              className="w-full flex items-center gap-2 px-3 py-2 text-[0.72rem] uppercase tracking-[0.14em] hover:bg-white/5 transition-colors text-left"
              style={{ color: s === matter.status ? GOLD : TITAN }}>
              <span className="size-1.5 rounded-full" style={{ background: STATUS_CONFIG[s].dot }} />
              {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export default function MattersPage() {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<MatterStatus | "all">("all");
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    const [mr, cr] = await Promise.all([
      fetch("/api/matters").then((r) => r.json()),
      fetch("/api/clients").then((r) => r.json()),
    ]);
    setMatters(mr.matters ?? []);
    setClients(cr.clients ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleStatusUpdate(id: string, status: MatterStatus) {
    setMatters((prev) => prev.map((m) => m.id === id ? { ...m, status } : m));
  }

  const filtered = statusFilter === "all"
    ? matters
    : matters.filter((m) => m.status === statusFilter);

  // Stats
  const stats = STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = matters.filter((m) => m.status === s).length;
    return acc;
  }, {});
  const active = matters.filter((m) => m.status !== "closed").length;

  function fmt(date: string) {
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
  }

  return (
    <div className="min-h-screen" style={{ background: BG, color: CREAM }}>
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="px-8 py-5 flex items-center justify-between border-b"
        style={{ borderColor: "rgba(201,181,138,0.1)", background: "rgba(10,11,14,0.9)", backdropFilter: "blur(8px)" }}>
        <div className="flex items-center gap-6">
          <Link href="/portal" className="text-[0.72rem] uppercase tracking-[0.28em] opacity-50 hover:opacity-100 transition-opacity"
            style={{ color: TITAN }}>
            ← Portal
          </Link>
          <span className="text-[0.72rem] uppercase tracking-[0.28em]" style={{ color: GOLD, opacity: 0.6 }}>
            Engagement Dashboard
          </span>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 border px-4 py-2 text-[0.76rem] uppercase tracking-[0.2em] hover:opacity-100 transition-opacity"
          style={{ borderColor: "rgba(201,181,138,0.25)", color: GOLD, opacity: 0.85 }}>
          <Plus size={13} />
          New engagement
        </button>
      </header>

      <div className="px-8 py-10 max-w-7xl mx-auto">

        {/* ── Stats ────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Total engagements", value: matters.length },
            { label: "Active",            value: active, accent: true },
            { label: "In clearance",      value: stats.clearance ?? 0 },
            { label: "Closed",            value: stats.closed ?? 0 },
          ].map(({ label, value, accent }) => (
            <div key={label} className="border p-5"
              style={{ borderColor: "rgba(201,181,138,0.1)", background: CARD }}>
              <p className="font-heading font-light text-[2rem] leading-none mb-1"
                style={{ color: accent ? GOLD : CREAM }}>
                {value}
              </p>
              <p className="text-[0.7rem] uppercase tracking-[0.22em]" style={{ color: TITAN, opacity: 0.55 }}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* ── Filters ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-7">
          {(["all", ...STATUS_ORDER] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="text-[0.68rem] uppercase tracking-[0.18em] px-3 py-1.5 border transition-all"
              style={{
                borderColor: statusFilter === s ? GOLD : "rgba(201,181,138,0.12)",
                color: statusFilter === s ? GOLD : TITAN,
                opacity: statusFilter === s ? 1 : 0.6,
                background: statusFilter === s ? "rgba(201,181,138,0.07)" : "transparent",
              }}>
              {s === "all" ? `All (${matters.length})` : `${STATUS_CONFIG[s].label} (${stats[s] ?? 0})`}
            </button>
          ))}
        </div>

        {/* ── Table ────────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="py-20 text-center text-[0.8rem] uppercase tracking-[0.2em]"
            style={{ color: TITAN, opacity: 0.4 }}>
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center border"
            style={{ borderColor: "rgba(201,181,138,0.08)", background: CARD }}>
            <p className="text-[0.8rem] uppercase tracking-[0.2em] mb-3"
              style={{ color: TITAN, opacity: 0.4 }}>
              No engagements
            </p>
            <button onClick={() => setShowModal(true)}
              className="text-[0.76rem] uppercase tracking-[0.2em] hover:opacity-100 transition-opacity"
              style={{ color: GOLD, opacity: 0.6 }}>
              Create the first one →
            </button>
          </div>
        ) : (
          <div className="border overflow-hidden" style={{ borderColor: "rgba(201,181,138,0.1)" }}>
            {/* Header */}
            <div className="hidden md:grid grid-cols-[2fr_2fr_1.5fr_1.5fr_1fr_0.5fr] px-5 py-3 border-b"
              style={{ borderColor: "rgba(201,181,138,0.08)", background: "rgba(201,181,138,0.03)" }}>
              {["Client", "Property", "Engagement", "Status", "Updated", ""].map((h) => (
                <p key={h} className="text-[0.64rem] uppercase tracking-[0.22em]"
                  style={{ color: TITAN, opacity: 0.45 }}>
                  {h}
                </p>
              ))}
            </div>

            {filtered.map((matter, i) => (
              <div key={matter.id}
                className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1.5fr_1.5fr_1fr_0.5fr] items-center px-5 py-4 border-b hover:bg-white/[0.018] transition-colors gap-3 md:gap-0"
                style={{ borderColor: "rgba(201,181,138,0.07)", background: i % 2 === 0 ? "transparent" : "rgba(13,15,20,0.6)" }}>

                {/* Client */}
                <div>
                  <p className="text-[0.87rem]" style={{ color: CREAM }}>{matter.client_name}</p>
                  {matter.client_email && (
                    <p className="text-[0.72rem] mt-0.5" style={{ color: TITAN, opacity: 0.5 }}>{matter.client_email}</p>
                  )}
                </div>

                {/* Property */}
                <div>
                  {matter.property_address ? (
                    <>
                      <p className="text-[0.82rem]" style={{ color: TITAN, opacity: 0.8 }}>{matter.property_address}</p>
                      <p className="text-[0.72rem] mt-0.5" style={{ color: TITAN, opacity: 0.45 }}>
                        {matter.property_city}, {matter.property_state}
                      </p>
                    </>
                  ) : (
                    <p className="text-[0.72rem]" style={{ color: TITAN, opacity: 0.3 }}>—</p>
                  )}
                </div>

                {/* Engagement */}
                <div>
                  <p className="text-[0.84rem]" style={{ color: CREAM }}>{matter.title}</p>
                  <p className="text-[0.68rem] uppercase tracking-[0.14em] mt-0.5" style={{ color: TITAN, opacity: 0.45 }}>
                    {TYPE_LABELS[matter.type]}
                  </p>
                </div>

                {/* Status */}
                <div>
                  <StatusEditor matter={matter} onUpdated={handleStatusUpdate} />
                </div>

                {/* Date */}
                <div>
                  <p className="text-[0.76rem]" style={{ color: TITAN, opacity: 0.5 }}>{fmt(matter.updated_at)}</p>
                  {matter.document_count > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <FileText size={10} style={{ color: GOLD, opacity: 0.5 }} />
                      <p className="text-[0.66rem]" style={{ color: TITAN, opacity: 0.4 }}>
                        {matter.document_count} doc{matter.document_count !== 1 ? "s" : ""}
                      </p>
                    </div>
                  )}
                </div>

                {/* Link */}
                <div className="flex justify-end">
                  <Link href={`/portal/matters/${matter.id}`}
                    className="opacity-30 hover:opacity-80 transition-opacity">
                    <ArrowRight size={14} style={{ color: CREAM }} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal ────────────────────────────────────────────────────────────── */}
      {showModal && (
        <NewEngagementModal
          clients={clients}
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}
