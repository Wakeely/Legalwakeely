"use client";

import { useState, useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { X, Cookie } from "lucide-react";

const STORAGE_KEY = "lw.cookie-consent";

/**
 * PDPL/GDPR cookie consent banner.
 * Shows on first visit, persists choice in localStorage.
 * Redesigned: higher contrast, non-overlapping (pushes content up),
 * dismissable, better visual hierarchy.
 */
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        // Small delay so the page renders first, then banner slides in
        setTimeout(() => setVisible(true), 800);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss(accepted: boolean) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ accepted, date: new Date().toISOString() }),
      );
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
      style={{ direction: "rtl" }}
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-ink-300 bg-white p-4 shadow-2xl ring-1 ring-black/5 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="hidden shrink-0 rounded-xl bg-teal-50 p-2 sm:block">
            <Cookie className="h-5 w-5 text-teal-700" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink-900">
              نستخدم ملفات تعريف الارتباط لتشغيل المنصة
            </p>
            <p className="mt-1 text-xs leading-5 text-ink-600">
              نستخدم cookies تقنية ضرورية لتشغيل المنصة، وملفات تحليلية لتحسين
              تجربتك. يمكنك الاطلاع على{" "}
              <Link
                href="/legal/privacy"
                className="font-semibold text-teal-700 underline hover:text-teal-800"
              >
                سياسة الخصوصية
              </Link>
              .
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => dismiss(true)} className="bg-teal-700 hover:bg-teal-800">
                موافق
              </Button>
              <Button size="sm" variant="outline" onClick={() => dismiss(false)}>
                رفض التحليلات
              </Button>
            </div>
          </div>
          <button
            onClick={() => dismiss(false)}
            className="shrink-0 rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
