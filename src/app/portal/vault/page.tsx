"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  File,
  FileImage,
  FileLock2,
  FileSpreadsheet,
  FileText,
  ReceiptText,
  Shield,
  Upload,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/brand-logo";
import { Progress } from "@/components/ui/progress";

// ─── Types ───────────────────────────────────────────────────────────────────

type DocCategory =
  | "lab_report"
  | "inspection_report"
  | "remediation_plan"
  | "contractor_proposal"
  | "insurance"
  | "photo"
  | "permit"
  | "correspondence"
  | "other";

interface VaultDocument {
  id: string;
  name: string;
  original_name: string;
  category: DocCategory;
  size_bytes: number;
  content_type: string;
  matter_id: string | null;
  created_at: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<DocCategory, string> = {
  lab_report: "Lab Report",
  inspection_report: "Inspection Report",
  remediation_plan: "Remediation Plan",
  contractor_proposal: "Contractor Proposal",
  insurance: "Insurance",
  photo: "Photo",
  permit: "Permit",
  correspondence: "Correspondence",
  other: "Other",
};

const CATEGORY_OPTIONS: { value: DocCategory; label: string }[] = Object.entries(
  CATEGORY_LABELS
).map(([value, label]) => ({ value: value as DocCategory, label }));

function categoryIcon(category: DocCategory) {
  if (category === "photo") return FileImage;
  if (category === "lab_report" || category === "inspection_report") return FileText;
  if (category === "contractor_proposal" || category === "insurance") return ReceiptText;
  if (category === "correspondence") return File;
  if (
    category === "remediation_plan" ||
    category === "permit"
  )
    return FileSpreadsheet;
  return FileLock2;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function VaultPage() {
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<DocCategory | "all">("all");

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadCategory, setUploadCategory] = useState<DocCategory>("other");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Download state
  const [downloading, setDownloading] = useState<string | null>(null);

  // ─── Fetch documents ───────────────────────────────────────────────────

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/vault/documents");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setDocuments(data.documents ?? []);
    } catch {
      // silently handle — no docs shown
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // ─── Upload ────────────────────────────────────────────────────────────

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      setUploadError(null);
      setUploadSuccess(null);
      setUploadProgress(10);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", uploadCategory);

        setUploadProgress(40);
        const res = await fetch("/api/vault/upload", {
          method: "POST",
          body: formData,
        });
        setUploadProgress(80);

        const data = await res.json();
        if (!res.ok) {
          setUploadError(data.error ?? "Upload failed");
          return;
        }

        setUploadProgress(100);
        setUploadSuccess(`"${file.name}" uploaded successfully.`);
        await fetchDocuments();
      } catch {
        setUploadError("Upload failed. Please try again.");
      } finally {
        setUploading(false);
        setTimeout(() => setUploadProgress(0), 1200);
      }
    },
    [uploadCategory, fetchDocuments]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
      e.target.value = "";
    },
    [uploadFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  // ─── Download ──────────────────────────────────────────────────────────

  const downloadDocument = useCallback(async (doc: VaultDocument) => {
    setDownloading(doc.id);
    try {
      const res = await fetch(`/api/vault/documents/${doc.id}`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.original_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // TODO: show error toast
    } finally {
      setDownloading(null);
    }
  }, []);

  // ─── Filter ────────────────────────────────────────────────────────────

  const filtered =
    filterCategory === "all"
      ? documents
      : documents.filter((d) => d.category === filterCategory);

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="James Roman Advisory home">
            <BrandLogo priority className="h-9" />
          </Link>
          <div className="flex items-center gap-4">
            <Badge
              variant="secondary"
              className="hidden gap-1.5 text-[0.6rem] uppercase tracking-widest sm:flex"
            >
              <Shield className="size-3" />
              Secure vault
            </Badge>
            <Link
              href="/portal"
              className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Portal
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-10 border-b border-primary/15 pb-6">
          <p className="mb-2 text-[0.64rem] uppercase tracking-[0.28em] text-muted-foreground">
            Secure file room
          </p>
          <h1 className="font-heading text-3xl font-semibold sm:text-4xl">
            Document Vault
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            All uploads are encrypted in transit. Access is logged. Documents are visible only to
            you and your assigned advisor.
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          {/* Left — document list */}
          <div>
            {/* Category filter */}
            <div className="mb-6 flex flex-wrap gap-2">
              <button
                onClick={() => setFilterCategory("all")}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  filterCategory === "all"
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/30"
                }`}
              >
                All ({documents.length})
              </button>
              {CATEGORY_OPTIONS.filter((c) =>
                documents.some((d) => d.category === c.value)
              ).map((c) => (
                <button
                  key={c.value}
                  onClick={() => setFilterCategory(c.value)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    filterCategory === c.value
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {c.label} ({documents.filter((d) => d.category === c.value).length})
                </button>
              ))}
            </div>

            {/* Document rows */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-sm border border-primary/10 bg-card"
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-primary/20 py-16 text-center">
                <FileLock2 className="mb-3 size-8 text-primary/30" />
                <p className="text-sm font-medium text-foreground/60">No documents yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Upload your first file using the panel on the right.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((doc) => {
                  const Icon = categoryIcon(doc.category);
                  return (
                    <div
                      key={doc.id}
                      className="group flex items-center gap-4 rounded-sm border border-primary/10 bg-card px-4 py-3 transition-colors hover:border-primary/25"
                    >
                      <Icon className="size-5 shrink-0 text-primary/50" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{doc.name}</p>
                        <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                          {CATEGORY_LABELS[doc.category]} ·{" "}
                          {formatBytes(doc.size_bytes)} ·{" "}
                          {formatDate(doc.created_at)}
                        </p>
                      </div>
                      <button
                        onClick={() => downloadDocument(doc)}
                        disabled={downloading === doc.id}
                        aria-label={`Download ${doc.name}`}
                        className="shrink-0 rounded p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-primary/10 hover:text-foreground group-hover:opacity-100 disabled:opacity-40"
                      >
                        <Download className="size-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right — upload panel */}
          <div className="space-y-5">
            <div className="rounded-sm border border-primary/15 bg-card p-5">
              <p className="mb-4 text-[0.64rem] uppercase tracking-[0.28em] text-muted-foreground">
                Upload document
              </p>

              {/* Category selector */}
              <div className="mb-4">
                <label
                  htmlFor="category"
                  className="mb-1.5 block text-xs text-muted-foreground"
                >
                  Category
                </label>
                <select
                  id="category"
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as DocCategory)}
                  className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Drop zone */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                disabled={uploading}
                className={`flex w-full flex-col items-center justify-center gap-2 rounded-sm border border-dashed py-10 text-center transition-colors ${
                  dragOver
                    ? "border-primary/60 bg-primary/5"
                    : "border-primary/20 hover:border-primary/40"
                } disabled:opacity-50`}
              >
                <Upload className="size-6 text-primary/50" />
                <p className="text-xs text-muted-foreground">
                  {uploading ? "Uploading…" : "Click to browse or drag a file here"}
                </p>
                <p className="text-[0.6rem] text-muted-foreground/60">
                  PDF, Word, Excel, images, text · max 50 MB
                </p>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.heic,.txt,.csv"
                onChange={handleFileChange}
                disabled={uploading}
              />

              {/* Upload progress */}
              {uploading && uploadProgress > 0 && (
                <div className="mt-3">
                  <Progress value={uploadProgress} className="h-1" />
                </div>
              )}

              {/* Feedback */}
              {uploadError && (
                <div className="mt-3 flex items-start gap-2 rounded-sm bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <X className="mt-0.5 size-3.5 shrink-0" />
                  {uploadError}
                </div>
              )}
              {uploadSuccess && (
                <div className="mt-3 rounded-sm bg-green-500/10 px-3 py-2 text-xs text-green-600 dark:text-green-400">
                  {uploadSuccess}
                </div>
              )}
            </div>

            {/* Info card */}
            <div className="rounded-sm border border-primary/10 bg-card/50 p-4">
              <div className="space-y-2 text-[0.65rem] leading-relaxed text-muted-foreground">
                <p className="flex items-center gap-1.5">
                  <Shield className="size-3 shrink-0 text-primary/50" />
                  Encrypted in transit via TLS
                </p>
                <p className="flex items-center gap-1.5">
                  <Shield className="size-3 shrink-0 text-primary/50" />
                  Every access is logged with timestamp
                </p>
                <p className="flex items-center gap-1.5">
                  <Shield className="size-3 shrink-0 text-primary/50" />
                  Visible only to you and your advisor
                </p>
                <p className="flex items-center gap-1.5">
                  <Shield className="size-3 shrink-0 text-primary/50" />
                  No third-party sharing without consent
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
