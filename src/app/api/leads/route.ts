import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createLead } from "@/lib/legal-ai/data";
import type { Lead } from "@/lib/types";

const Schema = z.object({
  lawyerId: z.string().min(1),
  message: z.string().trim().min(1).max(2000),
  feeOffered: z.number().int().min(0).max(100000).optional(),
  attachAnalysis: z.boolean().optional(),
  analysisContext: z
    .object({ id: z.string(), title: z.string(), summary: z.string() })
    .nullable()
    .optional(),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body: unknown = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { lawyerId, message, feeOffered } = parsed.data;

  const { data: lawyer } = await supabase.from("users").select("id, role").eq("id", lawyerId).maybeSingle();
  if (!lawyer || lawyer.role !== "lawyer") {
    return NextResponse.json({ error: "lawyer_not_found" }, { status: 404 });
  }

  const leadPayload: Omit<Lead, "id" | "createdAt" | "status"> = {
    userId: user.id,
    userName: user.email ?? user.id,
    lawyerId,
    documentType: "general",
    message,
    feeOffered: feeOffered ?? undefined,
  };

  const lead = await createLead(leadPayload);
  return NextResponse.json({ ok: true, lead });
}
