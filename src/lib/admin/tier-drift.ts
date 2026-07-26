import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { SubscriptionTier } from "@/types";

/**
 * Tier drift detection.
 *
 * The `users.subscription_tier` column is a CACHE of the subscription's
 * effective tier. It's denormalized for fast reads (dashboard, gate
 * checks, admin lists). The `subscriptions` table is the SOURCE OF
 * TRUTH — it carries `tier`, `status`, and `current_period_end`.
 *
 * These can drift apart when:
 *   - A CliQ payment is verified (verify route writes both, but older
 *     code paths or direct DB edits may not).
 *   - A `force_tier` admin override updates `users` but not `subscriptions`.
 *   - A subscription expires (`current_period_end` passes) without a
 *     corresponding update to `users.subscription_tier`.
 *   - Manual SQL fixes.
 *
 * This module computes the EFFECTIVE tier from `subscriptions` (treating
 * expired or inactive subs as `basic`) and compares it to the cached
 * `users.subscription_tier` to surface drift.
 */

export type TierDriftStatus = "aligned" | "drifted_tier" | "drifted_expired" | "no_subscription_row";

export interface TierDriftResult {
  /** What `users.subscription_tier` says. */
  cachedTier: SubscriptionTier;
  /** What `subscriptions` says is effectively active (basic if expired/none). */
  effectiveTier: SubscriptionTier;
  status: TierDriftStatus;
  /** True if the cached tier differs from the effective tier. */
  hasDrift: boolean;
  /** Why — human-readable explanation for the admin UI. */
  reason: string;
  /** Raw subscription row, if any (for the dossier page). */
  subscription: SubscriptionRow | null;
}

export interface SubscriptionRow {
  user_id: string;
  tier: SubscriptionTier | null;
  status: string | null;
  current_period_end: string | null;
  legal_ai_enabled: boolean;
  legal_ai_current_period_end: string | null;
  payment_method: string | null;
  cancel_at_period_end: boolean | null;
}

/**
 * Compute the effective tier for a single user.
 *
 * Rules:
 *   - No `subscriptions` row → `basic` (free tier by default).
 *   - `status !== 'active'` → `basic`.
 *   - `current_period_end` in the past → `basic` (prepaid expired).
 *   - Otherwise → `subscriptions.tier`.
 *
 * Legal-AI add-on is evaluated separately (it's independent of the base
 * tier) and is NOT collapsed here — see `legal_ai_enabled` on the row.
 */
export function computeEffectiveTier(sub: SubscriptionRow | null): SubscriptionTier {
  if (!sub) return "basic";
  if (sub.status !== "active") return "basic";
  if (sub.current_period_end) {
    const end = new Date(sub.current_period_end).getTime();
    if (Number.isNaN(end)) return "basic";
    if (end < Date.now()) return "basic"; // prepaid expired
  }
  return (sub.tier ?? "basic") as SubscriptionTier;
}

/**
 * Compare cached tier (from `users`) vs effective tier (from `subscriptions`).
 */
export function computeDrift(
  cachedTier: SubscriptionTier,
  sub: SubscriptionRow | null,
): TierDriftResult {
  const effectiveTier = computeEffectiveTier(sub);

  if (!sub) {
    return {
      cachedTier,
      effectiveTier,
      status: "no_subscription_row",
      hasDrift: cachedTier !== "basic",
      reason:
        cachedTier === "basic"
          ? "No subscription row; cached as basic. Aligned."
          : `Cached as ${cachedTier} but no subscription row exists. Should be basic.`,
      subscription: null,
    };
  }

  if (effectiveTier === cachedTier) {
    return {
      cachedTier,
      effectiveTier,
      status: "aligned",
      hasDrift: false,
      reason: "Cached tier matches active subscription.",
      subscription: sub,
    };
  }

  // Drift cases
  const expired =
    sub.status === "active" &&
    Boolean(sub.current_period_end) &&
    new Date(sub.current_period_end as string).getTime() < Date.now();

  return {
    cachedTier,
    effectiveTier,
    status: expired ? "drifted_expired" : "drifted_tier",
    hasDrift: true,
    reason: expired
      ? `Subscription expired on ${new Date(sub.current_period_end as string).toLocaleDateString()} but users.subscription_tier still says ${cachedTier}.`
      : `subscriptions.tier is ${sub.tier ?? "null"} but users.subscription_tier says ${cachedTier}.`,
    subscription: sub,
  };
}

/**
 * Fetch the subscription row for a single user.
 */
export async function fetchSubscription(
  userId: string,
): Promise<SubscriptionRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("subscriptions")
    .select(
      "user_id, tier, status, current_period_end, legal_ai_enabled, legal_ai_current_period_end, payment_method, cancel_at_period_end",
    )
    .eq("user_id", userId)
    .maybeSingle();
  return (data as SubscriptionRow | null) ?? null;
}

/**
 * Batch-fetch subscriptions for many users (one round-trip).
 * Returns a Map keyed by user_id.
 */
export async function fetchSubscriptionsBatch(
  userIds: string[],
): Promise<Map<string, SubscriptionRow>> {
  if (userIds.length === 0) return new Map();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("subscriptions")
    .select(
      "user_id, tier, status, current_period_end, legal_ai_enabled, legal_ai_current_period_end, payment_method, cancel_at_period_end",
    )
    .in("user_id", userIds);
  const map = new Map<string, SubscriptionRow>();
  for (const row of (data ?? []) as SubscriptionRow[]) {
    map.set(row.user_id, row);
  }
  return map;
}

/**
 * Compute drift for a single user (fetches the subscription row).
 */
export async function getTierDrift(
  userId: string,
  cachedTier: SubscriptionTier,
): Promise<TierDriftResult> {
  const sub = await fetchSubscription(userId);
  return computeDrift(cachedTier, sub);
}

/**
 * Compute drift for a batch of users.
 *
 * @param users Array of `{ id, subscription_tier }` from the users table.
 * @returns Map keyed by user_id.
 */
export async function getTierDriftBatch(
  users: Array<{ id: string; subscription_tier: SubscriptionTier }>,
): Promise<Map<string, TierDriftResult>> {
  const subs = await fetchSubscriptionsBatch(users.map((u) => u.id));
  const out = new Map<string, TierDriftResult>();
  for (const u of users) {
    out.set(u.id, computeDrift(u.subscription_tier, subs.get(u.id) ?? null));
  }
  return out;
}

/**
 * Sync `users.subscription_tier` to match the effective tier from
 * `subscriptions`. Returns the new tier that was written.
 *
 * Caller is responsible for the audit log entry.
 */
export async function syncUserTier(
  userId: string,
): Promise<{ syncedFrom: SubscriptionTier; syncedTo: SubscriptionTier; drift: TierDriftResult }> {
  const supabase = createAdminClient();

  // Read the current cached tier (for the audit `changed_from`).
  const { data: user } = await supabase
    .from("users")
    .select("subscription_tier")
    .eq("id", userId)
    .maybeSingle();
  const cachedTier = (user?.subscription_tier as SubscriptionTier) ?? "basic";

  const sub = await fetchSubscription(userId);
  const drift = computeDrift(cachedTier, sub);

  if (!drift.hasDrift) {
    // Nothing to write — return without an UPDATE.
    return { syncedFrom: cachedTier, syncedTo: cachedTier, drift };
  }

  const { error } = await supabase
    .from("users")
    .update({ subscription_tier: drift.effectiveTier })
    .eq("id", userId);

  if (error) {
    throw new Error(`Failed to sync tier: ${error.message}`);
  }

  return { syncedFrom: cachedTier, syncedTo: drift.effectiveTier, drift };
}
