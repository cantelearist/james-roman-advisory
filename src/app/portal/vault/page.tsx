"use client";

import {
  Archive,
  Download,
  Eye,
  File,
  FileClock,
  FileText,
  Filter,
  FolderOpen,
  History,
  MoreHorizontal,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { usePortalAccess } from "@/components/portal/access-provider";
import { EmptyState, PageHeader } from "@/components/portal/portal-ui";

type DocumentRecord = {
  id: string;
  name: string;
  original_name: string;
  category: string;
  size_bytes: number;
  content_type: string;
  matter_id: string | null;
  visibility?: "internal" | "contractor" | "client";
  publication_status?: "pending_review" | "published";
  archived_at?: string | null;
  created_at: string;
};
type DocumentVersion = {
  id: string; version_number: number; original_name: string; size_bytes: number;
  content_type: string; uploaded_by_name?: string | null; created_at: string;
};
type AccessEvent = {
  id: string; event_type: string; actor_name?: string | null; user_id: string; created_at: string;
};

type Matter = { id: string; title: string; client_name?: string };

const CATEGORIES = [
  "lab_report", "inspection_report", "remediation_plan", "contractor_proposal",
  "insurance", "photo", "permit", "correspondence", "other",
];

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DocumentsPage() {
  const { can, access } = usePortalAccess();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [matterId, setMatterId] = useState("");
  const [publication, setPublication] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "name">("newest");
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<DocumentRecord | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [accessEvents, setAccessEvents] = useState<AccessEvent[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [deleting, setDeleting] = useState<DocumentRecord | null>(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [documentResponse, matterResponse] = await Promise.all([
        fetch(`/api/vault/documents${showArchived ? "?archived=1" : ""}`, { cache: "no-store" }),
        fetch("/api/matters?limit=250", { cache: "no-store" }),
      ]);
      const [documentData, matterData] = await Promise.all([documentResponse.json(), matterResponse.json()]);
      if (!documentResponse.ok) throw new Error(documentData.error ?? "Documents could not be loaded.");
      setDocuments(documentData.documents ?? []);
      if (matterResponse.ok) setMatters(matterData.matters ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Documents could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timeout);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // preview URL is revoked when the component unmounts or a new preview opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const matterMap = useMemo(() => new Map(matters.map((matter) => [matter.id, matter])), [matters]);
  const visible = useMemo(() => documents.filter((document) => {
    if (query && !`${document.name} ${document.original_name}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (category && document.category !== category) return false;
    if (matterId && document.matter_id !== matterId) return false;
    if (publication && document.publication_status !== publication) return false;
    return true;
  }).sort((a, b) => sort === "name"
    ? a.name.localeCompare(b.name)
    : sort === "oldest"
      ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [category, documents, matterId, publication, query, sort]);

  async function openDetails(document: DocumentRecord) {
    setDetails(document);
    setVersions([]);
    setAccessEvents([]);
    const response = await fetch(`/api/vault/documents/${document.id}/versions`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setVersions(data.versions ?? []);
    setAccessEvents(data.accessEvents ?? []);
  }

  async function fetchDocument(document: DocumentRecord, preview = false) {
    setBusy(document.id);
    setError("");
    try {
      const response = await fetch(`/api/vault/documents/${document.id}`);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Document could not be opened.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (preview) {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(url);
        await openDetails(document);
      } else {
        const anchor = window.document.createElement("a");
        anchor.href = url;
        anchor.download = document.original_name || document.name;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      }
    } catch (documentError) {
      setError(documentError instanceof Error ? documentError.message : "Document could not be opened.");
    } finally {
      setBusy("");
    }
  }

  async function updateDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!details) return;
    const form = new FormData(event.currentTarget);
    setBusy(details.id);
    const response = await fetch(`/api/vault/documents/${details.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        visibility: form.get("visibility"),
        publicationStatus: form.get("publicationStatus"),
      }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "Document controls could not be updated.");
    else {
      setDocuments((rows) => rows.map((row) => row.id === details.id ? { ...row, ...data.document } : row));
      setDetails((current) => current ? { ...current, ...data.document } : current);
      setSuccess("Document record updated.");
    }
    setBusy("");
  }

  async function uploadVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!details) return;
    setBusy(`version-${details.id}`);
    const response = await fetch(`/api/vault/documents/${details.id}/versions`, {
      method: "POST",
      body: new FormData(event.currentTarget),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "The new version could not be uploaded.");
    else {
      setVersions((rows) => [data.version, ...rows]);
      setSuccess(`Version ${data.version.version_number} uploaded and recorded.`);
      await load();
    }
    setBusy("");
  }

  async function setArchived(document: DocumentRecord, archived: boolean) {
    setBusy(document.id);
    const response = await fetch(`/api/vault/documents/${document.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "Document archive state could not be updated.");
    else {
      setDetails(null);
      setSuccess(archived ? "Document archived." : "Document restored.");
      await load();
    }
    setBusy("");
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("upload");
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/vault/upload", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "The document could not be uploaded.");
    else {
      setShowUpload(false);
      setSuccess("Document uploaded and recorded.");
      await load();
    }
    setBusy("");
  }

  async function removeDocument() {
    if (!deleting) return;
    setBusy(deleting.id);
    const response = await fetch(`/api/vault/documents/${deleting.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "The document could not be deleted.");
    else {
      setDocuments((rows) => rows.filter((row) => row.id !== deleting.id));
      setDeleting(null);
      setDetails(null);
      setSuccess("Document permanently deleted.");
    }
    setBusy("");
  }

  async function bulkDownload() {
    for (const document of documents.filter((item) => selected.has(item.id))) {
      await fetchDocument(document);
    }
    setSelected(new Set());
  }

  return (
    <div className="portal-page">
      <PageHeader
        eyebrow="Secure record"
        title="Documents"
        description={access.role === "client"
          ? "View and share permitted documents for your engagement."
          : access.role === "contractor"
            ? "Upload and retrieve permitted documents for your assigned engagements."
            : "Review, publish and retrieve engagement files through the authenticated vault."}
        actions={
          <>
            <button className="portal-secondary-button" onClick={load}><RefreshCw size={14} />Refresh</button>
            {can("documents.upload") && <button className="portal-primary-button" onClick={() => setShowUpload(true)}><Upload size={15} />Upload document</button>}
          </>
        }
      />

      <section className="portal-document-summary">
        <div><FileText size={17} /><span><strong>{documents.length}</strong>Total files</span></div>
        {can("documents.publish") && <div className={documents.some((document) => document.publication_status === "pending_review") ? "is-warning" : undefined}><FileClock size={17} /><span><strong>{documents.filter((document) => document.publication_status === "pending_review").length}</strong>Awaiting review</span></div>}
        <div><ShieldCheck size={17} /><span><strong>{documents.filter((document) => document.visibility === "client" || document.visibility === undefined).length}</strong>Client visible</span></div>
      </section>

      <div className="portal-board-toolbar">
        <label className="portal-board-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search document names" /></label>
        <button className="portal-toolbar-button"><Filter size={14} />Filters</button>
        {selected.size > 0 && <div className="portal-bulk-actions"><strong>{selected.size} selected</strong><button onClick={bulkDownload}><Download size={12} />Download</button><button onClick={() => setSelected(new Set())}><X size={12} />Clear</button></div>}
      </div>

      <div className="portal-filter-bar portal-document-filters">
        <label><span>Engagement</span><select value={matterId} onChange={(event) => setMatterId(event.target.value)}><option value="">All engagements</option>{matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.title}</option>)}</select></label>
        <label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{CATEGORIES.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label>
        {can("documents.publish") && <label><span>Publication</span><select value={publication} onChange={(event) => setPublication(event.target.value)}><option value="">All states</option><option value="pending_review">Pending review</option><option value="published">Published</option></select></label>}
        {can("documents.publish") && <label className="portal-check-field"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />Include archived</label>}
        <label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="name">Name</option></select></label>
        <button onClick={() => { setMatterId(""); setCategory(""); setPublication(""); setQuery(""); }}>Clear filters</button>
      </div>

      {error && <div className="portal-inline-error" role="alert"><span>{error}</span><button onClick={() => setError("")}><X size={14} /></button></div>}
      {success && <div className="portal-inline-success" role="status"><span>{success}</span><button onClick={() => setSuccess("")}><X size={14} /></button></div>}

      <section className="portal-card portal-document-table-wrap">
        {loading ? (
          <div className="portal-board-loading">{Array.from({ length: 8 }, (_, index) => <span key={index} />)}</div>
        ) : visible.length === 0 ? (
          <EmptyState icon={FolderOpen} title="No documents match this view" description={documents.length ? "Adjust or clear the current filters." : "Uploaded engagement documents will appear here."} />
        ) : (
          <div className="portal-document-table">
            <div className="portal-document-row portal-document-header">
              <span><input type="checkbox" aria-label="Select all documents" checked={selected.size === visible.length} onChange={(event) => setSelected(event.target.checked ? new Set(visible.map((document) => document.id)) : new Set())} /></span>
              <span>Document</span><span>Engagement</span><span>Category</span><span>Audience</span><span>Status</span><span>Uploaded</span><span />
            </div>
            {visible.map((document) => (
              <div className="portal-document-row" key={document.id}>
                <span><input type="checkbox" aria-label={`Select ${document.name}`} checked={selected.has(document.id)} onChange={(event) => setSelected((current) => {
                  const next = new Set(current); if (event.target.checked) next.add(document.id); else next.delete(document.id); return next;
                })} /></span>
                <button className="portal-document-name" onClick={() => fetchDocument(document, true)}><span><File size={15} /></span><div><strong>{document.name}</strong><small>{formatBytes(document.size_bytes)} · {document.original_name}</small></div></button>
                <span>{document.matter_id ? matterMap.get(document.matter_id)?.title || "Engagement" : "Unassigned"}</span>
                <span>{document.category.replaceAll("_", " ")}</span>
                <span className={`portal-audience portal-audience-${document.visibility}`}>{document.visibility || "permitted"}</span>
                <span className={`portal-publication portal-publication-${document.archived_at ? "archived" : document.publication_status}`}>{document.archived_at ? "archived" : document.publication_status?.replace("_", " ") || "available"}</span>
                <time>{formatDate(document.created_at)}</time>
                <span className="portal-document-actions"><button className="portal-icon-button" onClick={() => fetchDocument(document, true)} disabled={busy === document.id} aria-label={`Preview ${document.name}`}><Eye size={14} /></button><button className="portal-icon-button" onClick={() => fetchDocument(document)} disabled={busy === document.id} aria-label={`Download ${document.name}`}><Download size={14} /></button><button className="portal-icon-button" onClick={() => openDetails(document)} aria-label={`Details for ${document.name}`}><MoreHorizontal size={14} /></button></span>
              </div>
            ))}
          </div>
        )}
      </section>

      {details && (
        <div className="portal-drawer-overlay" role="dialog" aria-modal="true" aria-labelledby="document-details-title">
          <button className="portal-command-scrim" onClick={() => { setDetails(null); if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(""); } }} aria-label="Close details" />
          <aside className="portal-drawer portal-document-drawer">
            <header><div><p className="portal-eyebrow">Document record</p><h2 id="document-details-title">{details.name}</h2></div><button className="portal-icon-button" onClick={() => { setDetails(null); if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(""); } }}><X size={18} /></button></header>
            {previewUrl ? (
              <div className="portal-document-preview">
                {details.content_type === "application/pdf" || details.content_type?.startsWith("image/")
                  ? <iframe src={previewUrl} title={`Preview ${details.name}`} />
                  : <EmptyState icon={FileText} title="Preview unavailable" description="Download this file to open it in its native application." />}
              </div>
            ) : <button className="portal-preview-trigger" onClick={() => fetchDocument(details, true)}><Eye size={16} />Load secure preview</button>}
            <dl className="portal-document-metadata">
              <div><dt>Original name</dt><dd>{details.original_name}</dd></div>
              <div><dt>Engagement</dt><dd>{details.matter_id ? matterMap.get(details.matter_id)?.title || "Engagement" : "Unassigned"}</dd></div>
              <div><dt>Category</dt><dd>{details.category.replaceAll("_", " ")}</dd></div>
              <div><dt>Size</dt><dd>{formatBytes(details.size_bytes)}</dd></div>
              <div><dt>Uploaded</dt><dd>{formatDate(details.created_at)}</dd></div>
            </dl>
            {can("documents.publish") && (
              <form onSubmit={updateDocument}>
                <label className="portal-field"><span>Display name</span><input name="name" defaultValue={details.name} required maxLength={240} /></label>
                <label className="portal-field"><span>Audience</span><select name="visibility" defaultValue={details.visibility || "internal"}><option value="internal">Internal only</option><option value="contractor">Contractor</option><option value="client">Client</option></select></label>
                <label className="portal-field"><span>Publication</span><select name="publicationStatus" defaultValue={details.publication_status || "published"}><option value="pending_review">Pending review</option><option value="published">Published</option></select></label>
                <footer><button type="button" className="portal-secondary-button" onClick={() => fetchDocument(details)}><Download size={14} />Download</button><button className="portal-primary-button" disabled={busy === details.id}>Save controls</button></footer>
              </form>
            )}
            <section className="portal-document-versions">
              <header><div><p className="portal-eyebrow">Version history</p><h3>{versions.length || 1} recorded version{versions.length === 1 ? "" : "s"}</h3></div><History size={15} /></header>
              {can("documents.upload") && !details.archived_at && <form onSubmit={uploadVersion}><label className="portal-upload-version"><Upload size={14} /><span>Upload new version</span><input type="file" name="file" required /></label><button className="portal-secondary-button" disabled={busy === `version-${details.id}`}>{busy === `version-${details.id}` ? "Uploading…" : "Add version"}</button></form>}
              <div>{versions.map((version) => <article key={version.id}><span>v{version.version_number}</span><div><strong>{version.original_name}</strong><small>{formatBytes(Number(version.size_bytes))} · {version.uploaded_by_name || "Authorized user"}</small></div><time>{formatDate(version.created_at)}</time></article>)}</div>
            </section>
            {accessEvents.length > 0 && <section className="portal-document-access-history"><header><p className="portal-eyebrow">Access history</p><h3>Recent activity</h3></header>{accessEvents.slice(0, 8).map((event) => <div key={event.id}><span>{event.event_type}</span><strong>{event.actor_name || "Authorized user"}</strong><time>{formatDate(event.created_at)}</time></div>)}</section>}
            {can("documents.publish") && <button className="portal-secondary-button" onClick={() => setArchived(details, !details.archived_at)}><Archive size={14} />{details.archived_at ? "Restore document" : "Archive document"}</button>}
            {can("documents.delete") && <button className="portal-danger-button" onClick={() => setDeleting(details)}><Trash2 size={14} />Permanently delete document</button>}
          </aside>
        </div>
      )}

      {showUpload && (
        <div className="portal-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="upload-document-title">
          <button className="portal-command-scrim" onClick={() => setShowUpload(false)} aria-label="Close upload" />
          <section className="portal-dialog">
            <header><div><p className="portal-eyebrow">Secure vault</p><h2 id="upload-document-title">Upload document</h2></div><button className="portal-icon-button" onClick={() => setShowUpload(false)}><X size={18} /></button></header>
            <form onSubmit={upload}>
              <label className="portal-upload-drop"><Upload size={22} /><strong>Select document</strong><span>PDF, images, Word or spreadsheet · 50 MB maximum</span><input type="file" name="file" required /></label>
              <div className="portal-form-grid">
                <label className="portal-field portal-field-wide"><span>Display name</span><input name="name" placeholder="Defaults to the original file name" /></label>
                <label className="portal-field"><span>Engagement</span><select name="matter_id" required defaultValue={matterId}><option value="" disabled>Select engagement</option>{matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.title}</option>)}</select></label>
                <label className="portal-field"><span>Category</span><select name="category" defaultValue="other">{CATEGORIES.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label>
                {can("documents.publish") && <label className="portal-field"><span>Audience</span><select name="visibility" defaultValue="internal"><option value="internal">Internal only</option><option value="contractor">Contractor</option><option value="client">Client</option></select></label>}
              </div>
              <footer><button type="button" className="portal-secondary-button" onClick={() => setShowUpload(false)}>Cancel</button><button className="portal-primary-button" disabled={busy === "upload"}>{busy === "upload" ? "Uploading…" : "Upload document"}</button></footer>
            </form>
          </section>
        </div>
      )}

      {deleting && (
        <div className="portal-dialog-overlay" role="alertdialog" aria-modal="true" aria-labelledby="delete-document-title">
          <button className="portal-command-scrim" onClick={() => setDeleting(null)} aria-label="Close confirmation" />
          <section className="portal-dialog portal-save-dialog">
            <header><div><p className="portal-eyebrow">Permanent action</p><h2 id="delete-document-title">Delete document?</h2></div><button className="portal-icon-button" onClick={() => setDeleting(null)}><X size={18} /></button></header>
            <form onSubmit={(event) => { event.preventDefault(); void removeDocument(); }}><p className="portal-dialog-copy">This removes “{deleting.name}” from storage and the engagement record. This action cannot be undone.</p><footer><button type="button" className="portal-secondary-button" onClick={() => setDeleting(null)}>Cancel</button><button className="portal-danger-button" disabled={busy === deleting.id}><Trash2 size={14} />Delete permanently</button></footer></form>
          </section>
        </div>
      )}
    </div>
  );
}
