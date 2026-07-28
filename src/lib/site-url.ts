const PRODUCTION_ORIGIN = "https://www.jamesroman.la";
const LOCAL_ORIGIN = "http://localhost:3000";

function normalizeOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function trustedSiteOrigins(): ReadonlySet<string> {
  const origins = new Set<string>();
  const configured = normalizeOrigin(process.env.SITE_URL);
  if (process.env.SITE_URL && !configured) return origins;
  if (configured) origins.add(configured);

  if (process.env.VERCEL_ENV === "preview") {
    const preview = normalizeOrigin(process.env.VERCEL_URL);
    if (preview) origins.add(preview);
  } else if (process.env.NODE_ENV === "production") {
    if (!configured) origins.add(PRODUCTION_ORIGIN);
  } else {
    origins.add(LOCAL_ORIGIN);
  }
  return origins;
}

export function canonicalSiteOrigin(): string {
  const configured = normalizeOrigin(process.env.SITE_URL);
  if (process.env.SITE_URL && !configured) {
    throw new Error("SITE_URL must be a valid HTTP(S) origin");
  }
  if (configured) return configured;

  if (process.env.VERCEL_ENV === "preview") {
    const preview = normalizeOrigin(process.env.VERCEL_URL);
    if (preview) return preview;
  }
  return process.env.NODE_ENV === "production" ? PRODUCTION_ORIGIN : LOCAL_ORIGIN;
}

export function hasTrustedMutationOrigin(request: Request): boolean {
  const value = request.headers.get("origin");
  if (!value) return false;
  const origin = normalizeOrigin(value);
  return origin !== null && trustedSiteOrigins().has(origin);
}
