import * as Sentry from "@sentry/nextjs";

import { buildSentryInitOptions, isSentryConfigured } from "./src/lib/monitoring";

if (isSentryConfigured({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN })) {
  Sentry.init(
    buildSentryInitOptions({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    }),
  );
}
