import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/jwt";
import { rateLimit, getClientIP } from "@/lib/rate-limit";
import { FieldValue } from "firebase-admin/firestore";
import { validateUSN } from "@/lib/usnValidator";
import { generateOTP, buildEmailHtml, sendEmailWithFallback } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    // Auth check via JWT
    const payload = await getSessionFromRequest(req);
    if (!payload?.usn) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const leaderUSN = (payload.usn as string).toUpperCase();

    // Rate limit: 5 team creation attempts per IP per hour
    const ip = getClientIP(req);
    const rl = rateLimit(ip, "create-team", 5, 60 * 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await req.json();
    const { eventId, teamName, memberUSNs } = body;

    // Input validation
    if (!eventId) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
    }
    if (!teamName?.trim()) {
      return NextResponse.json({ error: "Team name is required" }, { status: 400 });
    }
    if (!memberUSNs || !Array.isArray(memberUSNs) || memberUSNs.length === 0) {
      return NextResponse.json({ error: "At least one team member is required" }, { status: 400 });
    }

    // Reject if leader tries to add themselves
    const upperMemberUSNs = memberUSNs.map((u: string) => u.toUpperCase());
    if (upperMemberUSNs.includes(leaderUSN)) {
      return NextResponse.json({ error: "You cannot add yourself as a member — you are already the team leader." }, { status: 400 });
    }

    // Add leader to member list (leader is always first)
    const allMemberUSNs = [leaderUSN, ...new Set(upperMemberUSNs)];

    const db = getAdminFirestore();

    // Validate event exists and is team type
    const eventDoc = await db.collection("events").doc(eventId).get();
    if (!eventDoc.exists) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const eventData = eventDoc.data();
    if (eventData?.eventType !== "team") {
      return NextResponse.json({ error: "This event is not a team event" }, { status: 400 });
    }
    if (!eventData?.isActive) {
      return NextResponse.json({ error: "Event is not currently active" }, { status: 400 });
    }
    if (eventData?.registrationCount >= eventData?.capacity) {
      return NextResponse.json({ error: "Event is already full" }, { status: 400 });
    }

    // Validate team size matches event requirements
    const requiredTeamSize = eventData?.teamSize;
    if (requiredTeamSize && allMemberUSNs.length !== requiredTeamSize) {
      return NextResponse.json(
        { error: `This event requires exactly ${requiredTeamSize} members (including you). You have ${allMemberUSNs.length}.` },
        { status: 400 }
      );
    }

    // Validate all USN formats
    for (const usn of allMemberUSNs) {
      const usnCheck = validateUSN(usn);
      if (!usnCheck.valid) {
        return NextResponse.json({ error: `Invalid USN format: ${usn}` }, { status: 400 });
      }
    }

    // Validate all USNs exist in student database
    const studentDocs = await Promise.all(
      allMemberUSNs.map((usn) => db.collection("students").doc(usn).get())
    );

    const invalidUSNs = allMemberUSNs.filter((usn, index) => !studentDocs[index].exists);
    if (invalidUSNs.length > 0) {
      return NextResponse.json(
        { error: `USN(s) not found in student database: ${invalidUSNs.join(", ")}` },
        { status: 400 }
      );
    }

    // Check team leader eligibility (not already registered for team event)
    const leaderRegDoc = await db.collection("registrations").doc(leaderUSN).get();
    if (leaderRegDoc.exists && (leaderRegDoc.data()?.teamEventId || leaderRegDoc.data()?.teamId)) {
      return NextResponse.json({ error: "You are already registered for a team event" }, { status: 400 });
    }

    // Check if any members are already in teams for this event
    const existingTeams = await db
      .collection("teams")
      .where("eventId", "==", eventId)
      .where("status", "in", ["pending", "verified", "paid", "complete"])
      .get();

    const conflictingUSNs = [];
    for (const team of existingTeams.docs) {
      const teamData = team.data();
      const memberIntersection = teamData.memberUSNs.filter((usn: string) => allMemberUSNs.includes(usn));
      if (memberIntersection.length > 0) {
        conflictingUSNs.push(...memberIntersection);
      }
    }

    if (conflictingUSNs.length > 0) {
      return NextResponse.json(
        { error: `Some members are already registered for this event: ${[...new Set(conflictingUSNs)].join(", ")}` },
        { status: 400 }
      );
    }

    // Get leader details from registration or student data
    let leaderData;
    if (leaderRegDoc.exists) {
      leaderData = leaderRegDoc.data();
    } else {
      const leaderStudentDoc = await db.collection("students").doc(leaderUSN).get();
      leaderData = leaderStudentDoc.data();
    }

    // Create team record
    const teamId = `TEAM-${Date.now()}`;
    const otpVerificationStatus: Record<string, boolean> = {};
    allMemberUSNs.forEach((usn) => {
      otpVerificationStatus[usn] = false;
    });
    otpVerificationStatus[leaderUSN] = true; // leader auto-verified

    await db.collection("teams").doc(teamId).set({
      teamId,
      teamName: teamName.trim(),
      eventId,
      leaderUSN,
      leaderName: leaderData?.name || "",
      leaderEmail: leaderData?.email || "",
      leaderPhone: leaderData?.phone || "",
      memberUSNs: allMemberUSNs,
      memberCount: allMemberUSNs.length,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      otpVerificationStatus,
    });

    // Update leader's registration with pending team info
    if (leaderRegDoc.exists) {
      await db.collection("registrations").doc(leaderUSN).update({
        teamId: teamId,
        teamEventId: eventId,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Trigger OTP sending to all team members (skip leader — auto-verified)
    try {
      const baseUrl = req.nextUrl.origin;
      const otpPromises = allMemberUSNs
        .filter((usn) => usn !== leaderUSN)
        .map(async (memberUSN) => {
          const memberDoc = await db.collection("students").doc(memberUSN).get();
          if (!memberDoc.exists) return;
          const memberEmail = memberDoc.data()!.email;
          if (!memberEmail) return;

          const otp = generateOTP();
          const now = Date.now();
          await db.collection("otp_codes").add({
            email: memberEmail,
            otp,
            expiresAt: now + 10 * 60 * 1000,
            used: false,
            attempts: 0,
            createdAt: now,
            teamId,
          });

          await sendEmailWithFallback(
            memberEmail,
            `${otp} is your ChemNova 2026 team verification code`,
            buildEmailHtml(otp, baseUrl, { teamName: teamName.trim() })
          );
        });
      await Promise.all(otpPromises);
    } catch (otpError) {
      console.error("[create-team] OTP sending error:", otpError);
      // Don't fail team creation if OTP sending fails partially
      // Team leader can retry OTP verification
    }

    return NextResponse.json({
      success: true,
      teamId,
      teamName: teamName.trim(),
      memberUSNs: allMemberUSNs,
      memberCount: allMemberUSNs.length,
      status: "pending",
      message: `Team created successfully. OTPs have been sent to all team members. Please verify your OTPs within 24 hours.`
    });
  } catch (err) {
    console.error("[POST /api/registration/create-team]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create team" }, { status: 500 });
  }
}