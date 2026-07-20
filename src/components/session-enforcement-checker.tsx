"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LogOut, AlertTriangle } from "lucide-react";

/**
 * SessionEnforcementChecker — runs in the background on every page.
 *
 * Every 60 seconds, checks /api/auth/session-status. If the current
 * session has been superseded (another device logged in), shows a
 * non-dismissible modal and logs the user out.
 *
 * Also checks on mount + on window focus (catches tab switching).
 */
export function SessionEnforcementChecker() {
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState<string>("");

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/auth/session-status");
        if (!res.ok) return;
        const data = await res.json();
        if (data.authenticated && data.enforced && !data.active) {
          setReason(data.reason ?? "unknown");
          setShowModal(true);
        }
      } catch {
        // Silent fail — never disrupt the user
      }
    }

    // Delay first check by 10s to let the page fully hydrate
    const initialTimer = setTimeout(check, 10_000);

    // Check every 5 minutes (not every 60s — reduces serverless invocations)
    const interval = setInterval(check, 300_000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  async function handleLogout() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    window.location.href = "/ar/login?error=session_expired";
  }

  if (!showModal) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl"
        style={{ direction: "rtl" }}
      >
        <div className="mb-5 flex justify-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-amber-100">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          </div>
        </div>

        <h2 className="mb-3 text-center text-xl font-bold text-ink-900">
          حسابك قيد الاستخدام على جهاز آخر
        </h2>

        <p className="mb-6 text-center text-sm leading-relaxed text-ink-600">
          تم تسجيل الدخول إلى حسابك من جهاز آخر. للحفاظ على أمان حسابك،
          يسمح النظام بجلسة واحدة نشطة فقط في كل مرة.
          <br />
          <br />
          سيتم تسجيل خروجك من هذه الجلسة.
        </p>

        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink-900 py-3.5 text-sm font-bold text-white transition-colors hover:bg-ink-800"
        >
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </button>

        <p className="mt-4 text-center text-xs text-ink-400">
          إذا لم تكن أنت من سجّل الدخول، يرجى تغيير كلمة المرور فوراً.
        </p>
      </div>
    </div>
  );
}
