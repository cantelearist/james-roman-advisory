/**
 * Next.js configuration for James Roman Advisory.
 *
 * Sentry integration (activate when ready):
 *   1. Set staging NEXT_PUBLIC_SENTRY_DSN / SENTRY_DSN in Vercel.
 *   2. Optional source maps: set SENTRY_ORG, SENTRY_PROJECT, and SENTRY_AUTH_TOKEN.
 *   3. Keep sendDefaultPii disabled and scrub in beforeSend.
 *
 * PII scrubbing: src/lib/monitoring.ts scrubs signed URLs, auth tokens, emails,
 * filenames, and message content before any event reaches external services.
 * Review the PII_PATTERNS list when adding new data flows.
 *
 * CSP: connect-src includes sentry.io ingest when NEXT_PUBLIC_SENTRY_DSN is set.
 * See src/lib/security.ts.
 */

import { buildSecurityHeaders } from "./src/lib/security";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: buildSecurityHeaders(),
      },
    ];
  },
};

const sentrySourceMapsEnabled = Boolean(
  process.env.SENTRY_ORG && process.env.SENTRY_PROJECT && process.env.SENTRY_AUTH_TOKEN,
);

export default sentrySourceMapsEnabled
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      widenClientFileUpload: false,
      sourcemaps: {
        deleteSourcemapsAfterUpload: true,
      },
      disableLogger: true,
      automaticVercelMonitors: false,
    })
  : nextConfig;
