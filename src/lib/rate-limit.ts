import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

function getRedis(): Redis {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

function getGlobal<T>(key: string, factory: () => T): T {
  const g = globalThis as unknown as Record<string, T>;
  if (!g[key]) g[key] = factory();
  return g;
}

const hasRedis = () => !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

// ── Pre-configured rate limiters (used by middleware) ─────────
export const rateLimiters = {
  global: getGlobal('rl:global', () =>
    new Ratelimit({ redis: getRedis(), limiter: Ratelimit.fixedWindow(60, '60s'), analytics: false })
  ),
  page: getGlobal('rl:page', () =>
    new Ratelimit({ redis: getRedis(), limiter: Ratelimit.fixedWindow(20, '60s'), analytics: false })
  ),
  track: getGlobal('rl:track', () =>
    new Ratelimit({ redis: getRedis(), limiter: Ratelimit.fixedWindow(15, '60s'), analytics: false })
  ),
  auth: getGlobal('rl:auth', () =>
    new Ratelimit({ redis: getRedis(), limiter: Ratelimit.fixedWindow(10, '60s'), analytics: false })
  ),
  ai: getGlobal('rl:ai', () =>
    new Ratelimit({ redis: getRedis(), limiter: Ratelimit.fixedWindow(10, '60s'), analytics: false })
  ),
  webhook: getGlobal('rl:webhook', () =>
    new Ratelimit({ redis: getRedis(), limiter: Ratelimit.fixedWindow(30, '60s'), analytics: false })
  ),
  api: getGlobal('rl:api', () =>
    new Ratelimit({ redis: getRedis(), limiter: Ratelimit.fixedWindow(60, '60s'), analytics: false })
  ),
};

// ── Async checkRateLimit (used by middleware) ─────────────────
export async function checkRateLimitAsync(
  limiter: Ratelimit,
  key: string
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  const { success, remaining, reset } = await limiter.limit(key);
  return { allowed: success, remaining, reset };
}

// ── Backward-compatible checkRateLimit (used by API routes) ──
type Window = { perMinute: number; perHour: number };

export type RateLimitResult = {
  allowed: boolean;
  remaining: { minute: number; hour: number };
  retryAfter: number | null;
};

// Dynamic import to avoid circular deps at module level
let localCheckFn: ((key: string, window: Window) => RateLimitResult) | null = null;

async function loadLocalCheck() {
  if (!localCheckFn) {
    const mod = await import('./rate-limit-local');
    localCheckFn = mod.checkRateLimit;
  }
  return localCheckFn;
}

// Synchronous wrapper for backward compatibility with API routes
// When Upstash is configured, API routes still use this (middleware handles cross-instance via Upstash)
export function checkRateLimit(
  key: string,
  window: Window = { perMinute: 100, perHour: 1000 }
): RateLimitResult {
  // For API routes, use local in-memory (middleware already handles Upstash-backed global limits)
  // This keeps the API code unchanged and avoids async/await migration
  if (!localCheckFn) {
    // Synchronous require for first call (only in Node.js runtime)
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('./rate-limit-local');
      localCheckFn = mod.checkRateLimit;
    } catch {
      return { allowed: true, remaining: { minute: window.perMinute, hour: window.perHour }, retryAfter: null };
    }
  }
  return localCheckFn(key, window);
}

// ── rateLimitResponse ────────────────────────────────────────
export function rateLimitResponse(retryAfter?: number | null) {
  const response = NextResponse.json(
    { error: 'rate_limit_exceeded' },
    { status: 429 }
  );
  if (retryAfter) {
    response.headers.set('Retry-After', String(Math.ceil(retryAfter / 1000)));
  }
  return response;
}

// ── Dedup for track endpoint using Redis ─────────────────────
export async function isDuplicateTrack(
  visitorId: string,
  path: string,
  windowMs: number = 30_000
): Promise<boolean> {
  if (!hasRedis()) return false;
  const redis = getRedis();
  const key = `dedup:${visitorId}:${path}`;
  const exists = await redis.exists(key);
  if (exists) return true;
  await redis.set(key, '1', { px: windowMs });
  return false;
}
