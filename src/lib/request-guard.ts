import { NextResponse } from "next/server";

const STATIC_ALLOWED_ORIGINS = new Set([
  "https://www.jamesroman.la",
  "https://jamesroman.la",
  "https://office.jamesroman.la",
  "https://admin.jamesroman.la",
]);

const ALLOWED_FETCH_SITE_VALUES = new Set(["same-origin", "same-site", "none"]);

function configuredOrigins() {
  return (process.env.JRA_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isLocalhost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function isAllowedConfiguredOrigin(origin: string) {
  if (STATIC_ALLOWED_ORIGINS.has(origin)) return true;
  return configuredOrigins().includes(origin);
}

function parseOrigin(origin: string) {
  try {
    return new URL(origin);
  } catch {
    return null;
  }
}

export function isAllowedStateChangingRequest(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const secFetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();

  if (secFetchSite && !ALLOWED_FETCH_SITE_VALUES.has(secFetchSite)) {
    return false;
  }

  if (!origin) {
    return true;
  }

  const originUrl = parseOrigin(origin);
  if (!originUrl) return false;

  if (originUrl.origin === requestUrl.origin) {
    return true;
  }

  if (
    isLocalhost(originUrl.hostname) &&
    isLocalhost(requestUrl.hostname) &&
    originUrl.protocol === requestUrl.protocol
  ) {
    return true;
  }

  return isAllowedConfiguredOrigin(originUrl.origin);
}

export function enforceSameOriginRequest(request: Request) {
  if (isAllowedStateChangingRequest(request)) return null;

  return NextResponse.json({ message: "Request rejected." }, { status: 403 });
}
