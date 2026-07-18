import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── In-memory rate limit (per edge instance, resets on cold start) ──
const hits = new Map<string, { count: number; at: number }>();
const TRACK_LIMIT = 20; // max requests per IP per minute
const TRACK_WINDOW = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.at > TRACK_WINDOW) {
    hits.set(ip, { count: 1, at: now });
    return false;
  }
  if (rec.count >= TRACK_LIMIT) return true;
  rec.count++;
  return false;
}

/**
 * POST /api/track
 *
 * Anonymous page-view tracker. Rate-limited per IP.
 * Uses anon client (RLS enforced) instead of admin client.
 */
export async function POST(req: Request) {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";

  // ── Rate limit ────────────────────────────────────────────────
  if (isRateLimited(ip)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  let body: { path?: string; visitor_id?: string; locale?: string; referrer?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const ua = h.get("user-agent") ?? "";
  const country = h.get("x-vercel-ip-country") ?? null;

  const deviceType = /android|iphone|ipad|ipod/i.test(ua)
    ? "mobile"
    : /tablet|ipad/i.test(ua)
      ? "tablet"
      : "desktop";

  // ── Validate & sanitize inputs ────────────────────────────────
  const path = typeof body.path === "string" ? body.path.slice(0, 200) : "/";
  const visitorId = typeof body.visitor_id === "string" ? body.visitor_id.slice(0, 100) : "anonymous";
  const locale = typeof body.locale === "string" ? body.locale.slice(0, 10) : null;
  const referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 500) : null;

  // Use anon client (RLS enforced) instead of admin client
  const supabase = await createClient();
  const { error } = await supabase.from("page_views").insert({
    visitor_id: visitorId,
    path,
    locale,
    referrer,
    user_agent: ua.slice(0, 500),
    ip_address: ip,
    country,
    device_type: deviceType,
  });

  if (error) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
