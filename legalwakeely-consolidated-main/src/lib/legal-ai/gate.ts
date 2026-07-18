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

export const LEGAL_AI_MONTHLY_CAP: Record<SubscriptionTier, number> = {
  basic: 0,        // cannot use without the add-on
  pro: 25,         // add-on: 25 analyses/month
  premium: 100,    // bundled: 100/month
};

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
      monthlyCap: LEGAL_AI_MONTHLY_CAP[tier],
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
  const monthlyCap = LEGAL_AI_MONTHLY_CAP[tier];
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
