import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Liveness probe. Returns 200 if Supabase is reachable.
 * Does NOT expose internal configuration (API keys, etc.).
 */
export async function GET() {
  const checks: Record<string, "ok" | "fail"> = {
    app: "ok",
  };

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("users").select("id").limit(1);
    checks.supabase = error ? "fail" : "ok";
  } catch {
    checks.supabase = "fail";
  }

  const coreOk = checks.app === "ok" && checks.supabase === "ok";
  return NextResponse.json(
    { status: coreOk ? "healthy" : "degraded" },
    { status: coreOk ? 200 : 503 },
  );
}
