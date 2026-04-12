"use client";

import { useState } from "react";
import { Search, CalendarDays, CheckCircle2, User } from "lucide-react";

const USN_FORMAT = /^1DB2[0-9](CS|IC|CI|AD|IS|EC|EE)\d{3}$/i;

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
    } | null>(null);
    const [eventId, setEventId] = useState<string | null>(null);
    const [eventName, setEventName] = useState<string | null>(null);
    const [eventId2, setEventId2] = useState<string | null>(null);
    const [eventName2, setEventName2] = useState<string | null>(null);

    const handleLookup = async () => {
        const upperUSN = usn.trim().toUpperCase();
        if (!USN_FORMAT.test(upperUSN)) {
            setError("Invalid USN format. Expected format: 1DB25CS001");
            return;
        }

        setIsLoading(true);
        setError("");
        setStudentData(null);
        setEventId(null);
        setEventName(null);
        setEventId2(null);
        setEventName2(null);

        try {
            const res = await fetch("/api/auth/lookup-usn", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ usn: upperUSN }),
            });

            const json = await res.json();

            if (!res.ok || !json.found) {
                setError(json.error || "No registration found for this USN.");
                return;
            }

            if (!json.returning) {
                setError("No registration found for this USN.");
                return;
            }

            setStudentData({
                name: json.student.name,
                usn: json.student.usn || upperUSN,
                branch: json.student.branch,
                section: json.student.section,
                email: json.student.email || "",
            });
            setEventId(json.eventId || null);
            setEventName(json.eventName || null);
            setEventId2(json.eventId2 || null);
            setEventName2(json.eventName2 || null);
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

                    {/* Events */}
                    <div style={{ padding: "16px 20px", border: "1.5px solid var(--line)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                            <CalendarDays style={{ width: 16, height: 16, color: "var(--red)" }} />
                            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                                {eventId2 ? "Events (2)" : "Event"}
                            </span>
                        </div>
                        {eventId ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <div>
                                    <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)", marginBottom: "2px" }}>Event 1</p>
                                    <p style={{ fontWeight: 700, fontSize: "15px", color: "var(--ink)", marginBottom: "2px" }}>{eventName || eventId}</p>
                                    <p style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--muted)" }}>{eventId}</p>
                                </div>
                                {eventId2 && (
                                    <div style={{ borderTop: "1px solid var(--line)", paddingTop: "10px" }}>
                                        <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)", marginBottom: "2px" }}>Event 2</p>
                                        <p style={{ fontWeight: 700, fontSize: "15px", color: "var(--ink)", marginBottom: "2px" }}>{eventName2 || eventId2}</p>
                                        <p style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--muted)" }}>{eventId2}</p>
                                    </div>
                                )}
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
