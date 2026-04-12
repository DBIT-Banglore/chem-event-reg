"use client";

import { useState, useEffect, useCallback } from "react";
import { doc, getDoc, collection, getDocs, limit, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getSession, clearSession, initializeAuth } from "@/lib/session";
import { SessionData, ProgrammeEvent } from "@/lib/types";
import Navbar from "@/components/Navbar";
import SessionGuard from "@/components/SessionGuard";
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
  const [currentEvent2, setCurrentEvent2] = useState<ProgrammeEvent | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [paymentStatus2, setPaymentStatus2] = useState<string | null>(null);
  const [showEvent2Picker, setShowEvent2Picker] = useState(false);
  const [events, setEvents] = useState<ProgrammeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectError, setSelectError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const configSnap = await getDocs(query(collection(db, "config"), limit(1)));
      if (!configSnap.empty) {
        setRegistrationOpen(configSnap.docs[0].data().registrationsOpen ?? true);
      }

      const regDoc = await getDoc(doc(db, "registrations", session.usn));
      const eventId = regDoc.exists() ? (regDoc.data()?.eventId || null) : null;
      const eventId2 = regDoc.exists() ? (regDoc.data()?.eventId2 || null) : null;
      setPaymentStatus(regDoc.exists() ? (regDoc.data()?.paymentStatus || null) : null);
      setPaymentStatus2(regDoc.exists() ? (regDoc.data()?.paymentStatus2 || null) : null);

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
            createdAt: d.createdAt?.toDate() || null,
            updatedAt: d.updatedAt?.toDate() || null,
          });
        }
      } else {
        setCurrentEvent(null);
      }

      if (eventId2) {
        const eventDoc2 = await getDoc(doc(db, "events", eventId2));
        if (eventDoc2.exists()) {
          const d = eventDoc2.data();
          setCurrentEvent2({
            eventId: eventDoc2.id,
            name: d.name,
            description: d.description,
            capacity: d.capacity,
            dateTime: d.dateTime,
            price: d.price ?? 0,
            registrationCount: d.registrationCount || 0,
            isActive: d.isActive,
            createdAt: d.createdAt?.toDate() || null,
            updatedAt: d.updatedAt?.toDate() || null,
          });
        }
      } else {
        setCurrentEvent2(null);
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
      setEvents(data.events || []);
    } catch {
      setEvents([]);
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
      // Inject script dynamically if not already loaded
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

  const handleSelectEvent = async (eventId: string, slot: 1 | 2 = 1) => {
    setSelecting(true);
    setSelectError("");
    try {
      // Ask server for order info (or free confirmation)
      const orderRes = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, slot }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || "Failed to initiate");

      if (orderData.free) {
        // Free event — confirm slot directly
        const res = await fetch("/api/registration/select-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId, slot }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to select event");

        const existing = getSession();
        if (existing) {
          const updated = slot === 2 ? { ...existing, eventId2: eventId } : { ...existing, eventId };
          localStorage.setItem("idealab_session", JSON.stringify(updated));
        }
        setShowEventPicker(false);
        setShowEvent2Picker(false);
        await fetchData();
        return;
      }

      // Paid event — open Razorpay checkout
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
                  slot,
                }),
              });
              const verifyData = await verifyRes.json();
              if (!verifyRes.ok) throw new Error(verifyData.error || "Payment verification failed");

              const existing = getSession();
              if (existing) {
                const updated = slot === 2 ? { ...existing, eventId2: eventId } : { ...existing, eventId };
                localStorage.setItem("idealab_session", JSON.stringify(updated));
              }
              setShowEventPicker(false);
              setShowEvent2Picker(false);
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
            <p style={{ fontSize: "12px", color: "var(--muted)" }}>{session.branch} · Section {session.section}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 10px", background: "rgba(16,185,129,0.1)", border: "1.5px solid #10b981" }}>
            <CheckCircle2 style={{ width: 12, height: 12, color: "#10b981" }} />
            <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#10b981" }}>Registered</span>
          </div>
        </div>
      </div>

      {/* Event Cards */}
      <div className="glass-card" style={{ padding: "24px", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <Tag style={{ width: 18, height: 18, color: "var(--red)" }} />
          <h3 style={{ fontFamily: "var(--bebas)", fontSize: "20px", letterSpacing: "0.06em" }}>YOUR EVENTS</h3>
          <span style={{ marginLeft: "auto", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)", padding: "2px 8px", border: "1px solid var(--line)" }}>
            {[currentEvent, currentEvent2].filter(Boolean).length} / 2
          </span>
        </div>

        {/* Event 1 */}
        <div style={{ marginBottom: "20px" }}>
          <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)", marginBottom: "10px" }}>Event 1</p>
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
                    <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0 }} /> PAID &amp; LOCKED — Contact admin to change
                  </div>
                ) : (
                  <button
                    onClick={async () => { setShowEventPicker(!showEventPicker); setShowEvent2Picker(false); if (!showEventPicker) await fetchEvents(); }}
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
                  {registrationOpen ? "Choose an event to participate in." : "Registration is closed. Contact admin."}
                </p>
              </div>
              {registrationOpen && (
                <button
                  onClick={async () => { setShowEventPicker(!showEventPicker); setShowEvent2Picker(false); if (!showEventPicker) await fetchEvents(); }}
                  className="btn-primary"
                  style={{ fontSize: "12px", padding: "12px 24px", display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <CalendarDays style={{ width: 16, height: 16 }} /> Select an Event
                </button>
              )}
            </div>
          )}
        </div>

        {/* Event 2 */}
        {currentEvent && (
          <div style={{ borderTop: "1.5px solid var(--line)", paddingTop: "20px" }}>
            <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)", marginBottom: "10px" }}>Event 2 (Optional)</p>
            {currentEvent2 ? (
              <div>
                <div style={{ padding: "16px 20px", border: "1.5px solid var(--ink)", background: "var(--paper2)", marginBottom: "12px" }}>
                  <h4 style={{ fontFamily: "var(--bebas)", fontSize: "24px", letterSpacing: "0.04em", marginBottom: "8px", color: "var(--ink)" }}>{currentEvent2.name}</h4>
                  {currentEvent2.description && (
                    <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.7, marginBottom: "12px" }}>{currentEvent2.description}</p>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Clock style={{ width: 13, height: 13, color: "var(--muted)" }} />
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)" }}>{formatDateTime(currentEvent2.dateTime)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Users style={{ width: 13, height: 13, color: "var(--muted)" }} />
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)" }}>{currentEvent2.registrationCount} / {currentEvent2.capacity} registered</span>
                    </div>
                  </div>
                </div>
                {registrationOpen && (
                  paymentStatus2 === "paid" ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 14px", background: "rgba(16,185,129,0.08)", border: "1.5px solid #10b981", fontSize: "11px", fontWeight: 700, color: "#10b981" }}>
                      <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0 }} /> PAID &amp; LOCKED — Contact admin to change
                    </div>
                  ) : (
                    <button
                      onClick={async () => { setShowEvent2Picker(!showEvent2Picker); setShowEventPicker(false); if (!showEvent2Picker) await fetchEvents(); }}
                      className="btn-secondary"
                      style={{ fontSize: "11px", padding: "10px 20px", display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      <ChevronRight style={{ width: 14, height: 14 }} /> Change 2nd Event
                    </button>
                  )
                )}
              </div>
            ) : (
              <div>
                <div style={{ padding: "20px", border: "1.5px dashed var(--line)", textAlign: "center", marginBottom: "12px" }}>
                  <CalendarDays style={{ width: 28, height: 28, color: "var(--muted)", margin: "0 auto 10px" }} />
                  <p style={{ fontWeight: 700, color: "var(--ink)", marginBottom: "4px", fontSize: "14px" }}>Optional Second Event</p>
                  <p style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {registrationOpen ? "You may participate in one additional event." : "Registration is closed."}
                  </p>
                </div>
                {registrationOpen && (
                  <button
                    onClick={async () => { setShowEvent2Picker(!showEvent2Picker); setShowEventPicker(false); if (!showEvent2Picker) await fetchEvents(); }}
                    className="btn-secondary"
                    style={{ fontSize: "12px", padding: "12px 24px", display: "flex", alignItems: "center", gap: "8px" }}
                  >
                    <CalendarDays style={{ width: 16, height: 16 }} /> Register for Another Event
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Event Picker — Slot 1 */}
      {showEventPicker && (
        <div className="glass-card fade-in-up" style={{ padding: "24px", marginBottom: "20px" }}>
          <h3 style={{ fontFamily: "var(--bebas)", fontSize: "20px", letterSpacing: "0.06em", marginBottom: "16px" }}>
            {currentEvent ? "CHANGE EVENT 1" : "SELECT EVENT 1"}
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
              {events.filter(ev => ev.eventId !== currentEvent2?.eventId).map((ev) => {
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
                        onClick={() => handleSelectEvent(ev.eventId, 1)}
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

      {/* Event Picker — Slot 2 */}
      {showEvent2Picker && (
        <div className="glass-card fade-in-up" style={{ padding: "24px", marginBottom: "20px" }}>
          <h3 style={{ fontFamily: "var(--bebas)", fontSize: "20px", letterSpacing: "0.06em", marginBottom: "16px" }}>
            {currentEvent2 ? "CHANGE SECOND EVENT" : "SELECT ANOTHER EVENT"}
          </h3>

          {selectError && (
            <div style={{ padding: "12px 14px", fontSize: "12px", fontWeight: 600, background: "rgba(232,52,26,0.08)", color: "var(--red)", border: "1.5px solid var(--red)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} /> {selectError}
            </div>
          )}

          {events.filter(ev => ev.eventId !== currentEvent?.eventId).length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "13px", textAlign: "center", padding: "24px 0" }}>No other events available.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {events.filter(ev => ev.eventId !== currentEvent?.eventId).map((ev) => {
                const isFull = ev.registrationCount >= ev.capacity;
                const isCurrent2 = currentEvent2?.eventId === ev.eventId;
                return (
                  <div
                    key={ev.eventId}
                    style={{
                      border: `1.5px solid ${isCurrent2 ? "var(--ink)" : "var(--line)"}`,
                      padding: "16px 20px",
                      background: isCurrent2 ? "var(--paper2)" : "transparent",
                      opacity: isFull && !isCurrent2 ? 0.5 : 1,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                          <h4 style={{ fontFamily: "var(--bebas)", fontSize: "18px", letterSpacing: "0.04em" }}>{ev.name}</h4>
                          {isCurrent2 && <span style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", padding: "2px 8px", background: "var(--ink)", color: "var(--paper)" }}>Current</span>}
                          {isFull && !isCurrent2 && <span style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", padding: "2px 8px", background: "var(--muted)", color: "#fff" }}>Full</span>}
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
                        onClick={() => handleSelectEvent(ev.eventId, 2)}
                        disabled={selecting || isCurrent2 || isFull}
                        className={isCurrent2 ? "btn-secondary" : "btn-primary"}
                        style={{ fontSize: "11px", padding: "8px 16px", flexShrink: 0, opacity: (isCurrent2 || isFull) ? 0.5 : 1 }}
                      >
                        {selecting ? <div className="spinner" style={{ width: 14, height: 14 }} /> : isCurrent2 ? "Selected" : "Select"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={() => setShowEvent2Picker(false)}
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
