/**
 * Monitoring module for James Roman Advisory.
 *
 * Design goals:
 * - Works standalone immediately with structured console output (Vercel captures these).
 * - Drops into Sentry when SENTRY_DSN is configured — wire withSentryConfig into
 *   next.config.ts and add sentry.server.config.ts when ready.
 * - PII is scrubbed before any event leaves this process. Logs are not a second
 *   data-leak surface.
 *
 * Integration point: install @sentry/nextjs, set SENTRY_DSN, then uncomment the
 * Sentry calls below. No other changes needed — the event shape is already compatible.
 */

import * as Sentry from "@sentry/nextjs";

// ---------------------------------------------------------------------------
// PII scrubbing
// ---------------------------------------------------------------------------

/**
 * Patterns that must never appear in structured logs, Sentry payloads, or any
 * external monitoring surface.
 *
 * Order matters: signed URL patterns must run before generic URL patterns so
 * the entire token is caught, not just the parameter name.
 */
const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Supabase Storage signed URL tokens (upload and download)
  { pattern: /token=[^&\s"']+/gi, replacement: "token=[REDACTED]" },
  { pattern: /upload_token=[^&\s"']+/gi, replacement: "upload_token=[REDACTED]" },

  // AWS / Supabase presigned URL auth params
  { pattern: /X-Amz-Signature=[^&\s"']+/gi, replacement: "X-Amz-Signature=[REDACTED]" },
  { pattern: /X-Amz-Security-Token=[^&\s"']+/gi, replacement: "X-Amz-Security-Token=[REDACTED]" },
  { pattern: /X-Amz-Credential=[^&\s"']+/gi, replacement: "X-Amz-Credential=[REDACTED]" },

  // Bearer and Basic auth tokens in headers or log strings
  { pattern: /bearer\s+[a-zA-Z0-9._\-/+]+/gi, replacement: "Bearer [REDACTED]" },
  { pattern: /basic\s+[a-zA-Z0-9+/=]+/gi, replacement: "Basic [REDACTED]" },

  // JWT-shaped strings (three base64url segments separated by dots)
  {
    pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    replacement: "[JWT_REDACTED]",
  },

  // Email addresses — client emails are PII
  {
    pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    replacement: "[EMAIL_REDACTED]",
  },

  // Supabase Storage paths: tenant/{uuid}/matter/{uuid}/{filename}
  // Keep the UUID structure for debugging but remove the filename
  {
    pattern:
      /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/)([^"'\s?&]+)/gi,
    replacement: "$1[FILENAME_REDACTED]",
  },

  // Service-role and anon keys (64-char base64 fragments inside JWT-like strings not caught above)
  {
    pattern: /service_role[^"'\s]*/gi,
    replacement: "[SERVICE_ROLE_REDACTED]",
  },

  // SUPABASE_SERVICE_ROLE_KEY value patterns (sbp_ prefix keys)
  {
    pattern: /sbp_[a-zA-Z0-9]{40,}/g,
    replacement: "[SUPABASE_KEY_REDACTED]",
  },

  // Filenames can expose client/property details.
  {
    pattern: /[A-Za-z0-9][A-Za-z0-9._ \-]{1,180}\.(pdf|docx|xlsx|jpg|jpeg|png|webp|txt)\b/gi,
    replacement: "[FILENAME_REDACTED]",
  },
];

/**
 * Scrub a plain string of all known PII patterns.
 * Safe to call on JSON-serialized event payloads.
 */
export function scrubPii(value: string): string {
  let scrubbed = value;
  for (const { pattern, replacement } of PII_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, replacement);
  }
  return scrubbed;
}

/**
 * Scrub a URL — removes signed-URL query parameters before the URL is logged.
 * Preserves the path and non-sensitive parameters for debugging.
 *
 * Applies regex-based scrubbing directly so bracket characters in replacement
 * values are not percent-encoded (URL.searchParams.set would encode them).
 */
export function scrubUrl(rawUrl: string): string {
  // Validate it is a parseable URL, then apply string-level scrubbers.
  // This avoids percent-encoding side-effects from URL.searchParams manipulation.
  try {
    new URL(rawUrl);
  } catch {
    // Malformed — still scrub whatever we have
  }
  return scrubPii(rawUrl);
}

/**
 * Scrub an arbitrary object before logging.
 * Converts to JSON string, applies PII scrubbers, and parses back.
 * Returns the original value if any step fails.
 */
export function scrubObject(value: unknown): unknown {
  try {
    const json = JSON.stringify(value, null, 0);
    const scrubbed = scrubPii(json);
    return JSON.parse(scrubbed);
  } catch {
    return { error: "scrub_failed", type: typeof value };
  }
}

type SentryLikeEvent = {
  message?: string;
  user?: Record<string, unknown>;
  request?: {
    url?: string;
    headers?: Record<string, unknown>;
    cookies?: unknown;
    data?: unknown;
    [key: string]: unknown;
  };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  [key: string]: unknown;
};

export function scrubSentryEvent<T extends SentryLikeEvent>(event: T): T {
  const scrubbed = scrubObject(event) as T;

  if (scrubbed.user) {
    delete scrubbed.user.email;
    delete scrubbed.user.username;
    delete scrubbed.user.ip_address;
  }

  if (scrubbed.request) {
    scrubbed.request.url = scrubbed.request.url ? scrubUrl(scrubbed.request.url) : scrubbed.request.url;
    delete scrubbed.request.headers;
    delete scrubbed.request.cookies;
    delete scrubbed.request.data;
  }

  return scrubbed;
}

type SentryInitInput = {
  dsn?: string;
  environment?: string;
};

export function isSentryConfigured(input: SentryInitInput = {}) {
  const dsn = input.dsn ?? process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  return Boolean(dsn);
}

export function buildSentryInitOptions(input: SentryInitInput = {}) {
  return {
    dsn: input.dsn ?? process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: input.environment ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend: scrubSentryEvent as never,
    ignoreErrors: ["ResizeObserver loop limit exceeded", "ResizeObserver loop completed with undelivered notifications."],
  };
}

// ---------------------------------------------------------------------------
// Alert categories
// ---------------------------------------------------------------------------

export type AlertCategory =
  | "api.error_5xx"
  | "auth.failure"
  | "document.signed_url_failure"
  | "audit.write_failure"
  | "document.upload_completion_failure"
  | "rate_limit.exceeded"
  | "request_guard.rejected";

export type AlertSeverity = "error" | "warning" | "info";

export type MonitoringEvent = {
  category: AlertCategory | string;
  severity: AlertSeverity;
  message: string;
  context?: Record<string, unknown>;
  /** Actor user ID — safe to log (not PII by our model; it is an internal UUID). */
  userId?: string | null;
  /** Tenant ID — safe to log. */
  tenantId?: string | null;
  /** Route path, e.g. /api/documents/[documentId]/download */
  route?: string;
};

// ---------------------------------------------------------------------------
// Capture interface
// ---------------------------------------------------------------------------

/**
 * Capture a structured monitoring event.
 *
 * In production, this emits a structured JSON log line that Vercel captures.
 * When Sentry is configured, it also forwards scrubbed events to Sentry.
 */
export function captureMonitoringEvent(event: MonitoringEvent, error?: unknown): void {
  const payload = {
    ts: new Date().toISOString(),
    category: event.category,
    severity: event.severity,
    message: event.message,
    route: event.route ?? null,
    userId: event.userId ?? null,
    tenantId: event.tenantId ?? null,
    // Scrub any free-form context before emitting
    context: event.context ? scrubObject(event.context) : null,
    error:
      error instanceof Error
        ? { name: error.name, message: scrubPii(error.message) }
        : error
          ? scrubObject(error)
          : null,
  };

  if (event.severity === "error") {
    console.error(JSON.stringify(payload));
  } else if (event.severity === "warning") {
    console.warn(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }

  if (!isSentryConfigured()) return;

  Sentry.withScope((scope) => {
    if (event.userId) scope.setUser({ id: event.userId });
    scope.setContext("monitoring", scrubObject({
      category: event.category,
      tenantId: event.tenantId,
      route: event.route,
      context: payload.context,
    }) as Record<string, unknown>);
    scope.setLevel(event.severity);

    if (error instanceof Error) {
      Sentry.captureException(error);
    } else {
      Sentry.captureMessage(event.message);
    }
  });
}

// ---------------------------------------------------------------------------
// Convenience helpers for specific alert categories
// ---------------------------------------------------------------------------

export function captureApiError(
  route: string,
  statusCode: number,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  captureMonitoringEvent(
    {
      category: "api.error_5xx",
      severity: "error",
      message: `API error ${statusCode} on ${route}`,
      route,
      context: { statusCode, ...context },
    },
    error,
  );
}

export function captureAuthFailure(
  reason: string,
  context?: { route?: string; userId?: string | null; tenantId?: string | null },
): void {
  captureMonitoringEvent({
    category: "auth.failure",
    severity: "warning",
    message: `Auth failure: ${reason}`,
    route: context?.route,
    userId: context?.userId,
    tenantId: context?.tenantId,
    context: { reason },
  });
}

export function captureSignedUrlFailure(
  operation: "upload" | "download",
  context?: { documentId?: string; matterId?: string; userId?: string | null },
): void {
  captureMonitoringEvent({
    category: "document.signed_url_failure",
    severity: "error",
    message: `Signed ${operation} URL creation failed`,
    userId: context?.userId ?? null,
    context: {
      operation,
      documentId: context?.documentId,
      matterId: context?.matterId,
    },
  });
}

export function captureAuditWriteFailure(action: string, error: unknown): void {
  captureMonitoringEvent(
    {
      category: "audit.write_failure",
      severity: "error",
      message: `Audit write failed for action: ${action}`,
      context: { action },
    },
    error,
  );
}

export function captureUploadCompletionFailure(
  documentId: string,
  error: unknown,
  context?: { userId?: string | null; matterId?: string },
): void {
  captureMonitoringEvent(
    {
      category: "document.upload_completion_failure",
      severity: "error",
      message: "Upload completion failed",
      userId: context?.userId ?? null,
      context: { documentId, matterId: context?.matterId },
    },
    error,
  );
}

// ---------------------------------------------------------------------------
// Production guard
// ---------------------------------------------------------------------------

/**
 * Called at startup to warn if monitoring is not fully wired.
 * Emits a structured warning; does not throw.
 */
export function assertMonitoringConfigured(): void {
  if (process.env.NODE_ENV !== "production") return;

  if (!isSentryConfigured()) {
    captureMonitoringEvent({
      category: "api.error_5xx",
      severity: "warning",
      message:
        "Sentry DSN is not set. Production errors will only appear in Vercel structured logs. " +
        "Set SENTRY_DSN or NEXT_PUBLIC_SENTRY_DSN to enable Sentry error tracking.",
    });
  }
}
