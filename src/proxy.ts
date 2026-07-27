import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";

const STAGING_HOSTNAMES = ["staging.jamesroman.la"];
const PUBLIC_EXACT = new Set(["/", "/robots.txt", "/sitemap.xml"]);
const PUBLIC_PREFIXES = ["/prototype", "/prototype2", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/mfa", "/api/auth", "/api/consultations", "/api/cron", "/api/seed", "/api/stripe/webhook"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function stagingBasicAuth(req: NextRequest): NextResponse | null {
  const host = req.headers.get("host") ?? "";
  if (!STAGING_HOSTNAMES.some((hostname) => host === hostname || host.startsWith(`${hostname}:`))) return null;

  const password = process.env.STAGING_PASSWORD;
  if (!password) return null;
  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const colon = decoded.indexOf(":");
    if ((colon >= 0 ? decoded.slice(colon + 1) : decoded) === password) return null;
  }
  return new NextResponse("Staging access restricted.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="JRA Staging", charset="UTF-8"', "Content-Type": "text/plain" },
  });
}

export function proxy(req: NextRequest) {
  const stagingBlock = stagingBasicAuth(req);
  if (stagingBlock) return stagingBlock;
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
