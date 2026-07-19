type LocalState = { count: number; resetAt: number };
const store = new Map<string, LocalState>();
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [k, v] of store.entries()) {
    if (now > v.resetAt) store.delete(k);
  }
}

type Window = { perMinute: number; perHour: number };
type RateLimitResult = {
  allowed: boolean;
  remaining: { minute: number; hour: number };
  retryAfter: number | null;
};

export function checkRateLimit(
  key: string,
  window: Window = { perMinute: 100, perHour: 1000 }
): RateLimitResult {
  cleanup();
  const now = Date.now();
  const minuteWindowMs = 60_000;
  const hourWindowMs = 60 * 60_000;

  const minuteKey = `${key}:m`;
  const hourKey = `${key}:h`;

  let mRec = store.get(minuteKey);
  if (!mRec || now > mRec.resetAt) {
    mRec = { count: 1, resetAt: now + minuteWindowMs };
    store.set(minuteKey, mRec);
  } else {
    mRec.count++;
  }

  let hRec = store.get(hourKey);
  if (!hRec || now > hRec.resetAt) {
    hRec = { count: 1, resetAt: now + hourWindowMs };
    store.set(hourKey, hRec);
  } else {
    hRec.count++;
  }

  if (mRec.count > window.perMinute) {
    return {
      allowed: false,
      remaining: { minute: 0, hour: Math.max(0, window.perHour - hRec.count) },
      retryAfter: Math.ceil((mRec.resetAt - now) / 1000),
    };
  }

  if (hRec.count > window.perHour) {
    return {
      allowed: false,
      remaining: { minute: 0, hour: 0 },
      retryAfter: Math.ceil((hRec.resetAt - now) / 1000),
    };
  }

  return {
    allowed: true,
    remaining: {
      minute: window.perMinute - mRec.count,
      hour: window.perHour - hRec.count,
    },
    retryAfter: null,
  };
}

// ── Dedup for track endpoint (in-memory fallback) ──────────
const dedupStore = new Map<string, number>();
let lastDedupCleanup = Date.now();

export function checkDedup(key: string, windowMs: number = 30_000): boolean {
  const now = Date.now();
  if (now - lastDedupCleanup > 120_000) {
    lastDedupCleanup = now;
    for (const [k, v] of dedupStore) {
      if (now - v > windowMs * 2) dedupStore.delete(k);
    }
  }
  const last = dedupStore.get(key);
  return !!last && now - last < windowMs;
}

export function markTracked(key: string, timestamp: number): void {
  dedupStore.set(key, timestamp);
}
