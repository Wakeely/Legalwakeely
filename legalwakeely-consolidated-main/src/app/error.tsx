"use client";

import { useEffect } from "react";

/**
 * Root-level error.tsx — catches errors in the root layout's children.
 *
 * Shows the error with manual retry + reload buttons. No auto-retry
 * (auto-retry caused a flashing loop between error and dashboard pages).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        direction: "rtl",
      }}
    >
      <div style={{ maxWidth: 480, textAlign: "center" }}>
        <div
          style={{
            width: 56,
            height: 56,
            margin: "0 auto 1.25rem",
            borderRadius: 16,
            background: "#fef3c7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
          }}
        >
          ⚠️
        </div>
        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: 800,
            marginBottom: "0.5rem",
            color: "#0f172a",
          }}
        >
          حدث خطأ غير متوقع
        </h2>
        <p style={{ color: "#64748b", marginBottom: "1.5rem", lineHeight: 1.6 }}>
          {error.message?.includes("fetch")
            ? "تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت ثم أعد المحاولة."
            : error.message?.includes("hydrate") || error.message?.includes("300")
              ? "خطأ في تحميل الصفحة. أعد المحاولة أو حدّث الصفحة."
              : "حدث خطأ في النظام. أعد المحاولة أو حدّث الصفحة."}
        </p>
        {error.digest && (
          <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "1rem" }} dir="ltr">
            Error ID: {error.digest}
          </p>
        )}
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
          <button
            onClick={() => reset()}
            style={{
              background: "#085f63",
              color: "white",
              border: "none",
              borderRadius: 12,
              padding: "0.75rem 2rem",
              fontSize: "0.875rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            إعادة المحاولة
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "white",
              color: "#334155",
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              padding: "0.75rem 2rem",
              fontSize: "0.875rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            تحديث الصفحة
          </button>
        </div>
      </div>
    </div>
  );
}
