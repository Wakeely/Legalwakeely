import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requireAdmin } from '@/lib/admin-guard';
import { createAdminClient } from '@/lib/supabase/server';
import { getTierDrift } from '@/lib/admin/tier-drift';
import { AdminUserDossier } from '@/components/admin/user-dossier';
import type { SubscriptionTier } from '@/types';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminUserDossierPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  await requireAdmin(locale);
  const isRTL = locale === 'ar';
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const supabase = createAdminClient();

  // ── 1. Profile ───────────────────────────────────────────────
  const { data: user } = await supabase
    .from('users')
    .select(`
      id, email, full_name, phone, role, subscription_tier,
      created_at, last_seen_at, locale, data_region,
      is_suspended, suspended_at, suspend_reason, suspended_by,
      admin_notes
    `)
    .eq('id', id)
    .maybeSingle();

  if (!user) notFound();

  // ── 2. Subscription + tier drift ────────────────────────────
  const drift = await getTierDrift(id, (user.subscription_tier as SubscriptionTier) ?? 'basic');

  // ── 3. Payments (CliQ orders) ───────────────────────────────
  const { data: payments } = await supabase
    .from('payment_orders')
    .select(`
      id, reference, plan_type, billing_period, amount_jod, status,
      proof_url, proof_transaction_id, proof_uploaded_at,
      verified_at, verified_by, rejection_reason, period_end,
      created_at, expires_at
    `)
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  // ── 4. Legal-AI usage (monthly metering) ────────────────────
  const { data: usage } = await supabase
    .from('legal_ai_usage')
    .select('period_start, analyses_count, updated_at')
    .eq('user_id', id)
    .order('period_start', { ascending: false })
    .limit(12);

  // ── 5. Cases (as client) ────────────────────────────────────
  const { data: clientCases } = await supabase
    .from('cases')
    .select('id, title, case_type, status, health_score, created_at, updated_at')
    .eq('client_id', id)
    .order('updated_at', { ascending: false })
    .limit(20);

  // ── 6. Cases (as lawyer, if applicable) ─────────────────────
  const { data: lawyerAssignments } = await supabase
    .from('case_lawyers')
    .select(`
      case_id, status, created_at,
      cases!inner(id, title, case_type, status, updated_at)
    `)
    .eq('lawyer_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  // ── 7. Audit trail (actions affecting or by this user) ─────
  const { data: auditTarget } = await supabase
    .from('audit_logs')
    .select('action, resource, resource_id, severity, created_at, ip_address, metadata, changed_from, changed_to')
    .eq('resource_id', id)
    .order('created_at', { ascending: false })
    .limit(25);

  const { data: auditActor } = await supabase
    .from('audit_logs')
    .select('action, resource, resource_id, severity, created_at, ip_address, metadata, changed_from, changed_to')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(25);

  type AuditRow = {
    action: string;
    resource?: string;
    resource_id?: string;
    severity: string;
    created_at: string;
    ip_address?: string;
    metadata?: Record<string, unknown>;
    changed_from?: Record<string, unknown>;
    changed_to?: Record<string, unknown>;
  };

  // Merge target + actor audit entries, dedupe by (created_at + action).
  const auditMap = new Map<string, AuditRow>();
  for (const a of [...(auditTarget ?? []), ...(auditActor ?? [])] as AuditRow[]) {
    const key = `${a.action}@${a.created_at}`;
    if (!auditMap.has(key)) auditMap.set(key, a);
  }
  const audit = Array.from(auditMap.values())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 25);

  return (
    <div className="space-y-5 pb-10">
      <div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition mb-2"
        >
          <BackIcon className="h-4 w-4" />
          Back to users
        </Link>
        <h1 className="text-2xl font-black text-foreground">{user.full_name || 'Unnamed user'}</h1>
        <p className="text-sm text-muted-foreground mt-0.5 font-mono" dir="ltr">{user.email}</p>
      </div>

      <AdminUserDossier
        user={user}
        drift={drift}
        payments={(payments ?? []) as React.ComponentProps<typeof AdminUserDossier>['payments']}
        usage={(usage ?? []) as React.ComponentProps<typeof AdminUserDossier>['usage']}
        clientCases={(clientCases ?? []) as React.ComponentProps<typeof AdminUserDossier>['clientCases']}
        lawyerAssignments={(lawyerAssignments ?? []) as unknown as React.ComponentProps<typeof AdminUserDossier>['lawyerAssignments']}
        audit={audit as React.ComponentProps<typeof AdminUserDossier>['audit']}
      />
    </div>
  );
}
