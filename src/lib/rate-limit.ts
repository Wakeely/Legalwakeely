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
  return g[key];
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

// Cross-instance rate limiter for API routes.
// Previously this used purely in-memory counters, which reset per serverless
// instance — under real traffic spread across many concurrent instances, the
// configured limits were effectively unenforceable. This now uses the same
// Upstash Redis backend as the middleware limiters when it's configured, and
// only falls back to local in-memory (single-instance) counting when Redis
// isn't set up, e.g. local development. On any Redis error, it falls back to
// the local counter rather than allowing the request through unchecked.
export async function checkRateLimit(
  key: string,
  window: Window = { perMinute: 100, perHour: 1000 }
): Promise<RateLimitResult> {
  if (hasRedis()) {
    try {
      const redis = getRedis();
      const now = Date.now();
      const minuteBucket = Math.floor(now / 60_000);
      const hourBucket = Math.floor(now / 3_600_000);
      const minuteKey = `rl:${key}:m:${minuteBucket}`;
      const hourKey = `rl:${key}:h:${hourBucket}`;

      const [minuteCount, hourCount] = await Promise.all([
        redis.incr(minuteKey),
        redis.incr(hourKey),
      ]);
      // Only set TTL on the first hit in each bucket so it isn't refreshed
      // (and thus never expires) on every subsequent request.
      await Promise.all([
        minuteCount === 1 ? redis.expire(minuteKey, 60) : Promise.resolve(),
        hourCount === 1 ? redis.expire(hourKey, 3600) : Promise.resolve(),
      ]);

      if (minuteCount > window.perMinute) {
        return {
          allowed: false,
          remaining: { minute: 0, hour: Math.max(0, window.perHour - hourCount) },
          retryAfter: 60 - Math.floor((now / 1000) % 60),
        };
      }
      if (hourCount > window.perHour) {
        return { allowed: false, remaining: { minute: 0, hour: 0 }, retryAfter: 3600 - Math.floor((now / 1000) % 3600) };
      }
      return {
        allowed: true,
        remaining: {
          minute: Math.max(0, window.perMinute - minuteCount),
          hour: Math.max(0, window.perHour - hourCount),
        },
        retryAfter: null,
      };
    } catch {
      // Redis unreachable — fall through to local in-memory rather than
      // failing open (allowing the request unconditionally).
    }
  }
  const local = await loadLocalCheck();
  return local(key, window);
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
