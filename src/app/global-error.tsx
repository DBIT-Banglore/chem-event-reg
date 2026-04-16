"use client";
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html>
      <body style={{ background: "#F2EFE9", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif", color: "#0D0D0D" }}>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ marginBottom: 16 }}>Something went wrong.</h2>
          <button onClick={() => reset()} style={{ padding: "8px 24px", cursor: "pointer", border: "1px solid #0D0D0D", background: "#0D0D0D", color: "#F2EFE9" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
