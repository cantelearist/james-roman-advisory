/**
 * HTTP security headers for all routes.
 *
 * connect-src includes sentry.io ingest endpoints when NEXT_PUBLIC_SENTRY_DSN is
 * set so that client-side error reporting is not blocked by the CSP. The DSN
 * itself is a public ingest URL — it is safe to expose browser-side.
 *
 * Call buildSecurityHeaders() from next.config.ts so the Sentry domain is
 * conditionally included based on the environment at build time.
 */

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

/**
 * Extract the Sentry ingest hostname from the DSN, e.g.
 *   https://abc123@o12345.ingest.sentry.io/67890
 *   → https://o12345.ingest.sentry.io
 */
function sentryIngestOrigin(dsn: string): string | null {
  try {
    const url = new URL(dsn);
    // DSN host is the ingest host
    return `https://${url.host}`;
  } catch {
    return null;
  }
}

export function buildSecurityHeaders() {
  const sentryOrigin = sentryIngestOrigin(SENTRY_DSN);

  const connectSrcParts = [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    ...(sentryOrigin ? [sentryOrigin] : []),
  ];

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connectSrcParts.join(" ")}`,
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "worker-src blob:",
  ].join("; ");

  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  ];
}

/** @deprecated Use buildSecurityHeaders() — kept for backward compatibility only. */
export const securityHeaders = buildSecurityHeaders();
