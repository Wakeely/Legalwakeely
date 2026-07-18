import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/admin-guard";

export const runtime = "nodejs";

/**
 * GET /api/admin/cliq/pending
 *
 * Returns all payment orders with status "proof_uploaded" — these are
 * the ones awaiting admin verification.
 */
export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return NextResponse.json({ error: "Forbidden" }, { status: guard.response.status });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_orders")
    .select(
      "id, reference, user_id, plan_type, billing_period, amount_jod, " +
      "proof_url, proof_transaction_id, proof_uploaded_at, created_at",
    )
    .eq("status", "proof_uploaded")
    .order("proof_uploaded_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ orders: data ?? [] });
}
