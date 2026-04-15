import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/jwt";
import { rateLimit, getClientIP } from "@/lib/rate-limit";
import { generateOTP, buildEmailHtml, sendEmailWithFallback } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const payload = await getSessionFromRequest(req);
    if (!payload?.usn) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const sessionUSN = (payload.usn as string).toUpperCase();

    const body = await req.json();
    const { teamId, memberUSN: rawMemberUSN } = body;

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 });
    }
    if (!rawMemberUSN) {
      return NextResponse.json({ error: "memberUSN is required" }, { status: 400 });
    }
    const memberUSN = (rawMemberUSN as string).toUpperCase();

    const db = getAdminFirestore();

    const teamDoc = await db.collection("teams").doc(teamId).get();
    if (!teamDoc.exists) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
    const teamData = teamDoc.data()!;

    // Only the team leader can resend OTPs
    if (teamData.leaderUSN !== sessionUSN) {
      return NextResponse.json({ error: "Only the team leader can resend OTPs" }, { status: 403 });
    }

    // Don't allow resend for leader (auto-verified)
    if (memberUSN === teamData.leaderUSN) {
      return NextResponse.json({ error: "Team leader is auto-verified and does not need an OTP" }, { status: 400 });
    }

    // Check member is in team
    if (!teamData.memberUSNs.includes(memberUSN)) {
      return NextResponse.json({ error: "This USN is not a member of this team" }, { status: 400 });
    }

    // Look up member email
    let memberEmail: string | null = null;
    const memberRegDoc = await db.collection("registrations").doc(memberUSN).get();
    if (memberRegDoc.exists) {
      memberEmail = memberRegDoc.data()!.email || null;
    }
    if (!memberEmail) {
      const memberStudentDoc = await db.collection("students").doc(memberUSN).get();
      if (memberStudentDoc.exists) {
        memberEmail = memberStudentDoc.data()!.email || null;
      }
    }
    if (!memberEmail) {
      return NextResponse.json({ error: "Member email not found in database" }, { status: 404 });
    }

    // Rate limit: max 5 resends per IP per 60 seconds
    const ip = getClientIP(req);
    const rl = rateLimit(ip, "resend-team-otp", 5, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Too many requests. Please wait ${Math.ceil(rl.retryAfterMs / 1000)} seconds.` },
        { status: 429 }
      );
    }

    // Check for recent unused OTP for same email + teamId (60s cooldown)
    const now = Date.now();
    const recentSnap = await db
      .collection("otp_codes")
      .where("email", "==", memberEmail)
      .where("used", "==", false)
      .where("teamId", "==", teamId)
      .where("createdAt", ">", now - 60 * 1000)
      .limit(1)
      .get();

    if (!recentSnap.empty) {
      return NextResponse.json(
        { error: "Please wait 60 seconds before resending the OTP." },
        { status: 429 }
      );
    }

    // Generate new OTP and store in Firestore
    const otp = generateOTP();
    await db.collection("otp_codes").add({
      email: memberEmail,
      otp,
      expiresAt: now + 10 * 60 * 1000,
      used: false,
      attempts: 0,
      createdAt: now,
      teamId,
    });

    // Send email
    const baseUrl = req.nextUrl.origin;
    await sendEmailWithFallback(
      memberEmail,
      `${otp} is your ChemNova 2026 team verification code`,
      buildEmailHtml(otp, baseUrl, { teamName: String(teamData.teamName) })
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/registration/resend-team-otp]", err);
    return NextResponse.json({ error: "Failed to resend OTP. Please try again." }, { status: 500 });
  }
}
