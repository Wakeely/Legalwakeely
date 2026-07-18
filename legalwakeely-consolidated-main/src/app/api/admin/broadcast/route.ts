import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { validateBody } from "@/lib/validate";
import { writeAuditLog, getClientIp } from "@/lib/audit";

export const runtime = "nodejs";

const broadcastSchema = z.object({
  audience: z.enum(["single", "lawyers", "clients", "all"]),
  target_user_id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(2000),
  action_url: z.string().trim().max(500).optional().default("/notifications"),
  type: z.enum(["system", "subscription_updated", "deadline_reminder"]).optional().default("system"),
});

/**
 * POST /api/admin/broadcast
 *
 * Sends a notification to:
 *   - "single": one specific user (requires target_user_id)
 *   - "lawyers": all users with role = 'lawyer'
 *   - "clients": all users with role = 'client'
 *   - "all": every user
 *
 * Inserts rows into the notifications table. The notifications hub
 * component picks them up via Supabase realtime.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const body = await validateBody(req, broadcastSchema);
  if (body instanceof NextResponse) return body;

  if (body.audience === "single" && !body.target_user_id) {
    return NextResponse.json({ error: "target_user_id required for single audience" }, { status: 422 });
  }

  const admin = createAdminClient();

  // ── Resolve the target user IDs ──────────────────────────────
  let userIds: string[] = [];

  if (body.audience === "single") {
    userIds = [body.target_user_id!];
  } else {
    let query = admin.from("users").select("id");
    if (body.audience === "lawyers") query = query.eq("role", "lawyer");
    else if (body.audience === "clients") query = query.eq("role", "client");
    // "all" = no filter

    const { data: users, error: usersErr } = await query;
    if (usersErr) {
      return NextResponse.json({ error: usersErr.message }, { status: 500 });
    }
    userIds = (users ?? []).map((u: { id: string }) => u.id);
  }

  if (userIds.length === 0) {
    return NextResponse.json({ error: "no_users_found", message: "No users match the selected audience." }, { status: 404 });
  }

  // ── Insert notifications (batch) ─────────────────────────────
  const rows = userIds.map((userId) => ({
    user_id: userId,
    type: body.type,
    title: body.title,
    body: body.body,
    action_url: body.action_url,
  }));

  const { error: insertErr } = await admin.from("notifications").insert(rows);

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // ── Audit log ────────────────────────────────────────────────
  await writeAuditLog({
    user_id: guard.userId,
    action: "admin_user_edit",
    resource: "notifications",
    resource_id: body.audience,
    severity: "warn",
    ip_address: ip,
    changed_to: { audience: body.audience, target_count: userIds.length, title: body.title },
  });

  return NextResponse.json({
    ok: true,
    sent_count: userIds.length,
    audience: body.audience,
  });
}

/**
 * GET /api/admin/broadcast
 *
 * Returns user counts by role (for the broadcast form to show
 * "Sending to X lawyers, Y clients, Z total").
 */
export async function GET(req: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const admin = createAdminClient();
  const [
    { count: lawyers },
    { count: clients },
    { count: admins },
    { count: total },
  ] = await Promise.all([
    admin.from("users").select("*", { count: "exact", head: true }).eq("role", "lawyer"),
    admin.from("users").select("*", { count: "exact", head: true }).eq("role", "client"),
    admin.from("users").select("*", { count: "exact", head: true }).eq("role", "admin"),
    admin.from("users").select("*", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    lawyers: lawyers ?? 0,
    clients: clients ?? 0,
    admins: admins ?? 0,
    total: total ?? 0,
  });
}
