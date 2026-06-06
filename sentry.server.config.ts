import * as Sentry from "@sentry/nextjs";

import { buildSentryInitOptions, isSentryConfigured } from "./src/lib/monitoring";

if (isSentryConfigured()) {
  Sentry.init(buildSentryInitOptions());
}
