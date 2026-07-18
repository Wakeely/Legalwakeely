import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { validateBody } from "@/lib/validate";
import { CLIQ_ALIAS, CLIQ_ALIAS_NAME, getPlan } from "@/lib/cliq";
import { generateReference, calculateOrderExpiry } from "@/lib/cliq-server";

export const runtime = "nodejs";

const createOrderSchema = z.object({
  plan_type: z.enum(["basic", "pro", "premium", "legal_ai_addon"]),
  billing_period: z.enum(["monthly", "quarterly", "annual"]),
});

/**
 * POST /api/cliq/create-order
 *
 * Creates a new CliQ payment order. Returns the reference code + the
 * merchant CliQ alias the user should pay to.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await validateBody(req, createOrderSchema);
  if (body instanceof NextResponse) return body;

  const plan = getPlan(body.plan_type);
  if (!plan) {
    return NextResponse.json({ error: "invalid_plan" }, { status: 422 });
  }

  const amount = plan.jod[body.billing_period];
  const reference = generateReference();
  const expiresAt = calculateOrderExpiry();

  const { data: order, error } = await supabase
    .from("payment_orders")
    .insert({
      user_id: user.id,
      plan_type: body.plan_type,
      billing_period: body.billing_period,
      amount_jod: amount,
      reference,
      cliq_alias: CLIQ_ALIAS,
      cliq_alias_name: CLIQ_ALIAS_NAME,
      status: "pending",
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (error || !order) {
    return NextResponse.json(
      { error: "Failed to create order", detail: error?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    order,
    instructions: {
      cliq_alias: CLIQ_ALIAS,
      cliq_alias_name: CLIQ_ALIAS_NAME,
      amount_jod: amount,
      reference,
      note: `Include reference ${reference} in your CliQ payment note`,
      noteAr: `أدرج الرمز ${reference} في ملاحظة تحويل CliQ`,
    },
  });
}
