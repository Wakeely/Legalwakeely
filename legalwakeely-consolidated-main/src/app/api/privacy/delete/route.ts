import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/privacy/delete
 *
 * PDPL / GDPR "right to erasure" — deletes the user's account and
 * all owned data across the platform. This is irreversible.
 *
 * Cascade deletes are handled by the DB foreign keys (ON DELETE CASCADE)
 * on user-owned tables. Auth user is deleted via the admin API.
 *
 * Logs the deletion to consent_logs for audit (without retaining PII).
 */
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const userId = user.id;

  // ── Audit log the deletion request (no PII) ───────────────────
  await admin.from("consent_logs").insert({
    user_id: userId,
    consent_type: "account_deletion",
    version: "1.0",
    granted: false, // they're withdrawing everything
  });

  // ── Delete user-owned rows (cascade handles the rest) ─────────
  // The `users` table has ON DELETE CASCADE on most referencing tables,
  // so deleting the user row cleans up cases, documents, deadlines, etc.
  // We explicitly clean tables that may not cascade.
  const tablesToClean = [
    { table: "document_analyses", column: "user_id" },
    { table: "legal_leads", column: "user_id" },
    { table: "legal_reviews", column: "user_id" },
    { table: "legal_ai_usage", column: "user_id" },
    { table: "subscriptions", column: "user_id" },
    { table: "notifications", column: "user_id" },
  ];

  for (const { table, column } of tablesToClean) {
    await admin.from(table).delete().eq(column, userId);
  }

  // ── Delete the auth user (cascades the `users` row) ───────────
  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) {
    console.error("[privacy/delete] failed to delete auth user:", authError);
    return NextResponse.json(
      { error: "Failed to delete account", detail: authError.message },
      { status: 500 },
    );
  }

  // ── Sign out the now-deleted session ──────────────────────────
  await supabase.auth.signOut();

  return NextResponse.json({ deleted: true, user_id: userId });
}
