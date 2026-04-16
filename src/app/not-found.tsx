"use client";
export const dynamic = "force-dynamic";
import Link from "next/link";

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--paper)",
        color: "var(--ink)",
        padding: "24px",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: "420px" }}>
        <p
          style={{
            fontFamily: "var(--bebas)",
            fontSize: "clamp(96px, 20vw, 160px)",
            lineHeight: 0.9,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
          }}
        >
          4<span style={{ color: "var(--red)" }}>0</span>4
        </p>

        <p
          style={{
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            color: "var(--muted)",
            marginTop: "8px",
            marginBottom: "32px",
          }}
        >
          Page Not Found
        </p>

        <p
          style={{
            fontSize: "14px",
            color: "var(--muted)",
            lineHeight: 1.7,
            marginBottom: "32px",
          }}
        >
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/"
            className="btn-primary"
            style={{ padding: "14px 28px", display: "inline-flex" }}
          >
            Home
          </Link>
          <Link
            href="/register"
            className="btn-secondary"
            style={{ padding: "14px 28px", display: "inline-flex" }}
          >
            Register / Login
          </Link>
        </div>
      </div>
    </main>
  );
}
