import "server-only";
import { createClient } from "@/lib/supabase/server";
import { TIER_GATES, type SubscriptionTier } from "@/types";
import { canAccess } from "@/lib/feature-gate";

/**
 * Legal-AI subscription gate.
 *
 * The Legal-AI module (consolidated from Almustahar) is sold as a
 * paid add-on on top of any base Legal Wakeely tier, OR bundled with the
 * premium tier. Access is granted when EITHER:
 *   (a) the user's base tier is `premium` (TIER_GATES.premium.legal_ai === true), OR
 *   (b) the user has `subscriptions.legal_ai_enabled = true` (the add-on).
 *
 * This module also enforces a monthly fair-use cap on analysis count,
 * read from the `legal_ai_usage` table.
 */

/**
 * Monthly fair-use caps.
 *
 * - `LEGAL_AI_MONTHLY_CAP` applies when Legal-AI access comes from the
 *   **bundled** path (i.e. the user's base tier is `premium`).
 * - `LEGAL_AI_ADDON_MONTHLY_CAP` applies when access comes from the
 *   **paid add-on**, regardless of the base tier. The add-on is sold on
 *   top of ANY base tier (including `basic`), so its cap must NOT be
 *   derived from `LEGAL_AI_MONTHLY_CAP[baseTier]` — otherwise a `basic`
 *   user who bought the add-on ends up with cap 0 and is silently blocked
 *   even though they paid. (Regression fixed July 2026.)
 */
export const LEGAL_AI_MONTHLY_CAP: Record<SubscriptionTier, number> = {
  basic: 0,        // bundled path: basic has no Legal-AI
  pro: 0,          // bundled path: pro has no Legal-AI either
  premium: 100,    // bundled path: premium includes 100/month
};
export const LEGAL_AI_ADDON_MONTHLY_CAP = 25; // add-on: 25/month on any tier

function computeMonthlyCap(
  tier: SubscriptionTier,
  legalAiAddOnActive: boolean,
): number {
  // Bundled (premium) takes precedence — gives the higher cap.
  if (canAccess(tier, "legal_ai")) return LEGAL_AI_MONTHLY_CAP[tier];
  if (legalAiAddOnActive) return LEGAL_AI_ADDON_MONTHLY_CAP;
  return 0;
}

export interface LegalAiAccess {
  allowed: boolean;
  reason?: "no_subscription" | "usage_cap_reached" | "not_authenticated";
  tier: SubscriptionTier;
  legalAiEnabled: boolean;
  usedThisMonth: number;
  monthlyCap: number;
  remaining: number;
}

export async function checkLegalAiAccess(userId?: string): Promise<LegalAiAccess> {
  if (!userId) {
    return {
      allowed: false,
      reason: "not_authenticated",
      tier: "basic",
      legalAiEnabled: false,
      usedThisMonth: 0,
      monthlyCap: 0,
      remaining: 0,
    };
  }

  const supabase = await createClient();

  // ── 1. Load subscription row ──────────────────────────────────
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("tier, legal_ai_enabled, legal_ai_current_period_end, current_period_end, status")
    .eq("user_id", userId)
    .maybeSingle();

  const tier = (sub?.tier as SubscriptionTier | undefined) ?? "basic";
  const legalAiAddOn = Boolean(sub?.legal_ai_enabled);
  const now = new Date();

  // ── Check if the Legal-AI add-on period is still active ──────
  // CliQ payments are prepaid — if legal_ai_current_period_end has
  // passed, the add-on is expired (even if the flag is still true).
  const legalAiPeriodEnd = sub?.legal_ai_current_period_end
    ? new Date(sub.legal_ai_current_period_end)
    : null;
  const legalAiAddOnActive = legalAiAddOn && (!legalAiPeriodEnd || legalAiPeriodEnd > now);

  // ── Check if the base subscription period is still active ────
  // (For CliQ prepaid subscriptions; Stripe auto-renews so this is
  // less relevant there, but the check is harmless.)
  const basePeriodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  const baseActive = sub?.status === "active" && (!basePeriodEnd || basePeriodEnd > now);

  // Bundled into premium (if base is active), OR active add-on.
  const legalAiEnabled = (canAccess(tier, "legal_ai") && baseActive) || legalAiAddOnActive;

  if (!legalAiEnabled) {
    return {
      allowed: false,
      reason: "no_subscription",
      tier,
      legalAiEnabled: false,
      usedThisMonth: 0,
      monthlyCap: computeMonthlyCap(tier, legalAiAddOnActive),
      remaining: 0,
    };
  }

  // ── 2. Check monthly usage ────────────────────────────────────
  const periodStart = new Date().toISOString().slice(0, 7) + "-01";
  const { data: usage } = await supabase
    .from("legal_ai_usage")
    .select("analyses_count")
    .eq("user_id", userId)
    .eq("period_start", periodStart)
    .maybeSingle();

  const usedThisMonth = usage?.analyses_count ?? 0;
  const monthlyCap = computeMonthlyCap(tier, legalAiAddOnActive);
  const remaining = Math.max(0, monthlyCap - usedThisMonth);

  if (remaining === 0) {
    return {
      allowed: false,
      reason: "usage_cap_reached",
      tier,
      legalAiEnabled: true,
      usedThisMonth,
      monthlyCap,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    tier,
    legalAiEnabled: true,
    usedThisMonth,
    monthlyCap,
    remaining,
  };
}

/**
 * Throws a redirect to the upgrade page if the user lacks Legal-AI access.
 * Use in server components / route handlers that render Legal-AI pages.
 */
export async function requireLegalAi(userId?: string, redirectTo = "/billing"): Promise<LegalAiAccess> {
  const access = await checkLegalAiAccess(userId);
  if (!access.allowed) {
    const { redirect } = await import("next/navigation");
    redirect(redirectTo);
  }
  return access;
}
