import { afterEach, describe, expect, it, vi } from "vitest";

import {
  canonicalSiteOrigin,
  hasTrustedMutationOrigin,
  trustedSiteOrigins,
} from "./site-url";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("canonical site origin", () => {
  it("uses the private SITE_URL configuration", () => {
    vi.stubEnv("SITE_URL", "https://staging.jamesroman.la/path");
    expect(canonicalSiteOrigin()).toBe("https://staging.jamesroman.la");
  });

  it("rejects an invalid configured origin", () => {
    vi.stubEnv("SITE_URL", "javascript:alert(1)");
    expect(() => canonicalSiteOrigin()).toThrow("SITE_URL");
  });

  it("includes the Vercel deployment origin only for previews", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "jr-advisory-preview.vercel.app");

    expect(trustedSiteOrigins()).toContain(
      "https://jr-advisory-preview.vercel.app",
    );
  });

  it("fails closed when SITE_URL is configured but invalid", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SITE_URL", "not a valid origin");

    expect(trustedSiteOrigins()).toEqual(new Set());
  });
});

describe("mutation origin validation", () => {
  it("accepts the configured same origin", () => {
    vi.stubEnv("SITE_URL", "https://www.jamesroman.la");
    const request = new Request("https://www.jamesroman.la/api/auth/login", {
      method: "POST",
      headers: { origin: "https://www.jamesroman.la" },
    });
    expect(hasTrustedMutationOrigin(request)).toBe(true);
  });

  it.each([
    undefined,
    "https://evil.example",
    "null",
    "javascript:alert(1)",
  ])("rejects an absent or untrusted origin: %s", (origin) => {
    vi.stubEnv("SITE_URL", "https://www.jamesroman.la");
    const headers = origin ? { origin } : undefined;
    const request = new Request("https://www.jamesroman.la/api/auth/login", {
      method: "POST",
      headers,
    });
    expect(hasTrustedMutationOrigin(request)).toBe(false);
  });
});
