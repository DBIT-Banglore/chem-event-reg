"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/session";
import Navbar from "@/components/Navbar";
import StudentRegistrationForm from "@/components/StudentRegistrationForm";

export default function RegisterPage() {
  const router = useRouter();

  // If already logged in, redirect to dashboard
  useEffect(() => {
    const session = getSession();
    if (session) {
      router.replace("/dashboard");
    }
  }, [router]);

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--paper)", color: "var(--ink)" }}>
      <Navbar />

      <section className="flex-1 flex items-start justify-center px-4 py-8" style={{ marginTop: 60 }}>
        <div className="w-full max-w-md fade-in-up">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 style={{ fontFamily: "var(--bebas)", fontSize: "42px", letterSpacing: "0.02em", lineHeight: 1, marginBottom: "8px" }}>
              Join Idea Lab
            </h1>
            <p style={{ color: "var(--muted)", fontSize: "14px" }}>
              Enter your USN to register. Your details will be auto-filled from the student database.
            </p>
          </div>

          {/* Info Card */}
          <div className="glass-card p-4 mb-6 flex items-start gap-3 fade-in-up">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" className="mt-0.5 shrink-0">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <div style={{ fontSize: "13px" }}>
              <p style={{ fontWeight: 700, color: "var(--ink)", marginBottom: "4px" }}>How it works</p>
              <p style={{ color: "var(--muted)" }}>
                Register with your USN, verify your email, then select the event or theme you want to participate in. No team needed — this is individual participation!
              </p>
            </div>
          </div>

          {/* Registration Form */}
          <div className="glass-card p-6 md:p-8">
            <StudentRegistrationForm />
          </div>
        </div>
      </section>
    </main>
  );
}
