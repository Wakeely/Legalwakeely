import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/track
 *
 * Anonymous page-view tracker. Called by the client on every page
 * load. Stores the view in page_views table for the analytics
 * dashboard.
 */
export async function POST(req: Request) {
  let body: { path?: string; visitor_id?: string; locale?: string; referrer?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? null;
  const country = h.get("x-vercel-ip-country") ?? null;

  const deviceType = /android|iphone|ipad|ipod/i.test(ua)
    ? "mobile"
    : /tablet|ipad/i.test(ua)
      ? "tablet"
      : /mobile/i.test(ua)
        ? "mobile"
        : "desktop";

  const admin = createAdminClient();
  const { error } = await admin.from("page_views").insert({
    visitor_id: body.visitor_id ?? "anonymous",
    path: body.path ?? "/",
    locale: body.locale ?? null,
    referrer: body.referrer ?? null,
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
