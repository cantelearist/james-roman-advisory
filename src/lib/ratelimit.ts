/**
 * Rate limiting utility — wraps @upstash/ratelimit + @upstash/redis.
 *
 * Fails open: if UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN are not
 * configured, rate limiting is silently skipped and all requests are allowed.
 * This means you can deploy the code before adding Upstash credentials —
 * just set the env vars in Vercel when ready and rate limiting activates
 * without any code change.
 *
 * Usage:
 *   const result = await ratelimit("consultation", identifier);
 *   if (result?.blocked) {
 *     return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 *   }
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type LimitResult = { blocked: boolean; remaining: number; reset: number } | null;

// One Redis client per runtime process (edge / node)
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

// Pre-configured limiters — add more as needed
const LIMITERS: Record<string, { requests: number; window: `${number} s` | `${number} m` | `${number} h` }> = {
  // Public consultation form — 5 submissions per hour per IP
  consultation: { requests: 5, window: "1 h" },
  // Admin invite — 20 invites per hour per user
  invite: { requests: 20, window: "1 h" },
  // Seed endpoint — 10 calls per hour per IP (defense-in-depth; SEED_KEY is the primary gate)
  seed: { requests: 10, window: "1 h" },
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
 * @returns          null if Upstash is not configured (allow);
 *                   { blocked, remaining, reset } otherwise
 */
export async function ratelimit(name: string, identifier: string): Promise<LimitResult> {
  try {
    const limiter = getLimiter(name);
    if (!limiter) return null; // Upstash not configured — fail open

    const { success, remaining, reset } = await limiter.limit(identifier);
    return { blocked: !success, remaining, reset };
  } catch {
    // Never let rate limiting crash an endpoint
    return null;
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
