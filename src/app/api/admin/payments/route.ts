import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-guard';
import { createAdminClient } from '@/lib/supabase/server';
import { writeAuditLog, getClientIp } from '@/lib/audit';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { safeInt } from '@/lib/sanitize';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/payments
 *
 * Returns a paginated, filterable ledger of ALL payment_orders (not
 * just pending). Reuses the existing payment_orders table — does NOT
 * touch the CliQ verify/reject routes.
 *
 * Query params:
 *   page        1-based page number (default 1)
 *   limit       page size (10–100, default 25)
 *   status      filter by status (pending|proof_uploaded|verified|rejected|expired)
 *   plan_type   filter by plan_type (basic|pro|premium|legal_ai_addon)
 *   q           search user email or reference code
 *   csv         if "1", return CSV instead of JSON (max 10k rows)
 */
export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`admin:${ip}`, { perMinute: 30, perHour: 1800 });
  if (!rl.allowed) return rateLimitResponse();

  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const url     = new URL(req.url);
  const page    = safeInt(url.searchParams.get('page'), 1, 1000, 1);
  const limit   = safeInt(url.searchParams.get('limit'), 10, 100, 25);
  const status  = url.searchParams.get('status') ?? '';
  const plan    = url.searchParams.get('plan_type') ?? '';
  const q       = url.searchParams.get('q')?.trim().slice(0, 100) ?? '';
  const asCsv   = url.searchParams.get('csv') === '1';

  const supabase = createAdminClient();

  // ── CSV export path (max 10k rows, no pagination) ──────────
  if (asCsv) {
    const csvLimit = 10_000;
    let query = supabase
      .from('payment_orders')
      .select(`
        id, reference, user_id, plan_type, billing_period, amount_jod,
        status, proof_url, proof_transaction_id, proof_uploaded_at,
        verified_by, verified_at, rejection_reason, period_end,
        created_at, expires_at
      `)
      .order('created_at', { ascending: false })
      .limit(csvLimit);

    if (status)       query = query.eq('status', status);
    if (plan)         query = query.eq('plan_type', plan);

    const { data: csvRows } = await query;

    // Fetch user names for the export
    const userIds = [...new Set((csvRows ?? []).map((r: { user_id: string }) => r.user_id))];
    const { data: csvUsers } = await supabase
      .from('users')
      .select('id, email, full_name')
      .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);
    const csvUserMap = new Map(
      ((csvUsers ?? []) as Array<{ id: string; email: string; full_name: string }>).map((u) => [u.id, u]),
    );

    await writeAuditLog({
      user_id: guard.userId,
      action: 'admin_payment_export',
      resource: 'payment_orders',
      severity: 'warn',
      ip_address: ip,
      metadata: { rows: csvRows?.length ?? 0, status, plan_type: plan },
    });

    // Build CSV
    const header = [
      'id', 'reference', 'user_id', 'user_email', 'user_name',
      'plan_type', 'billing_period', 'amount_jod', 'status',
      'proof_transaction_id', 'proof_uploaded_at', 'verified_at',
      'rejection_reason', 'period_end', 'created_at', 'expires_at',
    ];
    const esc = (v: unknown): string => {
      const s = v == null ? '' : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(',')];
    for (const r of (csvRows ?? []) as Array<Record<string, unknown>>) {
      const u = csvUserMap.get(String(r.user_id));
      lines.push([
        r.id, r.reference, r.user_id, u?.email ?? '', u?.full_name ?? '',
        r.plan_type, r.billing_period, r.amount_jod, r.status,
        r.proof_transaction_id ?? '', r.proof_uploaded_at ?? '',
        r.verified_at ?? '', r.rejection_reason ?? '',
        r.period_end ?? '', r.created_at, r.expires_at ?? '',
      ].map(esc).join(','));
    }

    return new NextResponse(lines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="payments-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  // ── JSON paginated path ────────────────────────────────────
  const from = (page - 1) * limit;
  let query = supabase
    .from('payment_orders')
    .select(`
      id, reference, user_id, plan_type, billing_period, amount_jod,
      status, proof_url, proof_transaction_id, proof_uploaded_at,
      verified_by, verified_at, rejection_reason, period_end,
      created_at, expires_at
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (status)       query = query.eq('status', status);
  if (plan)         query = query.eq('plan_type', plan);

  // Search by reference or by joining users — PostgREST can't do a
  // cross-table OR in a single query, so we do a two-step: if q is
  // present, first resolve user IDs matching the email/name, then
  // filter payment_orders by those IDs (combined with the reference
  // match via OR).
  if (q) {
    const safeQ = q.replace(/[,()%]/g, '\\$&');
    // Try reference match first — if any rows match, use those.
    // Otherwise resolve via users table.
    const { data: byRef } = await supabase
      .from('payment_orders')
      .select('id')
      .ilike('reference', `%${safeQ}%`)
      .limit(500);
    const { data: byUser } = await supabase
      .from('users')
      .select('id')
      .or(`email.ilike.%${safeQ}%,full_name.ilike.%${safeQ}%`)
      .limit(500);
    const ids = new Set<string>();
    for (const r of (byRef ?? []) as Array<{ id: string }>) ids.add(r.id);
    const uIds = (byUser ?? []) as Array<{ id: string }>;
    // Filter original query: match if id ∈ byRef OR user_id ∈ byUser
    // PostgREST doesn't support OR across columns directly here, so
    // we use .in('id', [...]) when ref matches exist, else .in('user_id', [...])
    if (ids.size > 0) {
      query = query.in('id', Array.from(ids));
    } else if (uIds.length > 0) {
      query = query.in('user_id', uIds.map((u) => u.id));
    } else {
      // No matches at all — return empty
      return NextResponse.json({ payments: [], total: 0, page, limit, kpis: null });
    }
  }

  const { data, count } = await query;

  // ── KPIs (computed over the FULL unpaginated set, not just this page) ──
  // Single round-trip via headless aggregate query.
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

  // ── Enrich with user info ───────────────────────────────────
  const userIds = [...new Set(((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id))];
  const { data: users } = await supabase
    .from('users')
    .select('id, email, full_name')
    .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);
  const userMap = new Map(
    ((users ?? []) as Array<{ id: string; email: string; full_name: string }>).map((u) => [u.id, u]),
  );

  const enriched = ((data ?? []) as Array<Record<string, unknown>>).map((r) => {
    const u = userMap.get(String(r.user_id));
    return {
      ...r,
      user_email: u?.email ?? null,
      user_name:  u?.full_name ?? null,
    };
  });

  return NextResponse.json({
    payments: enriched,
    total: count ?? 0,
    page,
    limit,
    kpis,
  });
}
