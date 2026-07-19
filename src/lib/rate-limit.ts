import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

function getRedis(): Redis {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

// Singleton instances (cached on globalThis to survive hot reloads in dev)
function getGlobal<T>(key: string, factory: () => T): T {
  const g = globalThis as unknown as Record<string, T>;
  if (!g[key]) g[key] = factory();
  return g[key];
}

export const rateLimiters = {
  // Global: 60 requests per minute per IP
  global: getGlobal('rl:global', () =>
    new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.fixedWindow(60, '60s'),
      analytics: false,
    })
  ),

  // Page routes: 20 requests per minute per IP (SSR is expensive)
  page: getGlobal('rl:page', () =>
    new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.fixedWindow(20, '60s'),
      analytics: false,
    })
  ),

  // Track endpoint: 15 requests per minute per IP
  track: getGlobal('rl:track', () =>
    new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.fixedWindow(15, '60s'),
      analytics: false,
    })
  ),

  // Auth routes: 10 requests per minute per IP
  auth: getGlobal('rl:auth', () =>
    new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.fixedWindow(10, '60s'),
      analytics: false,
    })
  ),

  // AI routes: 10 requests per minute per IP (expensive operations)
  ai: getGlobal('rl:ai', () =>
    new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.fixedWindow(10, '60s'),
      analytics: false,
    })
  ),

  // Webhooks: 30 requests per minute per IP
  webhook: getGlobal('rl:webhook', () =>
    new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.fixedWindow(30, '60s'),
      analytics: false,
    })
  ),

  // API default: 60 requests per minute per IP
  api: getGlobal('rl:api', () =>
    new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.fixedWindow(60, '60s'),
      analytics: false,
    })
  ),
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  reset: number;
};

export async function checkRateLimit(
  limiter: Ratelimit,
  key: string
): Promise<RateLimitResult> {
  const { success, remaining, reset } = await limiter.limit(key);
  return { allowed: success, remaining, reset };
}

export function rateLimitResponse(retryAfter?: number) {
  const response = NextResponse.json(
    { error: 'rate_limit_exceeded', retryAfter },
    { status: 429 }
  );
  if (retryAfter) {
    response.headers.set('Retry-After', String(Math.ceil(retryAfter / 1000)));
  }
  return response;
}

// Dedup for track endpoint using Redis
export async function isDuplicateTrack(
  visitorId: string,
  path: string,
  windowMs: number = 30_000
): Promise<boolean> {
  const redis = getRedis();
  const key = `dedup:${visitorId}:${path}`;
  const exists = await redis.exists(key);
  if (exists) return true;
  await redis.set(key, '1', { px: windowMs });
  return false;
}
