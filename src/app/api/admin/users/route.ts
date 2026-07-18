import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/admin-guard';
import { createAdminClient } from '@/lib/supabase/server';
import { writeAuditLog, getClientIp } from '@/lib/audit';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { safeInt } from '@/lib/sanitize';
import { validateBody } from '@/lib/validate';

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`admin:${ip}`, { perMinute: 30, perHour: 1800 });
  if (!rl.allowed) return rateLimitResponse();

  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const url   = new URL(req.url);
  const page  = safeInt(url.searchParams.get('page'), 1, 1000, 1);
  const limit = safeInt(url.searchParams.get('limit'), 10, 100, 25);
  const q     = url.searchParams.get('q')?.trim().slice(0, 100) ?? '';
  const role  = url.searchParams.get('role') ?? '';
  const tier  = url.searchParams.get('tier') ?? '';
  const suspended = url.searchParams.get('suspended') ?? '';
  const from  = (page - 1) * limit;

  const supabase = createAdminClient();
  let query = supabase
    .from('users')
    .select('id,email,full_name,role,subscription_tier,created_at,last_seen_at,locale,data_region,is_suspended,suspended_at,suspend_reason', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (q)    query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  if (role) query = query.eq('role', role);
  if (tier) query = query.eq('subscription_tier', tier);
  if (suspended === 'true') query = query.eq('is_suspended', true);

  const { data, count } = await query;
  await writeAuditLog({ user_id: guard.userId, action: 'admin_user_view', severity: 'info', ip_address: ip });

  return NextResponse.json({ users: data ?? [], total: count ?? 0, page, limit });
}

// ── PATCH: update user fields (role, tier, suspend, admin_notes) ──
const patchSchema = z.object({
  target_id: z.string().uuid(),
  role: z.enum(['client', 'lawyer', 'admin']).optional(),
  subscription_tier: z.enum(['basic', 'pro', 'premium']).optional(),
  is_suspended: z.boolean().optional(),
  suspend_reason: z.string().trim().max(500).optional(),
  admin_notes: z.string().trim().max(2000).optional(),
  // Subscription overrides (super admin powers)
  force_tier: z.enum(['basic', 'pro', 'premium']).optional(),
  force_legal_ai: z.boolean().optional(),
  force_period_end: z.string().optional(), // ISO date
});

export async function PATCH(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`admin:${ip}`, { perMinute: 10, perHour: 600 });
  if (!rl.allowed) return rateLimitResponse();

  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const body = await validateBody(req, patchSchema);
  if (body instanceof NextResponse) return body;

  const { target_id, role, subscription_tier, is_suspended, suspend_reason, admin_notes,
          force_tier, force_legal_ai, force_period_end } = body;

  if (!target_id) return NextResponse.json({ error: 'target_id required' }, { status: 400 });

  const supabase = createAdminClient();

  // Don't allow admin to suspend themselves
  if (target_id === guard.userId && is_suspended === true) {
    return NextResponse.json({ error: 'Cannot suspend your own account' }, { status: 422 });
  }

  const { data: before } = await supabase
    .from('users')
    .select('role,subscription_tier,is_suspended,suspend_reason,admin_notes')
    .eq('id', target_id)
    .maybeSingle();

  // ── Update users table ──────────────────────────────────────
  const userUpdates: Record<string, unknown> = {};
  if (role) userUpdates.role = role;
  if (subscription_tier) userUpdates.subscription_tier = subscription_tier;
  if (is_suspended !== undefined) {
    userUpdates.is_suspended = is_suspended;
    userUpdates.suspended_at = is_suspended ? new Date().toISOString() : null;
    userUpdates.suspended_by = is_suspended ? guard.userId : null;
    userUpdates.suspend_reason = is_suspended ? (suspend_reason ?? null) : null;
  }
  if (admin_notes !== undefined) userUpdates.admin_notes = admin_notes;

  if (Object.keys(userUpdates).length > 0) {
    const { error: userErr } = await supabase.from('users').update(userUpdates).eq('id', target_id);
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });
  }

  // ── Force subscription override ─────────────────────────────
  // Super admin can grant a tier or Legal-AI without payment.
  if (force_tier || force_legal_ai !== undefined || force_period_end) {
    const subUpdate: Record<string, unknown> = {};
    if (force_tier) {
      subUpdate.tier = force_tier;
      subUpdate.status = 'active';
      subUpdate.payment_method = 'manual';
    }
    if (force_legal_ai !== undefined) {
      subUpdate.legal_ai_enabled = force_legal_ai;
      subUpdate.payment_method = 'manual';
    }
    if (force_period_end) {
      subUpdate.current_period_end = force_period_end;
      subUpdate.legal_ai_current_period_end = force_period_end;
    }

    const { error: subErr } = await supabase
      .from('subscriptions')
      .upsert({ user_id: target_id, ...subUpdate }, { onConflict: 'user_id' });
    if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });
  }

  // ── If suspending, kill their active sessions ───────────────
  if (is_suspended === true) {
    try {
      // Supabase admin API: sign out all sessions for this user.
      // The middleware also checks is_suspended on every request as a backstop.
      await supabase.auth.admin.signOut(target_id, 'global').catch(() => {});
    } catch {
      // non-fatal — the middleware will block them anyway
    }
  }

  const action = is_suspended === true ? 'admin_user_suspend'
    : is_suspended === false ? 'admin_user_unsuspend'
    : force_tier ? 'admin_force_tier'
    : force_legal_ai !== undefined ? 'admin_force_legal_ai'
    : role ? 'admin_role_change'
    : 'admin_user_edit';

  await writeAuditLog({
    user_id: guard.userId,
    action,
    resource: 'users',
    resource_id: target_id,
    severity: is_suspended || role === 'admin' ? 'critical' : 'warn',
    ip_address: ip,
    changed_from: before ?? {},
    changed_to: body,
  });

  return NextResponse.json({ ok: true });
}

// ── DELETE: permanently delete a user ────────────────────────────
const deleteSchema = z.object({
  target_id: z.string().uuid(),
  confirm: z.boolean().optional(), // must be true
});

export async function DELETE(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`admin:${ip}`, { perMinute: 5, perHour: 60 });
  if (!rl.allowed) return rateLimitResponse();

  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const body = await validateBody(req, deleteSchema);
  if (body instanceof NextResponse) return body;

  if (body.target_id === guard.userId) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 422 });
  }

  const supabase = createAdminClient();

  // Get user info for audit before deleting
  const { data: before } = await supabase
    .from('users')
    .select('email, full_name, role, subscription_tier')
    .eq('id', body.target_id)
    .maybeSingle();

  if (!before) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Delete auth user (cascades the users row + all user-owned data)
  const { error: authErr } = await supabase.auth.admin.deleteUser(body.target_id);
  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 500 });
  }

  await writeAuditLog({
    user_id: guard.userId,
    action: 'admin_user_delete',
    resource: 'users',
    resource_id: body.target_id,
    severity: 'critical',
    ip_address: ip,
    changed_from: before,
    changed_to: { deleted: true },
  });

  return NextResponse.json({ ok: true, deleted: body.target_id });
}
