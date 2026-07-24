// CLERK_HOST: resolved from environment at startup.
// In development/staging, falls back to the development instance.
// Set NEXT_PUBLIC_CLERK_FRONTEND_API_URL in Vercel env vars to override.
const CLERK_HOST =
  process.env.NEXT_PUBLIC_CLERK_FRONTEND_API_URL ??
  "https://crucial-chicken-28.clerk.accounts.dev";

const CLERK_IMG = "https://img.clerk.com";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${CLERK_HOST}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${CLERK_IMG}`,
  `font-src 'self' ${CLERK_HOST}`,
  `connect-src 'self' ${CLERK_HOST}`,
  `frame-src ${CLERK_HOST}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "worker-src blob:",
].join("; ");

export const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];
