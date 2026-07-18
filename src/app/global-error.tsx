"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            fontFamily: "system-ui, -apple-system, sans-serif",
            direction: "rtl",
          }}
        >
          <div style={{ maxWidth: 600, textAlign: "center" }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1rem" }}>
              حدث خطأ
            </h1>
            <p
              style={{
                color: "#dc2626",
                marginBottom: "1rem",
                fontFamily: "monospace",
                fontSize: "0.875rem",
                background: "#fef2f2",
                padding: "1rem",
                borderRadius: "0.5rem",
                direction: "ltr",
                textAlign: "left",
                wordBreak: "break-word",
              }}
            >
              {error.message || "Unknown error"}
            </p>
            {error.digest && (
              <p style={{ fontSize: "0.75rem", color: "#999", marginBottom: "1rem" }} dir="ltr">
                Digest: {error.digest}
              </p>
            )}
            {error.stack && (
              <details style={{ textAlign: "left", marginBottom: "1rem" }}>
                <summary style={{ cursor: "pointer", fontSize: "0.875rem", color: "#666" }}>
                  Stack trace
                </summary>
                <pre
                  style={{
                    fontSize: "0.75rem",
                    color: "#666",
                    overflow: "auto",
                    background: "#f5f5f5",
                    padding: "0.5rem",
                    borderRadius: "0.25rem",
                    direction: "ltr",
                    maxHeight: "200px",
                  }}
                >
                  {error.stack}
                </pre>
              </details>
            )}
            <button
              onClick={() => reset()}
              style={{
                background: "#085f63",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                padding: "0.75rem 2rem",
                fontSize: "0.875rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
