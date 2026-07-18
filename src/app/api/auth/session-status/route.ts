import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkSessionStatus } from "@/lib/session-enforcement";

export const runtime = "nodejs";

/**
 * GET /api/auth/session-status
 *
 * Called by the client periodically (every 60s) to check if the
 * current session is still active. If superseded, the client shows
 * the "account in use elsewhere" modal and logs the user out.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ authenticated: false });
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const sessionId = sessionData.session?.access_token
      ? hashToken(sessionData.session.access_token)
      : null;

    if (!sessionId) {
      return NextResponse.json({ authenticated: true, enforced: false });
    }

    let status: { active: boolean; reason?: string } = { active: true };
    try {
      status = await checkSessionStatus(user.id, sessionId);
    } catch {
      // If session check fails (table missing, RPC error, etc.),
      // don't block the user — just skip enforcement for this request.
      return NextResponse.json({ authenticated: true, enforced: false });
    }

    return NextResponse.json({
      authenticated: true,
      enforced: true,
      ...status,
    });
  } catch {
    // If anything fails, return a safe default — don't break the page
    return NextResponse.json({ authenticated: false, error: "check_failed" });
  }
}

function hashToken(token: string): string {
  // Use the last 32 chars of the JWT as the session ID
  // (the full token is too long to store, and the last segment
  // is the signature which is unique per session)
  return token.slice(-32);
}
