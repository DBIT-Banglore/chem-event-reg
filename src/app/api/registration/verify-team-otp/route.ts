import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/jwt";
import { rateLimit, getClientIP } from "@/lib/rate-limit";
import { FieldValue } from "firebase-admin/firestore";

const MAX_ATTEMPTS = 5;
const OTP_EXPIRY_HOURS = 24;

export async function POST(req: NextRequest) {
  try {
    const payload = await getSessionFromRequest(req);
    if (!payload?.usn) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const sessionUSN = (payload.usn as string).toUpperCase();

    const ip = getClientIP(req);
    const { allowed, retryAfterMs } = rateLimit(ip, "verify-team-otp", 10, 15 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many attempts. Please try again in ${Math.ceil(retryAfterMs / 1000)} seconds.` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { otp, teamId, memberUSN: rawMemberUSN } = body;

    if (!otp || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: "OTP must be a 6-digit code" }, { status: 400 });
    }
    if (!teamId) {
      return NextResponse.json({ error: "Team ID is required" }, { status: 400 });
    }

    // Determine which member's OTP to verify
    const targetUSN = rawMemberUSN ? (rawMemberUSN as string).toUpperCase() : sessionUSN;

    const adminDb = getAdminFirestore();

    const teamDoc = await adminDb.collection("teams").doc(teamId).get();
    if (!teamDoc.exists) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
    const teamData = teamDoc.data()!;

    // Auth check: session user must be team leader OR the target member themselves
    if (targetUSN !== sessionUSN && teamData.leaderUSN !== sessionUSN) {
      return NextResponse.json(
        { error: "Only the team leader can verify OTPs on behalf of other members" },
        { status: 403 }
      );
    }

    if (!teamData.memberUSNs.includes(targetUSN)) {
      return NextResponse.json({ error: "This USN is not a member of this team" }, { status: 403 });
    }

    // Check if non-leader member is already in a different team
    if (targetUSN !== teamData.leaderUSN) {
      const memberRegRef = adminDb.collection("registrations").doc(targetUSN);
      const memberRegDoc = await memberRegRef.get();
      if (memberRegDoc.exists) {
        const existingTeamId = memberRegDoc.data()?.teamId;
        if (existingTeamId && existingTeamId !== teamId) {
          return NextResponse.json(
            { error: "This member is already part of another team" },
            { status: 400 }
          );
        }
      }
    }

    // Check if already verified
    if (teamData.otpVerificationStatus?.[targetUSN] === true) {
      return NextResponse.json({
        success: true,
        verified: true,
        alreadyVerified: true,
        teamId,
        teamStatus: teamData.status,
        otpVerificationStatus: teamData.otpVerificationStatus,
        allMembersVerified: Object.values(teamData.otpVerificationStatus || {}).every(Boolean),
        message: "This member is already verified.",
      });
    }

    // Check team creation window
    const createdAt = teamData.createdAt?.toDate?.();
    if (createdAt) {
      const hoursSince = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
      if (hoursSince > OTP_EXPIRY_HOURS) {
        await adminDb.collection("teams").doc(teamId).update({
          status: "cancelled",
          updatedAt: FieldValue.serverTimestamp(),
        });
        return NextResponse.json(
          { error: "Team verification window has expired. Please create a new team." },
          { status: 400 }
        );
      }
    }

    // Lookup member email (required to find OTP code stored by email)
    let memberEmail: string | null = null;
    const memberRegDoc = await adminDb.collection("registrations").doc(targetUSN).get();
    if (memberRegDoc.exists) {
      memberEmail = memberRegDoc.data()!.email || null;
    }
    if (!memberEmail) {
      const memberStudentDoc = await adminDb.collection("students").doc(targetUSN).get();
      if (memberStudentDoc.exists) {
        memberEmail = memberStudentDoc.data()!.email || null;
      }
    }
    if (!memberEmail) {
      return NextResponse.json({ error: "Member email not found in database" }, { status: 404 });
    }

    // Find the most recent unused OTP by email + teamId
    const otpSnap = await adminDb
      .collection("otp_codes")
      .where("email", "==", memberEmail)
      .where("used", "==", false)
      .where("teamId", "==", teamId)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (otpSnap.empty) {
      return NextResponse.json(
        { error: "No verification code found. Please ask the team leader to resend the OTP." },
        { status: 400 }
      );
    }

    const otpDocRef = otpSnap.docs[0].ref;
    const otpData = otpSnap.docs[0].data();

    if (Date.now() > otpData.expiresAt) {
      await otpDocRef.update({ used: true });
      return NextResponse.json(
        { error: "Code expired. Please ask the team leader to resend the OTP." },
        { status: 400 }
      );
    }

    if (otpData.attempts >= MAX_ATTEMPTS) {
      await otpDocRef.update({ used: true });
      return NextResponse.json(
        { error: "Too many attempts. Please ask the team leader to resend the OTP." },
        { status: 400 }
      );
    }

    if (otpData.otp !== otp.trim()) {
      await otpDocRef.update({ attempts: FieldValue.increment(1) });
      return NextResponse.json({ error: "Invalid code. Please try again." }, { status: 400 });
    }

    // Mark OTP as used
    await otpDocRef.update({ used: true, verifiedAt: Date.now() });

    // Update team verification status
    const updatedStatus = { ...teamData.otpVerificationStatus, [targetUSN]: true };
    const allMembersVerified = Object.values(updatedStatus).every(Boolean);

    const teamUpdate: Record<string, unknown> = {
      otpVerificationStatus: updatedStatus,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (allMembersVerified) {
      teamUpdate.status = "verified";
    }

    await adminDb.collection("teams").doc(teamId).update(teamUpdate);

    // Update member's registration record with pending team info
    const memberRegRef = adminDb.collection("registrations").doc(targetUSN);
    const existingRegDoc = await memberRegRef.get();
    if (existingRegDoc.exists) {
      await memberRegRef.update({
        teamId,
        teamEventId: teamData.eventId,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({
      success: true,
      verified: true,
      teamId,
      teamStatus: allMembersVerified ? "verified" : "pending",
      teamName: teamData.teamName,
      memberUSNs: teamData.memberUSNs,
      otpVerificationStatus: updatedStatus,
      allMembersVerified,
      message: allMembersVerified
        ? "All team members verified! You can now proceed to payment."
        : "OTP verified. Waiting for other team members to verify.",
    });
  } catch (err) {
    console.error("[POST /api/registration/verify-team-otp]", err);
    return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 500 });
  }
}
