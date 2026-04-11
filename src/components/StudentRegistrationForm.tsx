"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { db, auth } from "@/lib/firebase";
import { signInWithCustomToken } from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, getDocs, limit, serverTimestamp } from "firebase/firestore";
import { validateUSN, getBranchName, getSection } from "@/lib/usnValidator";
import { setSession } from "@/lib/session";
import { useRouter } from "next/navigation";
import { CheckCircle2, PencilLine, Lock, Loader2, Mail, ShieldCheck, RotateCcw, CalendarDays, AlertCircle } from "lucide-react";

type Step = "usn" | "otp" | "register" | "event";

export default function StudentRegistrationForm({ redirectTo, onRegistered }: { redirectTo?: string; onRegistered?: () => void } = {}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("usn");

  // USN state
  const [usn, setUSN] = useState("");
  const [usnValidation, setUsnValidation] = useState<{
    valid: boolean | null;
    message: string;
    branch?: string;
    section?: string;
  }>({ valid: null, message: "" });

  // Student info from CSV / registrations
  const [studentInfo, setStudentInfo] = useState<{
    name: string;
    email: string;
    phone: string;
    branch: string;
    section: string;
  } | null>(null);

  // Whether this USN is already registered (returning student)
  const [isReturning, setIsReturning] = useState(false);

  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);
  const [csvNotFound, setCsvNotFound] = useState(false);

  // Event selection state
  const [events, setEvents] = useState<Array<{eventId: string; name: string; description: string; capacity: number; dateTime: string; price: number; registrationCount: number}>>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventSubmitting, setEventSubmitting] = useState(false);
  const [eventError, setEventError] = useState("");

  // OTP state
  const [otpCode, setOtpCode] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check registration gate
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const q = query(collection(db, "config"), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setRegistrationOpen(data.registrationsOpen ?? true);
        } else {
          setRegistrationOpen(true);
        }
      } catch {
        setRegistrationOpen(true);
      }
    };
    checkStatus();
  }, []);

  // Cooldown timer cleanup
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startCooldown = () => {
    setResendCooldown(60);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Mask email for returning students: a****z@domain.com
  const maskEmail = (email: string) => {
    const [local, domain] = email.split("@");
    if (!domain) return email;
    if (local.length <= 2) return `${local[0]}***@${domain}`;
    return `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
  };

  const fetchEvents = async () => {
    setEventsLoading(true);
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      setEvents(data.events || []);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  // Step 1: Validate USN and look up student data
  const handleUSNChange = useCallback(async (value: string) => {
    const upper = value.toUpperCase();
    setUSN(upper);
    setStudentInfo(null);
    setSubmitError("");
    setCsvNotFound(false);
    setIsReturning(false);
    setOtpSent(false);
    setOtpCode("");
    setOtpError("");
    setStep("usn");

    if (!upper || upper.length < 10) {
      setUsnValidation({ valid: null, message: "" });
      return;
    }

    const result = validateUSN(upper);
    if (!result.valid) {
      setUsnValidation({ valid: false, message: result.error || "Invalid USN" });
      return;
    }

    setUsnValidation({
      valid: null,
      message: "Verifying against student database...",
      branch: result.branch,
      section: result.section,
    });

    setIsLookingUp(true);
    try {
      // Server-side lookup (uses admin SDK — bypasses Firestore auth rules)
      const res = await fetch("/api/auth/lookup-usn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usn: upper }),
      });
      const data = await res.json();

      if (!res.ok || !data.found) {
        setCsvNotFound(true);
        setUsnValidation({
          valid: false,
          message: data.error || "USN not found in the student database.",
        });
        setStudentInfo(null);
        return;
      }

      const s = data.student;
      if (data.returning) {
        setUsnValidation({
          valid: true,
          message: `${s.branch || result.branch} — Section ${s.section || result.section} (already registered)`,
          branch: s.branch || result.branch,
          section: s.section || result.section,
        });
        setStudentInfo({
          name: s.name,
          email: s.email,
          phone: s.phone,
          branch: s.branch || result.branch || "",
          section: s.section || result.section || "",
        });
        setIsReturning(true);
      } else {
        setUsnValidation({
          valid: true,
          message: `${s.branch || result.branch} — Section ${s.section || result.section}`,
          branch: s.branch || result.branch,
          section: s.section || result.section,
        });
        setStudentInfo({
          name: s.name,
          email: s.email,
          phone: s.phone,
          branch: s.branch || result.branch || "",
          section: s.section || result.section || "",
        });
      }
    } catch {
      setUsnValidation({
        valid: false,
        message: "Could not verify USN. Please check your connection and try again.",
      });
      setStudentInfo(null);
    } finally {
      setIsLookingUp(false);
    }
  }, []);

  // Step 2: Send OTP via custom SMTP
  const handleSendOtp = async () => {
    if (!studentInfo?.email) return;
    setIsSendingOtp(true);
    setOtpError("");

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: studentInfo.email, usn: usn.toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send code.");
      setOtpSent(true);
      setStep("otp");
      startCooldown();
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Failed to send verification code.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Step 3: Verify OTP
  const handleVerifyOtp = async () => {
    if (!studentInfo?.email || !otpCode) return;
    setIsVerifyingOtp(true);
    setOtpError("");

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: studentInfo.email, otp: otpCode, usn: usn.toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed.");

      // Sign in with Firebase custom token (for Firestore auth)
      if (data.customToken) {
        await signInWithCustomToken(auth, data.customToken);
      }

      // OTP verified — if returning student, restore session from server response
      if (isReturning && data.user) {
        setSession({
          usn: data.user.usn,
          name: data.user.name,
          email: data.user.email,
          branch: data.user.branch,
          section: data.user.section,
          eventId: data.user.eventId || null,
          registeredAt: new Date().toISOString(),
        });
        // If returning student has no event yet, go to event selection
        if (!data.user.eventId) {
          await fetchEvents();
          setStep("event");
          return;
        }
        if (onRegistered) { onRegistered(); return; }
        window.location.href = redirectTo || "/dashboard";
        return;
      }

      // New student — proceed to registration step (Firebase Auth is now active)
      setStep("register");
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Invalid or expired code. Please try again.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Final submit — write registration to Firestore
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Only allow submit on the final registration step
    if (step !== "register") return;
    if (!studentInfo) return;
    setIsSubmitting(true);
    setSubmitError("");

    const upperUSN = usn.toUpperCase();

    try {
      if (!studentInfo.name.trim()) throw new Error("Name is required.");
      if (!studentInfo.phone.trim() || !/^\d{10}$/.test(studentInfo.phone.trim()))
        throw new Error("Please enter a valid 10-digit phone number.");

      // Final CSV validation
      const studentDoc = await getDoc(doc(db, "students", upperUSN));
      const existingDoc = await getDoc(doc(db, "registrations", upperUSN));

      if (!studentDoc.exists() && !existingDoc.exists()) {
        throw new Error("USN not found in the student database. Admin must upload the CSV first.");
      }

      if (existingDoc.exists()) {
        const data = existingDoc.data();
        setSession({
          usn: upperUSN,
          name: data.name,
          email: data.email || studentInfo.email,
          branch: data.branch,
          section: data.section,
          eventId: data.eventId || null,
          registeredAt: new Date().toISOString(),
        });
        if (onRegistered) { onRegistered(); return; }
        window.location.href = redirectTo || "/dashboard";
        return;
      }

      const branch = studentInfo.branch || getBranchName(upperUSN);
      const section = studentInfo.section || getSection(upperUSN);

      await setDoc(doc(db, "registrations", upperUSN), {
        name: studentInfo.name.trim(),
        usn: upperUSN,
        email: studentInfo.email.trim(),
        phone: studentInfo.phone.trim(),
        branch,
        section,
        eventId: null,
        registeredAt: serverTimestamp(),
      });

      setSession({
        usn: upperUSN,
        name: studentInfo.name.trim(),
        email: studentInfo.email.trim(),
        branch,
        section,
        eventId: null,
        registeredAt: new Date().toISOString(),
      });

      if (onRegistered) { onRegistered(); return; }
      await fetchEvents();
      setStep("event");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Renders ---

  if (registrationOpen === false) {
    return (
      <div className="text-center p-8 space-y-6 fade-in-up">
        <div style={{ width: 64, height: 64, border: "1.5px solid var(--ink)", display: "grid", placeItems: "center", margin: "0 auto" }}>
          <Lock style={{ width: 28, height: 28, color: "var(--muted)" }} />
        </div>
        <h3 style={{ fontFamily: "var(--bebas)", fontSize: "28px", color: "var(--ink)" }}>Registrations Closed</h3>
        <p style={{ color: "var(--muted)", fontSize: "14px", maxWidth: "320px", margin: "0 auto", lineHeight: 1.7 }}>
          The registration window for <strong style={{ color: "var(--ink)" }}>Idea Lab</strong> is currently closed.
        </p>
      </div>
    );
  }

  if (registrationOpen === null) {
    return <div className="text-center p-12"><div className="spinner mx-auto" /></div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 fade-in-up">
      {/* Step indicator */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: "8px", overflow: "hidden" }}>
        {[
          { key: "usn", label: "USN" },
          { key: "otp", label: "Verify" },
          { key: "register", label: "Register" },
          { key: "event", label: "Event" },
        ].map(({ key, label }, i) => {
          const isActive = step === key;
          const isDone =
            (key === "usn" && (step === "otp" || step === "register" || step === "event")) ||
            (key === "otp" && (step === "register" || step === "event")) ||
            (key === "register" && step === "event");
          return (
            <div key={key} style={{ display: "flex", alignItems: "center", flex: i < 3 ? 1 : "none" }}>
              {i > 0 && (
                <div style={{ flex: 1, height: "1.5px", background: isDone ? "var(--ink)" : "var(--line)", minWidth: 8, marginRight: 6 }} />
              )}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: isActive ? "var(--ink)" : isDone ? "var(--ink)" : "var(--muted)",
                  opacity: isActive || isDone ? 1 : 0.45,
                  whiteSpace: "nowrap",
                }}
              >
                {isDone ? (
                  <CheckCircle2 style={{ width: 13, height: 13, flexShrink: 0 }} />
                ) : (
                  <span
                    style={{
                      width: 17,
                      height: 17,
                      border: `1.5px solid ${isActive ? "var(--ink)" : "var(--line)"}`,
                      display: "grid",
                      placeItems: "center",
                      fontSize: "9px",
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </span>
                )}
                {(isActive || isDone) && <span>{label}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* USN Field — always visible */}
      <div>
        <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)", marginBottom: "8px" }}>
          Your USN
        </label>
        <input
          type="text"
          value={usn}
          onChange={(e) => handleUSNChange(e.target.value)}
          placeholder="1DB25CS001"
          className={`input-field ${usnValidation.valid === true ? "success" : usnValidation.valid === false ? "error" : ""}`}
          maxLength={10}
          required
          disabled={step !== "usn"}
        />
        {usnValidation.message && (
          <p style={{ marginTop: "6px", fontSize: "12px", fontWeight: 600, color: usnValidation.valid ? "#10b981" : "var(--red)" }}>
            {usnValidation.message}
          </p>
        )}
        {isLookingUp && (
          <p style={{ marginTop: "6px", fontSize: "11px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "6px" }}>
            <Loader2 style={{ width: 12, height: 12, animation: "spin 0.8s linear infinite" }} />
            Verifying against student database...
          </p>
        )}
        {csvNotFound && (
          <div style={{ marginTop: "10px", padding: "12px 14px", background: "rgba(232, 52, 26, 0.06)", border: "1.5px solid var(--red)", fontSize: "12px", color: "var(--red)", fontWeight: 600, lineHeight: 1.6 }}>
            This USN was not found in the student database. Please ask your admin to upload the student CSV with your USN before you can register.
          </div>
        )}
      </div>

      {/* Email display + Send OTP — visible once USN is valid and step is "usn" */}
      {studentInfo && usnValidation.valid && step === "usn" && (
        <div className="fade-in-up" style={{ padding: "16px 18px", background: "var(--paper2)", border: "1.5px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <Mail style={{ width: 16, height: 16, color: "var(--muted)" }} />
            <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)" }}>
              {isReturning ? "Registered Email" : "Email from Student Database"}
            </span>
          </div>
          <p style={{ fontWeight: 700, color: "var(--ink)", fontSize: "15px", fontFamily: "var(--mono)", marginBottom: "14px" }}>
            {isReturning ? maskEmail(studentInfo.email) : studentInfo.email}
          </p>
          <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.6, marginBottom: "14px" }}>
            {isReturning
              ? "A 6-digit verification code will be sent to your registered email to restore your session."
              : "A 6-digit verification code will be sent to this email to verify your identity."}
          </p>

          {otpError && (
            <div style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, background: "rgba(232, 52, 26, 0.08)", color: "var(--red)", border: "1.5px solid var(--red)", marginBottom: "12px" }}>
              {otpError}
            </div>
          )}

          <button
            type="button"
            onClick={handleSendOtp}
            disabled={isSendingOtp || !studentInfo.email}
            className="btn-primary w-full"
            style={{ padding: "14px" }}
          >
            {isSendingOtp ? (
              <><div className="spinner" /> Sending Code...</>
            ) : (
              <><Mail style={{ width: 18, height: 18 }} /> Send Verification Code</>
            )}
          </button>
        </div>
      )}

      {/* OTP Input — Step 2 */}
      {step === "otp" && otpSent && studentInfo && (
        <div className="fade-in-up space-y-4">
          <div style={{ padding: "14px 16px", background: "rgba(16, 185, 129, 0.06)", border: "1.5px solid #10b981", fontSize: "12px", fontWeight: 600, color: "#10b981", lineHeight: 1.6 }}>
            Verification code sent to {isReturning ? maskEmail(studentInfo.email) : studentInfo.email}
          </div>

          <div>
            <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)", marginBottom: "8px" }}>
              6-Digit Verification Code
            </label>
            <input
              type="text"
              value={otpCode}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setOtpCode(v);
                setOtpError("");
              }}
              placeholder="000000"
              className="input-field"
              style={{ fontSize: "24px", fontFamily: "var(--mono)", letterSpacing: "0.3em", textAlign: "center" }}
              maxLength={6}
              inputMode="numeric"
              autoFocus
            />
          </div>

          {otpError && (
            <div style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, background: "rgba(232, 52, 26, 0.08)", color: "var(--red)", border: "1.5px solid var(--red)" }}>
              {otpError}
            </div>
          )}

          <button
            type="button"
            onClick={handleVerifyOtp}
            disabled={isVerifyingOtp || otpCode.length !== 6}
            className="btn-primary w-full"
            style={{ padding: "14px" }}
          >
            {isVerifyingOtp ? (
              <><div className="spinner" /> Verifying...</>
            ) : (
              <><ShieldCheck style={{ width: 18, height: 18 }} /> Verify Code</>
            )}
          </button>

          {/* Resend */}
          <div style={{ textAlign: "center" }}>
            {resendCooldown > 0 ? (
              <p style={{ fontSize: "12px", color: "var(--muted)" }}>
                Resend code in {resendCooldown}s
              </p>
            ) : (
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={isSendingOtp}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "var(--ink)",
                  cursor: "pointer",
                  textDecoration: "underline",
                  textUnderlineOffset: "3px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <RotateCcw style={{ width: 12, height: 12 }} />
                Resend Code
              </button>
            )}
          </div>

          {/* Change USN */}
          <div style={{ textAlign: "center" }}>
            <button
              type="button"
              onClick={() => {
                setStep("usn");
                setOtpSent(false);
                setOtpCode("");
                setOtpError("");
              }}
              style={{
                background: "none",
                border: "none",
                fontSize: "11px",
                color: "var(--muted)",
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: "3px",
              }}
            >
              Change USN
            </button>
          </div>
        </div>
      )}

      {/* Registration fields — Step 3 (new students only, after OTP verified) */}
      {step === "register" && studentInfo && !isReturning && (
        <div className="fade-in-up space-y-4">
          <div style={{ padding: "14px 16px", background: "rgba(16, 185, 129, 0.06)", border: "1.5px solid #10b981", fontSize: "12px", fontWeight: 600, color: "#10b981", display: "flex", alignItems: "center", gap: "8px" }}>
            <CheckCircle2 style={{ width: 16, height: 16 }} />
            Email verified successfully
          </div>

          <div>
            <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)", marginBottom: "8px" }}>
              Full Name
            </label>
            <input
              type="text"
              value={studentInfo.name}
              onChange={(e) => setStudentInfo({ ...studentInfo, name: e.target.value })}
              placeholder="Enter your full name"
              className="input-field"
              required
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)", marginBottom: "8px" }}>
              Email
            </label>
            <input
              type="email"
              value={studentInfo.email}
              className="input-field"
              disabled
              style={{ opacity: 0.6 }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)", marginBottom: "8px" }}>
              Phone Number
            </label>
            <input
              type="tel"
              value={studentInfo.phone}
              onChange={(e) => setStudentInfo({ ...studentInfo, phone: e.target.value })}
              placeholder="10-digit phone number"
              className="input-field"
              maxLength={10}
              pattern="\d{10}"
              required
            />
            {studentInfo.phone && !/^\d{10}$/.test(studentInfo.phone) && (
              <p style={{ marginTop: "6px", fontSize: "12px", fontWeight: 600, color: "var(--red)" }}>Enter a valid 10-digit phone number</p>
            )}
          </div>

          {/* Branch/Section display */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={{ padding: "14px 18px", background: "var(--paper2)", border: "1.5px solid var(--line)" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)" }}>Branch</span>
              <p style={{ fontWeight: 700, color: "var(--ink)", marginTop: "4px" }}>{studentInfo.branch}</p>
            </div>
            <div style={{ padding: "14px 18px", background: "var(--paper2)", border: "1.5px solid var(--line)" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)" }}>Section</span>
              <p style={{ fontWeight: 700, color: "var(--ink)", marginTop: "4px" }}>{studentInfo.section}</p>
            </div>
          </div>

          {/* Error */}
          {submitError && (
            <div style={{ padding: "14px 16px", fontSize: "13px", fontWeight: 600, background: "rgba(232, 52, 26, 0.08)", color: "var(--red)", border: "1.5px solid var(--red)" }}>
              {submitError}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full"
            style={{ padding: "16px" }}
          >
            {isSubmitting ? (
              <><div className="spinner" /> Registering...</>
            ) : (
              <><PencilLine style={{ width: 20, height: 20 }} /> Register & Continue</>
            )}
          </button>
        </div>
      )}

      {/* Event Selection — Step 4 */}
      {step === "event" && (
        <div className="fade-in-up space-y-4">
          <div style={{ padding: "14px 16px", background: "rgba(16,185,129,0.06)", border: "1.5px solid #10b981", fontSize: "12px", fontWeight: 600, color: "#10b981", display: "flex", alignItems: "center", gap: "8px" }}>
            <CheckCircle2 style={{ width: 16, height: 16 }} />
            Registration complete! Now select your event.
          </div>

          <div>
            <h3 style={{ fontFamily: "var(--bebas)", fontSize: "22px", letterSpacing: "0.04em", marginBottom: "4px" }}>Select Your Event</h3>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "16px" }}>Choose the event you want to participate in. You can change this later from your dashboard.</p>
          </div>

          {eventsLoading ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div className="spinner mx-auto" style={{ width: 28, height: 28 }} />
            </div>
          ) : events.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", border: "1.5px dashed var(--line)", color: "var(--muted)", fontSize: "13px" }}>
              No events available yet. You can select one from your dashboard later.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {events.map((ev) => {
                const isFull = ev.registrationCount >= ev.capacity;
                const isSelected = selectedEventId === ev.eventId;
                return (
                  <button
                    key={ev.eventId}
                    type="button"
                    onClick={() => !isFull && setSelectedEventId(ev.eventId)}
                    disabled={isFull}
                    style={{
                      textAlign: "left", padding: "14px 18px", width: "100%",
                      border: `1.5px solid ${isSelected ? "var(--ink)" : "var(--line)"}`,
                      background: isSelected ? "var(--paper2)" : "transparent",
                      cursor: isFull ? "not-allowed" : "pointer",
                      opacity: isFull ? 0.5 : 1,
                      fontFamily: "var(--body)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--ink)", marginBottom: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
                          {ev.name}
                          {isFull && <span style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", padding: "2px 6px", background: "var(--muted)", color: "#fff" }}>Full</span>}
                          <span style={{ fontSize: "10px", fontWeight: 700, color: (ev.price ?? 0) === 0 ? "#16a34a" : "#2563eb", marginLeft: "auto" }}>
                            {(ev.price ?? 0) === 0 ? "Free" : `₹${ev.price}`}
                          </span>
                        </div>
                        {ev.description && <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.5, marginBottom: "4px" }}>{ev.description}</p>}
                        <p style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>
                          {new Date(ev.dateTime).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} · {ev.registrationCount}/{ev.capacity} registered
                        </p>
                      </div>
                      {isSelected && <CheckCircle2 style={{ width: 18, height: 18, color: "var(--ink)", flexShrink: 0 }} />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {eventError && (
            <div style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, background: "rgba(232,52,26,0.08)", color: "var(--red)", border: "1.5px solid var(--red)", display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} /> {eventError}
            </div>
          )}

          <button
            type="button"
            disabled={!selectedEventId || eventSubmitting}
            onClick={async () => {
              if (!selectedEventId) return;
              setEventSubmitting(true);
              setEventError("");
              try {
                // Ask server for order info (or free confirmation)
                const orderRes = await fetch("/api/payment/create-order", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ eventId: selectedEventId }),
                });
                const orderData = await orderRes.json();
                if (!orderRes.ok) throw new Error(orderData.error || "Failed to initiate");

                if (orderData.free) {
                  // Free — confirm directly
                  const res = await fetch("/api/registration/select-event", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ eventId: selectedEventId }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Failed to select event");
                  const existing = JSON.parse(localStorage.getItem("idealab_session") || "{}");
                  localStorage.setItem("idealab_session", JSON.stringify({ ...existing, eventId: selectedEventId }));
                  window.location.href = redirectTo || "/dashboard";
                  return;
                }

                // Paid event — load Razorpay and open checkout
                await new Promise<void>((resolveScript, rejectScript) => {
                  if ((window as unknown as Record<string, unknown>).Razorpay) { resolveScript(); return; }
                  const s = document.createElement("script");
                  s.src = "https://checkout.razorpay.com/v1/checkout.js";
                  s.onload = () => resolveScript();
                  s.onerror = () => rejectScript(new Error("Failed to load payment gateway"));
                  document.body.appendChild(s);
                });

                await new Promise<void>((resolve, reject) => {
                  const options = {
                    key: orderData.keyId,
                    amount: orderData.amount,
                    currency: orderData.currency,
                    name: "DBIT Chemistry Dept",
                    description: `Registration: ${orderData.eventName}`,
                    order_id: orderData.orderId,
                    handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
                      try {
                        const verifyRes = await fetch("/api/payment/verify", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            eventId: selectedEventId,
                          }),
                        });
                        const verifyData = await verifyRes.json();
                        if (!verifyRes.ok) throw new Error(verifyData.error || "Payment verification failed");
                        const existing = JSON.parse(localStorage.getItem("idealab_session") || "{}");
                        localStorage.setItem("idealab_session", JSON.stringify({ ...existing, eventId: selectedEventId }));
                        resolve();
                        window.location.href = redirectTo || "/dashboard";
                      } catch (err) { reject(err); }
                    },
                    theme: { color: "#E8341A" },
                    modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
                  };
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  new (window as any).Razorpay(options).open();
                });
              } catch (err) {
                const msg = err instanceof Error ? err.message : "Failed";
                if (msg !== "Payment cancelled") setEventError(msg);
                setEventSubmitting(false);
              }
            }}
            className="btn-primary w-full"
            style={{ padding: "16px" }}
          >
            {eventSubmitting ? (
              <><div className="spinner" /> Processing...</>
            ) : (
              <><CalendarDays style={{ width: 20, height: 20 }} /> Confirm & Go to Dashboard</>
            )}
          </button>

          {events.length > 0 && (
            <div style={{ textAlign: "center" }}>
              <button
                type="button"
                onClick={() => { window.location.href = redirectTo || "/dashboard"; }}
                style={{ background: "none", border: "none", fontSize: "12px", color: "var(--muted)", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px" }}
              >
                Skip for now — select from dashboard
              </button>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
