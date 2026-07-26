'use client';

import { useState } from 'react';
import {
  CreditCard, CheckCircle2, AlertTriangle, XCircle, Download,
  ChevronLeft, ChevronRight, Search, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Payment {
  id: string;
  reference: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
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

interface Kpis {
  total_revenue_jod: number;
  verified_count: number;
  pending_count: number;
  rejected_count: number;
}

interface AdminPaymentsLedgerProps {
  payments: Payment[];
  total: number;
  page: number;
  limit: number;
  q: string;
  status: string;
  planType: string;
  kpis: Kpis;
}

const STATUS_COLORS: Record<string, string> = {
  verified:       'bg-emerald-100 text-emerald-700',
  pending:        'bg-muted      text-muted-foreground',
  proof_uploaded: 'bg-amber-100  text-amber-700',
  rejected:       'bg-red-100    text-red-700',
  expired:        'bg-muted      text-muted-foreground',
};

const PLAN_COLORS: Record<string, string> = {
  premium:         'bg-amber-100 text-[#C89B3C]',
  pro:             'bg-blue-100  text-[#1A3557]',
  basic:           'bg-muted     text-muted-foreground',
  legal_ai_addon:  'bg-teal-100  text-teal-700',
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

export function AdminPaymentsLedger({
  payments, total, page, limit, q, status, planType, kpis,
}: AdminPaymentsLedgerProps) {
  const [exporting, setExporting] = useState(false);
  const totalPages = Math.ceil(total / limit);

  async function exportCsv() {
    setExporting(true);
    try {
      // The API route accepts the same query params + csv=1
      const params = new URLSearchParams();
      if (status)  params.set('status', status);
      if (planType) params.set('plan_type', planType);
      if (q)       params.set('q', q);
      params.set('csv', '1');

      const res = await fetch(`/api/admin/payments?${params.toString()}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── KPI cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Total revenue"
          value={fmtMoney(kpis.total_revenue_jod)}
          icon={CreditCard}
          tone="emerald"
        />
        <KpiCard
          label="Verified payments"
          value={kpis.verified_count}
          icon={CheckCircle2}
          tone="emerald"
        />
        <KpiCard
          label="Pending verification"
          value={kpis.pending_count}
          icon={AlertTriangle}
          tone="amber"
        />
        <KpiCard
          label="Rejected"
          value={kpis.rejected_count}
          icon={XCircle}
          tone="red"
        />
      </div>

      {/* ── Filters + export ─────────────────────────────────── */}
      <form className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search reference code…"
            className="w-full rounded-xl border border-border bg-background ps-9 pe-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E7490]/30"
          />
        </div>
        <select name="status" defaultValue={status} className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="proof_uploaded">Proof uploaded</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
        </select>
        <select name="plan_type" defaultValue={planType} className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
          <option value="">All plans</option>
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
          <option value="premium">Premium</option>
          <option value="legal_ai_addon">Legal-AI add-on</option>
        </select>
        <button type="submit" className="rounded-xl bg-[#0E7490] text-white px-4 py-2 text-sm font-semibold hover:bg-[#0c6578]">
          Filter
        </button>
        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
          title="Export the current filter as CSV (max 10,000 rows)"
        >
          <Download className="h-4 w-4" />
        </button>
      </form>

      {/* ── Ledger table ─────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {['Reference', 'User', 'Plan', 'Period', 'Amount', 'Status', 'Proof', 'Verified at', 'Period end', 'Created'].map((h) => (
                  <th key={h} className="px-3 py-3 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-3 py-3 font-mono">{p.reference}</td>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-foreground truncate max-w-[160px]">{p.user_name || '—'}</p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[160px]" dir="ltr">{p.user_email || '—'}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap', PLAN_COLORS[p.plan_type] ?? PLAN_COLORS.basic)}>
                      {p.plan_type}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{p.billing_period}</td>
                  <td className="px-3 py-3 font-semibold whitespace-nowrap" dir="ltr">{fmtMoney(p.amount_jod)}</td>
                  <td className="px-3 py-3">
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap', STATUS_COLORS[p.status] ?? STATUS_COLORS.pending)}>
                      {p.status}
                    </span>
                    {p.rejection_reason && (
                      <p className="mt-1 text-[10px] text-red-700 max-w-[140px] truncate" title={p.rejection_reason}>
                        {p.rejection_reason}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {p.proof_url ? (
                      <a href={p.proof_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[#0E7490] hover:underline">
                        View <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground whitespace-nowrap" dir="ltr">{fmtDate(p.verified_at)}</td>
                  <td className="px-3 py-3 text-muted-foreground whitespace-nowrap" dir="ltr">{fmtDate(p.period_end)}</td>
                  <td className="px-3 py-3 text-muted-foreground whitespace-nowrap" dir="ltr">{fmtDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {payments.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No payments found.</p>
          )}
        </div>
      </div>

      {/* ── Pagination ───────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-center">
          {page > 1 && (
            <a
              href={`?page=${page - 1}&status=${status}&plan_type=${planType}&q=${encodeURIComponent(q)}`}
              className="rounded-lg border border-border p-1.5 hover:bg-muted"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </a>
          )}
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages} · {total} total
          </span>
          {page < totalPages && (
            <a
              href={`?page=${page + 1}&status=${status}&plan_type=${planType}&q=${encodeURIComponent(q)}`}
              className="rounded-lg border border-border p-1.5 hover:bg-muted"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label, value, icon: Icon, tone,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  tone: 'emerald' | 'amber' | 'red';
}) {
  const toneClasses = {
    emerald: 'text-emerald-700 bg-emerald-50',
    amber:   'text-amber-700 bg-amber-50',
    red:     'text-red-700 bg-red-50',
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <div className={cn('rounded-lg p-1', toneClasses)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="mt-2 text-xl font-black text-foreground">{value}</p>
    </div>
  );
}
