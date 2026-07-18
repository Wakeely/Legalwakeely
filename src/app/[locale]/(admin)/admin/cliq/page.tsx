import { requireAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/server";
import { CliQVerificationPanel } from "@/components/admin/cliq-verification-panel";

export const dynamic = "force-dynamic";

export default async function AdminCliQPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { user } = await requireAdmin(locale);

  const admin = createAdminClient();

  // Fetch all orders with proof uploaded (awaiting verification)
  // + recently verified/rejected (last 20)
  const [{ data: pendingRaw }, { data: recentRaw }] = await Promise.all([
    admin
      .from("payment_orders")
      .select(
        "id, reference, user_id, plan_type, billing_period, amount_jod, " +
        "proof_url, proof_transaction_id, proof_uploaded_at, created_at, expires_at",
      )
      .eq("status", "proof_uploaded")
      .order("proof_uploaded_at", { ascending: true }),
    admin
      .from("payment_orders")
      .select(
        "id, reference, user_id, plan_type, billing_period, amount_jod, " +
        "status, verified_at, rejection_reason, period_end, created_at",
      )
      .in("status", ["verified", "rejected"])
      .order("verified_at", { ascending: false })
      .limit(20),
  ]);

  const pending = (pendingRaw ?? []) as unknown as Array<Record<string, unknown>>;
  const recent = (recentRaw ?? []) as unknown as Array<Record<string, unknown>>;

  // Fetch user names for the orders
  const userIds = [...pending, ...recent].map((o) => String(o.user_id));
  const { data: users } = await admin
    .from("users")
    .select("id, full_name, email")
    .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  const userMap = new Map(
    ((users ?? []) as Array<{ id: string; full_name: string; email: string }>).map((u) => [u.id, u]),
  );

  return (
    <CliQVerificationPanel
      pendingOrders={pending.map((o) => ({
        id: String(o.id),
        reference: String(o.reference),
        user_id: String(o.user_id),
        user_name: userMap.get(String(o.user_id))?.full_name ?? "—",
        user_email: userMap.get(String(o.user_id))?.email ?? "—",
        plan_type: String(o.plan_type),
        billing_period: String(o.billing_period),
        amount_jod: Number(o.amount_jod),
        proof_url: (o.proof_url as string | null) ?? null,
        proof_transaction_id: (o.proof_transaction_id as string | null) ?? null,
        proof_uploaded_at: String(o.proof_uploaded_at),
        created_at: String(o.created_at),
        expires_at: String(o.expires_at),
      }))}
      recentOrders={recent.map((o) => ({
        id: String(o.id),
        reference: String(o.reference),
        user_id: String(o.user_id),
        user_name: userMap.get(String(o.user_id))?.full_name ?? "—",
        user_email: userMap.get(String(o.user_id))?.email ?? "—",
        plan_type: String(o.plan_type),
        billing_period: String(o.billing_period),
        amount_jod: Number(o.amount_jod),
        status: String(o.status),
        verified_at: (o.verified_at as string | null) ?? null,
        rejection_reason: (o.rejection_reason as string | null) ?? null,
        period_end: (o.period_end as string | null) ?? null,
        created_at: String(o.created_at),
      }))}
    />
  );
}
