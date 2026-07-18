import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <p style={{ fontSize: "6rem", fontWeight: 900, color: "#cbd5e1", lineHeight: 1 }}>
          404
        </p>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "1rem" }}>
          الصفحة غير موجودة
        </h1>
        <p style={{ color: "#666", marginTop: "0.5rem", marginBottom: "1.5rem" }}>
          عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            padding: "0.5rem 1.5rem",
            backgroundColor: "#0f766e",
            color: "white",
            borderRadius: "0.5rem",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "0.875rem",
          }}
        >
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}
