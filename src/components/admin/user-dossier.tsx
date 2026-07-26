'use client';

import { useState } from 'react';
import {
  Loader2, RefreshCw, AlertTriangle, CheckCircle2, XCircle,
  Crown, Sparkles, Ban, FileText, Scale, Activity, CreditCard,
  Calendar, Shield, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TierDriftResult } from '@/lib/admin/tier-drift';

// ── Types (loosely typed — these come from raw Supabase rows) ──
interface DossierUser {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: string;
  subscription_tier: string;
  created_at: string;
  last_seen_at?: string;
  locale: string;
  data_region: string;
  is_suspended?: boolean;
  suspended_at?: string;
  suspend_reason?: string;
  admin_notes?: string;
}

interface Payment {
  id: string;
  reference: string;
  plan_type: string;
  billing_period: string;
  amount_jod: number;
  status: string;
  proof_url?: string | null;
  proof_transaction_id?: string | null;
  proof_uploaded_at?: string | null;
  verified_at?: string | null;
  rejection_reason?: string | null;
  period_end?: string | null;
  created_at: string;
  expires_at?: string;
}

interface UsageRow {
  period_start: string;
  analyses_count: number;
  updated_at?: string;
}

interface CaseRow {
  id: string;
  title: string;
  case_type: string;
  status: string;
  health_score?: number;
  created_at: string;
  updated_at: string;
}

interface LawyerAssignment {
  case_id: string;
  status: string;
  created_at: string;
  cases: CaseRow;
}

interface AuditRow {
  action: string;
  resource?: string;
  resource_id?: string;
  severity: string;
  created_at: string;
  ip_address?: string;
  metadata?: Record<string, unknown>;
  changed_from?: Record<string, unknown>;
  changed_to?: Record<string, unknown>;
}

interface AdminUserDossierProps {
  user: DossierUser;
  drift: TierDriftResult;
  payments: Payment[];
  usage: UsageRow[];
  clientCases: CaseRow[];
  lawyerAssignments: LawyerAssignment[];
  audit: AuditRow[];
}

const TIER_COLORS: Record<string, string> = {
  premium: 'bg-amber-100 text-[#C89B3C]',
  pro:     'bg-blue-100  text-[#1A3557]',
  basic:   'bg-muted     text-muted-foreground',
};

const STATUS_COLORS: Record<string, string> = {
  verified:    'bg-emerald-100 text-emerald-700',
  pending:     'bg-muted      text-muted-foreground',
  proof_uploaded: 'bg-amber-100  text-amber-700',
  rejected:    'bg-red-100    text-red-700',
  expired:     'bg-muted      text-muted-foreground',
};

const SEVERITY_COLORS: Record<string, string> = {
  info:     'bg-blue-100    text-blue-700',
  warn:     'bg-amber-100   text-amber-700',
  error:    'bg-orange-100  text-orange-700',
  critical: 'bg-red-100     text-red-700',
};

function fmtDate(s?: string | null): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return s;
  }
}

function fmtMoney(jod: number): string {
  return `${Number(jod).toFixed(3)} JOD`;
}

