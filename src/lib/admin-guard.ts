import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

/** Server-side admin guard — call at top of every admin page/route */
export async function requireAdmin(locale = 'en') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: profile } = await supabase
    .from('users')
    .select('role, is_suspended')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.is_suspended) redirect(`/${locale}/login?error=suspended`);
  if (profile?.role !== 'admin') redirect(`/${locale}/dashboard`);
  return { user, profile };
}

/** API route admin guard — returns 403 JSON if not admin */
export async function requireAdminApi(): Promise<
  { ok: true; userId: string } | { ok: false, response: Response }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) };
  }
  const { data: profile } = await supabase.from('users').select('role, is_suspended').eq('id', user.id).maybeSingle();
  if (profile?.is_suspended) {
    return { ok: false, response: new Response(JSON.stringify({ error: 'Account suspended' }), { status: 403 }) };
  }
  if (profile?.role !== 'admin') {
    return { ok: false, response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) };
  }
  return { ok: true, userId: user.id };
}

/**
 * Checks if ANY authenticated user is suspended. Use in non-admin
 * middleware/pages to block suspended users from the app.
 */
export async function checkNotSuspended(): Promise<{ suspended: boolean; userId?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { suspended: false };
  const { data: profile } = await supabase
    .from('users')
    .select('is_suspended')
    .eq('id', user.id)
    .maybeSingle();
  return { suspended: Boolean(profile?.is_suspended), userId: user.id };
}
