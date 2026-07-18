import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { calculatePeriodEnd } from "@/lib/cliq-server";

export const runtime = "nodejs";

/**
 * POST /api/admin/cliq/[id]/verify
 *
 * Admin verifies a CliQ payment. This:
 *   1. Sets the payment_order status to "verified"
 *   2. Activates the subscription:
 *      - If plan_type is a base tier (basic/pro/premium): updates
 *        subscriptions.tier + current_period_end
 *      - If plan_type is "legal_ai_addon": sets
 *        subscriptions.legal_ai_enabled = true + legal_ai_current_period_end
 *   3. Inserts a notification for the user
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return NextResponse.json({ error: "Forbidden" }, { status: guard.response.status });

  const { id } = await params;
  const admin = createAdminClient();
  const supabase = await createClient();

  // Fetch the order
  const { data: order, error: fetchErr } = await admin
    .from("payment_orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !order) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }

  if (order.status === "verified") {
    return NextResponse.json({ error: "already_verified" }, { status: 409 });
  }

  const periodEnd = calculatePeriodEnd(order.billing_period);

  // ── Activate the subscription ──────────────────────────────
  if (order.plan_type === "legal_ai_addon") {
    // Enable the Legal-AI add-on on the existing subscription
    await admin
      .from("subscriptions")
      .upsert({
        user_id: order.user_id,
        legal_ai_enabled: true,
        legal_ai_stripe_price_id: null,
        legal_ai_current_period_end: periodEnd,
        legal_ai_cancel_at_period_end: false,
        payment_method: "cliq",
      }, { onConflict: "user_id" });
  } else {
    // Upgrade the base tier
    await admin
      .from("subscriptions")
      .upsert({
        user_id: order.user_id,
        tier: order.plan_type,
        status: "active",
        current_period_end: periodEnd,
        cancel_at_period_end: false,
        payment_method: "cliq",
      }, { onConflict: "user_id" });

    // Also update the users table's subscription_tier cache
    await admin
      .from("users")
      .update({ subscription_tier: order.plan_type })
      .eq("id", order.user_id);
  }

  // ── Mark the order as verified ─────────────────────────────
  await admin
    .from("payment_orders")
    .update({
      status: "verified",
      verified_by: guard.userId,
      verified_at: new Date().toISOString(),
      activated_tier: order.plan_type === "legal_ai_addon" ? null : order.plan_type,
      activated_legal_ai: order.plan_type === "legal_ai_addon",
      period_end: periodEnd,
    })
    .eq("id", id);

  // ── Notify the user ────────────────────────────────────────
  const planLabel =
    order.plan_type === "legal_ai_addon"
      ? "Legal-AI add-on"
      : order.plan_type === "premium"
        ? "Premium"
        : order.plan_type === "pro"
          ? "Pro"
          : "Basic";

  await admin.from("notifications").insert({
    user_id: order.user_id,
    type: "subscription_updated",
    title: `Payment verified — ${planLabel} active`,
    body:
      order.plan_type === "legal_ai_addon"
        ? "Your CliQ payment has been verified. The Legal-AI add-on is now enabled."
        : `Your CliQ payment has been verified. Your ${planLabel} subscription is active until ${new Date(periodEnd).toLocaleDateString()}.`,
    action_url: "/billing",
  });

  return NextResponse.json({
    ok: true,
    verified: true,
    plan_type: order.plan_type,
    period_end: periodEnd,
  });
}