export function AdminUserDossier({
  user, drift, payments, usage, clientCases, lawyerAssignments, audit,
}: AdminUserDossierProps) {
  const [updating, setUpdating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function patch(changes: Record<string, unknown>, label: string) {
    setUpdating(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: user.id, ...changes }),
      });
      const j = await res.json();
      if (res.ok) {
        setFeedback(`✓ ${label}`);
        setTimeout(() => setFeedback(null), 3000);
        // Reload to reflect any DB-side changes (tier sync, force_tier, etc.)
        if (changes.sync_tier || changes.force_tier) {
          setTimeout(() => window.location.reload(), 800);
        }
      } else {
        setFeedback(`✗ ${j.error ?? 'Failed'}`);
      }
    } catch {
      setFeedback('✗ Network error');
    } finally {
      setUpdating(false);
    }
  }

  // ── Derived KPIs ────────────────────────────────────────────
  const totalPaid = payments
    .filter((p) => p.status === 'verified')
    .reduce((sum, p) => sum + Number(p.amount_jod), 0);
  const verifiedCount = payments.filter((p) => p.status === 'verified').length;
  const pendingCount = payments.filter((p) => p.status === 'proof_uploaded').length;
  const rejectedCount = payments.filter((p) => p.status === 'rejected').length;
  const totalAnalyses = usage.reduce((sum, u) => sum + Number(u.analyses_count), 0);

  return (
    <div className="space-y-5">
      {feedback && (
        <div className={cn(
          'rounded-lg px-3 py-2 text-xs font-semibold',
          feedback.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
        )}>
          {feedback}
        </div>
      )}

      {/* ── KPI strip ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Total paid" value={fmtMoney(totalPaid)} icon={CreditCard} />
        <KpiCard label="Verified" value={verifiedCount} icon={CheckCircle2} />
        <KpiCard label="Pending" value={pendingCount} icon={AlertTriangle} />
        <KpiCard label="Rejected" value={rejectedCount} icon={XCircle} />
        <KpiCard label="Legal-AI runs" value={totalAnalyses} icon={Sparkles} />
      </div>

      {/* ── Profile + subscription + drift ───────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Profile" icon={Shield} className="lg:col-span-2">
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <Field label="User ID" value={<span className="font-mono" dir="ltr">{user.id}</span>} />
            <Field label="Email" value={<span className="font-mono" dir="ltr">{user.email}</span>} />
            <Field label="Phone" value={<span dir="ltr">{user.phone || '—'}</span>} />
            <Field label="Role" value={<span className="capitalize">{user.role}</span>} />
            <Field label="Joined" value={<span dir="ltr">{fmtDate(user.created_at)}</span>} />
            <Field label="Last seen" value={<span dir="ltr">{fmtDate(user.last_seen_at)}</span>} />
            <Field label="Locale" value={user.locale} />
            <Field label="Data region" value={user.data_region} />
            <Field
              label="Status"
              value={
                user.is_suspended ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                    <Ban className="h-2.5 w-2.5" /> Suspended
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Active
                  </span>
                )
              }
            />
          </dl>
          {user.is_suspended && user.suspend_reason && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <strong>Reason:</strong> {user.suspend_reason}
            </p>
          )}
          {user.admin_notes && (
            <p className="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <strong>Admin notes:</strong> {user.admin_notes}
            </p>
          )}
        </Card>

        <Card title="Subscription" icon={Crown}>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cached tier</span>
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', TIER_COLORS[user.subscription_tier] ?? TIER_COLORS.basic)}>
                {user.subscription_tier}
              </span>
            </div>

            {drift.subscription && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Effective tier</span>
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', TIER_COLORS[drift.effectiveTier] ?? TIER_COLORS.basic)}>
                    {drift.effectiveTier}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Sub status</span>
                  <span className="font-mono">{drift.subscription.status ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Period ends</span>
                  <span dir="ltr">{fmtDate(drift.subscription.current_period_end)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Legal-AI</span>
                  <span className={drift.subscription.legal_ai_enabled ? 'text-emerald-700 font-bold' : 'text-muted-foreground'}>
                    {drift.subscription.legal_ai_enabled ? 'Enabled' : 'Off'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Payment method</span>
                  <span className="font-mono">{drift.subscription.payment_method ?? '—'}</span>
                </div>
              </>
            )}

            {drift.hasDrift ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5">
                <p className="flex items-center gap-1 text-[10px] font-bold text-amber-800">
                  <AlertTriangle className="h-2.5 w-2.5" /> Drift detected
                </p>
                <p className="mt-1 text-[10px] text-amber-700">{drift.reason}</p>
                <button
                  onClick={() => patch({ sync_tier: true }, `Synced tier → ${drift.effectiveTier}`)}
                  disabled={updating}
                  className="mt-2 w-full rounded-lg bg-amber-600 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  <RefreshCw className="mr-0.5 inline h-2.5 w-2.5" />
                  Sync from subscription
                </button>
              </div>
            ) : (
              <p className="rounded-lg bg-emerald-50 px-2 py-1.5 text-[10px] text-emerald-700">
                <CheckCircle2 className="mr-0.5 inline h-2.5 w-2.5" />
                Aligned with subscription
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* ── Super-admin overrides ────────────────────────────── */}
      <Card title="Super admin — force subscription" icon={Crown}>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => patch({ force_tier: 'pro', force_period_end: new Date(Date.now() + 30 * 86400000).toISOString() }, 'Granted Pro for 30 days')}
            disabled={updating}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Grant Pro (30d)
          </button>
          <button
            onClick={() => patch({ force_tier: 'premium', force_period_end: new Date(Date.now() + 30 * 86400000).toISOString() }, 'Granted Premium for 30 days')}
            disabled={updating}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            Grant Premium (30d)
          </button>
          <button
            onClick={() => patch({ force_legal_ai: true, force_period_end: new Date(Date.now() + 30 * 86400000).toISOString() }, 'Enabled Legal-AI for 30 days')}
            disabled={updating}
            className="rounded-lg bg-teal-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            <Sparkles className="mr-0.5 inline h-2.5 w-2.5" /> Enable Legal-AI (30d)
          </button>
          <button
            onClick={() => patch({ force_legal_ai: false }, 'Disabled Legal-AI')}
            disabled={updating}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-[10px] font-bold text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            Disable Legal-AI
          </button>
          <button
            onClick={() => patch({ force_tier: 'basic', force_legal_ai: false }, 'Reset to Basic')}
            disabled={updating}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-[10px] font-bold text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            Reset to Basic
          </button>
        </div>
      </Card>

      {/* ── Payments ledger ──────────────────────────────────── */}
      <Card title={`Payments (${payments.length})`} icon={CreditCard}>
        {payments.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">No payments recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {['Reference', 'Plan', 'Period', 'Amount', 'Status', 'Proof', 'Verified', 'Created'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono">{p.reference}</td>
                    <td className="px-3 py-2">{p.plan_type}</td>
                    <td className="px-3 py-2">{p.billing_period}</td>
                    <td className="px-3 py-2 font-semibold" dir="ltr">{fmtMoney(p.amount_jod)}</td>
                    <td className="px-3 py-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', STATUS_COLORS[p.status] ?? STATUS_COLORS.pending)}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {p.proof_url ? (
                        <a href={p.proof_url} target="_blank" rel="noopener noreferrer" className="text-[#0E7490] hover:underline">
                          View
                        </a>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2" dir="ltr">{fmtDate(p.verified_at)}</td>
                    <td className="px-3 py-2" dir="ltr">{fmtDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Legal-AI usage ───────────────────────────────────── */}
      <Card title={`Legal-AI usage (last 12 months)`} icon={Sparkles}>
        {usage.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">No Legal-AI usage recorded.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {usage.map((u) => (
              <div key={u.period_start} className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
                <p className="text-muted-foreground font-mono" dir="ltr">{u.period_start}</p>
                <p className="text-lg font-bold text-foreground">{u.analyses_count}</p>
                <p className="text-[10px] text-muted-foreground">analyses</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Cases ────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Cases as client (${clientCases.length})`} icon={FileText}>
          {clientCases.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No cases.</p>
          ) : (
            <ul className="divide-y divide-border text-xs">
              {clientCases.map((c) => (
                <li key={c.id} className="py-2 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{c.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {c.case_type} · {c.status} · health {c.health_score ?? '—'}
                    </p>
                  </div>
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Cases as lawyer (${lawyerAssignments.length})`} icon={Scale}>
          {lawyerAssignments.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No lawyer assignments.</p>
          ) : (
            <ul className="divide-y divide-border text-xs">
              {lawyerAssignments.map((a) => (
                <li key={a.case_id} className="py-2 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{a.cases?.title ?? '—'}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {a.cases?.case_type} · assigned {a.status} · {fmtDate(a.created_at)}
                    </p>
                  </div>
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ── Audit trail ──────────────────────────────────────── */}
      <Card title={`Audit trail (${audit.length})`} icon={Activity}>
        {audit.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">No audit events.</p>
        ) : (
          <ul className="divide-y divide-border text-xs">
            {audit.map((a, i) => (
              <li key={i} className="py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold shrink-0', SEVERITY_COLORS[a.severity] ?? SEVERITY_COLORS.info)}>
                      {a.severity}
                    </span>
                    <span className="font-mono text-foreground truncate">{a.action}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0" dir="ltr">{fmtDate(a.created_at)}</span>
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {a.resource && <span>resource={a.resource} </span>}
                  {a.ip_address && <span dir="ltr">ip={a.ip_address} </span>}
                </div>
                {a.changed_from && a.changed_to && (
                  <pre className="mt-1 overflow-x-auto rounded bg-muted/50 p-1.5 text-[10px] text-muted-foreground" dir="ltr">
                    {JSON.stringify({ from: a.changed_from, to: a.changed_to }, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ── Small presentational helpers ────────────────────────────────
function Card({
  title, icon: Icon, children, className,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-2xl border border-border bg-card p-5', className)}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-[#0E7490]" />
        {title}
      </h2>
      {children}
    </div>
  );
}

function KpiCard({
  label, value, icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className="h-3 w-3 text-muted-foreground" />
      </div>
      <p className="mt-1 text-lg font-black text-foreground">{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground break-words">{value}</dd>
    </div>
  );
}
