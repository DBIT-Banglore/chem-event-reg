import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { rateLimit, getClientIP } from "@/lib/rate-limit";
import { validateUSN, getBranchName, getSection } from "@/lib/usnValidator";
import { generateOTP, sendEmailWithFallback, maskEmail, buildEmailHtml } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { usn, sendOtp, teamId, teamName } = await req.json();

    if (!usn || typeof usn !== "string") {
      return NextResponse.json({ error: "USN is required" }, { status: 400 });
    }

    const cleanUSN = usn.trim().toUpperCase();

    if (!/^[A-Z0-9]{6,12}$/.test(cleanUSN)) {
      return NextResponse.json({ error: "Invalid USN format." }, { status: 400 });
    }

    const adminDb = getAdminFirestore();

    // Check if student is in database (students or registrations)
    const [studentDoc, regDoc] = await Promise.all([
      adminDb.collection("students").doc(cleanUSN).get(),
      adminDb.collection("registrations").doc(cleanUSN).get(),
    ]);

    // Get student info - prioritise registration data if exists
    let studentData = null;
    let emailToSend = null;

    if (regDoc.exists) {
      studentData = regDoc.data()!;
      emailToSend = studentData.email;
    } else if (studentDoc.exists) {
      studentData = studentDoc.data()!;
      emailToSend = studentData.email;
    }

    // If no student data found - return error
    if (!studentData || !emailToSend) {
      return NextResponse.json({
        found: false,
        error: "USN not found in student database. Contact your admin to upload student CSV.",
      });
    }

    // If just looking up USN (not sending OTP), return student info
    if (!sendOtp) {
      return NextResponse.json({
        success: true,
        student: {
          usn: cleanUSN,
          name: studentData.name || "",
          email: emailToSend,
          maskedEmail: maskEmail(emailToSend),
          branch: studentData.branch || "",
          section: studentData.section || "",
        },
        otpSent: false,
      });
    }

    // IP rate limiting: 5 sends per IP per 15 min
    const ip = getClientIP(req);
    const perMin = rateLimit(ip, "send-otp-min", 5, 60 * 1000);
    if (!perMin.allowed) {
      const sec = Math.ceil(perMin.retryAfterMs / 1000);
      return NextResponse.json(
        { error: `Too many requests. Please wait ${sec}s before trying again.` },
        { status: 429 }
      );
    }
    const perHour = rateLimit(ip, "send-otp-hr", 30, 60 * 60 * 1000);
    if (!perHour.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in an hour." },
        { status: 429 }
      );
    }

    const otp = generateOTP();
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000;

    // Rate limit: max 1 OTP per email per 60 seconds
    const recentSnap = await adminDb
      .collection("otp_codes")
      .where("email", "==", emailToSend)
      .where("used", "==", false)
      .where("createdAt", ">", now - 60 * 1000)
      .limit(1)
      .get();

    if (!recentSnap.empty) {
      return NextResponse.json(
        { error: "Please wait 60 seconds before requesting another code." },
        { status: 429 }
      );
    }

    // Store OTP in Firestore (admin SDK)
    await adminDb.collection("otp_codes").add({
      email: emailToSend,
      otp,
      expiresAt,
      used: false,
      attempts: 0,
      createdAt: now,
      teamId: teamId || null,
    });

    // Send email with round-robin + fallback
    const baseUrl = req.nextUrl.origin;
    await sendEmailWithFallback(
      emailToSend,
      `${otp} is your ChemNova 2026 verification code`,
      buildEmailHtml(otp, baseUrl, teamName ? { teamName } : undefined)
    );

    return NextResponse.json({
      success: true,
      student: {
        usn: cleanUSN,
        name: studentData.name || "",
        email: emailToSend,
        maskedEmail: maskEmail(emailToSend),
        branch: studentData.branch || "",
        section: studentData.section || "",
      },
      otpSent: true,
      teamContext: teamId ? { teamId, teamName: teamName || "" } : null,
    });
  } catch (err) {
    console.error("Send OTP error:", err);
    return NextResponse.json(
      { error: "Failed to send verification code. Please try again." },
      { status: 500 }
    );
  }
}
