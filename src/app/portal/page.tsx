"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileText, Folder, Shield } from "lucide-react";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const GOLD  = "#c9b58a";
const CREAM = "#ece6d6";
const TITAN = "#b2a898";
const BG    = "#0a0b0e";
const CARD  = "#0d0f14";

// ─── Types ─────────────────────────────────────────────────────────────────────
type MatterStatus =
  | "intake" | "assessment" | "review"
  | "vendor_evaluation" | "oversight" | "clearance" | "closed";

interface Matter {
  id: string;
  title: string;
  type: string;
  status: MatterStatus;
  client_name?: string;
  property_address?: string;
  property_city?: string;
  document_count: number;
  updated_at: string;
}

interface Document {
  id: string;
  name: string;
  category: string;
  size_bytes: number;
  created_at: string;
}

// ─── Status display ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<MatterStatus, { label: string; dot: string }> = {
  intake:            { label: "Intake",            dot: "#8a8070" },
  assessment:        { label: "Assessment",        dot: "#f59e0b" },
  review:            { label: "Review",            dot: "#c9b58a" },
  vendor_evaluation: { label: "Vendor Evaluation", dot: "#f97316" },
  oversight:         { label: "Oversight",         dot: "#8b5cf6" },
  clearance:         { label: "Clearance",         dot: "#4ade80" },
  closed:            { label: "Closed",            dot: "#64748b" },
};

function StatusDot({ status }: { status: MatterStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, dot: TITAN };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-1.5 rounded-full" style={{ background: cfg.dot }} />
      <span className="text-[0.7rem] uppercase tracking-[0.18em]" style={{ color: cfg.dot }}>
        {cfg.label}
      </span>
    </span>
  );
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "2-digit",
  });
}

