const DEFAULT_CLERK_HOST = "https://crucial-chicken-28.clerk.accounts.dev";

const CLERK_IMG = "https://img.clerk.com";

function clerkHost() {
  const configured = process.env.NEXT_PUBLIC_CLERK_FRONTEND_API_URL;
  if (!configured) return DEFAULT_CLERK_HOST;

  try {
    const url = new URL(configured);
    return url.protocol === "https:" ? url.origin : DEFAULT_CLERK_HOST;
  } catch {
    return DEFAULT_CLERK_HOST;
  }
}

export function buildSecurityHeaders() {
  const clerkOrigin = clerkHost();
  const allowUnsafeEval = process.env.NODE_ENV !== "production";

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${allowUnsafeEval ? " 'unsafe-eval'" : ""} ${clerkOrigin}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${CLERK_IMG}`,
    `font-src 'self' ${clerkOrigin}`,
    `connect-src 'self' ${clerkOrigin}`,
    `frame-src ${clerkOrigin}`,
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "worker-src blob:",
    ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
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

export const securityHeaders = buildSecurityHeaders();
