/**
 * vault.ts
 * Server-side Vercel Blob operations for the document vault.
 * All access goes through authenticated API routes — blob URLs
 * are never exposed directly to the client.
 */
import { del, head, put } from "@vercel/blob";

export const VAULT_PATH_PREFIX = "vault/";

/** Upload a file to Vercel Blob and return the blob metadata. */
export async function uploadToVault(opts: {
  pathname: string;
  file: Blob | ArrayBuffer;
  contentType: string;
}) {
  const blob = await put(opts.pathname, opts.file, {
    access: "public", // URL is UUID-obscured; access control enforced at API layer
    contentType: opts.contentType,
    allowOverwrite: false,
  });
  return blob; // { url, pathname, contentType, size }
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
