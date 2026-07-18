import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/privacy/export
 *
 * PDPL / GDPR "right to data portability" — returns a JSON bundle
 * of all data the authenticated user owns across the platform.
 *
 * The user can download this from Settings → Privacy → Export my data.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Parallel-fetch all user-owned tables.
  const [
    profile,
    cases,
    documents,
    deadlines,
    messages,
    analyses,
    leads,
    reviews,
    invoices,
    notifications,
    usage,
    subscriptions,
    consentLogs,
  ] = await Promise.all([
    admin.from("users").select("*").eq("id", user.id).maybeSingle(),
    admin.from("cases").select("*").eq("client_id", user.id),
    admin.from("documents").select("*").eq("uploader_id", user.id),
    admin.from("deadlines").select("*").eq("created_by", user.id),
    admin.from("messages").select("*").eq("sender_id", user.id),
    admin.from("document_analyses").select("*").eq("user_id", user.id),
    admin.from("legal_leads").select("*").eq("user_id", user.id),
    admin.from("legal_reviews").select("*").eq("user_id", user.id),
    admin.from("invoices").select("*").eq("user_id", user.id),
    admin.from("notifications").select("*").eq("user_id", user.id),
    admin.from("legal_ai_usage").select("*").eq("user_id", user.id),
    admin.from("subscriptions").select("*").eq("user_id", user.id),
    admin.from("consent_logs").select("*").eq("user_id", user.id),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      created_at: user.created_at,
    },
    profile: profile.data,
    cases: cases.data ?? [],
    documents: documents.data ?? [],
    deadlines: deadlines.data ?? [],
    messages: messages.data ?? [],
    document_analyses: analyses.data ?? [],
    legal_leads: leads.data ?? [],
    legal_reviews: reviews.data ?? [],
    invoices: invoices.data ?? [],
    notifications: notifications.data ?? [],
    legal_ai_usage: usage.data ?? [],
    subscriptions: subscriptions.data ?? [],
    consent_logs: consentLogs.data ?? [],
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="legalwakeely-data-export-${user.id}.json"`,
    },
  });
}
