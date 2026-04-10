"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { validateUSN } from "@/lib/usnValidator";
import { Search, CalendarDays, CheckCircle2, User } from "lucide-react";

export default function StatusLookup() {
    const [usn, setUSN] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [studentData, setStudentData] = useState<{
        name: string;
        usn: string;
        branch: string;
        section: string;
        email: string;
        eventId: string | null;
    } | null>(null);
    const [eventName, setEventName] = useState<string | null>(null);

    const handleLookup = async () => {
        const upperUSN = usn.trim().toUpperCase();
        const validation = validateUSN(upperUSN);
        if (!validation.valid) {
            setError("Invalid USN format.");
            return;
        }

        setIsLoading(true);
        setError("");
        setStudentData(null);
        setEventName(null);

        try {
            const regDoc = await getDoc(doc(db, "registrations", upperUSN));
            if (!regDoc.exists()) {
                setError("No registration found for this USN.");
                return;
            }
            const d = regDoc.data();
            const data = {
                name: d.name,
                usn: d.usn,
                branch: d.branch,
                section: d.section,
                email: d.email || "",
                eventId: d.eventId || null,
            };
            setStudentData(data);

            if (data.eventId) {
                const evDoc = await getDoc(doc(db, "events", data.eventId));
                if (evDoc.exists()) {
                    setEventName(evDoc.data().name);
                }
            }
        } catch (err) {
            setError("Failed to fetch data. Please try again.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
                <input
                    type="text"
                    value={usn}
                    onChange={(e) => setUSN(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                    placeholder="1DB25CS001"
                    className="input-field"
                    maxLength={10}
                    style={{ flex: 1, fontFamily: "monospace", fontSize: "16px", letterSpacing: "0.08em" }}
                />
                <button onClick={handleLookup} disabled={isLoading} className="btn-primary" style={{ padding: "12px 20px" }}>
                    {isLoading ? <div className="spinner" /> : <Search style={{ width: 18, height: 18 }} />}
                </button>
            </div>

            {error && (
                <div style={{ padding: "12px 14px", background: "rgba(232,52,26,0.08)", border: "1.5px solid var(--red)", color: "var(--red)", fontSize: "12px", fontWeight: 600 }}>
                    {error}
                </div>
            )}

            {studentData && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {/* Profile */}
                    <div style={{ padding: "16px 20px", border: "1.5px solid var(--ink)", background: "var(--paper2)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <User style={{ width: 20, height: 20, color: "var(--red)", flexShrink: 0 }} />
                            <div>
                                <h3 style={{ fontFamily: "var(--bebas)", fontSize: "20px", letterSpacing: "0.04em", lineHeight: 1 }}>{studentData.name}</h3>
                                <p style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>{studentData.usn}</p>
                                <p style={{ fontSize: "12px", color: "var(--muted)" }}>{studentData.branch} · Section {studentData.section}</p>
                            </div>
                            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px", padding: "4px 10px", background: "rgba(16,185,129,0.1)", border: "1.5px solid #10b981" }}>
                                <CheckCircle2 style={{ width: 12, height: 12, color: "#10b981" }} />
                                <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#10b981" }}>Registered</span>
                            </div>
                        </div>
                    </div>

                    {/* Event */}
                    <div style={{ padding: "16px 20px", border: "1.5px solid var(--line)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                            <CalendarDays style={{ width: 16, height: 16, color: "var(--red)" }} />
                            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em" }}>Event</span>
                        </div>
                        {studentData.eventId ? (
                            <div>
                                <p style={{ fontWeight: 700, fontSize: "15px", color: "var(--ink)", marginBottom: "4px" }}>{eventName || studentData.eventId}</p>
                                <p style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--muted)" }}>{studentData.eventId}</p>
                            </div>
                        ) : (
                            <p style={{ fontSize: "13px", color: "var(--muted)" }}>No event selected yet.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
