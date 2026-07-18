import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { registerSession, getDeviceInfo } from "@/lib/session-enforcement";

export const runtime = "nodejs";

/**
 * POST /api/auth/on-login
 *
 * Called by the client immediately after a successful Supabase login.
 * Registers the new session in active_sessions, which supersedes all
 * previous sessions for that user (forcing old devices to log out).
 *
 * Request body:
 *   { session_id: string (the Supabase access token JID), expires_at: string (ISO) }
 *
 * The device fingerprint + IP are read from headers / request.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: { session_id?: string; expires_at?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 422 });
  }

  if (!body.session_id) {
    return NextResponse.json({ error: "session_id required" }, { status: 422 });
  }

  // Get the actual session to find the expiry
  const { data: sessionData } = await supabase.auth.getSession();
  const expiresAt = body.expires_at
    ? new Date(body.expires_at)
    : sessionData.session?.expires_at
      ? new Date(sessionData.session.expires_at)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // default 7 days

  const deviceInfo = await getDeviceInfo();

  // Read client-side fingerprint from header (more accurate than server-side)
  const h = req.headers;
  if (h.get("x-device-fingerprint")) {
    deviceInfo.fingerprint = h.get("x-device-fingerprint")!;
  }
  if (h.get("x-device-label")) {
    deviceInfo.label = h.get("x-device-label")!;
  }

  const sessionUuid = await registerSession(user.id, body.session_id, expiresAt, deviceInfo);

  if (!sessionUuid) {
    // Non-fatal — the user can still use the app, we just can't enforce
    // single-session for them. Log it.
    console.warn("[on-login] registerSession returned null for user", user.id);
    return NextResponse.json({ ok: true, enforced: false });
  }

  return NextResponse.json({
    ok: true,
    enforced: true,
    session_uuid: sessionUuid,
    device_label: deviceInfo.label,
  });
}
