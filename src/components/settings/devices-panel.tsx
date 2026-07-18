"use client";

import { useState } from "react";
import { Loader2, Smartphone, Laptop, Trash2, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

interface Session {
  id: string;
  session_id: string;
  device_label: string | null;
  ip_address: string | null;
  last_active_at: string;
  created_at: string;
  status: string;
}

export function DevicesPanel({
  sessions,
  currentSessionId,
  locale,
}: {
  sessions: Session[];
  currentSessionId: string | null;
  locale: string;
}) {
  const [revoking, setRevoking] = useState<string | null>(null);
  const [localSessions, setLocalSessions] = useState<Session[]>(sessions);

  async function revoke(sessionId: string) {
    setRevoking(sessionId);
    try {
      const res = await fetch("/api/auth/revoke-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (res.ok) {
        setLocalSessions((prev) =>
          prev.map((s) => (s.session_id === sessionId ? { ...s, status: "revoked" } : s)),
        );
      }
    } finally {
      setRevoking(null);
    }
  }

  const isRTL = locale === "ar";

  function statusBadge(status: string) {
    const map: Record<string, { label: string; color: string }> = {
      active: { label: isRTL ? "نشط" : "Active", color: "bg-emerald-100 text-emerald-700" },
      superseded: { label: isRTL ? "مستبدل" : "Superseded", color: "bg-amber-100 text-amber-700" },
      revoked: { label: isRTL ? "مُلغى" : "Revoked", color: "bg-red-100 text-red-700" },
      expired: { label: isRTL ? "منتهي" : "Expired", color: "bg-gray-100 text-gray-500" },
    };
    const s = map[status] ?? map.expired;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${s.color}`}>
        {status === "active" && <CheckCircle2 className="h-2.5 w-2.5" />}
        {s.label}
      </span>
    );
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return isRTL ? "الآن" : "just now";
    if (diffMin < 60) return isRTL ? `قبل ${diffMin} دقيقة` : `${diffMin}m ago`;
    if (diffHr < 24) return isRTL ? `قبل ${diffHr} ساعة` : `${diffHr}h ago`;
    if (diffDay < 7) return isRTL ? `قبل ${diffDay} يوم` : `${diffDay}d ago`;
    return d.toLocaleDateString(isRTL ? "ar-JO" : "en-US");
  }

  return (
    <div className="container-page max-w-3xl py-10" dir={isRTL ? "rtl" : "ltr"}>
      <div className="mb-8">
        <h1 className="text-2xl font-black text-ink-900">
          {isRTL ? "الأجهزة والجلسات النشطة" : "Active Devices & Sessions"}
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          {isRTL
            ? "يسمح النظام بجلسة واحدة نشطة فقط. إذا سجّلت الدخول من جهاز آخر، سيتم تسجيل خروج هذا الجهاز تلقائياً."
            : "Only one active session is allowed. If you log in from another device, this device will be automatically logged out."}
        </p>
      </div>

      {/* Info banner */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
        <div>
          <p className="text-sm font-bold text-brand-900">
            {isRTL ? "سياسة جلسة واحدة لكل حساب" : "One session per account policy"}
          </p>
          <p className="mt-1 text-xs text-brand-700">
            {isRTL
              ? "لمنع مشاركة الحساب، يسمح النظام بجلسة نشطة واحدة فقط. كل تسجيل دخول جديد يُلغي الجلسات السابقة."
              : "To prevent account sharing, only one active session is allowed. Each new login supersedes all previous sessions."}
          </p>
        </div>
      </div>

      {/* Sessions list */}
      <div className="space-y-3">
        {localSessions.length === 0 ? (
          <div className="rounded-xl border border-ink-200 bg-white p-8 text-center">
            <p className="text-sm text-ink-500">
              {isRTL ? "لا توجد جلسات مسجّلة" : "No sessions found"}
            </p>
          </div>
        ) : (
          localSessions.map((session) => {
            const isCurrent = session.session_id === currentSessionId;
            const isMobile = session.device_label?.includes("📱");
            const DeviceIcon = isMobile ? Smartphone : Laptop;

            return (
              <div
                key={session.id}
                className={`flex items-center gap-4 rounded-xl border bg-white p-4 transition-colors ${
                  isCurrent ? "border-brand-300 ring-1 ring-brand-100" : "border-ink-200"
                }`}
              >
                <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${isCurrent ? "bg-brand-50" : "bg-ink-50"}`}>
                  <DeviceIcon className={`h-5 w-5 ${isCurrent ? "text-brand-700" : "text-ink-500"}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-ink-900">
                      {session.device_label ?? (isRTL ? "جهاز غير معروف" : "Unknown device")}
                    </p>
                    {isCurrent && (
                      <span className="shrink-0 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        {isRTL ? "هذا الجهاز" : "This device"}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-ink-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {isRTL ? "آخر نشاط" : "Last active"}: {formatTime(session.last_active_at)}
                    </span>
                    {session.ip_address && (
                      <span dir="ltr" className="font-mono">{session.ip_address}</span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {statusBadge(session.status)}
                  {!isCurrent && session.status === "active" && (
                    <button
                      onClick={() => revoke(session.session_id)}
                      disabled={revoking === session.session_id}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-ink-200 text-ink-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      title={isRTL ? "إلغاء الجلسة" : "Revoke session"}
                    >
                      {revoking === session.session_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer note */}
      <div className="mt-8 rounded-xl bg-ink-50 p-4">
        <p className="text-xs text-ink-500">
          {isRTL
            ? "إذا لاحظت نشاطاً مشبوهاً، يرجى تغيير كلمة المرور فوراً والتواصل مع الدعم."
            : "If you notice suspicious activity, please change your password immediately and contact support."}
        </p>
      </div>
    </div>
  );
}
