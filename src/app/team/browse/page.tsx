"use client";
import Link from "next/link";

export default function BrowseTeamsPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--paper)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        fontFamily: "'Instrument Sans', sans-serif",
        color: "var(--ink)",
      }}
    >
      <div
        style={{
          maxWidth: 560,
          width: "100%",
          border: "1.5px solid var(--ink)",
          background: "#fff",
          padding: "2.5rem 2rem",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: "2.5rem",
            letterSpacing: "0.04em",
            marginBottom: "0.5rem",
          }}
        >
          Individual Registration
        </p>

        <p
          style={{
            color: "var(--muted)",
            fontSize: "0.95rem",
            lineHeight: 1.65,
            marginBottom: "2rem",
          }}
        >
          Idea Lab operates on an <strong>individual basis</strong> — there are
          no team slots to browse. Each student registers independently and can
          participate in up to <strong>2 events</strong>. Head to your dashboard
          to view or update your event selection.
        </p>

        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/dashboard"
            style={{
              background: "var(--ink)",
              color: "#fff",
              padding: "0.65rem 1.6rem",
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "1.05rem",
              letterSpacing: "0.06em",
              textDecoration: "none",
              border: "1.5px solid var(--ink)",
              display: "inline-block",
            }}
          >
            Go to Dashboard
          </Link>

          <Link
            href="/"
            style={{
              background: "transparent",
              color: "var(--ink)",
              padding: "0.65rem 1.6rem",
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "1.05rem",
              letterSpacing: "0.06em",
              textDecoration: "none",
              border: "1.5px solid var(--ink)",
              display: "inline-block",
            }}
          >
            Back to Home
          </Link>
        </div>
      </div>

      <p
        style={{
          marginTop: "2rem",
          fontSize: "0.8rem",
          color: "var(--muted)",
        }}
      >
        Idea Lab &mdash; DBIT Bangalore
      </p>
    </main>
  );
}
