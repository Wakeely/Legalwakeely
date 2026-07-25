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

      // ── Honor an "I selected Lawyer" choice from registration ──
      // Google OAuth never carries the register page's role selection
      // through on its own, so the register page stashes it in a
      // short-lived cookie before starting the redirect. This callback
      // is the one place ALL Google sign-ins land (register page and
      // login page both route through here), and — unlike a plain page
      // render — a Route Handler is actually allowed to mutate cookies,
      // so this can read AND clear it properly (a page-level attempt at
      // this same fix earlier could only read it, not clear it).
      const cookieStore = await cookies();
      const intendedRole = cookieStore.get('wakeely_intended_role')?.value;
      if (intendedRole === 'lawyer') {
        await supabase.from('users').update({ role: 'lawyer' }).eq('id', data.user.id);
        cookieStore.delete('wakeely_intended_role');
        return NextResponse.redirect(`${origin}/${locale}/lawyer/cases`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/${locale}/login?error=oauth_failed`);
}
