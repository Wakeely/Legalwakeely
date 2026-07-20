'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Crown, Sparkles, TrendingUp, AlertCircle, DollarSign, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Subscription {
  user_id: string;
  tier: string;
  status: string;
  current_period_end: string | null;
  legal_ai_enabled: boolean;
  legal_ai_current_period_end: string | null;
  payment_method: string;
  cancel_at_period_end: boolean;
  created_at: string;
  user_name: string;
  user_email: string;
  is_suspended: boolean;
}

interface RevenueData {
  total_jod: number;
  monthly_jod: number;
  by_tier: { basic: number; pro: number; premium: number };
  legal_ai_count: number;
  recent_payments: Array<{
    amount_jod: number;
    plan_type: string;
    billing_period: string;
    verified_at: string;
  }>;
}

const TIER_COLORS: Record<string, string> = {
  premium: 'bg-amber-100 text-[#C89B3C]',
  pro:     'bg-blue-100  text-[#1A3557]',
  basic:   'bg-muted     text-muted-foreground',
};

export function AdminSubscriptionsPanel({
  subscriptions,
  expiredCount,
  noSubCount,
  revenue,
}: {
  subscriptions: Subscription[];
  expiredCount: number;
  noSubCount: number;
  revenue: RevenueData;
}) {
  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-black text-foreground">Subscriptions &amp; Revenue</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Monitor who&apos;s paying, manage subscriptions, track CliQ revenue.
        </p>
      </div>

      {/* Revenue cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground">Total revenue (all-time)</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-foreground">{revenue.total_jod.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">JOD collected</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground">This month</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-foreground">{revenue.monthly_jod.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">JOD this month</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground">Legal-AI add-on</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-foreground">{revenue.legal_ai_count}</p>
          <p className="text-xs text-muted-foreground mt-1">active add-ons</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground">No subscription</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-foreground">{noSubCount}</p>
          <p className="text-xs text-muted-foreground mt-1">free / basic users</p>
        </Card>
      </div>

      {/* Tier breakdown */}
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Active subscriptions by tier
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {(['basic', 'pro', 'premium'] as const).map((tier) => (
            <div key={tier} className="flex items-center justify-between rounded-xl border border-border p-3">
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', TIER_COLORS[tier])}>
                {tier}
              </span>
              <span className="text-2xl font-black text-foreground">{revenue.by_tier[tier]}</span>
            </div>
          ))}
        </div>
        {expiredCount > 0 && (
          <p className="mt-3 flex items-center gap-1 text-xs text-amber-600">
            <AlertCircle className="h-3 w-3" />
            {expiredCount} subscription(s) have expired period_end — access should be blocked.
          </p>
        )}
      </Card>

      {/* Recent payments */}
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Recent CliQ payments (last 20)
        </h2>
        {revenue.recent_payments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No verified payments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border">
                <tr>
                  {['Date', 'Plan', 'Period', 'Amount'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {revenue.recent_payments.map((p, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="px-3 py-2 text-muted-foreground" dir="ltr">
                      {new Date(p.verified_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-3 py-2 font-semibold">{p.plan_type}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.billing_period}</td>
                    <td className="px-3 py-2 font-bold text-emerald-700">{p.amount_jod} JOD</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* All subscriptions */}
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          All active subscriptions ({subscriptions.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border">
              <tr>
                {['User', 'Tier', 'Legal-AI', 'Payment', 'Period ends', 'Status'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {subscriptions.map((s) => (
                <tr key={s.user_id} className={cn('hover:bg-muted/30', s.is_suspended && 'bg-red-50/50')}>
                  <td className="px-3 py-2">
                    <p className="font-semibold text-foreground">{s.user_name}</p>
                    <p className="text-muted-foreground font-mono" dir="ltr">{s.user_email}</p>
                    {s.is_suspended && (
                      <span className="inline-flex items-center gap-0.5 mt-0.5 text-[10px] text-red-600">
                        <Ban className="h-2 w-2" /> suspended
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', TIER_COLORS[s.tier] ?? TIER_COLORS.basic)}>
                      {s.tier}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {s.legal_ai_enabled ? (
                      <span className="inline-flex items-center gap-0.5 text-teal-600">
                        <Sparkles className="h-3 w-3" /> Yes
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono uppercase">
                      {s.payment_method}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground" dir="ltr">
                    {s.current_period_end
                      ? new Date(s.current_period_end).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {s.cancel_at_period_end ? (
                      <Badge tone="warning">Canceling</Badge>
                    ) : new Date(s.current_period_end ?? Date.now()) > new Date() ? (
                      <Badge tone="success">Active</Badge>
                    ) : (
                      <Badge tone="danger">Expired</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
