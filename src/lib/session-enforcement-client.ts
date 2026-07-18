"use client";

/**
 * Client-side device fingerprinting.
 *
 * Generates a stable hash from browser characteristics to identify
 * a device. This is NOT a security measure — it's for detecting
 * account sharing (same user logging in from many devices).
 *
 * The fingerprint is sent as the x-device-fingerprint header on
 * login, and stored in active_sessions.device_fingerprint.
 */

export async function generateDeviceFingerprint(): Promise<{ fingerprint: string; label: string }> {
  const parts: string[] = [];

  // Screen characteristics
  parts.push(`${screen.width}x${screen.height}`);
  parts.push(`${screen.colorDepth}`);
  parts.push(`${screen.pixelDepth}`);

  // Timezone
  try {
    parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    parts.push("tz-unknown");
  }

  // Language
  parts.push(navigator.language);
  parts.push(navigator.languages?.join(",") ?? "");

  // Platform
  parts.push(navigator.platform);

  // Hardware concurrency (CPU cores)
  parts.push(String(navigator.hardwareConcurrency ?? 0));

  // Device memory (GB)
  // @ts-expect-error — deviceMemory is not in all TS lib defs
  parts.push(String(navigator.deviceMemory ?? 0));

  // Touch support
  parts.push(String("ontouchstart" in window));

  // Canvas fingerprint (subtle — draws text + reads pixels)
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillText("LegalWakeely fingerprint 🔒", 2, 2);
      parts.push(canvas.toDataURL().slice(0, 100));
    }
  } catch {
    // canvas blocked — skip
  }

  // WebRTC IP (best-effort, may be blocked)
  // Skipped — too intrusive and unreliable.

  const raw = parts.join("|");
  const fingerprint = await sha256(raw);

  return {
    fingerprint: fingerprint.slice(0, 32), // 32 chars is plenty
    label: getDeviceLabel(),
  };
}

function getDeviceLabel(): string {
  const ua = navigator.userAgent;
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

  // Check if mobile
  const isMobile = /android|iphone|ipad|ipod/i.test(ua) || window.innerWidth < 768;
  return `${isMobile ? "📱 " : "💻 "}${browser} on ${os}`;
}

async function sha256(message: string): Promise<string> {
  // Use SubtleCrypto if available (secure context), else fallback to simple hash
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // fall through to simple hash
    }
  }
  // Fallback: simple FNV-1a
  let hash = 0x811c9dc5;
  for (let i = 0; i < message.length; i++) {
    hash ^= message.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Stores the fingerprint in sessionStorage so it persists across
 * page loads within the same tab session.
 */
export async function getOrCreateFingerprint(): Promise<{ fingerprint: string; label: string }> {
  const stored = sessionStorage.getItem("lw.device-fp");
  const storedLabel = sessionStorage.getItem("lw.device-label");
  if (stored && storedLabel) {
    return { fingerprint: stored, label: storedLabel };
  }
  const { fingerprint, label } = await generateDeviceFingerprint();
  sessionStorage.setItem("lw.device-fp", fingerprint);
  sessionStorage.setItem("lw.device-label", label);
  return { fingerprint, label };
}
