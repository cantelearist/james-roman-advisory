import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkRateLimit,
  clientFingerprint,
  enforceRateLimit,
  normalizeRateLimitPart,
  resetRateLimitForTests,
} from "./rate-limit";

describe("rate limit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T12:00:00Z"));
    resetRateLimitForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetRateLimitForTests();
  });

  it("allows requests inside the configured window", () => {
    const first = checkRateLimit({
      namespace: "test",
      limit: 2,
      windowMs: 60_000,
      keyParts: ["user-1"],
    });

    const second = checkRateLimit({
      namespace: "test",
      limit: 2,
      windowMs: 60_000,
      keyParts: ["user-1"],
    });

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
  });

  it("blocks requests over the configured limit", async () => {
    const input = {
      namespace: "upload",
      limit: 1,
      windowMs: 60_000,
      keyParts: ["user-1", "matter-1"],
    };

    expect(enforceRateLimit(input)).toBeNull();
    const response = enforceRateLimit(input);

    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBe("60");
    await expect(response?.json()).resolves.toEqual({
      message: "Too many requests. Please try again shortly.",
    });
  });

  it("resets after the configured window", () => {
    const input = {
      namespace: "messages",
      limit: 1,
      windowMs: 60_000,
      keyParts: ["user-1"],
    };

    expect(checkRateLimit(input).allowed).toBe(true);
    expect(checkRateLimit(input).allowed).toBe(false);

    vi.advanceTimersByTime(60_001);

    expect(checkRateLimit(input).allowed).toBe(true);
  });

  it("normalizes identifiers before bucketing", () => {
    expect(normalizeRateLimitPart("  USER@Example.COM   ")).toBe("user@example.com");
    expect(normalizeRateLimitPart("")).toBe("anonymous");
  });

  it("normalizes client IP and user-agent into one fingerprint", () => {
    const request = new Request("https://www.jamesroman.la/api/consultations", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 198.51.100.1",
        "user-agent": " Test Browser  ",
      },
    });

    expect(clientFingerprint(request)).toBe("203.0.113.10:test browser");
  });
});
