"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { db, auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import StudentTable from "@/components/StudentTable";
import CSVUploader from "@/components/CSVUploader";
import CSVStudentTable, { CSVStudent } from "@/components/CSVStudentTable";
import { LayoutDashboard, Users, Settings, LogOut, Lightbulb, AlertTriangle, AlertCircle, ShieldAlert, Eraser, Database, Download, FileSpreadsheet, CalendarDays, Plus } from "lucide-react";

interface Student {
    name: string;
    usn: string;
    phone: string;
    email: string;
    branch: string;
    section: string;
    eventId: string | null;
}

type TabType = "dashboard" | "students" | "registrations" | "events" | "settings";

export default function AdminPage() {
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loginError, setLoginError] = useState("");
    const [loginLoading, setLoginLoading] = useState(false);

    const [activeTab, setActiveTab] = useState<TabType>("dashboard");
    const [students, setStudents] = useState<Student[]>([]);
    const [dataLoading, setDataLoading] = useState(false);

    // Reset Database States
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetPhrase, setResetPhrase] = useState("");
    const [resetLoading, setResetLoading] = useState(false);
    const [resetError, setResetError] = useState("");
    const [clearOtpCodes, setClearOtpCodes] = useState(true);
    const [clearCSV, setClearCSV] = useState(false);
    const [clearEvents, setClearEvents] = useState(false);

    // Settings States
    const [registrationsOpen, setRegistrationsOpen] = useState(true);
    const [configLoading, setConfigLoading] = useState(false);

    // New stats
    const [csvStudents, setCsvStudents] = useState<CSVStudent[]>([]);
    const [csvStudentCount, setCsvStudentCount] = useState(0);

    // Event state
    const [events, setEvents] = useState<Array<{eventId: string; name: string; description: string; capacity: number; dateTime: string; price: number; registrationCount: number; isActive: boolean}>>([]);
    const [eventsLoading, setEventsLoading] = useState(false);
    const [showEventForm, setShowEventForm] = useState(false);
    const [editingEvent, setEditingEvent] = useState<string | null>(null);
    const [eventForm, setEventForm] = useState({ name: "", description: "", capacity: "", dateTime: "", price: "0", isActive: true });
    const [eventFormError, setEventFormError] = useState("");
    const [eventFormLoading, setEventFormLoading] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const fetchConfig = useCallback(async () => {
        try {
            const docSnap = await getDocs(query(collection(db, "config")));
            if (!docSnap.empty) {
                const data = docSnap.docs[0].data();
                setRegistrationsOpen(data.registrationsOpen ?? true);
            }
        } catch (error) {
            console.error("Error fetching config:", error);
        }
    }, []);

    const fetchEvents = useCallback(async () => {
        setEventsLoading(true);
        try {
            const res = await fetch("/api/admin/events");
            const data = await res.json();
            setEvents(data.events || []);
        } catch {
            console.error("Error fetching events");
        } finally {
            setEventsLoading(false);
        }
    }, []);

    const fetchStudents = useCallback(async () => {
        setDataLoading(true);
        try {
            // Fetch CSV students
            const studentsSnap = await getDocs(collection(db, "students"));
            setCsvStudentCount(studentsSnap.size);
            const csvData: CSVStudent[] = [];
            studentsSnap.forEach((d) => {
                const data = d.data();
                csvData.push({
                    usn: data.usn || d.id,
                    name: data.name || "",
                    email: data.email || "",
                    phone: data.phone || "",
                    branch: data.branch || "",
                    section: data.section || "",
                });
            });
            setCsvStudents(csvData);

            const q = query(collection(db, "registrations"), orderBy("registeredAt", "desc"));
            const snapshot = await getDocs(q);
            const data: Student[] = [];
            snapshot.forEach((docSnap) => {
                const d = docSnap.data();
                data.push({
                    name: d.name, usn: d.usn, phone: d.phone, email: d.email || "",
                    branch: d.branch, section: d.section,
                    eventId: d.eventId || null,
                });
            });
            setStudents(data);
            await fetchConfig();
            await fetchEvents();
        } catch {
            try {
                const q2 = query(collection(db, "registrations"), orderBy("createdAt", "desc"));
                const snapshot = await getDocs(q2);
                const data: Student[] = [];
                snapshot.forEach((docSnap) => {
                    const d = docSnap.data();
                    data.push({
                        name: d.name, usn: d.usn, phone: d.phone, email: d.email || "",
                        branch: d.branch, section: d.section,
                        eventId: d.eventId || null,
                    });
                });
                setStudents(data);
                await fetchConfig();
                await fetchEvents();
            } catch (error2) {
                console.error("Error fetching data:", error2);
            }
        } finally {
            setDataLoading(false);
        }
    }, [fetchConfig, fetchEvents]);

    useEffect(() => {
        if (user) fetchStudents();
    }, [user, fetchStudents]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginLoading(true);
        setLoginError("");
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch {
            setLoginError("Invalid email or password. Please try again.");
        } finally {
            setLoginLoading(false);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        setStudents([]);
    };

    const handleResetDatabase = async () => {
        const currentUser = auth.currentUser;
        console.log("[reset] clicked, user=", currentUser?.email, "phrase=", JSON.stringify(resetPhrase));
        if (!currentUser || !currentUser.email) {
            setResetError("Not logged in. Please refresh and try again.");
            return;
        }
        if (resetPhrase.trim() !== "RESET DATABASE") {
            setResetError("Please type 'RESET DATABASE' exactly.");
            return;
        }

        setResetLoading(true);
        setResetError("");

        try {
            const idToken = await currentUser.getIdToken(true);

            const res = await fetch("/api/admin/reset-database", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken, clearCSV, clearOtpCodes, clearEvents }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Failed to reset database.");

            setShowResetModal(false);
            setResetPhrase("");
            setClearOtpCodes(true);
            setClearCSV(false);
            setClearEvents(false);
            alert(data.message || "Database has been successfully reset.");
            await Promise.all([fetchStudents(), fetchEvents()]);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Failed to reset database.";
            console.error("[reset] error:", error);
            setResetError(msg);
        } finally {
            setResetLoading(false);
        }
    };

    const toggleRegistrations = async () => {
        setConfigLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) throw new Error("Not authenticated");
            const idToken = await user.getIdToken(true);
            const res = await fetch("/api/admin/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken, updates: { registrationsOpen: !registrationsOpen } }),
            });
            if (!res.ok) throw new Error("Failed to update config");
            setRegistrationsOpen(!registrationsOpen);
        } catch {
            console.error("Error updating config");
        } finally {
            setConfigLoading(false);
        }
    };

    const handleSaveEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        setEventFormError("");
        setEventFormLoading(true);
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error("Not authenticated");
            const idToken = await currentUser.getIdToken(true);

            const body = {
                idToken,
                name: eventForm.name,
                description: eventForm.description,
                capacity: Number(eventForm.capacity),
                dateTime: eventForm.dateTime,
                price: Number(eventForm.price) || 0,
                isActive: eventForm.isActive,
            };

            let res;
            if (editingEvent) {
                res = await fetch("/api/admin/events", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...body, eventId: editingEvent }),
                });
            } else {
                res = await fetch("/api/admin/events", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
            }

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to save event");
            setShowEventForm(false);
            setEditingEvent(null);
            setEventForm({ name: "", description: "", capacity: "", dateTime: "", price: "0", isActive: true });
            await fetchEvents();
        } catch (err) {
            setEventFormError(err instanceof Error ? err.message : "Failed to save event");
        } finally {
            setEventFormLoading(false);
        }
    };

    const handleDeleteEvent = async (eventId: string, eventName: string) => {
        if (!confirm(`Delete event "${eventName}"? This cannot be undone.`)) return;
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error("Not authenticated");
            const idToken = await currentUser.getIdToken(true);
            const res = await fetch("/api/admin/events", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken, eventId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to delete event");
            await fetchEvents();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to delete event");
        }
    };

    const handleToggleEventActive = async (eventId: string, currentIsActive: boolean) => {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error("Not authenticated");
            const idToken = await currentUser.getIdToken(true);
            const res = await fetch("/api/admin/events", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken, eventId, isActive: !currentIsActive }),
            });
            if (!res.ok) throw new Error("Failed to toggle event");
            await fetchEvents();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed");
        }
    };

    const totalRegistrations = students.length;
    const branchStats: Record<string, number> = {};
    students.forEach((s) => { branchStats[s.branch] = (branchStats[s.branch] || 0) + 1; });
    const maxBranchCount = Math.max(...Object.values(branchStats), 1);

    const branchColors: Record<string, string> = {
        CSE: "#7c3aed", IOT: "#06b6d4", "AI&ML": "#f59e0b",
        "AI&DS": "#10b981", ISE: "#ef4444", ECE: "#8b5cf6", EEE: "#ec4899",
    };

    // Enrich students with event names for display and export
    const studentsWithEvents = useMemo(() => {
        const eventMap = new Map(events.map(e => [e.eventId, e.name]));
        return students.map(s => ({
            ...s,
            eventName: s.eventId ? (eventMap.get(s.eventId) ?? null) : null,
        }));
    }, [students, events]);

    // ─── Export Helpers ───
    const handleExportAllXLS = async () => {
        const { exportToXLS } = await import("@/lib/xlsExport");
        const allRows = studentsWithEvents.map(s => ({
            Name: s.name, USN: s.usn, Email: s.email || "", Phone: s.phone,
            Branch: s.branch, Section: s.section,
            "Event Name": s.eventName || "", "Event ID": s.eventId || "",
        }));
        const sheets: Record<string, string | number | null | undefined>[][] = [allRows];
        const sheetNames = ["All Registrations"];
        events.forEach(ev => {
            const eventRows = studentsWithEvents
                .filter(s => s.eventId === ev.eventId)
                .map(s => ({
                    Name: s.name, USN: s.usn, Email: s.email || "", Phone: s.phone,
                    Branch: s.branch, Section: s.section,
                }));
            sheets.push(eventRows);
            sheetNames.push(ev.name.slice(0, 31));
        });
        exportToXLS(sheets, sheetNames, `registrations-${new Date().toISOString().split("T")[0]}.xlsx`);
    };

    const handleExportEventCSV = (eventId: string, eventName: string) => {
        const rows = studentsWithEvents.filter(s => s.eventId === eventId);
        const headers = ["Name", "USN", "Email", "Phone", "Branch", "Section"];
        const csvContent = [
            headers.join(","),
            ...rows.map(s =>
                [s.name, s.usn, s.email || "", s.phone, s.branch, s.section]
                    .map(c => `"${String(c).replace(/"/g, '""')}"`)
                    .join(",")
            ),
        ].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${eventName.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    // ─── Loading ───
    if (authLoading) {
        return (
            <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--paper)" }}>
                <div className="spinner" style={{ width: 40, height: 40 }} />
            </main>
        );
    }

    // ─── Login ───
    if (!user) {
        return (
            <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "var(--paper)" }}>
                <div style={{ width: "100%", maxWidth: "420px" }} className="fade-in-up">
                    <div style={{ textAlign: "center", marginBottom: "40px" }}>
                        <div style={{ width: 72, height: 72, background: "var(--ink)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                            <Lightbulb style={{ width: 36, height: 36, color: "var(--paper)" }} />
                        </div>
                        <h1 style={{ fontFamily: "var(--bebas)", fontSize: "clamp(36px, 6vw, 48px)", letterSpacing: "0.02em", lineHeight: 1, marginBottom: "8px" }}>ADMIN PANEL</h1>
                        <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--muted)" }}>Secure Access Required</p>
                    </div>

                    <form onSubmit={handleLogin} className="glass-card" style={{ padding: "clamp(24px, 4vw, 40px)" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
                            <div>
                                <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)", marginBottom: "8px" }}>Admin Email</label>
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@dbit.in" className="input-field" required />
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)", marginBottom: "8px" }}>Password</label>
                                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="input-field" required />
                            </div>
                        </div>
                        {loginError && (
                            <div style={{ padding: "12px 14px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", background: "rgba(232, 52, 26, 0.08)", color: "var(--red)", border: "1.5px solid var(--red)", marginBottom: "24px" }}>
                                {loginError}
                            </div>
                        )}
                        <button type="submit" disabled={loginLoading} className="btn-primary w-full" style={{ padding: "18px" }}>
                            {loginLoading ? <div className="spinner" /> : "Authorize & Enter"}
                        </button>
                    </form>
                </div>
            </main>
        );
    }

    // ─── Navigation items ───
    const navigationItems = [
        { id: "dashboard", label: "Overview", icon: <LayoutDashboard style={{ width: 22, height: 22 }} /> },
        { id: "students", label: "Students", icon: <Database style={{ width: 22, height: 22 }} /> },
        { id: "registrations", label: "Registrations", icon: <Users style={{ width: 22, height: 22 }} /> },
        { id: "events", label: "Events", icon: <CalendarDays style={{ width: 22, height: 22 }} /> },
        { id: "settings", label: "Settings", icon: <Settings style={{ width: 22, height: 22 }} /> }
    ];

    // ─── Main Panel ───
    return (
        <main className="admin-layout">

            {/* ── Sidebar (desktop + tablet icon-only) ── */}
            <aside className="admin-sidebar">
                <div className="admin-sidebar-header" style={{ padding: "24px", borderBottom: "1.5px solid var(--ink)", background: "var(--paper)", display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Lightbulb style={{ width: 16, height: 16, color: "var(--paper)" }} />
                    </div>
                    <span className="admin-sidebar-logo-text" style={{ fontFamily: "var(--bebas)", fontSize: "20px", letterSpacing: "0.04em" }}>IDEA LAB</span>
                </div>

                <div style={{ padding: "12px 8px", display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
                    {navigationItems.map(item => (
                        <button
                            key={item.id}
                            className="admin-sidebar-nav-btn"
                            onClick={() => setActiveTab(item.id as TabType)}
                            title={item.label}
                            style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: "14px",
                                padding: "12px 16px",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "11px",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.1em",
                                fontFamily: "var(--body)",
                                transition: "all 0.15s",
                                background: activeTab === item.id ? "var(--ink)" : "transparent",
                                color: activeTab === item.id ? "var(--paper)" : "var(--muted)",
                                borderLeft: activeTab === item.id ? "3px solid var(--red)" : "3px solid transparent",
                            }}
                        >
                            {item.icon}
                            <span className="admin-sidebar-label">{item.label}</span>
                        </button>
                    ))}
                </div>

                <div className="admin-sidebar-footer" style={{ padding: "16px", borderTop: "1.5px solid var(--ink)" }}>
                    <div className="admin-sidebar-user" style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--paper)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <span style={{ fontSize: "10px", fontWeight: 700 }}>{user.email?.charAt(0).toUpperCase()}</span>
                        </div>
                        <p className="admin-sidebar-email" style={{ fontSize: "10px", fontWeight: 700, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{user.email}</p>
                    </div>
                    <button
                        className="admin-sidebar-signout"
                        onClick={handleLogout}
                        title="Sign Out"
                        style={{
                            width: "100%", display: "flex", alignItems: "center", gap: "10px",
                            padding: "10px 14px", border: "1px solid var(--ink)", background: "transparent",
                            color: "var(--ink)", cursor: "pointer", fontSize: "10px", fontWeight: 700,
                            textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "var(--body)",
                            transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--red)"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "var(--red)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ink)"; e.currentTarget.style.borderColor = "var(--ink)"; }}
                    >
                        <LogOut style={{ width: 16, height: 16, flexShrink: 0 }} />
                        <span className="admin-sidebar-signout-text">Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* ── Mobile Topbar ── */}
            <div className="admin-mobile-topbar">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Lightbulb style={{ width: 14, height: 14, color: "var(--paper)" }} />
                        </div>
                        <span style={{ fontFamily: "var(--bebas)", fontSize: "16px" }}>IDEA LAB</span>
                    </div>
                    <button onClick={handleLogout} style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: "var(--red)", background: "none", border: "none", cursor: "pointer", letterSpacing: "0.08em" }}>Sign Out</button>
                </div>
                <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "2px" }}>
                    {navigationItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as TabType)}
                            style={{
                                padding: "7px 14px",
                                whiteSpace: "nowrap",
                                fontSize: "10px",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                border: "1px solid",
                                cursor: "pointer",
                                fontFamily: "var(--body)",
                                borderColor: activeTab === item.id ? "var(--ink)" : "var(--line)",
                                background: activeTab === item.id ? "var(--ink)" : "transparent",
                                color: activeTab === item.id ? "var(--paper)" : "var(--muted)",
                            }}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Main Content ── */}
            <div className="admin-content">

                {dataLoading ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
                        <div style={{ textAlign: "center" }}>
                            <div className="spinner" style={{ width: 40, height: 40, margin: "0 auto 16px", borderColor: "var(--line)", borderTopColor: "var(--ink)" }} />
                            <p className="admin-section-sub">Loading Data...</p>
                        </div>
                    </div>
                ) : (
                    <div className="admin-inner fade-in-up">

                        {/* ── Dashboard Tab ── */}
                        {activeTab === "dashboard" && (
                            <>
                                <header>
                                    <h1 className="admin-section-title">OVERVIEW</h1>
                                    <p className="admin-section-sub">Real-time Event Metrics</p>
                                </header>

                                {/* Stats Grid */}
                                <div className="admin-grid-2" style={{ marginBottom: "24px" }}>
                                    {[
                                        { label: "Total Registrations", value: totalRegistrations, color: "var(--ink)" },
                                        { label: "Active Events", value: events.filter(e => e.isActive).length, color: "var(--red)" },
                                        { label: "With Event", value: students.filter(s => s.eventId).length, color: "#10b981" },
                                        { label: "CSV Students", value: csvStudentCount, color: "var(--muted)" },
                                    ].map(({ label, value, color }) => (
                                        <div key={label} className="admin-card" style={{ padding: "20px 24px" }}>
                                            <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--muted)", marginBottom: "8px" }}>{label}</p>
                                            <p style={{ fontFamily: "var(--bebas)", fontSize: "40px", letterSpacing: "0.02em", color, lineHeight: 1 }}>{value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Branch Distribution */}
                                <div className="admin-card" style={{ marginBottom: "24px" }}>
                                    <h2 style={{ fontFamily: "var(--bebas)", fontSize: "clamp(20px, 3vw, 24px)", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
                                        <LayoutDashboard style={{ width: 22, height: 22, color: "var(--red)" }} /> Branch Distribution
                                    </h2>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                                        {Object.entries(branchStats).sort(([, a], [, b]) => b - a).map(([branch, count]) => (
                                            <div key={branch}>
                                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                                                    <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em" }}>{branch}</span>
                                                    <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)" }}>{count}</span>
                                                </div>
                                                <div style={{ height: "20px", border: "1.5px solid var(--ink)", background: "var(--paper2)", position: "relative" }}>
                                                    <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${(count / maxBranchCount) * 100}%`, background: branchColors[branch] || "var(--ink)", transition: "width 1s ease" }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Event Distribution */}
                                {events.length > 0 && (
                                    <div className="admin-card">
                                        <h2 style={{ fontFamily: "var(--bebas)", fontSize: "clamp(20px, 3vw, 24px)", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
                                            <CalendarDays style={{ width: 22, height: 22, color: "var(--red)" }} /> Event Registrations
                                        </h2>

                                        {/* Event stat cards */}
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px", marginBottom: "28px" }}>
                                            {events.map((ev) => {
                                                const fillPct = ev.capacity > 0 ? Math.min((ev.registrationCount / ev.capacity) * 100, 100) : 0;
                                                const barColor = ev.registrationCount >= ev.capacity ? "var(--red)" : fillPct >= 90 ? "var(--red)" : fillPct >= 70 ? "#f59e0b" : "#10b981";
                                                const statusLabel = ev.registrationCount >= ev.capacity ? "FULL" : ev.isActive ? "ACTIVE" : "INACTIVE";
                                                const statusBg = ev.registrationCount >= ev.capacity ? "rgba(232,52,26,0.10)" : ev.isActive ? "rgba(16,185,129,0.10)" : "rgba(0,0,0,0.06)";
                                                const statusColor = ev.registrationCount >= ev.capacity ? "var(--red)" : ev.isActive ? "#10b981" : "var(--muted)";
                                                return (
                                                    <div key={ev.eventId} style={{ border: "1.5px solid var(--line)", padding: "16px", background: "var(--paper2)" }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                                                            <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", lineHeight: 1.3, flex: 1, paddingRight: "8px" }}>{ev.name}</span>
                                                            <span style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", padding: "3px 7px", background: statusBg, color: statusColor, border: `1px solid ${statusColor}`, flexShrink: 0 }}>{statusLabel}</span>
                                                        </div>
                                                        <p style={{ fontFamily: "var(--bebas)", fontSize: "28px", letterSpacing: "0.02em", lineHeight: 1, marginBottom: "8px", color: barColor }}>
                                                            {ev.registrationCount} <span style={{ fontSize: "14px", color: "var(--muted)", fontFamily: "var(--bebas)" }}>/ {ev.capacity}</span>
                                                        </p>
                                                        <div style={{ height: "6px", background: "var(--line)", position: "relative", overflow: "hidden" }}>
                                                            <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${fillPct}%`, background: barColor, transition: "width 1s ease" }} />
                                                        </div>
                                                        <p style={{ fontSize: "9px", color: "var(--muted)", marginTop: "5px", fontWeight: 700, letterSpacing: "0.08em" }}>{Math.round(fillPct)}% filled</p>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Enhanced bar chart */}
                                        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
                                            {events.map((ev) => {
                                                const fillPct = ev.capacity > 0 ? Math.min((ev.registrationCount / ev.capacity) * 100, 100) : 0;
                                                const barColor = ev.registrationCount >= ev.capacity ? "var(--red)" : fillPct >= 90 ? "var(--red)" : fillPct >= 70 ? "#f59e0b" : "#10b981";
                                                return (
                                                    <div key={ev.eventId}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                                                            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em" }}>{ev.name}</span>
                                                            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)" }}>{ev.registrationCount} / {ev.capacity}</span>
                                                        </div>
                                                        <div style={{ height: "22px", border: "1.5px solid var(--ink)", background: "var(--paper2)", position: "relative" }}>
                                                            <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${fillPct}%`, background: barColor, transition: "width 1s ease" }} />
                                                            {ev.registrationCount > 0 && (
                                                                <span style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", left: `${Math.min(fillPct, 85)}%`, marginLeft: "6px", fontSize: "9px", fontWeight: 800, color: fillPct > 20 ? "#fff" : "var(--ink)", letterSpacing: "0.06em", pointerEvents: "none" }}>
                                                                    {ev.registrationCount}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* No-event count */}
                                        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", background: "var(--paper2)", border: "1.5px dashed var(--line)" }}>
                                            <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)", flex: 1 }}>No Event Selected</span>
                                            <span style={{ fontFamily: "var(--bebas)", fontSize: "22px", color: "var(--muted)", letterSpacing: "0.04em" }}>
                                                {students.filter(s => !s.eventId).length}
                                            </span>
                                            <span style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)" }}>students</span>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── Students Tab ── */}
                        {activeTab === "students" && (
                            <>
                                <header>
                                    <h1 className="admin-section-title">STUDENTS</h1>
                                    <p className="admin-section-sub">CSV Master Data — {csvStudentCount} Records</p>
                                </header>

                                <div className="admin-card">
                                    <h3 style={{ fontFamily: "var(--bebas)", fontSize: "22px", letterSpacing: "0.04em", marginBottom: "20px", display: "flex", alignItems: "center", gap: "12px" }}>
                                        <Database style={{ width: 20, height: 20, color: "var(--red)" }} /> Upload Student CSV
                                    </h3>
                                    <CSVUploader onUploadComplete={fetchStudents} />
                                </div>

                                <div className="admin-card" style={{ padding: "4px" }}>
                                    <CSVStudentTable
                                        students={csvStudents}
                                        onUpdate={async (usn, data) => {
                                            const currentUser = auth.currentUser;
                                            if (!currentUser) throw new Error("Not authenticated");
                                            const idToken = await currentUser.getIdToken(true);
                                            const res = await fetch("/api/admin/students", {
                                                method: "PUT",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ idToken, usn, data }),
                                            });
                                            if (!res.ok) throw new Error("Update failed");
                                            setCsvStudents((prev) =>
                                                prev.map((s) => (s.usn === usn ? { ...s, ...data } : s))
                                            );
                                        }}
                                        onDelete={async (usn) => {
                                            const currentUser = auth.currentUser;
                                            if (!currentUser) throw new Error("Not authenticated");
                                            const idToken = await currentUser.getIdToken(true);
                                            const res = await fetch("/api/admin/students", {
                                                method: "DELETE",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ idToken, usn }),
                                            });
                                            if (!res.ok) throw new Error("Delete failed");
                                            setCsvStudents((prev) => prev.filter((s) => s.usn !== usn));
                                            setCsvStudentCount((c) => c - 1);
                                        }}
                                    />
                                </div>
                            </>
                        )}

                        {/* ── Registrations Tab ── */}
                        {activeTab === "registrations" && (
                            <>
                                <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "16px" }}>
                                    <div>
                                        <h1 className="admin-section-title">REGISTRATIONS</h1>
                                        <p className="admin-section-sub">Full Participant Directory</p>
                                    </div>
                                    <button onClick={fetchStudents} className="btn-secondary" style={{ fontSize: "10px", fontWeight: 800, padding: "10px 24px" }}>
                                        RELOAD DATA
                                    </button>
                                </header>

                                {/* ── Event-wise count summary ── */}
                                {events.length > 0 && (
                                    <div className="admin-card" style={{ padding: "20px 24px" }}>
                                        <h3 style={{ fontFamily: "var(--bebas)", fontSize: "18px", letterSpacing: "0.06em", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
                                            <CalendarDays style={{ width: 18, height: 18, color: "var(--red)" }} /> Event Summary
                                        </h3>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "24px" }}>
                                            {events.map((ev) => (
                                                <div key={ev.eventId} style={{ border: "1.5px solid var(--line)", padding: "12px 16px", background: "var(--paper2)", minWidth: "140px" }}>
                                                    <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px", lineHeight: 1.3 }}>{ev.name}</p>
                                                    <p style={{ fontFamily: "var(--bebas)", fontSize: "26px", letterSpacing: "0.02em", lineHeight: 1, color: "var(--ink)" }}>
                                                        {studentsWithEvents.filter(s => s.eventId === ev.eventId).length}
                                                    </p>
                                                    <p style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)", marginTop: "2px" }}>registered</p>
                                                </div>
                                            ))}
                                            <div style={{ border: "1.5px dashed var(--line)", padding: "12px 16px", background: "transparent", minWidth: "140px" }}>
                                                <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px", color: "var(--muted)" }}>No Event</p>
                                                <p style={{ fontFamily: "var(--bebas)", fontSize: "26px", letterSpacing: "0.02em", lineHeight: 1, color: "var(--muted)" }}>
                                                    {students.filter(s => !s.eventId).length}
                                                </p>
                                                <p style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)", marginTop: "2px" }}>pending</p>
                                            </div>
                                        </div>

                                        {/* Export section */}
                                        <div style={{ borderTop: "1.5px solid var(--line)", paddingTop: "20px" }}>
                                            <p style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--muted)", marginBottom: "12px" }}>Export Data</p>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                                                {/* Export All XLS */}
                                                <button
                                                    onClick={handleExportAllXLS}
                                                    className="btn-primary"
                                                    style={{ fontSize: "10px", fontWeight: 800, padding: "9px 18px", display: "flex", alignItems: "center", gap: "6px" }}
                                                >
                                                    <FileSpreadsheet style={{ width: 13, height: 13 }} /> Export All (XLS, multi-sheet)
                                                </button>

                                                {/* Per-event CSV buttons */}
                                                <div style={{ width: "1px", height: "28px", background: "var(--line)", margin: "0 4px" }} />
                                                {events.map((ev) => (
                                                    <button
                                                        key={ev.eventId}
                                                        onClick={() => handleExportEventCSV(ev.eventId, ev.name)}
                                                        className="btn-secondary"
                                                        style={{ fontSize: "9px", fontWeight: 800, padding: "7px 13px", display: "flex", alignItems: "center", gap: "5px", letterSpacing: "0.08em" }}
                                                    >
                                                        <Download style={{ width: 11, height: 11 }} />
                                                        {ev.name.slice(0, 20)}{ev.name.length > 20 ? "…" : ""} CSV
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="admin-card" style={{ padding: "4px" }}>
                                    <StudentTable students={studentsWithEvents} showEventColumn={true} />
                                </div>
                            </>
                        )}

                        {/* ── Events Tab ── */}
                        {activeTab === "events" && (
                            <>
                                <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "16px" }}>
                                    <div>
                                        <h1 className="admin-section-title">EVENTS</h1>
                                        <p className="admin-section-sub">{events.length} Event{events.length !== 1 ? "s" : ""} · {events.filter(e => e.isActive).length} Active</p>
                                    </div>
                                    <button
                                        onClick={() => { setShowEventForm(true); setEditingEvent(null); setEventForm({ name: "", description: "", capacity: "", dateTime: "", price: "0", isActive: true }); setEventFormError(""); }}
                                        className="btn-primary"
                                        style={{ fontSize: "10px", fontWeight: 800, padding: "10px 20px", display: "flex", alignItems: "center", gap: "6px" }}
                                    >
                                        <Plus style={{ width: 14, height: 14 }} /> Add Event
                                    </button>
                                </header>

                                {/* Event Form */}
                                {showEventForm && (
                                    <div className="admin-card fade-in-up">
                                        <h3 style={{ fontFamily: "var(--bebas)", fontSize: "22px", letterSpacing: "0.04em", marginBottom: "20px" }}>
                                            {editingEvent ? "EDIT EVENT" : "NEW EVENT"}
                                        </h3>
                                        <form onSubmit={handleSaveEvent}>
                                            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                                <div>
                                                    <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)", marginBottom: "8px" }}>Event Name *</label>
                                                    <input type="text" value={eventForm.name} onChange={e => setEventForm(f => ({...f, name: e.target.value}))} className="input-field" required placeholder="e.g. Web Development Workshop" />
                                                </div>
                                                <div>
                                                    <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)", marginBottom: "8px" }}>Description</label>
                                                    <textarea value={eventForm.description} onChange={e => setEventForm(f => ({...f, description: e.target.value}))} className="input-field" rows={3} placeholder="Brief description of the event" style={{ resize: "vertical", fontFamily: "var(--body)" }} />
                                                </div>
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                                                    <div>
                                                        <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)", marginBottom: "8px" }}>Capacity *</label>
                                                        <input type="number" value={eventForm.capacity} onChange={e => setEventForm(f => ({...f, capacity: e.target.value}))} className="input-field" required min={1} placeholder="50" />
                                                    </div>
                                                    <div>
                                                        <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)", marginBottom: "8px" }}>Date & Time *</label>
                                                        <input type="datetime-local" value={eventForm.dateTime} onChange={e => setEventForm(f => ({...f, dateTime: e.target.value}))} className="input-field" required />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)", marginBottom: "8px" }}>Entry Fee (₹) <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>— 0 for free</span></label>
                                                    <div style={{ position: "relative" }}>
                                                        <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "13px", color: "var(--muted)", fontWeight: 600 }}>₹</span>
                                                        <input type="number" value={eventForm.price} onChange={e => setEventForm(f => ({...f, price: e.target.value}))} className="input-field" min={0} placeholder="0" style={{ paddingLeft: "28px" }} />
                                                    </div>
                                                    {Number(eventForm.price) === 0 && <span style={{ fontSize: "10px", color: "#16a34a", fontWeight: 700, marginTop: "4px", display: "inline-block" }}>✓ FREE event</span>}
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                    <input type="checkbox" id="isActive" checked={eventForm.isActive} onChange={e => setEventForm(f => ({...f, isActive: e.target.checked}))} style={{ width: 16, height: 16, cursor: "pointer" }} />
                                                    <label htmlFor="isActive" style={{ fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>Active (visible to students)</label>
                                                </div>
                                            </div>
                                            {eventFormError && (
                                                <div style={{ marginTop: "16px", padding: "12px 14px", fontSize: "12px", fontWeight: 600, background: "rgba(232,52,26,0.08)", color: "var(--red)", border: "1.5px solid var(--red)" }}>
                                                    {eventFormError}
                                                </div>
                                            )}
                                            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                                                <button type="submit" disabled={eventFormLoading} className="btn-primary" style={{ fontSize: "11px", padding: "10px 24px" }}>
                                                    {eventFormLoading ? <div className="spinner" /> : editingEvent ? "Save Changes" : "Create Event"}
                                                </button>
                                                <button type="button" onClick={() => { setShowEventForm(false); setEditingEvent(null); setEventFormError(""); }} className="btn-secondary" style={{ fontSize: "11px", padding: "10px 24px" }}>
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                )}

                                {/* Events List */}
                                {eventsLoading ? (
                                    <div style={{ textAlign: "center", padding: "48px 0" }}>
                                        <div className="spinner" style={{ width: 36, height: 36, margin: "0 auto" }} />
                                    </div>
                                ) : events.length === 0 ? (
                                    <div className="admin-card" style={{ textAlign: "center", padding: "48px 24px" }}>
                                        <CalendarDays style={{ width: 40, height: 40, color: "var(--muted)", margin: "0 auto 16px" }} />
                                        <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)", marginBottom: "8px" }}>No events yet</p>
                                        <p style={{ fontSize: "13px", color: "var(--muted)" }}>Create your first event to get started.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                        {events.map((ev) => {
                                            const fillPct = Math.min((ev.registrationCount / ev.capacity) * 100, 100);
                                            const isFull = ev.registrationCount >= ev.capacity;
                                            return (
                                                <div key={ev.eventId} className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
                                                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "16px 20px", borderBottom: "1.5px solid var(--line)", background: "var(--paper2)" }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                            <CalendarDays style={{ width: 18, height: 18, color: "var(--red)", flexShrink: 0 }} />
                                                            <div>
                                                                <h3 style={{ fontFamily: "var(--bebas)", fontSize: "20px", letterSpacing: "0.04em", lineHeight: 1 }}>{ev.name}</h3>
                                                                <p style={{ fontFamily: "monospace", fontSize: "10px", color: "var(--muted)", marginTop: "2px" }}>{ev.eventId}</p>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                            <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", padding: "3px 8px", background: ev.isActive ? "#10b981" : "var(--muted)", color: "#fff" }}>
                                                                {ev.isActive ? "Active" : "Inactive"}
                                                            </span>
                                                            {isFull && <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", padding: "3px 8px", background: "#ef4444", color: "#fff" }}>Full</span>}
                                                        </div>
                                                    </div>
                                                    <div style={{ padding: "16px 20px" }}>
                                                        {ev.description && <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "12px", lineHeight: 1.6 }}>{ev.description}</p>}
                                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginBottom: "14px" }}>
                                                            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)" }}>📅 {new Date(ev.dateTime).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                                                            <span style={{ fontSize: "12px", fontWeight: 700, color: isFull ? "#ef4444" : "var(--muted)" }}>👥 {ev.registrationCount} / {ev.capacity}</span>
                                                            <span style={{ fontSize: "12px", fontWeight: 700, color: (ev.price ?? 0) === 0 ? "#16a34a" : "#2563eb" }}>
                                                                {(ev.price ?? 0) === 0 ? "🆓 Free" : `💰 ₹${ev.price}`}
                                                            </span>
                                                        </div>
                                                        <div style={{ height: "6px", background: "var(--line)", marginBottom: "16px" }}>
                                                            <div style={{ height: "100%", width: `${fillPct}%`, background: isFull ? "#ef4444" : "#10b981", transition: "width 0.5s ease" }} />
                                                        </div>
                                                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                                            <button
                                                                onClick={() => { setEditingEvent(ev.eventId); setEventForm({ name: ev.name, description: ev.description, capacity: String(ev.capacity), dateTime: ev.dateTime, price: String(ev.price ?? 0), isActive: ev.isActive }); setShowEventForm(true); setEventFormError(""); }}
                                                                className="btn-secondary"
                                                                style={{ fontSize: "10px", padding: "7px 14px" }}
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={() => handleToggleEventActive(ev.eventId, ev.isActive)}
                                                                className="btn-secondary"
                                                                style={{ fontSize: "10px", padding: "7px 14px" }}
                                                            >
                                                                {ev.isActive ? "Deactivate" : "Activate"}
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteEvent(ev.eventId, ev.name)}
                                                                style={{ fontSize: "10px", fontWeight: 700, padding: "7px 14px", background: "none", border: "1px solid rgba(232,52,26,0.3)", color: "var(--red)", cursor: "pointer", fontFamily: "var(--body)", textTransform: "uppercase", letterSpacing: "0.06em" }}
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── Settings Tab ── */}
                        {activeTab === "settings" && (
                            <>
                                <header>
                                    <h1 className="admin-section-title">SETTINGS</h1>
                                    <p className="admin-section-sub">Global Configurations</p>
                                </header>

                                <div className="admin-grid-2">
                                    {/* Registration Gate */}
                                    <div className="admin-card">
                                        <Settings style={{ width: 36, height: 36, color: "var(--muted)", marginBottom: "20px" }} />
                                        <h3 style={{ fontFamily: "var(--bebas)", fontSize: "22px", letterSpacing: "0.04em", marginBottom: "8px" }}>Registration Gate</h3>
                                        <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)", marginBottom: "32px", lineHeight: 1.8 }}>
                                            Portal is currently{" "}
                                            <span style={{ padding: "2px 8px", background: registrationsOpen ? "#10b981" : "var(--red)", color: "#fff" }}>
                                                {registrationsOpen ? "OPEN" : "LOCKED"}
                                            </span>
                                        </p>
                                        <button onClick={toggleRegistrations} disabled={configLoading} className="btn-primary w-full" style={{ padding: "14px" }}>
                                            {configLoading ? <div className="spinner" /> : (registrationsOpen ? "LOCK REGISTRATIONS" : "OPEN REGISTRATIONS")}
                                        </button>
                                    </div>

                                    {/* Danger Zone */}
                                    <div className="admin-card" style={{ borderColor: "var(--red)", gridColumn: "1 / -1" }}>
                                        <ShieldAlert style={{ width: 36, height: 36, color: "var(--red)", marginBottom: "20px" }} />
                                        <h3 style={{ fontFamily: "var(--bebas)", fontSize: "22px", letterSpacing: "0.04em", marginBottom: "8px", color: "var(--red)" }}>Danger Zone</h3>
                                        <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--red)", marginBottom: "32px", lineHeight: 1.8 }}>
                                            Wipe all registration and event data. Proceed with extreme caution.
                                        </p>
                                        <button
                                            onClick={() => setShowResetModal(true)}
                                            style={{
                                                width: "100%", padding: "14px", border: "1.5px solid var(--red)", background: "transparent",
                                                color: "var(--red)", cursor: "pointer", fontSize: "11px", fontWeight: 800,
                                                textTransform: "uppercase", letterSpacing: "0.16em", fontFamily: "var(--body)",
                                                transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--red)"; e.currentTarget.style.color = "#fff"; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--red)"; }}
                                        >
                                            <Eraser style={{ width: 16, height: 16 }} /> RESET DATABASE
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* ── Reset Modal ── */}
            {showResetModal && (
                <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "rgba(13,13,13,0.9)", backdropFilter: "blur(4px)" }}>
                    <div className="glass-card" style={{ maxWidth: "420px", width: "100%", padding: "clamp(24px, 4vw, 48px)", borderColor: "var(--red)" }}>
                        <div style={{ textAlign: "center", marginBottom: "32px" }}>
                            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                                <AlertTriangle style={{ width: 32, height: 32, color: "#fff" }} />
                            </div>
                            <h2 style={{ fontFamily: "var(--bebas)", fontSize: "clamp(28px, 4vw, 36px)", lineHeight: 1, marginBottom: "8px" }}>DANGER ZONE</h2>
                            <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)" }}>
                                Permanently erase all <span style={{ color: "var(--red)" }}>data</span>.
                            </p>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                            {/* Cleanup options */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "14px 16px", background: "rgba(232, 52, 26, 0.04)", border: "1.5px solid var(--line)" }}>
                                <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)", marginBottom: "4px" }}>
                                    Also Clear
                                </p>
                                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "var(--ink)" }}>
                                    <input
                                        type="checkbox"
                                        checked={clearOtpCodes}
                                        onChange={(e) => setClearOtpCodes(e.target.checked)}
                                        style={{ width: 16, height: 16, accentColor: "var(--red)" }}
                                    />
                                    OTP verification codes
                                </label>
                                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "var(--ink)" }}>
                                    <input
                                        type="checkbox"
                                        checked={clearCSV}
                                        onChange={(e) => setClearCSV(e.target.checked)}
                                        style={{ width: 16, height: 16, accentColor: "var(--red)" }}
                                    />
                                    CSV student master data
                                </label>
                                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "var(--ink)" }}>
                                    <input
                                        type="checkbox"
                                        checked={clearEvents}
                                        onChange={(e) => setClearEvents(e.target.checked)}
                                        style={{ width: 16, height: 16, accentColor: "var(--red)" }}
                                    />
                                    Event definitions
                                </label>
                            </div>

                            <div>
                                <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)", marginBottom: "8px" }}>
                                    Type <span style={{ color: "var(--red)", fontStyle: "italic" }}>RESET DATABASE</span> to confirm
                                </label>
                                <input
                                    type="text"
                                    value={resetPhrase}
                                    onChange={(e) => setResetPhrase(e.target.value.toUpperCase())}
                                    placeholder="RESET DATABASE"
                                    className="input-field"
                                    style={{ textTransform: "uppercase" }}
                                    autoComplete="off"
                                />
                            </div>

                            {resetError && (
                                <div style={{ padding: "12px 14px", fontSize: "12px", fontWeight: 700, background: "rgba(232,52,26,0.10)", color: "var(--red)", border: "1.5px solid var(--red)", display: "flex", alignItems: "center", gap: "8px" }}>
                                    <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} /> {resetError}
                                </div>
                            )}

                            <div style={{ display: "flex", gap: "12px" }}>
                                <button
                                    type="button"
                                    onClick={() => { setShowResetModal(false); setResetError(""); setResetPhrase(""); }}
                                    className="btn-secondary"
                                    style={{ flex: 1, padding: "14px" }}
                                    disabled={resetLoading}
                                >
                                    ABORT
                                </button>
                                <button
                                    type="button"
                                    onClick={handleResetDatabase}
                                    disabled={resetLoading || resetPhrase.trim() !== "RESET DATABASE"}
                                    className="btn-danger"
                                    style={{
                                        flex: 1, padding: "14px",
                                        opacity: resetLoading ? 1 : resetPhrase.trim() !== "RESET DATABASE" ? 0.35 : 1,
                                        cursor: resetLoading ? "default" : resetPhrase.trim() !== "RESET DATABASE" ? "not-allowed" : "pointer",
                                        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                                        pointerEvents: resetLoading ? "none" : undefined,
                                    }}
                                >
                                    {resetLoading ? (
                                        <>
                                            <div style={{
                                                width: 16, height: 16, border: "2.5px solid rgba(255,255,255,0.35)",
                                                borderTopColor: "#fff", borderRadius: "50%",
                                                animation: "spin 0.7s linear infinite", flexShrink: 0,
                                            }} />
                                            Resetting…
                                        </>
                                    ) : (
                                        <><Eraser style={{ width: 14, height: 14 }} /> ERASE DATA</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
