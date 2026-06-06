import { headers } from "next/headers";
import { createHmac, randomUUID } from "node:crypto";

import { captureAuditWriteFailure } from "@/lib/monitoring";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const AUDIT_HASH_SECRET_MIN_LENGTH = 32;
const CORRELATION_ID_MAX_LENGTH = 128;
const CORRELATION_HEADERS = ["x-correlation-id", "x-request-id", "x-vercel-id"];

type AuditInput = {
  actorId: string | null;
  tenantId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  correlationId?: string | null;
  metadata?: Record<string, unknown>;
};

export function getAuditHashSecret() {
  const secret = process.env.AUDIT_HASH_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUDIT_HASH_SECRET is required for audit hashing.");
  }

  return "development-only-audit-hash-secret-change-before-staging";
}

function assertAuditHashSecret(secret: string) {
  if (secret.length < AUDIT_HASH_SECRET_MIN_LENGTH) {
    throw new Error(`AUDIT_HASH_SECRET must be at least ${AUDIT_HASH_SECRET_MIN_LENGTH} characters.`);
  }
}

export function createAuditHash(value: string, secret = getAuditHashSecret()) {
  assertAuditHashSecret(secret);
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function normalizeAuditCorrelationId(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return randomUUID();

  const normalized = trimmed.slice(0, CORRELATION_ID_MAX_LENGTH);
  if (!/^[A-Za-z0-9._:-]+$/.test(normalized)) return randomUUID();

  return normalized;
}

function getRequestCorrelationId(headerStore: Headers) {
  for (const header of CORRELATION_HEADERS) {
    const value = headerStore.get(header);
    if (value) return normalizeAuditCorrelationId(value);
  }

  return normalizeAuditCorrelationId(null);
}

export async function writeAuditEvent(input: AuditInput) {
  try {
    const headerStore = await headers();
    const ip = headerStore.get("x-forwarded-for") ?? "unknown";
    const userAgent = headerStore.get("user-agent") ?? "unknown";
    // Service-role is used for append-only audit logging even when user RLS would block writes.
    const supabase = createSupabaseAdminClient();

    await supabase.from("audit_logs").insert({
      actor_id: input.actorId,
      tenant_id: input.tenantId,
      action: input.action,
      resource_type: input.resourceType,
      resource_id: input.resourceId ?? null,
      correlation_id: input.correlationId
        ? normalizeAuditCorrelationId(input.correlationId)
        : getRequestCorrelationId(headerStore),
      ip_hash: createAuditHash(ip),
      user_agent_hash: createAuditHash(userAgent),
      metadata: input.metadata ?? {},
    });
  } catch (error) {
    console.error("audit.write_failed", error);
    captureAuditWriteFailure(input.action, error);
    throw error;
  }
}
