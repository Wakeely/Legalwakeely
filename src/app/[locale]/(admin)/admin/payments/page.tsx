import { getLocale } from 'next-intl/server';
import { requireAdmin } from '@/lib/admin-guard';
import { createAdminClient } from '@/lib/supabase/server';
import { AdminPaymentsLedger } from '@/components/admin/payments-ledger';

export const dynamic = 'force-dynamic';

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; plan_type?: string; q?: string; page?: string }>;
}) {
  const locale = await getLocale();
  await requireAdmin(locale);

  const sp   = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));
  const limit = 25;
  const status = sp.status ?? '';
  const plan   = sp.plan_type ?? '';
  const q      = sp.q?.trim().slice(0, 100) ?? '';
  const from   = (page - 1) * limit;

  const supabase = createAdminClient();

  let query = supabase
    .from('payment_orders')
    .select(
      `id, reference, user_id, plan_type, billing_period, amount_jod,
       status, proof_url, proof_transaction_id, proof_uploaded_at,
       verified_by, verified_at, rejection_reason, period_end,
       created_at, expires_at`,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (status) query = query.eq('status', status);
  if (plan)   query = query.eq('plan_type', plan);

  if (q) {
    const safeQ = q.replace(/[,()%]/g, '\\$&');
    query = query.or(`reference.ilike.%${safeQ}%`);
  }

  const { data: payments, count } = await query;

  // ── KPIs (full unpaginated set) ─────────────────────────────
  const [{ data: allVerified }, { data: allPending }, { data: allRejected }] = await Promise.all([
    supabase.from('payment_orders').select('amount_jod').eq('status', 'verified'),
    supabase.from('payment_orders').select('id').eq('status', 'proof_uploaded'),
    supabase.from('payment_orders').select('id').eq('status', 'rejected'),
  ]);

  const totalRevenueJod = ((allVerified ?? []) as Array<{ amount_jod: number }>)
    .reduce((sum, r) => sum + Number(r.amount_jod), 0);
  const kpis = {
    total_revenue_jod: Number(totalRevenueJod.toFixed(3)),
    verified_count:    (allVerified ?? []).length,
    pending_count:     (allPending ?? []).length,
    rejected_count:    (allRejected ?? []).length,
  };

  // ── Enrich with user info ──────────────────────────────────
  const userIds = [...new Set(((payments ?? []) as Array<{ user_id: string }>).map((r) => r.user_id))];
  const { data: users } = await supabase
    .from('users')
    .select('id, email, full_name')
    .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);
  const userMap = new Map(
    ((users ?? []) as Array<{ id: string; email: string; full_name: string }>).map((u) => [u.id, u]),
  );

  const enriched = ((payments ?? []) as Array<Record<string, unknown>>).map((r) => {
    const u = userMap.get(String(r.user_id));
    return {
      id: String(r.id),
      reference: String(r.reference),
      user_id: String(r.user_id),
      user_email: u?.email ?? null,
      user_name: u?.full_name ?? null,
      plan_type: String(r.plan_type),
      billing_period: String(r.billing_period),
      amount_jod: Number(r.amount_jod),
      status: String(r.status),
      proof_url: (r.proof_url as string | null) ?? null,
      proof_transaction_id: (r.proof_transaction_id as string | null) ?? null,
      proof_uploaded_at: (r.proof_uploaded_at as string | null) ?? null,
      verified_at: (r.verified_at as string | null) ?? null,
      rejection_reason: (r.rejection_reason as string | null) ?? null,
      period_end: (r.period_end as string | null) ?? null,
      created_at: String(r.created_at),
      expires_at: (r.expires_at as string | null) ?? null,
    } as React.ComponentProps<typeof AdminPaymentsLedger>['payments'][number];
  });

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-2xl font-black text-foreground">Payments</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          All CliQ payment orders across all users. Verify or reject pending proofs in the
          {' '}<a href={`/${locale}/admin/cliq`} className="text-[#0E7490] hover:underline font-medium">CliQ verify queue</a>.
        </p>
      </div>

      <AdminPaymentsLedger
        payments={enriched}
        total={count ?? 0}
        page={page}
        limit={limit}
        q={q}
        status={status}
        planType={plan}
        kpis={kpis}
      />
    </div>
  );
}
