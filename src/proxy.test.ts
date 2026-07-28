import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { proxy } from "./proxy";

function request(host: string, pathname = "/", authorization?: string) {
  return new NextRequest(`https://${host}${pathname}`, {
    headers: {
      host,
      ...(authorization ? { authorization } : {}),
    },
  });
}

function mutationRequest(
  pathname: string,
  origin?: string,
  host = "www.jamesroman.la",
) {
  return new NextRequest(`https://${host}${pathname}`, {
    method: "POST",
    headers: {
      host,
      ...(origin ? { origin } : {}),
    },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("staging host gate", () => {
  it("fails closed when STAGING_PASSWORD is missing", () => {
    vi.stubEnv("STAGING_PASSWORD", "");

    const response = proxy(request("staging.jamesroman.la"));

    expect(response.status).toBe(503);
  });

  it("rejects missing, invalid, and malformed credentials", () => {
    vi.stubEnv("STAGING_PASSWORD", "correct-horse");

    expect(proxy(request("staging.jamesroman.la")).status).toBe(401);
    expect(
      proxy(
        request(
          "staging.jamesroman.la",
          "/",
          `Basic ${Buffer.from("user:wrong").toString("base64")}`,
        ),
      ).status,
    ).toBe(401);
    expect(proxy(request("staging.jamesroman.la", "/", "Basic !!!")).status).toBe(401);
  });

  it("allows a valid staging credential to continue", () => {
    vi.stubEnv("STAGING_PASSWORD", "correct-horse");

    const response = proxy(
      request(
        "staging.jamesroman.la",
        "/",
        `Basic ${Buffer.from("user:correct-horse").toString("base64")}`,
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("does not apply the staging gate to production", () => {
    vi.stubEnv("STAGING_PASSWORD", "");

    const response = proxy(request("www.jamesroman.la"));

    expect(response.status).toBe(200);
  });
});

describe("mutation origin gate", () => {
  it("allows a trusted browser mutation", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SITE_URL", "https://www.jamesroman.la");

    const response = proxy(
      mutationRequest(
        "/api/auth/login",
        "https://www.jamesroman.la",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it.each([undefined, "https://evil.example", "null"])(
    "rejects an absent or untrusted browser mutation origin: %s",
    (origin) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("SITE_URL", "https://www.jamesroman.la");

      expect(proxy(mutationRequest("/api/auth/login", origin)).status).toBe(403);
    },
  );

  it.each([
    "/api/stripe/webhook",
    "/api/cron/portal-automations",
    "/api/seed/users",
  ])("leaves authenticated server-to-server route %s exempt", (pathname) => {
    vi.stubEnv("NODE_ENV", "production");

    expect(proxy(mutationRequest(pathname)).status).toBe(200);
  });
});
