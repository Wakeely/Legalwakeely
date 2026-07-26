import { getLocale } from 'next-intl/server';
import { requireAdmin } from '@/lib/admin-guard';
import { createAdminClient } from '@/lib/supabase/server';
import { getTierDriftBatch } from '@/lib/admin/tier-drift';
import { AdminUsersTable } from '@/components/admin/users-table';
import type { SubscriptionTier } from '@/types';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; suspended?: string; page?: string }>;
}) {
  const locale = await getLocale();
  await requireAdmin(locale);

  const sp    = await searchParams;
  const page  = Math.max(1, parseInt(sp.page ?? '1', 10));
  const limit = 25;
  const q     = sp.q?.trim().slice(0, 100) ?? '';
  const role  = sp.role ?? '';
  const suspended = sp.suspended ?? '';
  const from  = (page - 1) * limit;

  const supabase = createAdminClient();
  let query = supabase
    .from('users')
    .select('id,email,full_name,role,subscription_tier,created_at,last_seen_at,locale,data_region,is_suspended,suspended_at,suspend_reason', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  // Escape chars that have special meaning in PostgREST's filter syntax.
  if (q) {
    const safeQ = q.replace(/[,()%]/g, '\\$&');
    query = query.or(`email.ilike.%${safeQ}%,full_name.ilike.%${safeQ}%`);
  }
  if (role) query = query.eq('role', role);
  if (suspended === 'true') query = query.eq('is_suspended', true);

  const { data: users, count } = await query;

  // ── Enrich with tier drift ──────────────────────────────────
  // subscriptions table is the source of truth; users.subscription_tier
  // is a cache that can drift. Compute the drift once per page so the
  // UI can show a badge + Sync button on drifted rows.
  const usersList = (users ?? []) as Array<{ id: string; subscription_tier: SubscriptionTier }>;
  const driftMap = await getTierDriftBatch(usersList);

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-2xl font-black text-foreground">Users</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{count ?? 0} total users</p>
      </div>
      <AdminUsersTable
        users={(usersList ?? []) as unknown as React.ComponentProps<typeof AdminUsersTable>['users']}
        driftMap={driftMap}
        total={count ?? 0}
        page={page}
        limit={limit}
        q={q}
        role={role}
        locale={locale}
      />
    </div>
  );
}
