"use client";

import { useState, useEffect, useCallback } from "react";
import { doc, getDoc, collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getSession, setSession, clearSession, initializeAuth } from "@/lib/session";
import { SessionData, ProgrammeEvent } from "@/lib/types";
import Navbar from "@/components/Navbar";
import SessionGuard from "@/components/SessionGuard";
import TeamRegistrationForm from "@/components/TeamRegistrationForm";
import { CalendarDays, Users, CheckCircle2, ChevronRight, LogOut, AlertCircle, Tag, Clock, IndianRupee } from "lucide-react";
import { useRouter } from "next/navigation";

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function DashboardContent({ session }: { session: SessionData }) {
  const router = useRouter();
  const [registrationOpen, setRegistrationOpen] = useState<boolean>(true);
  const [currentEvent, setCurrentEvent] = useState<ProgrammeEvent | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [events, setEvents] = useState<ProgrammeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectError, setSelectError] = useState("");
  const [teamEvent, setTeamEvent] = useState<ProgrammeEvent | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [teamData, setTeamData] = useState<any>(null);
  const [showTeamPicker, setShowTeamPicker] = useState<string | null>(null);
  const [teamEvents, setTeamEvents] = useState<ProgrammeEvent[]>([]);
  const [teamOtpInputs, setTeamOtpInputs] = useState<Record<string, string>>({});
  const [verifyingMember, setVerifyingMember] = useState<string | null>(null);
  const [resendingOtp, setResendingOtp] = useState<string | null>(null);
  const [creatingTeamOrder, setCreatingTeamOrder] = useState(false);
  const [teamError, setTeamError] = useState("");
  const [teamSuccess, setTeamSuccess] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const configSnap = await getDocs(query(collection(db, "config"), limit(1)));
      if (!configSnap.empty) {
        setRegistrationOpen(configSnap.docs[0].data().registrationsOpen ?? true);
      }

      const regDoc = await getDoc(doc(db, "registrations", session.usn));
      const eventId = regDoc.exists() ? (regDoc.data()?.eventId || null) : null;
      const teamId = regDoc.exists() ? (regDoc.data()?.teamId || null) : null;
      const teamEventId = regDoc.exists() ? (regDoc.data()?.teamEventId || null) : null;
      setPaymentStatus(regDoc.exists() ? (regDoc.data()?.paymentStatus || null) : null);

      // Fetch team data — try registration.teamId first (post-payment/verification),
      // then query teams for a pending team led by this user
      let resolvedTeamData: Record<string, unknown> | null = null;
      let resolvedTeamEventId: string | null = teamEventId;

      let resolvedTeamId = teamId;
      if (!resolvedTeamId) {
        const leaderTeamSnap = await getDocs(
          query(
            collection(db, "teams"),
            where("leaderUSN", "==", session.usn),
            where("status", "in", ["pending", "verified"]),
            limit(1)
          )
        );
        if (!leaderTeamSnap.empty) {
          resolvedTeamId = leaderTeamSnap.docs[0].id;
        }
      }
      if (resolvedTeamId) {
        const teamDoc = await getDoc(doc(db, "teams", resolvedTeamId));
        if (teamDoc.exists()) {
          resolvedTeamData = teamDoc.data() as Record<string, unknown>;
          resolvedTeamEventId = resolvedTeamEventId || (resolvedTeamData.eventId as string) || null;
        }
      }
      setTeamData(resolvedTeamData);

      if (eventId) {
        const eventDoc = await getDoc(doc(db, "events", eventId));
        if (eventDoc.exists()) {
          const d = eventDoc.data();
          setCurrentEvent({
            eventId: eventDoc.id,
            name: d.name,
            description: d.description,
            capacity: d.capacity,
            dateTime: d.dateTime,
            price: d.price ?? 0,
            registrationCount: d.registrationCount || 0,
            isActive: d.isActive,
            eventType: d.eventType || "individual",
            teamSize: d.teamSize || null,
            createdAt: d.createdAt?.toDate() || null,
            updatedAt: d.updatedAt?.toDate() || null,
          });
        }
      } else {
        setCurrentEvent(null);
      }

      if (resolvedTeamEventId) {
        const teamEventDoc = await getDoc(doc(db, "events", resolvedTeamEventId));
        if (teamEventDoc.exists()) {
          const td = teamEventDoc.data();
          setTeamEvent({
            eventId: teamEventDoc.id,
            name: td.name,
            description: td.description,
            capacity: td.capacity,
            dateTime: td.dateTime,
            price: td.price ?? 0,
            registrationCount: td.registrationCount || 0,
            isActive: td.isActive,
            eventType: "team",
            teamSize: td.teamSize || null,
            createdAt: td.createdAt?.toDate() || null,
            updatedAt: td.updatedAt?.toDate() || null,
          });
        }
      } else {
        setTeamEvent(null);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [session.usn]);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      const allEvents: ProgrammeEvent[] = data.events || [];
      setEvents(allEvents.filter((e) => e.eventType !== "team"));
      setTeamEvents(allEvents.filter((e) => e.eventType === "team"));
    } catch {
      setEvents([]);
      setTeamEvents([]);
    }
  }, []);

  useEffect(() => {
    initializeAuth().then(() => fetchData());
  }, [fetchData]);

  const loadRazorpayScript = (): Promise<void> =>
    new Promise((resolve, reject) => {
      if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).Razorpay) {
        resolve();
        return;
      }
      const existing = document.getElementById("razorpay-checkout-js");
      if (!existing) {
        const script = document.createElement("script");
        script.id = "razorpay-checkout-js";
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        document.body.appendChild(script);
      }
      let tries = 0;
      const check = setInterval(() => {
        if ((window as unknown as Record<string, unknown>).Razorpay) {
          clearInterval(check);
          resolve();
        } else if (++tries > 80) {
          clearInterval(check);
          reject(new Error("Payment gateway unavailable. Check your internet connection."));
        }
      }, 100);
    });

  const handleSelectEvent = async (eventId: string) => {
    setSelecting(true);
    setSelectError("");
    try {
      const orderRes = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || "Failed to initiate");

      if (orderData.free) {
        const res = await fetch("/api/registration/select-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to select event");

        const existing = getSession();
        if (existing) {
          const updated = { ...existing, eventId };
          localStorage.setItem("idealab_session", JSON.stringify(updated));
        }
        setShowEventPicker(false);
        await fetchData();
        return;
      }

      await loadRazorpayScript();
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
                  eventId,
                }),
              });
              const verifyData = await verifyRes.json();
              if (!verifyRes.ok) throw new Error(verifyData.error || "Payment verification failed");

              const existing = getSession();
              if (existing) {
                localStorage.setItem("idealab_session", JSON.stringify({ ...existing, eventId }));
              }
              setShowEventPicker(false);
              await fetchData();
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          prefill: { name: session.name || "" },
          theme: { color: "#E8341A" },
          modal: {
            ondismiss: () => reject(new Error("Payment cancelled")),
          },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to select event";
      if (msg !== "Payment cancelled") setSelectError(msg);
    } finally {
      setSelecting(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    clearSession();
    router.push("/");
  };

  const handleCreateTeam = async (teamName: string, memberUSNs: string[]) => {
    setTeamError("");
    const res = await fetch("/api/registration/create-team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: showTeamPicker, teamName, memberUSNs }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to create team");
    setShowTeamPicker(null);
    await fetchData();
  };

  const handleVerifyMemberOtp = async (memberUSN: string) => {
    const otp = teamOtpInputs[memberUSN];
    if (!otp || otp.length !== 6) return;
    setVerifyingMember(memberUSN);
    setTeamError("");
    setTeamSuccess("");
    try {
      const res = await fetch("/api/registration/verify-team-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp, teamId: teamData?.teamId, memberUSN }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setTeamOtpInputs((prev) => ({ ...prev, [memberUSN]: "" }));
      setTeamSuccess(data.message || "OTP verified!");
      await fetchData();
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifyingMember(null);
    }
  };

  const handleResendOtp = async (memberUSN: string) => {
    setResendingOtp(memberUSN);
    setTeamError("");
    try {
      const res = await fetch("/api/registration/resend-team-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: teamData?.teamId, memberUSN }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend OTP");
      setTeamSuccess(`OTP resent to ${memberUSN}`);
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : "Failed to resend OTP");
    } finally {
      setResendingOtp(null);
    }
  };

  const handleTeamPayment = async () => {
    if (!teamData) return;
    setCreatingTeamOrder(true);
    setTeamError("");
    setTeamSuccess("");
    try {
      const orderRes = await fetch("/api/payment/create-team-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: teamData.teamId }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || "Failed to create order");

      if (orderData.free) {
        const existing = getSession();
        if (existing) {
          setSession({ ...existing, teamId: teamData.teamId as string, teamEventId: teamData.eventId as string });
        }
        await fetchData();
        setTeamSuccess("Team registered for free event!");
        return;
      }

      await loadRazorpayScript();
      await new Promise<void>((resolve, reject) => {
        const options = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency,
          name: "DBIT Chemistry Dept",
          description: `Team Registration: ${orderData.eventName} (${orderData.memberCount} members)`,
          order_id: orderData.orderId,
          handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            try {
              const verifyRes = await fetch("/api/payment/verify-team-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  teamId: teamData.teamId,
                }),
              });
              const verifyData = await verifyRes.json();
              if (!verifyRes.ok) throw new Error(verifyData.error || "Payment verification failed");
              const existing = getSession();
              if (existing) {
                setSession({ ...existing, teamId: teamData.teamId as string, teamEventId: teamData.eventId as string });
              }
              await fetchData();
              setTeamSuccess("Team payment verified! Your team is registered.");
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          prefill: { name: session.name || "" },
          theme: { color: "#E8341A" },
          modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new (window as any).Razorpay(options).open();
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment failed";
      if (msg !== "Payment cancelled") setTeamError(msg);
    } finally {
      setCreatingTeamOrder(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="spinner" style={{ width: 36, height: 36 }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontFamily: "var(--bebas)", fontSize: "clamp(32px, 6vw, 48px)", letterSpacing: "0.02em", lineHeight: 1, marginBottom: "4px" }}>
            DASHBOARD
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "13px" }}>Your registration overview</p>
        </div>
        <button
          onClick={handleLogout}
          style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "1.5px solid var(--line)", padding: "8px 16px", cursor: "pointer", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", fontFamily: "var(--body)" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--red)"; e.currentTarget.style.color = "var(--red)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.color = "var(--muted)"; }}
        >
          <LogOut style={{ width: 14, height: 14 }} /> Sign Out
        </button>
      </div>

      {/* Profile Card */}
      <div className="glass-card" style={{ padding: "20px 24px", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ width: 48, height: 48, background: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontFamily: "var(--bebas)", fontSize: "20px", color: "var(--paper)", letterSpacing: "0.04em" }}>
              {session.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontFamily: "var(--bebas)", fontSize: "22px", letterSpacing: "0.04em", lineHeight: 1, marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.name}</h2>
            <p style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--muted)", marginBottom: "2px" }}>{session.usn}</p>
            <p style={{ fontSize: "12px", color: "var(--muted)" }}>{session.branch} &middot; Section {session.section}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 10px", background: "rgba(16,185,129,0.1)", border: "1.5px solid #10b981" }}>
            <CheckCircle2 style={{ width: 12, height: 12, color: "#10b981" }} />
            <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#10b981" }}>Registered</span>
          </div>
        </div>
      </div>

      {/* Individual Event Card */}
      <div className="glass-card" style={{ padding: "24px", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <Tag style={{ width: 18, height: 18, color: "var(--red)" }} />
          <h3 style={{ fontFamily: "var(--bebas)", fontSize: "20px", letterSpacing: "0.06em" }}>INDIVIDUAL EVENT</h3>
          <span style={{ marginLeft: "auto", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)", padding: "2px 8px", border: "1px solid var(--line)" }}>
            {currentEvent ? "1 / 1" : "0 / 1"}
          </span>
        </div>

        {currentEvent ? (
          <div>
            <div style={{ padding: "16px 20px", border: "1.5px solid var(--ink)", background: "var(--paper2)", marginBottom: "12px" }}>
              <h4 style={{ fontFamily: "var(--bebas)", fontSize: "24px", letterSpacing: "0.04em", marginBottom: "8px", color: "var(--ink)" }}>{currentEvent.name}</h4>
              {currentEvent.description && (
                <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.7, marginBottom: "12px" }}>{currentEvent.description}</p>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Clock style={{ width: 13, height: 13, color: "var(--muted)" }} />
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)" }}>{formatDateTime(currentEvent.dateTime)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Users style={{ width: 13, height: 13, color: "var(--muted)" }} />
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)" }}>{currentEvent.registrationCount} / {currentEvent.capacity} registered</span>
                </div>
              </div>
            </div>

            {registrationOpen && (
              paymentStatus === "paid" ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 14px", background: "rgba(16,185,129,0.08)", border: "1.5px solid #10b981", fontSize: "11px", fontWeight: 700, color: "#10b981" }}>
                  <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0 }} /> PAID &amp; LOCKED &mdash; Contact admin to change
                </div>
              ) : (
                <button
                  onClick={async () => { setShowEventPicker(!showEventPicker); if (!showEventPicker) await fetchEvents(); }}
                  className="btn-secondary"
                  style={{ fontSize: "11px", padding: "10px 20px", display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <ChevronRight style={{ width: 14, height: 14 }} /> Change Event
                </button>
              )
            )}
          </div>
        ) : (
          <div>
            <div style={{ padding: "24px", border: "1.5px dashed var(--line)", textAlign: "center", marginBottom: "12px" }}>
              <CalendarDays style={{ width: 32, height: 32, color: "var(--muted)", margin: "0 auto 12px" }} />
              <p style={{ fontWeight: 700, color: "var(--ink)", marginBottom: "4px" }}>No Event Selected</p>
              <p style={{ fontSize: "13px", color: "var(--muted)" }}>
                {registrationOpen ? "Choose an individual event to participate in." : "Registration is closed. Contact admin."}
              </p>
            </div>
            {registrationOpen && (
              <button
                onClick={async () => { setShowEventPicker(!showEventPicker); if (!showEventPicker) await fetchEvents(); }}
                className="btn-primary"
                style={{ fontSize: "12px", padding: "12px 24px", display: "flex", alignItems: "center", gap: "8px" }}
              >
                <CalendarDays style={{ width: 16, height: 16 }} /> Select an Event
              </button>
            )}
          </div>
        )}
      </div>

      {/* ───── TEAM EVENT SECTION ───── */}
      <div className="glass-card" style={{ padding: "24px", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <Users style={{ width: 18, height: 18, color: "var(--red)" }} />
          <h3 style={{ fontFamily: "var(--bebas)", fontSize: "20px", letterSpacing: "0.06em" }}>TEAM EVENT</h3>
          <span style={{ marginLeft: "auto", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)", padding: "2px 8px", border: "1px solid var(--line)" }}>
            {teamData ? "1 / 1" : "0 / 1"}
          </span>
        </div>

        {teamError && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", background: "rgba(232,52,26,0.08)", border: "1.5px solid var(--red)", color: "var(--red)", fontSize: "12px", fontWeight: 600, marginBottom: "16px" }}>
            <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} /> {teamError}
          </div>
        )}
        {teamSuccess && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", background: "rgba(16,185,129,0.08)", border: "1.5px solid #10b981", color: "#10b981", fontSize: "12px", fontWeight: 600, marginBottom: "16px" }}>
            <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0 }} /> {teamSuccess}
          </div>
        )}

        {teamData ? (
          <div>
            {/* Team + Event header */}
            {teamEvent && (
              <div style={{ padding: "16px 20px", border: "1.5px solid var(--ink)", background: "var(--paper2)", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <h4 style={{ fontFamily: "var(--bebas)", fontSize: "22px", letterSpacing: "0.04em", color: "var(--ink)" }}>{teamEvent.name}</h4>
                  <span style={{
                    fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em",
                    padding: "2px 8px",
                    background: (teamData.status === "paid" || teamData.status === "complete") ? "rgba(16,185,129,0.15)" : "rgba(232,52,26,0.1)",
                    color: (teamData.status === "paid" || teamData.status === "complete") ? "#10b981" : "var(--red)",
                    border: `1px solid ${(teamData.status === "paid" || teamData.status === "complete") ? "#10b981" : "var(--red)"}`,
                  }}>
                    {String(teamData.status).toUpperCase()}
                  </span>
                </div>
                {teamEvent.description && <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.7 }}>{teamEvent.description}</p>}
              </div>
            )}

            {/* Team info */}
            <div style={{ padding: "12px 16px", background: "var(--paper2)", border: "1px solid var(--line)", marginBottom: "16px" }}>
              <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)", marginBottom: "6px" }}>Team Details</p>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>{String(teamData.teamName)}</p>
              <p style={{ fontSize: "11px", color: "var(--muted)" }}>{Number(teamData.memberCount)} members &middot; Leader: {String(teamData.leaderUSN)}</p>
            </div>

            {/* OTP verification panel */}
            {(teamData.status === "pending" || teamData.status === "verified") && (
              <div style={{ marginBottom: "16px" }}>
                <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)", marginBottom: "10px" }}>
                  Member Verification
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {(teamData.memberUSNs as string[]).map((usn: string) => {
                    const isVerified = (teamData.otpVerificationStatus as Record<string, boolean>)?.[usn] === true;
                    const isLeader = usn === teamData.leaderUSN;
                    const isCurrentUser = usn === session.usn;
                    const canVerify = teamData.leaderUSN === session.usn || isCurrentUser;

                    return (
                      <div key={usn} style={{ padding: "12px 16px", border: `1.5px solid ${isVerified ? "#10b981" : "var(--line)"}`, background: isVerified ? "rgba(16,185,129,0.04)" : "transparent" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: isVerified ? "#10b981" : "var(--muted)", flexShrink: 0 }} />
                            <div>
                              <span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{usn}</span>
                              {isLeader && <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginLeft: "8px", padding: "1px 6px", background: "var(--ink)", color: "var(--paper)" }}>LEADER</span>}
                              {isCurrentUser && !isLeader && <span style={{ fontSize: "9px", color: "var(--muted)", marginLeft: "6px" }}>(you)</span>}
                            </div>
                          </div>
                          {isVerified ? (
                            <CheckCircle2 style={{ width: 16, height: 16, color: "#10b981", flexShrink: 0 }} />
                          ) : canVerify ? (
                            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="\d{6}"
                                maxLength={6}
                                value={teamOtpInputs[usn] || ""}
                                onChange={(e) => setTeamOtpInputs((prev) => ({ ...prev, [usn]: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                                placeholder="6-digit OTP"
                                style={{ width: "100px", padding: "6px 10px", background: "var(--paper2)", border: "1.5px solid var(--line)", color: "var(--ink)", fontSize: "13px", fontFamily: "monospace", outline: "none" }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--ink)"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--line)"; }}
                              />
                              <button
                                onClick={() => handleVerifyMemberOtp(usn)}
                                disabled={verifyingMember === usn || (teamOtpInputs[usn] || "").length !== 6}
                                className="btn-primary"
                                style={{ padding: "6px 12px", fontSize: "10px", opacity: (teamOtpInputs[usn] || "").length === 6 ? 1 : 0.6 }}
                              >
                                {verifyingMember === usn ? <div className="spinner" style={{ width: 12, height: 12 }} /> : "Verify"}
                              </button>
                              {teamData.leaderUSN === session.usn && (
                                <button
                                  onClick={() => handleResendOtp(usn)}
                                  disabled={resendingOtp === usn}
                                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "10px", color: "var(--muted)", textDecoration: "underline", textUnderlineOffset: "2px" }}
                                >
                                  {resendingOtp === usn ? "Sending\u2026" : "Resend"}
                                </button>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: "10px", color: "var(--muted)" }}>Pending</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {teamData.status === "verified" && teamData.leaderUSN === session.usn && (
                  <div style={{ marginTop: "16px" }}>
                    <p style={{ fontSize: "12px", color: "#10b981", marginBottom: "10px", fontWeight: 600 }}>
                      ✓ All members verified! Complete your team registration by paying.
                    </p>
                    <button
                      onClick={handleTeamPayment}
                      disabled={creatingTeamOrder}
                      className="btn-primary"
                      style={{ padding: "12px 24px", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}
                    >
                      {creatingTeamOrder ? (
                        <><div className="spinner" style={{ width: 16, height: 16 }} /> Processing&hellip;</>
                      ) : (
                        <><IndianRupee style={{ width: 16, height: 16 }} /> Pay for Team ({teamEvent?.price === 0 ? "FREE" : `\u20b9${(teamEvent?.price || 0) * Number(teamData.memberCount)}`})</>
                      )}
                    </button>
                  </div>
                )}

                {teamData.status === "verified" && teamData.leaderUSN !== session.usn && (
                  <p style={{ marginTop: "12px", fontSize: "12px", color: "var(--muted)" }}>
                    Waiting for team leader to complete payment.
                  </p>
                )}
              </div>
            )}

            {/* Paid/complete status */}
            {(teamData.status === "paid" || teamData.status === "complete") && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", background: "rgba(16,185,129,0.08)", border: "1.5px solid #10b981", fontSize: "11px", fontWeight: 700, color: "#10b981" }}>
                <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0 }} /> TEAM REGISTERED &mdash; All members confirmed
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ padding: "24px", border: "1.5px dashed var(--line)", textAlign: "center", marginBottom: "12px" }}>
              <Users style={{ width: 32, height: 32, color: "var(--muted)", margin: "0 auto 12px" }} />
              <p style={{ fontWeight: 700, color: "var(--ink)", marginBottom: "4px" }}>No Team Event Selected</p>
              <p style={{ fontSize: "13px", color: "var(--muted)" }}>
                {registrationOpen ? "Form a team and register together for a team event." : "Registration is closed. Contact admin."}
              </p>
            </div>
            {registrationOpen && (
              <button
                onClick={async () => {
                  const next = showTeamPicker ? null : "browse";
                  setShowTeamPicker(next);
                  setTeamError("");
                  setTeamSuccess("");
                  if (next) await fetchEvents();
                }}
                className="btn-primary"
                style={{ fontSize: "12px", padding: "12px 24px", display: "flex", alignItems: "center", gap: "8px" }}
              >
                <Users style={{ width: 16, height: 16 }} /> Browse Team Events
              </button>
            )}
          </div>
        )}
      </div>

      {/* Team Event Picker */}
      {showTeamPicker === "browse" && !teamData && (
        <div className="glass-card fade-in-up" style={{ padding: "24px", marginBottom: "20px" }}>
          <h3 style={{ fontFamily: "var(--bebas)", fontSize: "20px", letterSpacing: "0.06em", marginBottom: "16px" }}>
            SELECT A TEAM EVENT
          </h3>
          {teamEvents.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "13px", textAlign: "center", padding: "24px 0" }}>No team events available at this time.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {teamEvents.map((ev) => {
                const isFull = ev.registrationCount >= ev.capacity;
                return (
                  <div
                    key={ev.eventId}
                    style={{ border: "1.5px solid var(--line)", padding: "16px 20px", opacity: isFull ? 0.5 : 1 }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                          <h4 style={{ fontFamily: "var(--bebas)", fontSize: "18px", letterSpacing: "0.04em" }}>{ev.name}</h4>
                          {isFull && <span style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", padding: "2px 8px", background: "var(--muted)", color: "#fff" }}>Full</span>}
                          <span style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", padding: "2px 8px", background: "rgba(232,52,26,0.1)", color: "var(--red)", border: "1px solid var(--red)" }}>
                            {ev.teamSize} members
                          </span>
                        </div>
                        {ev.description && <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.6, marginBottom: "8px" }}>{ev.description}</p>}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                          <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Clock style={{ width: 12, height: 12 }} /> {formatDateTime(ev.dateTime)}
                          </span>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: (ev.price ?? 0) === 0 ? "#16a34a" : "var(--ink)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <IndianRupee style={{ width: 12, height: 12 }} />{(ev.price ?? 0) === 0 ? "Free" : `\u20b9${ev.price} \u00d7 ${ev.teamSize} = \u20b9${(ev.price || 0) * (ev.teamSize || 1)}`}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowTeamPicker(ev.eventId)}
                        disabled={isFull}
                        className="btn-primary"
                        style={{ fontSize: "11px", padding: "8px 16px", flexShrink: 0, opacity: isFull ? 0.5 : 1 }}
                      >
                        Create Team
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <button
            onClick={() => setShowTeamPicker(null)}
            style={{ marginTop: "16px", background: "none", border: "none", fontSize: "12px", color: "var(--muted)", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px" }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Team Registration Form */}
      {showTeamPicker && showTeamPicker !== "browse" && !teamData && (
        <TeamRegistrationForm
          eventId={showTeamPicker}
          eventName={teamEvents.find((e) => e.eventId === showTeamPicker)?.name || ""}
          teamSize={teamEvents.find((e) => e.eventId === showTeamPicker)?.teamSize || 2}
          price={teamEvents.find((e) => e.eventId === showTeamPicker)?.price || 0}
          leaderUSN={session.usn}
          onSubmit={handleCreateTeam}
          onCancel={() => setShowTeamPicker(null)}
        />
      )}

      {/* Event Picker */}
      {showEventPicker && (
        <div className="glass-card fade-in-up" style={{ padding: "24px", marginBottom: "20px" }}>
          <h3 style={{ fontFamily: "var(--bebas)", fontSize: "20px", letterSpacing: "0.06em", marginBottom: "16px" }}>
            {currentEvent ? "CHANGE YOUR EVENT" : "SELECT YOUR EVENT"}
          </h3>

          {selectError && (
            <div style={{ padding: "12px 14px", fontSize: "12px", fontWeight: 600, background: "rgba(232,52,26,0.08)", color: "var(--red)", border: "1.5px solid var(--red)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} /> {selectError}
            </div>
          )}

          {events.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "13px", textAlign: "center", padding: "24px 0" }}>No events available at this time.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {events.map((ev) => {
                const isFull = ev.registrationCount >= ev.capacity;
                const isCurrent = currentEvent?.eventId === ev.eventId;
                return (
                  <div
                    key={ev.eventId}
                    style={{
                      border: `1.5px solid ${isCurrent ? "var(--ink)" : "var(--line)"}`,
                      padding: "16px 20px",
                      background: isCurrent ? "var(--paper2)" : "transparent",
                      opacity: isFull && !isCurrent ? 0.5 : 1,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                          <h4 style={{ fontFamily: "var(--bebas)", fontSize: "18px", letterSpacing: "0.04em" }}>{ev.name}</h4>
                          {isCurrent && <span style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", padding: "2px 8px", background: "var(--ink)", color: "var(--paper)" }}>Current</span>}
                          {isFull && !isCurrent && <span style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", padding: "2px 8px", background: "var(--muted)", color: "#fff" }}>Full</span>}
                        </div>
                        {ev.description && <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.6, marginBottom: "8px" }}>{ev.description}</p>}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                          <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}><Clock style={{ width: 12, height: 12 }} /> {formatDateTime(ev.dateTime)}</span>
                          <span style={{ fontSize: "11px", color: isFull ? "var(--red)" : "var(--muted)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Users style={{ width: 12, height: 12 }} /> {ev.registrationCount}/{ev.capacity} {isFull ? "(Full)" : "spots"}
                          </span>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: (ev.price ?? 0) === 0 ? "#16a34a" : "#2563eb", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <IndianRupee style={{ width: 12, height: 12 }} />{(ev.price ?? 0) === 0 ? "Free" : ev.price}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSelectEvent(ev.eventId)}
                        disabled={selecting || isCurrent || isFull}
                        className={isCurrent ? "btn-secondary" : "btn-primary"}
                        style={{ fontSize: "11px", padding: "8px 16px", flexShrink: 0, opacity: (isCurrent || isFull) ? 0.5 : 1 }}
                      >
                        {selecting ? <div className="spinner" style={{ width: 14, height: 14 }} /> : isCurrent ? "Selected" : "Select"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={() => setShowEventPicker(false)}
            style={{ marginTop: "16px", background: "none", border: "none", fontSize: "12px", color: "var(--muted)", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px" }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Registration closed banner */}
      {!registrationOpen && (
        <div className="glass-card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
          <AlertCircle style={{ width: 18, height: 18, color: "var(--muted)", flexShrink: 0 }} />
          <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.6 }}>
            <strong style={{ color: "var(--ink)" }}>Registrations are closed.</strong> You can no longer change your event selection.
          </p>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--paper)", color: "var(--ink)" }}>
      <Navbar />
      <div style={{ paddingTop: 60 }}>
        <SessionGuard>
          {(session) => <DashboardContent session={session} />}
        </SessionGuard>
      </div>
    </main>
  );
}
