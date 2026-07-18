import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { validateBody } from "@/lib/validate";

export const runtime = "nodejs";

const uploadProofSchema = z.object({
  order_id: z.string().uuid(),
  proof_url: z.string().url().max(500),
  proof_transaction_id: z.string().trim().max(100).optional(),
});

/**
 * POST /api/cliq/upload-proof
 *
 * Called after the user uploads a screenshot of their CliQ payment
 * to Supabase Storage. Records the proof URL + transaction ID on the
 * order and sets status to "proof_uploaded" for admin review.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await validateBody(req, uploadProofSchema);
  if (body instanceof NextResponse) return body;

  // Verify the order belongs to this user + is still pending
  const { data: order, error: fetchErr } = await supabase
    .from("payment_orders")
    .select("id, user_id, status, expires_at")
    .eq("id", body.order_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchErr || !order) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }

  if (order.status === "verified") {
    return NextResponse.json({ error: "already_verified" }, { status: 409 });
  }

  if (order.status === "expired" || new Date(order.expires_at) < new Date()) {
    return NextResponse.json({ error: "order_expired" }, { status: 410 });
  }

  const { error: updateErr } = await supabase
    .from("payment_orders")
    .update({
      proof_url: body.proof_url,
      proof_transaction_id: body.proof_transaction_id ?? null,
      proof_uploaded_at: new Date().toISOString(),
      status: "proof_uploaded",
    })
    .eq("id", body.order_id);

  if (updateErr) {
    return NextResponse.json({ error: "update_failed", detail: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "proof_uploaded" });
}
