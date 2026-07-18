import { getLocale } from 'next-intl/server';
import { requireAdmin } from '@/lib/admin-guard';
import { createAdminClient } from '@/lib/supabase/server';
import { AdminSubscriptionsPanel } from '@/components/admin/subscriptions-panel';

export const dynamic = 'force-dynamic';

export default async function AdminSubscriptionsPage() {
  const locale = await getLocale();
  await requireAdmin(locale);
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Fetch all subscriptions joined with user info
  const { data: subs } = await supabase
    .from('subscriptions')
    .select(`
      user_id,
      tier,
      status,
      current_period_end,
      legal_ai_enabled,
      legal_ai_current_period_end,
      payment_method,
      cancel_at_period_end,
      created_at
    `)
    .order('created_at', { ascending: false });

  // Fetch all users for name/email lookup
  const userIds = (subs ?? []).map((s) => s.user_id);
  const { data: users } = await supabase
    .from('users')
    .select('id, email, full_name, is_suspended')
    .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

  const userMap = new Map((users ?? []).map((u) => [u.id, u]));

  // Fetch CliQ revenue (verified payments)
  const { data: verifiedPayments } = await supabase
    .from('payment_orders')
    .select('amount_jod, plan_type, billing_period, verified_at, period_end')
    .eq('status', 'verified')
    .order('verified_at', { ascending: false });

  // Calculate revenue metrics
  const payments = (verifiedPayments ?? []) as Array<Record<string, unknown>>;
  const totalRevenueJod = payments.reduce((sum, p) => sum + Number(p.amount_jod), 0);

  // This month's revenue
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthlyRevenueJod = payments
    .filter((p) => p.verified_at && new Date(String(p.verified_at)) >= monthStart)
    .reduce((sum, p) => sum + Number(p.amount_jod), 0);

  // Active subscriptions by tier
  const allSubs = (subs ?? []) as Array<Record<string, unknown>>;
  const activeSubs = allSubs.filter((s) => s.status === 'active');
  const byTier = {
    basic: activeSubs.filter((s) => s.tier === 'basic').length,
    pro: activeSubs.filter((s) => s.tier === 'pro').length,
    premium: activeSubs.filter((s) => s.tier === 'premium').length,
  };
  const legalAiCount = activeSubs.filter((s) => s.legal_ai_enabled).length;

  // Expired subscriptions (period_end < now)
  const expired = allSubs.filter(
    (s) => s.current_period_end && new Date(String(s.current_period_end)) < new Date(now),
  );

  // Users with NO subscription row at all (basic by default)
  const { count: totalUsers } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  const usersWithSubs = new Set(allSubs.map((s) => s.user_id));
  const noSubCount = (totalUsers ?? 0) - usersWithSubs.size;

  return (
    <AdminSubscriptionsPanel
      subscriptions={activeSubs.map((s) => ({
        user_id: String(s.user_id),
        tier: String(s.tier),
        status: String(s.status),
        current_period_end: (s.current_period_end as string | null) ?? null,
        legal_ai_enabled: Boolean(s.legal_ai_enabled),
        legal_ai_current_period_end: (s.legal_ai_current_period_end as string | null) ?? null,
        payment_method: String(s.payment_method ?? 'cliq'),
        cancel_at_period_end: Boolean(s.cancel_at_period_end),
        created_at: String(s.created_at),
        user_name: userMap.get(s.user_id as string)?.full_name ?? '—',
        user_email: userMap.get(s.user_id as string)?.email ?? '—',
        is_suspended: Boolean(userMap.get(s.user_id as string)?.is_suspended),
      }))}
      expiredCount={expired.length}
      noSubCount={noSubCount}
      revenue={{
        total_jod: totalRevenueJod,
        monthly_jod: monthlyRevenueJod,
        by_tier: byTier,
        legal_ai_count: legalAiCount,
        recent_payments: payments.slice(0, 20).map((p) => ({
          amount_jod: Number(p.amount_jod),
          plan_type: String(p.plan_type),
          billing_period: String(p.billing_period),
          verified_at: String(p.verified_at),
        })),
      }}
    />
  );
}
