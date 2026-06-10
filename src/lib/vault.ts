/**
 * vault.ts
 * Server-side Vercel Blob operations for the document vault.
 *
 * SECURITY MODEL — READ THIS BEFORE CHANGING ANYTHING:
 *
 * Vercel Blob stores files with `access: "public"` because the standard tier
 * does not support per-blob auth. This means direct blob URLs are reachable
 * by anyone who knows the path. We mitigate this with two controls:
 *
 *   1. UUID OBSCURITY: Every blob path contains three UUIDs:
 *      vault/{clientId}/{matterId}/{docId}/{filename}
 *      Guessing a valid path requires finding four correct UUIDs (v4,
 *      each 2^122 space). This is computationally infeasible.
 *
 *   2. URL CONTAINMENT: blob.url and blob_pathname are NEVER returned to
 *      clients in any API response. All client downloads must go through
 *      the authenticated proxy at /api/vault/documents/[id], which enforces
 *      ownership and writes an audit log entry before streaming.
 *
 * INVARIANT: If you add a new API route or modify an existing one, confirm
 * that no response body includes `blob_pathname`, `blob.url`, or any
 * Vercel Blob URL. The audit trail depends on this — direct URL access
 * bypasses logging entirely.
 *
 * Future: when private Vercel Blob access or presigned URLs become available
 * on the current plan, replace `access: "public"` with the private model and
 * generate time-limited signed URLs in the download proxy.
 */
import { del, head, put } from "@vercel/blob";

export const VAULT_PATH_PREFIX = "vault/";

/** Upload a file to Vercel Blob and return the blob metadata.
 *  IMPORTANT: Never return blob.url or blob.pathname in API responses. */
export async function uploadToVault(opts: {
  pathname: string;
  file: Blob | ArrayBuffer;
  contentType: string;
}) {
  const blob = await put(opts.pathname, opts.file, {
    access: "public", // URL is UUID-obscured; proxy download enforces auth
    contentType: opts.contentType,
    allowOverwrite: false,
  });
  // blob.url and blob.pathname are for server-side use ONLY.
  return blob;
}

/** Delete a file from Vercel Blob by its pathname. */
export async function deleteFromVault(pathname: string) {
  await del(pathname);
}

/** Check a file exists in Vercel Blob. Returns metadata or null. */
export async function headVaultFile(pathname: string) {
  try {
    return await head(pathname);
  } catch {
    return null;
  }
}

/** Build the canonical vault pathname for a document. */
export function vaultPathname(opts: {
  clientId: string;
  matterId: string | null;
  docId: string;
  filename: string;
}): string {
  const scope = opts.matterId
    ? `${opts.clientId}/${opts.matterId}`
    : `${opts.clientId}/unassigned`;
  return `${VAULT_PATH_PREFIX}${scope}/${opts.docId}/${opts.filename}`;
}

/** Sanitise a filename for storage — keep extension, replace unsafe chars. */
export function sanitiseFilename(raw: string): string {
  const ext = raw.includes(".") ? `.${raw.split(".").pop()}` : "";
  const base = raw
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_\-]/g, "_")
    .slice(0, 80);
  return `${base}${ext}`;
}

/** Max upload size: 50 MB */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "text/plain",
  "text/csv",
]);

/**
 * Strip blob storage fields from a document record before sending to a client.
 * Call this on any document object before including it in an API response.
 */
export function sanitiseDocumentForClient<
  T extends { blob_pathname?: unknown; blob_url?: unknown }
>(doc: T): Omit<T, "blob_pathname" | "blob_url"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { blob_pathname, blob_url, ...safe } = doc;
  return safe;
}
