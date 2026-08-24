import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { registerSession, getDeviceInfo } from '@/lib/session-enforcement';

/**
 * Supabase OAuth callback.
 *
 * Flow:
 *   1. Google OAuth → Supabase → /api/auth/callback?code=...&next=/ar/invite?token=...
 *   2. We exchange the code, register the session (one-device enforcement),
 *      then redirect to `next`.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  const next   = searchParams.get('next') ?? '/ar/dashboard';
  const locale = next.match(/^\/(en|ar)/)?.[1] ?? 'ar';

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      // ── Register the session for one-device enforcement ──
      try {
        const deviceInfo = await getDeviceInfo();
        // OAuth flow can't read the client-side fingerprint (it's a redirect),
        // so we use the server-side fingerprint. Good enough for basic enforcement.
        const sessionId = data.session.access_token.slice(-32);
        const expiresAt = new Date(data.session.expires_at ?? Date.now() + 7 * 24 * 60 * 60 * 1000);
        await registerSession(data.user.id, sessionId, expiresAt, deviceInfo);
      } catch {
        // Non-fatal
      }

      // ── Lawyer elevation is admin-only (SEC-01 fix) ──
      // Previously trusted wakeely_intended_role cookie (client-set, unsigned) → self-elevation.
      // Now always start as client; lawyer requires admin verification.
      const cookieStore = await cookies();
      if (cookieStore.get('wakeely_intended_role')) {
        cookieStore.delete('wakeely_intended_role');
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/${locale}/login?error=oauth_failed`);
}
