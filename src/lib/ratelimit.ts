/**
 * Rate limiting utility — wraps @upstash/ratelimit + @upstash/redis.
 *
 * Returns an explicit unavailable result if Upstash is not configured or
 * cannot be reached. Sensitive callers must fail closed with 503 rather than
 * silently admitting an unthrottled request.
 *
 * Usage:
 *   const result = await ratelimit("consultation", identifier);
 *   if (result?.blocked) {
 *     return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 *   }
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type LimitResult = {
  available: boolean;
  blocked: boolean;
  remaining: number | null;
  reset: number | null;
  reason?: "not_configured" | "provider_error" | "unknown_limiter";
};

// One Redis client per runtime process (edge / node)
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

// Pre-configured limiters — add more as needed
const LIMITERS: Record<string, { requests: number; window: `${number} s` | `${number} m` | `${number} h` }> = {
  // Public consultation form — 5 submissions per hour per IP
  consultation: { requests: 5, window: "1 h" },
  "auth-login": { requests: 10, window: "15 m" },
  "auth-register": { requests: 5, window: "1 h" },
  // Admin invite — 20 invites per hour per user
  invite: { requests: 20, window: "1 h" },
  // Seed endpoint — 10 calls per hour per IP (defense-in-depth; SEED_KEY is the primary gate)
  seed: { requests: 10, window: "1 h" },
  "auth-recovery": { requests: 5, window: "15 m" },
  "auth-reset": { requests: 8, window: "15 m" },
  "auth-mfa": { requests: 10, window: "15 m" },
  // Password, session, and MFA changes can otherwise be abused from a live session.
  "account-security": { requests: 8, window: "15 m" },
};

const limiterCache = new Map<string, Ratelimit>();

function getLimiter(name: string): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;

  if (limiterCache.has(name)) return limiterCache.get(name)!;

  const config = LIMITERS[name];
  if (!config) return null;

  const limiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(config.requests, config.window),
    prefix: `jra:rl:${name}`,
  });

  limiterCache.set(name, limiter);
  return limiter;
}

/**
 * Check rate limit for a named endpoint.
 *
 * @param name       Key from LIMITERS config (e.g., "consultation")
 * @param identifier IP address or user ID — used as the rate limit bucket key
 * @returns          An explicit allowed, blocked, or unavailable result.
 */
export async function ratelimit(name: string, identifier: string): Promise<LimitResult> {
  if (!LIMITERS[name]) {
    return {
      available: false,
      blocked: true,
      remaining: null,
      reset: null,
      reason: "unknown_limiter",
    };
  }
  try {
    const limiter = getLimiter(name);
    if (!limiter) {
      return {
        available: false,
        blocked: true,
        remaining: null,
        reset: null,
        reason: "not_configured",
      };
    }

    const { success, remaining, reset } = await limiter.limit(identifier);
    return { available: true, blocked: !success, remaining, reset };
  } catch {
    return {
      available: false,
      blocked: true,
      remaining: null,
      reset: null,
      reason: "provider_error",
    };
  }
}

/**
 * Extract the best available IP from a Next.js request.
 * Falls back to "unknown" if no IP can be determined.
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
