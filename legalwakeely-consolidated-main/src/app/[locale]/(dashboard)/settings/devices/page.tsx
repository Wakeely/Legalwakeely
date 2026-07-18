import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveSessions } from "@/lib/session-enforcement";
import { DevicesPanel } from "@/components/settings/devices-panel";

export const dynamic = "force-dynamic";

export default async function DevicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  // Get the current session ID
  const { data: sessionData } = await supabase.auth.getSession();
  const currentSessionId = sessionData.session?.access_token?.slice(-32) ?? null;

  const sessions = await getActiveSessions(user.id);

  return (
    <DevicesPanel
      sessions={sessions as never}
      currentSessionId={currentSessionId}
      locale={locale}
    />
  );
}
