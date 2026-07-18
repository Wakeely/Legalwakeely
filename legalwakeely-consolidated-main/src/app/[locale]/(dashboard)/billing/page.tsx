import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SafeClient } from "@/components/safe-client";
import { CliQBilling } from "@/components/billing/cliq-billing";

export const dynamic = "force-dynamic";

export default async function BillingPage({
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

  const [{ data: sub }, { data: orders }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("tier, status, current_period_end, legal_ai_enabled, legal_ai_current_period_end, payment_method")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("payment_orders")
      .select("id, reference, plan_type, billing_period, amount_jod, status, proof_url, created_at, expires_at, period_end")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <SafeClient fallback={<div className="p-8 text-center text-muted-foreground">Loading billing…</div>}>
      <CliQBilling locale={locale} subscription={sub} orders={orders ?? []} />
    </SafeClient>
  );
}
