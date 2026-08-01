"use client";

import { Download, FileClock, Info, Paperclip, X } from "lucide-react";
import { useState } from "react";

export type MessageAttachmentRecord = {
  id: string;
  name: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
};

type Version = {
  id: string;
  version_number: number;
  original_name: string;
  size_bytes: number;
  content_type: string;
  created_at: string;
  uploaded_by_name?: string | null;
};

type Metadata = {
  attachment: MessageAttachmentRecord & {
    uploaded_by_name?: string | null;
    audience: string;
  };
  versions: Version[];
  accessEvents: Array<{
    id: string;
    event_type: string;
    created_at: string;
    actor_name?: string | null;
  }>;
};

function fileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function dateTime(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MessageAttachment({ attachment }: { attachment: MessageAttachmentRecord }) {
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function download(versionId?: string, filename = attachment.original_name || attachment.name) {
    setError("");
    const params = versionId ? `?versionId=${encodeURIComponent(versionId)}` : "";
    const response = await fetch(`/api/messages/attachments/${attachment.id}${params}`);
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setError(result?.error ?? "The attachment could not be downloaded.");
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function openDetails() {
    setDetailsOpen(true);
    if (metadata) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/messages/attachments/${attachment.id}/metadata`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Attachment details could not be loaded.");
      setMetadata(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Attachment details could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="portal-message-attachment-row">
        <button type="button" onClick={() => void download()}>
          <Paperclip size={13} />
          <span>{attachment.name}</span>
          <small>{fileSize(attachment.size_bytes)}</small>
          <Download size={13} />
        </button>
        <button type="button" className="portal-attachment-info" onClick={() => void openDetails()} aria-label={`Details for ${attachment.name}`}>
          <Info size={14} />
        </button>
      </div>
      {detailsOpen && (
        <div className="portal-dialog-overlay" role="dialog" aria-modal="true" aria-label={`Attachment details for ${attachment.name}`}>
          <button className="portal-dialog-scrim" onClick={() => setDetailsOpen(false)} aria-label="Close attachment details" />
          <section className="portal-dialog portal-attachment-dialog">
            <header>
              <div><p className="portal-eyebrow">Correspondence file</p><h2>{attachment.name}</h2></div>
              <button className="portal-icon-button" onClick={() => setDetailsOpen(false)} aria-label="Close"><X size={16} /></button>
            </header>
            <div className="portal-attachment-dialog-body">
              {loading ? <div className="portal-attachment-loading">Loading file history…</div> : error && !metadata ? (
                <div className="portal-inline-error" role="alert">{error}</div>
              ) : metadata && (
                <>
                  <dl className="portal-attachment-metadata">
                    <div><dt>Original file</dt><dd>{metadata.attachment.original_name}</dd></div>
                    <div><dt>Type</dt><dd>{metadata.attachment.content_type || "File"}</dd></div>
                    <div><dt>Size</dt><dd>{fileSize(metadata.attachment.size_bytes)}</dd></div>
                    <div><dt>Audience</dt><dd>{metadata.attachment.audience}</dd></div>
                    <div><dt>Uploaded</dt><dd>{dateTime(metadata.attachment.created_at)}</dd></div>
                    <div><dt>Uploaded by</dt><dd>{metadata.attachment.uploaded_by_name || "Private Office user"}</dd></div>
                  </dl>
                  <section className="portal-attachment-history">
                    <div><FileClock size={16} /><h3>Version history</h3></div>
                    {metadata.versions.map((version) => (
                      <button type="button" key={version.id} onClick={() => void download(version.id, version.original_name)}>
                        <span><strong>Version {version.version_number}</strong><small>{version.original_name} · {fileSize(version.size_bytes)}</small></span>
                        <span><time>{dateTime(version.created_at)}</time><Download size={14} /></span>
                      </button>
                    ))}
                  </section>
                  {metadata.accessEvents.length > 0 && (
                    <section className="portal-attachment-access">
                      <h3>Recent access</h3>
                      {metadata.accessEvents.map((event) => <p key={event.id}><span>{event.actor_name || "Private Office user"} · {event.event_type}</span><time>{dateTime(event.created_at)}</time></p>)}
                    </section>
                  )}
                  {error && <div className="portal-inline-error" role="alert">{error}</div>}
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
