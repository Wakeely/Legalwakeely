"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary for dashboard routes.
 *
 * Shows the error with a manual retry button. Does NOT auto-retry
 * (auto-retry caused a flashing loop between the error page and the
 * dashboard when the underlying issue was persistent, not transient).
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route-error]", error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  return (
    <div
      style={{
        minHeight: "50vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        direction: "rtl",
      }}
    >
      <div style={{ maxWidth: 400, textAlign: "center" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.5rem" }}>
          حدث خطأ في تحميل الصفحة
        </h2>
        <p style={{ color: "#64748b", marginBottom: "1rem", fontSize: "0.875rem" }}>
          {error.message?.includes("fetch")
            ? "تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت."
            : error.message?.includes("hydrate") || error.message?.includes("300")
              ? "خطأ في تحميل الصفحة. أعد المحاولة."
              : "حدث خطأ غير متوقع. أعد المحاولة أو حدّث الصفحة."}
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
              borderRadius: 10,
              padding: "0.6rem 1.5rem",
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
              borderRadius: 10,
              padding: "0.6rem 1.5rem",
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
