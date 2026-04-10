"use client";

import { useState, useMemo } from "react";
import { Search, Download, FileSpreadsheet, Pencil, Trash2, X } from "lucide-react";

export interface CSVStudent {
    usn: string;
    name: string;
    email: string;
    phone: string;
    branch: string;
    section: string;
}

interface CSVStudentTableProps {
    students: CSVStudent[];
    onUpdate: (usn: string, data: Partial<CSVStudent>) => Promise<void>;
    onDelete: (usn: string) => Promise<void>;
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

export default function CSVStudentTable({ students, onUpdate, onDelete }: CSVStudentTableProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 20;

    // Edit modal state
    const [editStudent, setEditStudent] = useState<CSVStudent | null>(null);
    const [editName, setEditName] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [editSaving, setEditSaving] = useState(false);

    // Delete state
    const [deleteUSN, setDeleteUSN] = useState<string | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const filteredStudents = useMemo(() => {
        if (!searchQuery) return students;
        const q = searchQuery.toLowerCase();
        return students.filter(
            (s) =>
                s.name.toLowerCase().includes(q) ||
                s.usn.toLowerCase().includes(q) ||
                s.branch.toLowerCase().includes(q) ||
                s.email.toLowerCase().includes(q)
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

    const openEdit = (s: CSVStudent) => {
        setEditStudent(s);
        setEditName(s.name);
        setEditEmail(s.email);
        setEditPhone(s.phone);
    };

    const handleSaveEdit = async () => {
        if (!editStudent) return;
        setEditSaving(true);
        try {
            await onUpdate(editStudent.usn, { name: editName, email: editEmail, phone: editPhone });
            setEditStudent(null);
        } catch {
            alert("Failed to update student.");
        } finally {
            setEditSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteUSN) return;
        setDeleteLoading(true);
        try {
            await onDelete(deleteUSN);
            setDeleteUSN(null);
        } catch {
            alert("Failed to delete student.");
        } finally {
            setDeleteLoading(false);
        }
    };

    const exportCSV = () => {
        const headers = ["Name", "USN", "Email", "Phone", "Branch", "Section"];
        const rows = students.map((s) => [s.name, s.usn, s.email, s.phone, s.branch, s.section]);
        const csvContent = [
            headers.join(","),
            ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `csv-students-${new Date().toISOString().split("T")[0]}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const exportXLS = async () => {
        try {
            const { exportSingleSheet } = await import("@/lib/xlsExport");
            const rows = students.map((s) => ({
                Name: s.name,
                USN: s.usn,
                Email: s.email,
                Phone: s.phone,
                Branch: s.branch,
                Section: s.section,
            }));
            exportSingleSheet(rows, `csv-students-${new Date().toISOString().split("T")[0]}.xlsx`, "Students");
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
                        placeholder="Search by name, USN, branch, email..."
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
                            <th style={thStyle} className="admin-hide-mobile">Email</th>
                            <th style={thStyle} className="admin-hide-mobile">Phone</th>
                            <th style={thStyle} className="admin-hide-tablet">Branch</th>
                            <th style={thStyle} className="admin-hide-tablet">Section</th>
                            <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedStudents.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ padding: "40px", textAlign: "center", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)" }}>
                                    {searchQuery ? "No matching students found" : "No CSV students uploaded yet"}
                                </td>
                            </tr>
                        ) : (
                            paginatedStudents.map((student, i) => (
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
                                    <td style={{ ...tdStyle, color: "var(--muted)", fontSize: "12px" }} className="admin-hide-mobile">{student.email}</td>
                                    <td style={{ ...tdStyle, color: "var(--muted)", fontSize: "12px" }} className="admin-hide-mobile">{student.phone}</td>
                                    <td style={{ ...tdStyle, color: "var(--muted)" }} className="admin-hide-tablet">{student.branch}</td>
                                    <td style={{ ...tdStyle, color: "var(--muted)" }} className="admin-hide-tablet">{student.section}</td>
                                    <td style={{ ...tdStyle, textAlign: "center", whiteSpace: "nowrap" }}>
                                        <button
                                            onClick={() => openEdit(student)}
                                            title="Edit"
                                            style={{
                                                background: "none", border: "1px solid var(--line)", cursor: "pointer",
                                                padding: "6px 8px", color: "var(--ink)", marginRight: "6px",
                                                transition: "all 0.15s",
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--ink)"; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line)"; }}
                                        >
                                            <Pencil style={{ width: 14, height: 14 }} />
                                        </button>
                                        <button
                                            onClick={() => setDeleteUSN(student.usn)}
                                            title="Delete"
                                            style={{
                                                background: "none", border: "1px solid var(--line)", cursor: "pointer",
                                                padding: "6px 8px", color: "var(--red)",
                                                transition: "all 0.15s",
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--red)"; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line)"; }}
                                        >
                                            <Trash2 style={{ width: 14, height: 14 }} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
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

            {/* Edit Modal */}
            {editStudent && (
                <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "rgba(13,13,13,0.9)", backdropFilter: "blur(4px)" }}>
                    <div className="glass-card" style={{ maxWidth: "420px", width: "100%", padding: "clamp(24px, 4vw, 40px)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                            <h2 style={{ fontFamily: "var(--bebas)", fontSize: "24px", letterSpacing: "0.04em" }}>EDIT STUDENT</h2>
                            <button onClick={() => setEditStudent(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
                                <X style={{ width: 20, height: 20 }} />
                            </button>
                        </div>

                        <div style={{ marginBottom: "20px", padding: "12px 14px", background: "var(--paper2)", border: "1.5px solid var(--line)" }}>
                            <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)", marginBottom: "4px" }}>USN</p>
                            <p style={{ fontFamily: "monospace", fontSize: "14px", fontWeight: 700 }}>{editStudent.usn}</p>
                            <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
                                <div>
                                    <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)" }}>Branch</p>
                                    <p style={{ fontSize: "13px", fontWeight: 600 }}>{editStudent.branch}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)" }}>Section</p>
                                    <p style={{ fontSize: "13px", fontWeight: 600 }}>{editStudent.section}</p>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
                            <div>
                                <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)", marginBottom: "8px" }}>Name</label>
                                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="input-field" />
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)", marginBottom: "8px" }}>Email</label>
                                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="input-field" />
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)", marginBottom: "8px" }}>Phone</label>
                                <input type="text" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="input-field" />
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "12px" }}>
                            <button onClick={() => setEditStudent(null)} className="btn-secondary" style={{ flex: 1, padding: "14px" }}>
                                CANCEL
                            </button>
                            <button onClick={handleSaveEdit} disabled={editSaving || !editName.trim()} className="btn-primary" style={{ flex: 1, padding: "14px" }}>
                                {editSaving ? <div className="spinner" /> : "SAVE CHANGES"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm Modal */}
            {deleteUSN && (
                <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "rgba(13,13,13,0.9)", backdropFilter: "blur(4px)" }}>
                    <div className="glass-card" style={{ maxWidth: "380px", width: "100%", padding: "clamp(24px, 4vw, 40px)", borderColor: "var(--red)" }}>
                        <div style={{ textAlign: "center", marginBottom: "24px" }}>
                            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                                <Trash2 style={{ width: 28, height: 28, color: "#fff" }} />
                            </div>
                            <h2 style={{ fontFamily: "var(--bebas)", fontSize: "24px", letterSpacing: "0.04em", marginBottom: "8px" }}>DELETE STUDENT</h2>
                            <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.6 }}>
                                Remove <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--ink)" }}>{deleteUSN}</span> from the CSV master data?
                            </p>
                        </div>
                        <div style={{ display: "flex", gap: "12px" }}>
                            <button onClick={() => setDeleteUSN(null)} className="btn-secondary" style={{ flex: 1, padding: "14px" }}>
                                CANCEL
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleteLoading}
                                style={{
                                    flex: 1, padding: "14px", background: "var(--red)", color: "#fff",
                                    fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em",
                                    fontSize: "11px", border: "1px solid var(--ink)", cursor: "pointer",
                                    opacity: deleteLoading ? 0.5 : 1, transition: "all 0.15s", fontFamily: "var(--body)",
                                }}
                            >
                                {deleteLoading ? <div className="spinner" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} /> : "DELETE"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
