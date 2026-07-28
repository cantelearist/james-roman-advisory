import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const limit = vi.hoisted(() => vi.fn());

vi.mock("@upstash/redis", () => ({
  Redis: class MockRedis {},
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class MockRatelimit {
    static slidingWindow() {
      return {};
    }

    limit = limit;
  },
}));

describe("ratelimit", () => {
  beforeEach(() => {
    vi.resetModules();
    limit.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed when Upstash is not configured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const { ratelimit } = await import("./ratelimit");

    await expect(ratelimit("auth-login", "127.0.0.1")).resolves.toMatchObject({
      available: false,
      blocked: true,
      reason: "not_configured",
    });
  });

  it("returns the provider decision when available", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "secret");
    limit.mockResolvedValue({ success: true, remaining: 4, reset: 123 });
    const { ratelimit } = await import("./ratelimit");

    await expect(ratelimit("consultation", "127.0.0.1")).resolves.toEqual({
      available: true,
      blocked: false,
      remaining: 4,
      reset: 123,
    });
  });

  it("fails closed when the provider errors", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "secret");
    limit.mockRejectedValue(new Error("provider unavailable"));
    const { ratelimit } = await import("./ratelimit");

    await expect(ratelimit("auth-reset", "127.0.0.1")).resolves.toMatchObject({
      available: false,
      blocked: true,
      reason: "provider_error",
    });
  });

  it("fails closed for an unknown limiter name", async () => {
    const { ratelimit } = await import("./ratelimit");

    await expect(ratelimit("typo", "127.0.0.1")).resolves.toMatchObject({
      available: false,
      blocked: true,
      reason: "unknown_limiter",
    });
  });
});
