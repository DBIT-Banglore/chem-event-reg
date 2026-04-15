import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireAdmin, adminErrStatus } from "@/lib/admin-auth";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  try {
    const idToken = req.headers.get("x-admin-token") || "";
    await requireAdmin(idToken);

    const db = getAdminFirestore();
    const [teamsSnap, studentsSnap, eventsSnap] = await Promise.all([
      db.collection("teams").orderBy("createdAt", "desc").get().catch(() => db.collection("teams").get()),
      db.collection("students").get(),
      db.collection("events").get(),
    ]);

    // Build USN → name map for enrichment
    const nameMap = new Map<string, string>();
    studentsSnap.docs.forEach((d) => {
      const data = d.data();
      nameMap.set(data.usn || d.id, data.name || "");
    });

    // Build eventId → name map
    const eventNameMap = new Map<string, string>();
    eventsSnap.docs.forEach((d) => {
      eventNameMap.set(d.id, d.data().name || d.id);
    });

    const teams = teamsSnap.docs.map((d) => {
      const t = d.data();
      const memberUSNs: string[] = t.memberUSNs || [];
      const eid = t.eventId || "";
      return {
        teamId: d.id,
        teamName: t.teamName || "",
        eventId: eid,
        eventName: eventNameMap.get(eid) || eid,
        leaderUSN: t.leaderUSN || "",
        leaderName: t.leaderName || nameMap.get(t.leaderUSN) || "",
        leaderEmail: t.leaderEmail || "",
        leaderPhone: t.leaderPhone || "",
        memberUSNs,
        memberNames: memberUSNs.map((u) => nameMap.get(u) || u),
        memberCount: t.memberCount || memberUSNs.length,
        status: t.status || "pending",
        otpVerificationStatus: t.otpVerificationStatus || {},
        paymentId: t.paymentId || null,
        paymentStatus: t.paymentStatus || null,
        totalAmount: t.totalAmount ?? null,
        createdAt: t.createdAt?.toDate?.()?.toISOString() || null,
      };
    });

    return NextResponse.json({ teams });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fetch failed" },
      { status: adminErrStatus(err) }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const idToken = req.headers.get("x-admin-token") || "";
    await requireAdmin(idToken);

    const body = await req.json();
    const { teamId, action } = body;
    if (!teamId || !action) {
      return NextResponse.json({ error: "teamId and action are required" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const teamRef = db.collection("teams").doc(teamId);
    const teamDoc = await teamRef.get();
    if (!teamDoc.exists) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
    const team = teamDoc.data()!;

    // ── Update team name ────────────────────────────────────────────────────
    if (action === "update-name") {
      const { teamName } = body;
      if (!teamName?.trim()) return NextResponse.json({ error: "Team name required" }, { status: 400 });
      await teamRef.update({ teamName: teamName.trim(), updatedAt: FieldValue.serverTimestamp() });
      return NextResponse.json({ success: true });
    }

    // ── Set team status ──────────────────────────────────────────────────────
    if (action === "set-status") {
      const { status } = body;
      const valid = ["pending", "verified", "paid", "complete", "cancelled"];
      if (!valid.includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      await teamRef.update({ status, updatedAt: FieldValue.serverTimestamp() });
      return NextResponse.json({ success: true });
    }

    // ── Remove a member ──────────────────────────────────────────────────────
    if (action === "remove-member") {
      const usn = body.memberUSN || body.usn;
      if (!usn) return NextResponse.json({ error: "USN required" }, { status: 400 });
      if (usn === team.leaderUSN) {
        return NextResponse.json({ error: "Cannot remove team leader. Delete the team instead." }, { status: 400 });
      }

      const updatedMembers: string[] = (team.memberUSNs as string[]).filter((u) => u !== usn);
      const updatedOtpStatus = { ...(team.otpVerificationStatus || {}) };
      delete updatedOtpStatus[usn];

      const allVerified = updatedMembers.every((u) => updatedOtpStatus[u] === true);

      const batch = db.batch();
      batch.update(teamRef, {
        memberUSNs: updatedMembers,
        memberCount: updatedMembers.length,
        otpVerificationStatus: updatedOtpStatus,
        status: allVerified ? "verified" : "pending",
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Clear member's teamId/teamEventId in their registration doc
      const memberRegRef = db.collection("registrations").doc(usn);
      const memberRegDoc = await memberRegRef.get();
      if (memberRegDoc.exists && memberRegDoc.data()?.teamId === teamId) {
        batch.update(memberRegRef, {
          teamId: null,
          teamEventId: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();
      return NextResponse.json({ success: true, memberUSNs: updatedMembers });
    }

    // ── Add a member ─────────────────────────────────────────────────────────
    if (action === "add-member") {
      const usn = body.memberUSN || body.usn;
      if (!usn) return NextResponse.json({ error: "USN required" }, { status: 400 });
      const cleanUSN = (usn as string).trim().toUpperCase();

      const currentMembers: string[] = team.memberUSNs || [];
      if (currentMembers.includes(cleanUSN)) {
        return NextResponse.json({ error: "This USN is already a member of this team" }, { status: 400 });
      }

      // Check the student exists in the students collection
      const studentDoc = await db.collection("students").doc(cleanUSN).get();
      if (!studentDoc.exists) {
        return NextResponse.json({ error: `USN ${cleanUSN} is not in the student database` }, { status: 400 });
      }

      // Check they're not in another team for the same event
      const existingReg = await db.collection("registrations").doc(cleanUSN).get();
      if (existingReg.exists) {
        const existingTeamId = existingReg.data()?.teamId;
        if (existingTeamId && existingTeamId !== teamId) {
          return NextResponse.json({ error: `${cleanUSN} is already in another team` }, { status: 400 });
        }
      }

      const updatedMembers = [...currentMembers, cleanUSN];
      const updatedOtpStatus = { ...(team.otpVerificationStatus || {}), [cleanUSN]: false };

      await teamRef.update({
        memberUSNs: updatedMembers,
        memberCount: updatedMembers.length,
        otpVerificationStatus: updatedOtpStatus,
        status: "pending",
        updatedAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({ success: true, memberUSNs: updatedMembers });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: adminErrStatus(err) }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const idToken = req.headers.get("x-admin-token") || "";
    await requireAdmin(idToken);

    const { searchParams } = req.nextUrl;
    const teamId = searchParams.get("teamId");
    if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 });

    const db = getAdminFirestore();
    const teamRef = db.collection("teams").doc(teamId);
    const teamDoc = await teamRef.get();
    if (!teamDoc.exists) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    const team = teamDoc.data()!;
    const memberUSNs: string[] = team.memberUSNs || [];

    const batch = db.batch();
    batch.delete(teamRef);

    // Clear teamId/teamEventId for all members
    for (const usn of memberUSNs) {
      const regRef = db.collection("registrations").doc(usn);
      const regDoc = await regRef.get();
      if (regDoc.exists && regDoc.data()?.teamId === teamId) {
        batch.update(regRef, {
          teamId: null,
          teamEventId: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    // If event had a registrationCount increment, decrement it back (only for paid teams)
    if (team.status === "paid" || team.status === "complete") {
      const eventRef = db.collection("events").doc(team.eventId);
      batch.update(eventRef, {
        registrationCount: FieldValue.increment(-memberUSNs.length),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: adminErrStatus(err) }
    );
  }
}
