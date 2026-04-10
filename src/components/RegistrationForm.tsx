"use client";

import { useState, useCallback, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, getDocs, limit } from "firebase/firestore";
import { validateUSN, areSameSection, getBranchName, getSection } from "@/lib/usnValidator";
import { CheckCircle2, Copy, Share2, PencilLine, Lock } from "lucide-react";

interface FormData {
    name: string;
    usn: string;
    phone: string;
    partnerUSN: string;
}

interface ValidationState {
    usn: { valid: boolean | null; message: string; branch?: string; section?: string };
    partnerUSN: { valid: boolean | null; message: string; branch?: string; section?: string };
}

export default function RegistrationForm() {
    const [formData, setFormData] = useState<FormData>({ name: "", usn: "", phone: "", partnerUSN: "" });
    const [validation, setValidation] = useState<ValidationState>({
        usn: { valid: null, message: "" },
        partnerUSN: { valid: null, message: "" },
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitResult, setSubmitResult] = useState<{
        success: boolean;
        message: string;
        pairStatus?: string;
        pairCode?: string;
    } | null>(null);

    const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const q = query(collection(db, "config"), limit(1));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    setRegistrationOpen(snap.docs[0].data().registrationsOpen ?? true);
                } else {
                    setRegistrationOpen(true);
                }
            } catch (error) {
                console.error("Config fetch error:", error);
                setRegistrationOpen(true);
            }
        };
        checkStatus();
    }, []);

    const validateField = useCallback((field: "usn" | "partnerUSN", value: string) => {
        const upperValue = value.toUpperCase();
        if (!upperValue) {
            setValidation((prev) => ({ ...prev, [field]: { valid: null, message: "" } }));
            return;
        }

        const result = validateUSN(upperValue);
        setValidation((prev) => ({
            ...prev,
            [field]: {
                valid: result.valid,
                message: result.valid ? `${result.branch} — Section ${result.section}` : result.error || "Invalid USN",
                branch: result.branch,
                section: result.section,
            },
        }));
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const newValue = name === "usn" || name === "partnerUSN" ? value.toUpperCase() : value;
        setFormData((prev) => ({ ...prev, [name]: newValue }));

        if (name === "usn" || name === "partnerUSN") {
            validateField(name, newValue);
        }
        if (submitResult) setSubmitResult(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitResult(null);

        const usn = formData.usn.toUpperCase();
        const partnerUSN = formData.partnerUSN.toUpperCase();

        try {
            if (!formData.name.trim()) throw new Error("Name is required");
            if (!formData.phone.trim() || !/^\d{10}$/.test(formData.phone)) throw new Error("Please enter a valid 10-digit phone number");

            const usnResult = validateUSN(usn);
            if (!usnResult.valid) throw new Error(`Your USN: ${usnResult.error}`);

            const partnerResult = validateUSN(partnerUSN);
            if (!partnerResult.valid) throw new Error(`Partner USN: ${partnerResult.error}`);

            if (usn === partnerUSN) throw new Error("You cannot be your own partner. Please enter a friend's USN.");
            if (!areSameSection(usn, partnerUSN)) throw new Error("Both partners must be from the same section. Your sections don't match.");

            const existingDoc = await getDoc(doc(db, "registrations", usn));
            if (existingDoc.exists()) throw new Error("This USN is already registered. If this is an error, contact the admin.");

            const partnerDoc = await getDoc(doc(db, "registrations", partnerUSN));
            if (partnerDoc.exists() && partnerDoc.data().partnerUSN !== usn) {
                throw new Error(`${partnerUSN} has already registered with a different partner.`);
            }

            const branch = getBranchName(usn);
            const section = getSection(usn);
            let pairStatus = "pending";
            let generatedCode = Math.random().toString(36).substring(2, 7).toUpperCase();

            if (partnerDoc.exists() && partnerDoc.data().partnerUSN === usn) {
                pairStatus = "confirmed";
                generatedCode = partnerDoc.data().pairCode || generatedCode;
                await updateDoc(doc(db, "registrations", partnerUSN), { pairStatus: "confirmed" });
            }

            await setDoc(doc(db, "registrations", usn), {
                name: formData.name.trim(),
                usn,
                phone: formData.phone.trim(),
                branch,
                section,
                partnerUSN,
                pairCode: generatedCode,
                pairStatus,
                teamId: null,
                createdAt: serverTimestamp(),
            });

            setSubmitResult({
                success: true,
                message: pairStatus === "confirmed" ? "Registration successful! Your pair is confirmed!" : "Registration successful! You've created a pair code.",
                pairStatus,
                pairCode: generatedCode,
            });

        } catch (error) {
            setSubmitResult({
                success: false,
                message: error instanceof Error ? error.message : "Something went wrong",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submitResult?.success) {
        return (
            <div className="text-center p-2 space-y-6 fade-in-up">
                <div style={{ width: 64, height: 64, border: "1.5px solid #10b981", display: "grid", placeItems: "center", margin: "0 auto" }}>
                    <CheckCircle2 style={{ width: 32, height: 32, color: "#10b981" }} />
                </div>
                <h3 style={{ fontFamily: "var(--bebas)", fontSize: "28px", letterSpacing: "0.02em", color: "var(--ink)" }}>{submitResult.message}</h3>

                {submitResult.pairStatus === "pending" && (
                    <div style={{ padding: "24px", border: "1.5px solid var(--ink)", background: "var(--paper2)" }} className="space-y-4">
                        <p style={{ color: "var(--muted)", fontSize: "14px" }}>Invite your partner <strong style={{ color: "var(--ink)" }}>{formData.partnerUSN}</strong> using this Pair Code:</p>

                        <div style={{
                            fontFamily: "monospace",
                            fontSize: "36px",
                            fontWeight: 800,
                            letterSpacing: "0.2em",
                            color: "var(--ink)",
                            background: "var(--paper)",
                            border: "1.5px solid var(--ink)",
                            padding: "16px",
                        }}>
                            {submitResult.pairCode}
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <button type="button" onClick={() => {
                                const text = `Hi, I've registered us for Idea Lab! Join my team using this code: ${submitResult.pairCode}\n\nLink: https://idealab-seven.vercel.app/join?code=${submitResult.pairCode}`;
                                navigator.clipboard.writeText(text);
                                alert("Copied to clipboard!");
                            }} className="btn-secondary w-full text-sm">
                                <Copy className="w-4 h-4 flex-shrink-0" /> Copy Link
                            </button>
                            <a href={`https://wa.me/?text=${encodeURIComponent(`Hi, I've registered us for Idea Lab! Join my team using this code: ${submitResult.pairCode}\n\nJoin Link: https://idealab-seven.vercel.app/join?code=${submitResult.pairCode}`)}`}
                               target="_blank" rel="noopener noreferrer"
                               className="btn-primary w-full text-sm"
                               style={{ background: "#25D366", color: "#fff" }}>
                                <Share2 className="w-4 h-4 flex-shrink-0" /> WhatsApp
                            </a>
                        </div>
                    </div>
                )}

                {submitResult.pairStatus === "confirmed" && (
                    <div style={{ padding: "16px", border: "1.5px solid #10b981", background: "rgba(16, 185, 129, 0.08)" }}>
                        <p style={{ color: "var(--ink)", fontSize: "13px", fontWeight: 600 }}>Both partners registered — your pair is locked in.</p>
                    </div>
                )}
            </div>
        );
    }

    if (registrationOpen === false) {
        return (
            <div className="text-center p-8 space-y-6 fade-in-up">
                <div style={{ width: 64, height: 64, border: "1.5px solid var(--ink)", display: "grid", placeItems: "center", margin: "0 auto" }}>
                    <Lock style={{ width: 28, height: 28, color: "var(--muted)" }} />
                </div>
                <h3 style={{ fontFamily: "var(--bebas)", fontSize: "28px", color: "var(--ink)" }}>Registrations Closed</h3>
                <p style={{ color: "var(--muted)", fontSize: "14px", maxWidth: "320px", margin: "0 auto", lineHeight: 1.7 }}>
                    The registration window for <strong style={{ color: "var(--ink)" }}>Idea Lab</strong> is currently closed.
                    Please check back later or contact your department admin.
                </p>
            </div>
        );
    }

    if (registrationOpen === null) {
        return <div className="text-center p-12"><div className="spinner mx-auto" /></div>;
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 fade-in-up">
            <div>
                <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)", marginBottom: "8px" }}>Full Name</label>
                <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter your full name"
                    className="input-field"
                    required
                />
            </div>

            <div>
                <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)", marginBottom: "8px" }}>Your USN</label>
                <input
                    type="text"
                    name="usn"
                    value={formData.usn}
                    onChange={handleChange}
                    placeholder="1DB25CS001"
                    className={`input-field ${validation.usn.valid === true ? "success" : validation.usn.valid === false ? "error" : ""}`}
                    maxLength={10}
                    required
                />
                {validation.usn.message && <p style={{ marginTop: "6px", fontSize: "12px", fontWeight: 600, color: validation.usn.valid ? "#10b981" : "var(--red)" }}>{validation.usn.message}</p>}
            </div>

            <div>
                <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)", marginBottom: "8px" }}>Phone Number</label>
                <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="10-digit phone number"
                    className="input-field"
                    maxLength={10}
                    pattern="\d{10}"
                    required
                />
                {formData.phone && !/^\d{10}$/.test(formData.phone) && <p style={{ marginTop: "6px", fontSize: "12px", fontWeight: 600, color: "var(--red)" }}>Enter a valid 10-digit phone number</p>}
            </div>

            <div>
                <label style={{ display: "block", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted)", marginBottom: "8px" }}>
                    Partner&apos;s USN <span style={{ fontWeight: 400, color: "var(--muted)", marginLeft: "8px" }}>(must be same section)</span>
                </label>
                <input
                    type="text"
                    name="partnerUSN"
                    value={formData.partnerUSN}
                    onChange={handleChange}
                    placeholder="1DB25CS002"
                    className={`input-field ${validation.partnerUSN.valid === true ? "success" : validation.partnerUSN.valid === false ? "error" : ""}`}
                    maxLength={10}
                    required
                />
                {validation.partnerUSN.message && <p style={{ marginTop: "6px", fontSize: "12px", fontWeight: 600, color: validation.partnerUSN.valid ? "#10b981" : "var(--red)" }}>{validation.partnerUSN.message}</p>}

                {validation.usn.valid && validation.partnerUSN.valid && formData.usn && formData.partnerUSN && !areSameSection(formData.usn, formData.partnerUSN) && (
                    <p style={{ marginTop: "6px", fontSize: "12px", fontWeight: 600, color: "var(--red)" }}>Partners must be from the same section</p>
                )}
            </div>

            {submitResult && !submitResult.success && (
                <div style={{ padding: "14px 16px", fontSize: "13px", fontWeight: 600, background: "rgba(232, 52, 26, 0.08)", color: "var(--red)", border: "1.5px solid var(--red)" }}>
                    {submitResult.message}
                </div>
            )}

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full" style={{ padding: "16px" }}>
                {isSubmitting ? <><div className="spinner" /> Registering...</> : <><PencilLine className="w-5 h-5"/> Register & Create Pair</>}
            </button>
        </form>
    );
}