// ─── Main ───────────────────────────────────────────────────────────────────────
export default function PortalPage() {
  const [matters, setMatters]   = useState<Matter[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [mr, dr] = await Promise.all([
          fetch("/api/matters").then((r) => r.json()),
          fetch("/api/vault/documents").then((r) => r.json()),
        ]);
        setMatters(mr.matters ?? []);
        setDocuments(dr.documents ?? []);
      } catch {
        setError("Failed to load your workspace. Please refresh.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const activeMatters = matters.filter((m) => m.status !== "closed");
  const recentMatter  = matters[0] ?? null; // API returns most recent first
  const recentDocs    = documents.slice(0, 4);

  return (
    <div className="min-h-screen" style={{ background: BG, color: CREAM }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header
        className="px-8 py-5 flex items-center justify-between border-b"
        style={{
          borderColor: "rgba(201,181,138,0.1)",
          background: "rgba(10,11,14,0.9)",
          backdropFilter: "blur(8px)",
        }}
      >
        <span
          className="text-[0.72rem] uppercase tracking-[0.28em]"
          style={{ color: GOLD, opacity: 0.8 }}
        >
          Private Office
        </span>
        <nav className="flex items-center gap-5">
          <Link
            href="/portal/matters"
            className="text-[0.68rem] uppercase tracking-[0.18em] opacity-40 hover:opacity-80 transition-opacity"
            style={{ color: TITAN }}
          >
            Engagements
          </Link>
          <Link
            href="/portal/vault"
            className="text-[0.68rem] uppercase tracking-[0.18em] opacity-40 hover:opacity-80 transition-opacity"
            style={{ color: TITAN }}
          >
            Vault
          </Link>
          <Link
            href="/portal/admin"
            className="flex items-center gap-1 text-[0.68rem] uppercase tracking-[0.16em] opacity-30 hover:opacity-60 transition-opacity"
            style={{ color: TITAN }}
          >
            <Shield size={10} />
            Admin
          </Link>
        </nav>
      </header>

      <div className="px-8 py-12 max-w-5xl mx-auto">

        {loading ? (
          <div
            className="py-32 text-center text-[0.8rem] uppercase tracking-[0.22em]"
            style={{ color: TITAN, opacity: 0.35 }}
          >
            Loading…
          </div>
        ) : error ? (
          <div
            className="py-32 text-center text-[0.8rem]"
            style={{ color: "#f87171" }}
          >
            {error}
          </div>
        ) : (
          <>
            {/* ── Summary stats ─────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-4 mb-12">
              {[
                {
                  label: "Active engagements",
                  value: activeMatters.length,
                  accent: activeMatters.length > 0,
                  href: "/portal/matters",
                },
                {
                  label: "Documents in vault",
                  value: documents.length,
                  accent: false,
                  href: "/portal/vault",
                },
                {
                  label: "Total engagements",
                  value: matters.length,
                  accent: false,
                  href: "/portal/matters",
                },
              ].map(({ label, value, accent, href }) => (
                <Link
                  key={label}
                  href={href}
                  className="block border p-6 hover:opacity-80 transition-opacity"
                  style={{ borderColor: "rgba(201,181,138,0.1)", background: CARD }}
                >
                  <p
                    className="font-heading font-light text-[2.4rem] leading-none mb-1"
                    style={{ color: accent ? GOLD : CREAM }}
                  >
                    {value}
                  </p>
                  <p
                    className="text-[0.68rem] uppercase tracking-[0.22em]"
                    style={{ color: TITAN, opacity: 0.5 }}
                  >
                    {label}
                  </p>
                </Link>
              ))}
            </div>

            {/* ── Empty state ────────────────────────────────────────────── */}
            {matters.length === 0 && (
              <div
                className="border p-12 text-center mb-10"
                style={{ borderColor: "rgba(201,181,138,0.08)", background: CARD }}
              >
                <Folder
                  size={28}
                  className="mx-auto mb-4 opacity-20"
                  style={{ color: GOLD }}
                />
                <p
                  className="text-[0.84rem] mb-2"
                  style={{ color: CREAM, opacity: 0.6 }}
                >
                  No engagements yet.
                </p>
                <p
                  className="text-[0.76rem]"
                  style={{ color: TITAN, opacity: 0.4 }}
                >
                  Your advisor will open your first engagement here.
                </p>
              </div>
            )}

            {/* ── Active engagement ──────────────────────────────────────── */}
            {recentMatter && (
              <div className="mb-10">
                <p
                  className="text-[0.62rem] uppercase tracking-[0.34em] mb-4"
                  style={{ color: GOLD, opacity: 0.6 }}
                >
                  Most recent engagement
                </p>
                <Link
                  href={`/portal/matters/${recentMatter.id}`}
                  className="block border p-6 hover:opacity-80 transition-opacity group"
                  style={{ borderColor: "rgba(201,181,138,0.12)", background: CARD }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[1rem] font-light mb-1 truncate"
                        style={{ color: CREAM }}
                      >
                        {recentMatter.title}
                      </p>
                      {recentMatter.property_address && (
                        <p
                          className="text-[0.76rem] mb-3 truncate"
                          style={{ color: TITAN, opacity: 0.55 }}
                        >
                          {recentMatter.property_address}, {recentMatter.property_city}
                        </p>
                      )}
                      <StatusDot status={recentMatter.status} />
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className="text-[0.7rem] mb-1"
                        style={{ color: TITAN, opacity: 0.4 }}
                      >
                        Updated {fmt(recentMatter.updated_at)}
                      </p>
                      {recentMatter.document_count > 0 && (
                        <div className="flex items-center justify-end gap-1">
                          <FileText
                            size={10}
                            style={{ color: GOLD, opacity: 0.5 }}
                          />
                          <p
                            className="text-[0.68rem]"
                            style={{ color: TITAN, opacity: 0.4 }}
                          >
                            {recentMatter.document_count} doc
                            {recentMatter.document_count !== 1 ? "s" : ""}
                          </p>
                        </div>
                      )}
                      <ArrowRight
                        size={14}
                        className="mt-2 ml-auto opacity-20 group-hover:opacity-60 transition-opacity"
                        style={{ color: CREAM }}
                      />
                    </div>
                  </div>
                </Link>

                {matters.length > 1 && (
                  <Link
                    href="/portal/matters"
                    className="mt-3 flex items-center gap-1.5 text-[0.72rem] uppercase tracking-[0.2em] opacity-40 hover:opacity-80 transition-opacity"
                    style={{ color: GOLD }}
                  >
                    View all {matters.length} engagements <ArrowRight size={11} />
                  </Link>
                )}
              </div>
            )}

            {/* ── Recent documents ───────────────────────────────────────── */}
            {recentDocs.length > 0 && (
              <div>
                <p
                  className="text-[0.62rem] uppercase tracking-[0.34em] mb-4"
                  style={{ color: GOLD, opacity: 0.6 }}
                >
                  Recent documents
                </p>
                <div
                  className="border overflow-hidden"
                  style={{ borderColor: "rgba(201,181,138,0.1)" }}
                >
                  {recentDocs.map((doc, i) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-4 px-5 py-3.5 border-b last:border-b-0"
                      style={{
                        borderColor: "rgba(201,181,138,0.07)",
                        background: i % 2 === 0 ? CARD : "transparent",
                      }}
                    >
                      <FileText
                        size={13}
                        style={{ color: GOLD, opacity: 0.45 }}
                        className="shrink-0"
                      />
                      <p
                        className="flex-1 text-[0.82rem] truncate"
                        style={{ color: CREAM, opacity: 0.8 }}
                      >
                        {doc.name}
                      </p>
                      <p
                        className="text-[0.68rem] shrink-0"
                        style={{ color: TITAN, opacity: 0.35 }}
                      >
                        {fmt(doc.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
                {documents.length > 4 && (
                  <Link
                    href="/portal/vault"
                    className="mt-3 flex items-center gap-1.5 text-[0.72rem] uppercase tracking-[0.2em] opacity-40 hover:opacity-80 transition-opacity"
                    style={{ color: GOLD }}
                  >
                    View all {documents.length} documents <ArrowRight size={11} />
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
