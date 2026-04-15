"use client";

import { useState } from "react";
import { validateUSN } from "@/lib/usnValidator";
import { AlertCircle, Users, IndianRupee, X, Plus } from "lucide-react";

interface TeamRegistrationFormProps {
  eventId: string;
  eventName: string;
  teamSize: number;
  price: number;
  leaderUSN: string;
  onSubmit: (teamName: string, memberUSNs: string[]) => Promise<void>;
  onCancel: () => void;
}

export default function TeamRegistrationForm({
  eventId,
  eventName,
  teamSize,
  price,
  leaderUSN,
  onSubmit,
  onCancel,
}: TeamRegistrationFormProps) {
  const [teamName, setTeamName] = useState("");
  const [memberUSNs, setMemberUSNs] = useState<string[]>([]);
  const [newMemberUSN, setNewMemberUSN] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const membersNeeded = teamSize - 1; // leader is auto-included
  const canAddMore = memberUSNs.length < membersNeeded;
  const totalPrice = price * teamSize;
  const isFree = price === 0;
  const isReady = memberUSNs.length === membersNeeded && teamName.trim().length > 0;

  const handleAddMember = () => {
    const clean = newMemberUSN.trim().toUpperCase();
    if (!clean) return;
    if (clean === leaderUSN.toUpperCase()) {
      setError("You are already the team leader — don't add your own USN.");
      return;
    }
    if (!validateUSN(clean).valid) {
      setError(`Invalid USN format: ${clean}`);
      return;
    }
    if (memberUSNs.includes(clean)) {
      setError("This USN is already added");
      return;
    }
    if (!canAddMore) {
      setError(`Maximum ${membersNeeded} additional members allowed`);
      return;
    }
    setMemberUSNs((prev) => [...prev, clean]);
    setNewMemberUSN("");
    setError("");
  };

  const handleRemoveMember = (usn: string) => {
    setMemberUSNs((prev) => prev.filter((u) => u !== usn));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) { setError("Team name is required"); return; }
    if (memberUSNs.length !== membersNeeded) {
      setError(`Exactly ${membersNeeded} additional member USNs required (you + ${membersNeeded} = ${teamSize} total)`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onSubmit(teamName.trim(), memberUSNs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setLoading(false);
    }
  };

  // suppress unused warning
  void eventId;

  return (
    <div className="glass-card fade-in-up" style={{ padding: "24px", marginBottom: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
        <div>
          <h3 style={{ fontFamily: "var(--bebas)", fontSize: "22px", letterSpacing: "0.06em", marginBottom: "4px" }}>
            CREATE TEAM
          </h3>
          <p style={{ fontSize: "12px", color: "var(--muted)" }}>{eventName}</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "4px", display: "flex", alignItems: "center" }}
        >
          <X style={{ width: 18, height: 18 }} />
        </button>
      </div>

      {/* Info row */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "20px", padding: "12px 16px", background: "var(--paper2)", border: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Users style={{ width: 14, height: 14, color: "var(--muted)" }} />
          <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)" }}>{teamSize} members total</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <IndianRupee style={{ width: 14, height: 14, color: "var(--muted)" }} />
          <span style={{ fontSize: "12px", fontWeight: 700, color: isFree ? "#16a34a" : "var(--ink)" }}>
            {isFree ? "FREE" : `\u20b9${totalPrice} total (\u20b9${price} \u00d7 ${teamSize})`}
          </span>
        </div>
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", background: "rgba(232,52,26,0.08)", border: "1.5px solid var(--red)", color: "var(--red)", fontSize: "12px", fontWeight: 600, marginBottom: "16px" }}>
          <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Team name */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)", marginBottom: "8px" }}>
            Team Name *
          </label>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Enter a unique team name"
            maxLength={40}
            required
            style={{ width: "100%", padding: "10px 14px", background: "var(--paper2)", border: "1.5px solid var(--line)", color: "var(--ink)", fontSize: "14px", fontFamily: "var(--body)", outline: "none", boxSizing: "border-box" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--ink)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--line)"; }}
          />
        </div>

        {/* Members */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <label style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)" }}>
              Team Members * ({memberUSNs.length}/{membersNeeded} added)
            </label>
            <span style={{ fontSize: "10px", color: "var(--muted)" }}>You are added as leader</span>
          </div>

          {/* Add member input */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            <input
              type="text"
              value={newMemberUSN}
              onChange={(e) => setNewMemberUSN(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddMember(); } }}
              placeholder="Enter member USN"
              maxLength={12}
              disabled={!canAddMore}
              style={{ flex: 1, padding: "10px 14px", background: "var(--paper2)", border: "1.5px solid var(--line)", color: "var(--ink)", fontSize: "13px", fontFamily: "monospace", outline: "none", opacity: canAddMore ? 1 : 0.5 }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--ink)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--line)"; }}
            />
            <button
              type="button"
              onClick={handleAddMember}
              disabled={!canAddMore || !newMemberUSN.trim()}
              className="btn-secondary"
              style={{ padding: "10px 16px", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px", opacity: (canAddMore && newMemberUSN.trim()) ? 1 : 0.5 }}
            >
              <Plus style={{ width: 14, height: 14 }} /> Add
            </button>
          </div>

          {/* Member list */}
          {memberUSNs.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {memberUSNs.map((usn, idx) => (
                <div key={usn} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: "var(--paper2)", border: "1.5px solid var(--line)" }}>
                  <div>
                    <span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{usn}</span>
                    <span style={{ fontSize: "10px", color: "var(--muted)", marginLeft: "8px" }}>Member {idx + 1}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(usn)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "2px", display: "flex", alignItems: "center" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--red)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; }}
                  >
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {memberUSNs.length === 0 && (
            <p style={{ fontSize: "12px", color: "var(--muted)", textAlign: "center", padding: "16px 0" }}>
              Add {membersNeeded} team member{membersNeeded !== 1 ? "s" : ""} by USN
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !isReady}
          className="btn-primary"
          style={{ width: "100%", padding: "14px", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", opacity: isReady ? 1 : 0.6 }}
        >
          {loading ? (
            <><div className="spinner" style={{ width: 16, height: 16 }} /> Creating team&hellip;</>
          ) : (
            <><Users style={{ width: 16, height: 16 }} /> Create Team &amp; Send OTPs</>
          )}
        </button>
      </form>
    </div>
  );
}
