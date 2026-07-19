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

export function checkRateLimit(
  key: string,
  limit: number = 60,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number; reset: number } {
  cleanup();
  const now = Date.now();
  const record = store.get(key);

  if (!record || now > record.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, reset: now + windowMs };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0, reset: record.resetAt };
  }

  record.count++;
  return { allowed: true, remaining: limit - record.count, reset: record.resetAt };
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
