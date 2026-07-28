import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";
import { hasTrustedMutationOrigin } from "@/lib/site-url";

const STAGING_HOSTNAMES = ["staging.jamesroman.la"];
const PUBLIC_EXACT = new Set(["/", "/robots.txt", "/sitemap.xml"]);
const PUBLIC_PREFIXES = ["/prototype", "/prototype2", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/mfa", "/api/auth", "/api/consultations", "/api/cron", "/api/seed", "/api/stripe/webhook"];
const ORIGIN_EXEMPT_PREFIXES = ["/api/cron", "/api/seed", "/api/stripe/webhook"];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isPublicPath(pathname: string): boolean {
  return PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function stagingBasicAuth(req: NextRequest): NextResponse | null {
  const host = req.headers.get("host") ?? "";
  if (!STAGING_HOSTNAMES.some((hostname) => host === hostname || host.startsWith(`${hostname}:`))) return null;

  const password = process.env.STAGING_PASSWORD;
  if (!password) {
    return new NextResponse("Staging access is not configured.", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const colon = decoded.indexOf(":");
      if ((colon >= 0 ? decoded.slice(colon + 1) : decoded) === password) return null;
    } catch {
      // Malformed credentials are handled as an ordinary authentication failure.
    }
  }
  return new NextResponse("Staging access restricted.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="JRA Staging", charset="UTF-8"', "Content-Type": "text/plain" },
  });
}

export function proxy(req: NextRequest) {
  const stagingBlock = stagingBasicAuth(req);
  if (stagingBlock) return stagingBlock;
  if (
    !SAFE_METHODS.has(req.method) &&
    req.nextUrl.pathname.startsWith("/api/") &&
    !ORIGIN_EXEMPT_PREFIXES.some(
      (prefix) =>
        req.nextUrl.pathname === prefix ||
        req.nextUrl.pathname.startsWith(`${prefix}/`),
    ) &&
    !hasTrustedMutationOrigin(req)
  ) {
    return NextResponse.json(
      { error: "Request origin is not allowed" },
      { status: 403 },
    );
  }
  if (isPublicPath(req.nextUrl.pathname)) return NextResponse.next();

  if (!req.cookies.get(SESSION_COOKIE)?.value) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const signIn = new URL("/sign-in", req.url);
    signIn.searchParams.set("redirect_url", req.nextUrl.pathname);
    return NextResponse.redirect(signIn);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
