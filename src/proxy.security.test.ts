import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type AuthResult = {
  userId: string | null;
  sessionClaims?: Record<string, unknown>;
};

const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn<() => Promise<AuthResult>>(),
}));

function matcherFromPattern(pattern: string) {
  if (pattern.endsWith("(.*)")) {
    const prefix = pattern.slice(0, -4);
    return (pathname: string) => pathname === prefix || pathname.startsWith(prefix);
  }
  return (pathname: string) => pathname === pattern;
}

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: vi.fn((handler) => handler),
  createRouteMatcher: vi.fn((patterns: string[]) => {
    const matchers = patterns.map(matcherFromPattern);
    return (request: NextRequest) => matchers.some((matches) => matches(request.nextUrl.pathname));
  }),
}));

import { proxy } from "./proxy";

function makeRequest(pathname: string, headers: HeadersInit = {}): NextRequest {
  return {
    nextUrl: { pathname },
    url: `https://www.jamesroman.la${pathname}`,
    headers: new Headers(headers),
  } as unknown as NextRequest;
}

async function callProxy(request: NextRequest) {
  return proxy(authMock, request);
}

function expectPrivateHeaders(response: Response) {
  expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
  expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
}

describe("production proxy security behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    authMock.mockResolvedValue({ userId: null, sessionClaims: {} });
  });

  it("fails closed when staging basic auth password is missing", async () => {
    const response = await callProxy(makeRequest("/", { host: "staging.jamesroman.la" }));

    expect(response.status).toBe(503);
    expect(await response.text()).toBe("Staging access is not configured.");
  });

  it("returns controlled noindex 503 instead of leaking Clerk auth errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    authMock.mockRejectedValue(new Error("Clerk middleware failed"));

    const response = await callProxy(makeRequest("/portal"));

    expect(response.status).toBe(503);
    expectPrivateHeaders(response);
    expect(console.error).toHaveBeenCalledWith("proxy.auth_failed", expect.any(Error));
  });

  it("redirects unauthenticated portal users with private-route headers", async () => {
    authMock.mockResolvedValue({ userId: null, sessionClaims: {} });

    const response = await callProxy(makeRequest("/portal"));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/sign-in");
    expectPrivateHeaders(response);
  });

  it("allows authenticated portal users with private-route headers", async () => {
    authMock.mockResolvedValue({ userId: "user-1", sessionClaims: { role: "client" } });

    const response = await callProxy(makeRequest("/portal"));

    expect(response.status).toBe(200);
    expectPrivateHeaders(response);
  });
});
