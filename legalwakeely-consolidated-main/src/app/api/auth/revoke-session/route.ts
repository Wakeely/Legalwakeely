import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { validateBody } from "@/lib/validate";

export const runtime = "nodejs";

const revokeSchema = z.object({
  session_id: z.string().min(1).max(100),
});

/**
 * POST /api/auth/revoke-session
 *
 * Revokes a specific session (used by the /settings/devices page).
 * The user can revoke any of their own sessions except the current one.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await validateBody(req, revokeSchema);
  if (body instanceof NextResponse) return body;

  const admin = createAdminClient();

  // Get the current session ID so we don't revoke it
  const { data: sessionData } = await supabase.auth.getSession();
  const currentSessionId = sessionData.session?.access_token
    ? sessionData.session.access_token.slice(-32)
    : null;

  if (body.session_id === currentSessionId) {
    return NextResponse.json({ error: "cannot_revoke_current_session" }, { status: 422 });
  }

  const { error } = await admin
    .from("active_sessions")
    .update({ status: "revoked" })
    .eq("user_id", user.id)
    .eq("session_id", body.session_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
