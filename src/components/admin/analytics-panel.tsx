"use client";

import { Card } from "@/components/ui/card";
import { Eye, Users, TrendingUp, FileText, Smartphone, Monitor, Tablet } from "lucide-react";

interface Stats {
  totalViews30d: number;
  totalViews7d: number;
  totalViewsToday: number;
  uniqueVisitors7d: number;
  totalUsers: number;
  newUsers7d: number;
}

interface DailyView {
  date: string;
  views: number;
}

export function AnalyticsPanel({
  stats,
  topPages,
  dailyViews,
  deviceBreakdown,
  topCountries,
}: {
  stats: Stats;
  topPages: Array<{ path: string; count: number }>;
  dailyViews: DailyView[];
  deviceBreakdown: Record<string, number>;
  topCountries: Array<{ country: string; count: number }>;
}) {
  const maxViews = Math.max(...dailyViews.map((d) => d.views), 1);
  const totalDevices = Object.values(deviceBreakdown).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-black text-foreground">Analytics & Visitor Tracking</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Page views, unique visitors, and user growth over the last 30 days.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground">Page views (7 days)</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <Eye className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-foreground">{stats.totalViews7d.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">{stats.totalViews30d.toLocaleString()} in last 30 days</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground">Unique visitors (7 days)</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-foreground">{stats.uniqueVisitors7d.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">{stats.totalViewsToday.toLocaleString()} views today</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground">Registered users</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-foreground">{stats.totalUsers.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">+{stats.newUsers7d} new this week</p>
        </Card>
      </div>

      {/* Daily views chart */}
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Daily page views (last 7 days)
        </h2>
        {dailyViews.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <div className="flex items-end gap-2 h-40">
            {dailyViews.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-brand-600 to-brand-400 transition-all hover:opacity-80"
                  style={{ height: `${(d.views / maxViews) * 100}%`, minHeight: "4px" }}
                  title={`${d.views} views on ${d.date}`}
                />
                <span className="text-[10px] text-muted-foreground">
                  {new Date(d.date).toLocaleDateString("en", { weekday: "short" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top pages */}
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">Top pages (7 days)</h2>
          {topPages.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {topPages.map((p, i) => (
                <div key={p.path} className="flex items-center justify-between rounded-lg border border-border p-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-muted-foreground shrink-0">#{i + 1}</span>
                    <span className="text-sm font-medium truncate" dir="ltr">{p.path}</span>
                  </div>
                  <span className="text-sm font-bold text-foreground shrink-0">{p.count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Device + country breakdown */}
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Devices</h2>
            <div className="space-y-2">
              {Object.entries(deviceBreakdown).map(([device, count]) => {
                const pct = Math.round((count / totalDevices) * 100);
                const Icon = device === "mobile" ? Smartphone : device === "desktop" ? Monitor : Tablet;
                return (
                  <div key={device} className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium capitalize flex-1">{device}</span>
                    <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-brand-600 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 w-8 text-end">{pct}%</span>
                  </div>
                );
              })}
              {Object.keys(deviceBreakdown).length === 0 && (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Top countries</h2>
            <div className="space-y-2">
              {topCountries.map((c) => (
                <div key={c.country} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{c.country}</span>
                  <span className="text-sm font-bold text-muted-foreground">{c.count}</span>
                </div>
              ))}
              {topCountries.length === 0 && (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
