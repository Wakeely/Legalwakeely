import { getLocale } from "next-intl/server";
import { requireAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/server";
import { BroadcastPanel } from "@/components/admin/broadcast-panel";

export const dynamic = "force-dynamic";

export default async function AdminBroadcastPage() {
  const locale = await getLocale();
  await requireAdmin(locale);
  const supabase = createAdminClient();

  const [
    { count: lawyers },
    { count: clients },
    { count: total },
    { data: recentNotifs },
  ] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "lawyer"),
    supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "client"),
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase
      .from("notifications")
      .select("id, title, body, type, action_url, created_at, user_id")
      .eq("type", "system")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <BroadcastPanel
      counts={{
        lawyers: lawyers ?? 0,
        clients: clients ?? 0,
        total: total ?? 0,
      }}
      recentBroadcasts={(recentNotifs ?? []) as never}
    />
  );
}
