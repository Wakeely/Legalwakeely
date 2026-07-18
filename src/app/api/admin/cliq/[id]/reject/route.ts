import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { validateBody } from "@/lib/validate";

export const runtime = "nodejs";

const rejectSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

/**
 * POST /api/admin/cliq/[id]/reject
 *
 * Admin rejects a CliQ payment (e.g. wrong amount, fake screenshot).
 * Notifies the user with the rejection reason so they can re-upload
 * or create a new order.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return NextResponse.json({ error: "Forbidden" }, { status: guard.response.status });

  const { id } = await params;
  const body = await validateBody(req, rejectSchema);
  if (body instanceof NextResponse) return body;

  const admin = createAdminClient();

  const { data: order, error: fetchErr } = await admin
    .from("payment_orders")
    .select("user_id, reference, plan_type")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !order) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }

  await admin
    .from("payment_orders")
    .update({
      status: "rejected",
      verified_by: guard.userId,
      verified_at: new Date().toISOString(),
      rejection_reason: body.reason,
    })
    .eq("id", id);

  await admin.from("notifications").insert({
    user_id: order.user_id,
    type: "subscription_updated",
    title: "Payment rejected",
    body: `Your CliQ payment (ref ${order.reference}) was rejected: ${body.reason}. You can create a new order and try again.`,
    action_url: "/billing",
  });

  return NextResponse.json({ ok: true, rejected: true });
}
