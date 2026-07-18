import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

/**
 * Session enforcement — one active session per user.
 *
 * When a user logs in, we:
 *   1. Generate a device fingerprint from browser characteristics
 *   2. Call supersede_user_sessions() to mark old sessions as superseded
 *   3. Insert the new session row
 *
 * On every protected request, the middleware checks if the current
 * session is still 'active'. If it's 'superseded', the user is logged
 * out with an "account in use elsewhere" message.
 */

export interface DeviceInfo {
  fingerprint: string;
  label: string;
  ip: string;
  userAgent: string;
}

/**
 * Extracts device info from the request headers.
 * The fingerprint is generated client-side and sent as a header
 * (see session-enforcement-client.ts).
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
  const userAgent = h.get("user-agent") ?? "unknown";
  const fingerprint = h.get("x-device-fingerprint") ?? hashString(userAgent + ip);
  const label = h.get("x-device-label") ?? parseDeviceLabel(userAgent);

  return { fingerprint, label, ip, userAgent };
}

/**
 * Called on login. Supersedes all previous sessions and inserts the new one.
 * Returns the session UUID.
 */
export async function registerSession(
  userId: string,
  sessionId: string,
  expiresAt: Date,
  deviceInfo?: DeviceInfo,
): Promise<string | null> {
  const admin = createAdminClient();
  const info = deviceInfo ?? (await getDeviceInfo());

  const { data, error } = await admin.rpc("supersede_user_sessions", {
    p_user_id: userId,
    p_new_session_id: sessionId,
    p_fingerprint: info.fingerprint,
    p_ip: info.ip,
    p_user_agent: info.userAgent,
    p_device_label: info.label,
    p_expires_at: expiresAt.toISOString(),
  });

  if (error) {
    console.error("[session-enforcement] registerSession failed:", error);
    return null;
  }

  return data as string;
}

/**
 * Checks if a session is still active (not superseded/revoked/expired).
 * Returns { active: boolean, reason?: string }.
 */
export async function checkSessionStatus(
  userId: string,
  sessionId: string,
): Promise<{ active: boolean; reason?: string; supersededAt?: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("active_sessions")
    .select("status, superseded_at, expires_at")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error || !data) {
    // No session row = either first login or the row was cleaned up.
    // Allow the request (the login hook will create the row).
    return { active: true };
  }

  if (data.status === "active") {
    // Update last_active_at (heartbeat)
    await admin
      .from("active_sessions")
      .update({ last_active_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("session_id", sessionId);
    return { active: true };
  }

  if (data.status === "superseded") {
    return {
      active: false,
      reason: "superseded",
      supersededAt: data.superseded_at,
    };
  }

  if (data.status === "revoked") {
    return { active: false, reason: "revoked" };
  }

  if (data.status === "expired" || new Date(data.expires_at) < new Date()) {
    return { active: false, reason: "expired" };
  }

  return { active: true };
}

/**
 * Revokes a specific session (used by the /settings/devices page
 * and by admins).
 */
export async function revokeSession(userId: string, sessionId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("active_sessions")
    .update({ status: "revoked" })
    .eq("user_id", userId)
    .eq("session_id", sessionId);
  return !error;
}

/**
 * Gets all active sessions for a user (for the /settings/devices page).
 */
export async function getActiveSessions(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("active_sessions")
    .select("id, session_id, device_label, ip_address, last_active_at, created_at, status")
    .eq("user_id", userId)
    .order("last_active_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

// ── Helpers ──────────────────────────────────────────────────

function hashString(s: string): string {
  // Simple FNV-1a hash (good enough for fingerprinting, not for security)
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function parseDeviceLabel(ua: string): string {
  let browser = "Unknown";
  let os = "Unknown";

  if (/edg/i.test(ua)) browser = "Edge";
  else if (/chrome|crios|crmo/i.test(ua)) browser = "Chrome";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua)) browser = "Safari";

  if (/windows/i.test(ua)) os = "Windows";
  else if (/mac os|macintosh/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/linux/i.test(ua)) os = "Linux";

  return `${browser} on ${os}`;
}
