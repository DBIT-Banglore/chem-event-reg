"use client";

import { useState, useMemo } from "react";
import { Search, Download, FileSpreadsheet } from "lucide-react";

interface Student {
    name: string;
    usn: string;
    phone: string;
    branch: string;
    section: string;
    email?: string;
    eventId?: string | null;
    eventName?: string | null;
    paymentStatus?: string | null;
    paymentId?: string | null;
    paymentAmount?: number | null;
    eventId2?: string | null;
    eventName2?: string | null;
    paymentStatus2?: string | null;
    paymentId2?: string | null;
    paymentAmount2?: number | null;
}

interface StudentTableProps {
    students: Student[];
    showEventColumn?: boolean;
}

const thStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "16px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontSize: "10px",
    color: "var(--muted)",
    whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
    padding: "16px",
    fontSize: "13px",
};

const fmtAmt = (v: number | null | undefined): string =>
    v == null || v === 0 ? "₹0 (Free)" : `₹${v.toLocaleString("en-IN")}`;

export default function StudentTable({ students, showEventColumn = true }: StudentTableProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 20;

    const filteredStudents = useMemo(() => {
        if (!searchQuery) return students;
        const q = searchQuery.toLowerCase();
        return students.filter(
            (s) =>
                s.usn.toLowerCase().includes(q) ||
                s.name.toLowerCase().includes(q) ||
                s.branch.toLowerCase().includes(q) ||
                s.section.toLowerCase().includes(q) ||
                (s.eventId && s.eventId.toLowerCase().includes(q)) ||
                (s.email && s.email.toLowerCase().includes(q))
        );
    }, [students, searchQuery]);

    const totalPages = Math.ceil(filteredStudents.length / pageSize);
    const paginatedStudents = filteredStudents.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    const handleSearch = (value: string) => {
        setSearchQuery(value);
        setCurrentPage(1);
    };

    const exportCSV = () => {
        const headers = ["#", "Name", "USN", "Email", "Phone", "Branch", "Section",
            "Event 1", "Payment Status", "Transaction ID (Event 1)", "Amount Paid — Event 1",
            "Event 2", "Payment Status (Event 2)", "Transaction ID (Event 2)", "Amount Paid — Event 2",
            "Total Amount Paid"];

        const rows = students.map((s, i) => [
            i + 1, s.name, s.usn, s.email || "", s.phone, s.branch, s.section,
            s.eventName || "", s.paymentStatus || "Free", s.paymentId || "", fmtAmt(s.paymentAmount),
            s.eventName2 || "", s.paymentStatus2 || (s.eventId2 ? "Free" : ""), s.paymentId2 || "", fmtAmt(s.paymentAmount2),
            fmtAmt((s.paymentAmount ?? 0) + (s.paymentAmount2 ?? 0)),
        ]);

        const csvContent = [
            headers.map(h => `"${h}"`).join(","),
            ...rows.map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")),
        ].join("\n");

        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `idea-lab-all-registrations-${new Date().toISOString().split("T")[0]}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const exportXLS = async () => {
        try {
            const { exportToXLS } = await import("@/lib/xlsExport");
            const amountKeys = ["Amount Paid — Event 1", "Amount Paid — Event 2", "Total Amount Paid"];
            const rows = students.map((s, i) => ({
                "#": i + 1,
                "Name": s.name,
                "USN": s.usn,
                "Email": s.email || "",
                "Phone": s.phone,
                "Branch": s.branch,
                "Section": s.section,
                "Event 1": s.eventName || "",
                "Payment Status": s.paymentStatus || "Free",
                "Transaction ID (Event 1)": s.paymentId || "",
                "Amount Paid — Event 1": s.paymentAmount ?? "",
                "Event 2": s.eventName2 || "",
                "Payment Status (Event 2)": s.paymentStatus2 || (s.eventId2 ? "Free" : ""),
                "Transaction ID (Event 2)": s.paymentId2 || "",
                "Amount Paid — Event 2": s.paymentAmount2 ?? "",
                "Total Amount Paid": ((s.paymentAmount ?? 0) + (s.paymentAmount2 ?? 0)) || "",
            }));
            await exportToXLS([rows], ["All Registrations"], `idea-lab-all-registrations-${new Date().toISOString().split("T")[0]}.xlsx`, amountKeys);
        } catch {
            exportCSV();
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Search + Export */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: "200px", position: "relative" }}>
                    <Search style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "var(--muted)" }} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder="Search by USN, name, branch, event..."
                        className="input-field"
                        style={{ paddingLeft: "44px" }}
                    />
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={exportCSV} className="btn-secondary">
                        <Download style={{ width: 16, height: 16 }} /> CSV
                    </button>
                    <button onClick={exportXLS} className="btn-secondary">
                        <FileSpreadsheet style={{ width: 16, height: 16 }} /> XLS
                    </button>
                </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: "auto", border: "1.5px solid var(--ink)", background: "var(--paper)" }}>
                <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ borderBottom: "1.5px solid var(--ink)", background: "var(--paper2)" }}>
                            <th style={thStyle}>Name</th>
                            <th style={thStyle}>USN</th>
                            <th style={thStyle} className="admin-hide-mobile">Branch</th>
                            <th style={thStyle} className="admin-hide-mobile">Section</th>
                            {showEventColumn && (
                                <th style={thStyle} className="admin-hide-tablet">Event</th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedStudents.map((student, i) => (
                            <tr
                                key={student.usn}
                                style={{
                                    borderBottom: "1px solid var(--line)",
                                    background: i % 2 === 0 ? "transparent" : "var(--paper2)",
                                    transition: "background 0.15s",
                                }}
                            >
                                <td style={{ ...tdStyle, fontWeight: 600, color: "var(--ink)" }}>{student.name}</td>
                                <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "12px", color: "var(--ink)" }}>{student.usn}</td>
                                <td style={{ ...tdStyle, color: "var(--muted)" }} className="admin-hide-mobile">{student.branch}</td>
                                <td style={{ ...tdStyle, color: "var(--muted)" }} className="admin-hide-mobile">{student.section}</td>
                                {showEventColumn && (
                                    <td style={{ ...tdStyle, fontSize: "12px" }} className="admin-hide-tablet">
                                        {(student.eventName || student.eventId || student.eventName2 || student.eventId2) ? (
                                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                                {(student.eventName || student.eventId) && (
                                                    <span className="badge badge-success">
                                                        {student.eventName || student.eventId}
                                                    </span>
                                                )}
                                                {(student.eventName2 || student.eventId2) && (
                                                    <span className="badge badge-success">
                                                        {student.eventName2 || student.eventId2}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span style={{ color: "var(--muted)" }}>—</span>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px", padding: "8px 0" }}>
                <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)" }}>
                    Showing {paginatedStudents.length} of {filteredStudents.length} entries
                </p>
                {totalPages > 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn-secondary" style={{ padding: "8px 16px", fontSize: "11px" }}>
                            Prev
                        </button>
                        <span style={{ fontSize: "11px", fontWeight: 700, padding: "0 8px" }}>{currentPage} / {totalPages}</span>
                        <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn-secondary" style={{ padding: "8px 16px", fontSize: "11px" }}>
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
