import { NextResponse } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitInput = {
  namespace: string;
  limit: number;
  windowMs: number;
  keyParts: Array<string | null | undefined>;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function normalizeRateLimitPart(value: string | null | undefined) {
  const normalized = (value ?? "anonymous")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 160);

  return normalized || "anonymous";
}

export function clientFingerprint(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0];
  const ip = forwardedFor ?? request.headers.get("x-real-ip") ?? "unknown-ip";
  const userAgent = request.headers.get("user-agent") ?? "unknown-agent";

  return [normalizeRateLimitPart(ip), normalizeRateLimitPart(userAgent)].join(":");
}

export function checkRateLimit(input: RateLimitInput, now = Date.now()): RateLimitResult {
  const key = [input.namespace, ...input.keyParts.map(normalizeRateLimitPart)].join("|");
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + input.windowMs });
    return { allowed: true, remaining: input.limit - 1, resetAt: now + input.windowMs };
  }

  if (current.count >= input.limit) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  return { allowed: true, remaining: input.limit - current.count, resetAt: current.resetAt };
}

export function rateLimitResponse(result: RateLimitResult) {
  return NextResponse.json(
    { message: "Too many requests. Please try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))),
      },
    },
  );
}

export function enforceRateLimit(input: RateLimitInput) {
  const result = checkRateLimit(input);
  if (result.allowed) return null;
  return rateLimitResponse(result);
}

export function resetRateLimitForTests() {
  buckets.clear();
}
