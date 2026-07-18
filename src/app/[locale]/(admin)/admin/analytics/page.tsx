import { getLocale } from "next-intl/server";
import { requireAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/server";
import { AnalyticsPanel } from "@/components/admin/analytics-panel";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const locale = await getLocale();
  await requireAdmin(locale);
  const admin = createAdminClient();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const yesterday = new Date(now.getTime() - 86400000);

  // Fetch analytics data in parallel
  const [
    { count: totalViews30d },
    { count: totalViews7d },
    { count: totalViewsToday },
    { data: uniqueVisitors7d },
    { data: topPages },
    { data: dailyViews },
    { data: deviceBreakdown },
    { data: countryBreakdown },
    { count: totalUsers },
    { count: newUsers7d },
  ] = await Promise.all([
    admin.from("page_views").select("*", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo.toISOString()),
    admin.from("page_views").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo.toISOString()),
    admin.from("page_views").select("*", { count: "exact", head: true }).gte("created_at", yesterday.toISOString()),
    admin.from("page_views").select("visitor_id").gte("created_at", sevenDaysAgo.toISOString()),
    admin.from("page_views").select("path").gte("created_at", sevenDaysAgo.toISOString()).limit(500),
    admin.from("page_views").select("created_at").gte("created_at", sevenDaysAgo.toISOString()).order("created_at", { ascending: true }),
    admin.from("page_views").select("device_type").gte("created_at", sevenDaysAgo.toISOString()).limit(500),
    admin.from("page_views").select("country").gte("created_at", sevenDaysAgo.toISOString()).limit(500),
    admin.from("users").select("*", { count: "exact", head: true }),
    admin.from("users").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo.toISOString()),
  ]);

  // Process unique visitors
  const uniqueVisitorIds = new Set((uniqueVisitors7d ?? []).map((v: { visitor_id: string }) => v.visitor_id));

  // Process top pages
  const pageCounts: Record<string, number> = {};
  for (const p of (topPages ?? []) as Array<{ path: string }>) {
    pageCounts[p.path] = (pageCounts[p.path] ?? 0) + 1;
  }
  const topPagesList = Object.entries(pageCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  // Process daily views (group by day)
  const dailyMap: Record<string, number> = {};
  for (const v of (dailyViews ?? []) as Array<{ created_at: string }>) {
    const day = v.created_at.slice(0, 10);
    dailyMap[day] = (dailyMap[day] ?? 0) + 1;
  }
  const dailyData = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, views]) => ({ date, views }));

  // Process device breakdown
  const deviceCounts: Record<string, number> = {};
  for (const d of (deviceBreakdown ?? []) as Array<{ device_type: string }>) {
    const dt = d.device_type ?? "unknown";
    deviceCounts[dt] = (deviceCounts[dt] ?? 0) + 1;
  }

  // Process country breakdown
  const countryCounts: Record<string, number> = {};
  for (const c of (countryBreakdown ?? []) as Array<{ country: string | null }>) {
    const country = c.country ?? "Unknown";
    countryCounts[country] = (countryCounts[country] ?? 0) + 1;
  }
  const topCountries = Object.entries(countryCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([country, count]) => ({ country, count }));

  return (
    <AnalyticsPanel
      stats={{
        totalViews30d: totalViews30d ?? 0,
        totalViews7d: totalViews7d ?? 0,
        totalViewsToday: totalViewsToday ?? 0,
        uniqueVisitors7d: uniqueVisitorIds.size,
        totalUsers: totalUsers ?? 0,
        newUsers7d: newUsers7d ?? 0,
      }}
      topPages={topPagesList}
      dailyViews={dailyData}
      deviceBreakdown={deviceCounts}
      topCountries={topCountries}
    />
  );
}
