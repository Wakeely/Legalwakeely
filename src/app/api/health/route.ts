import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Liveness + readiness probe. Returns 200 if the app and its
 * critical dependencies (Supabase) are reachable.
 *
 * Uses the admin client to bypass RLS — the anon client can't read
 * the `users` table, so a health check against it would always fail.
 */
export async function GET() {
  const checks: Record<string, "ok" | "fail"> = {
    app: "ok",
  };

  // ── Supabase reachability (admin client bypasses RLS) ─────────
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("users").select("id").limit(1);
    checks.supabase = error ? "fail" : "ok";
  } catch {
    checks.supabase = "fail";
  }

  // ── Gemini configured? (required for Legal-AI module) ─────────
  checks.gemini = process.env.GEMINI_API_KEY ? "ok" : "fail";

  // ── Stripe configured? (required for subscriptions) ───────────
  checks.stripe = process.env.STRIPE_SECRET_KEY ? "ok" : "fail";

  // App is "healthy" if Supabase is reachable (the core dependency).
  // Gemini/Stripe are feature-specific — degrade gracefully.
  const coreOk = checks.app === "ok" && checks.supabase === "ok";
  return NextResponse.json(
    {
      status: coreOk ? "healthy" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: coreOk ? 200 : 503 },
  );
}
