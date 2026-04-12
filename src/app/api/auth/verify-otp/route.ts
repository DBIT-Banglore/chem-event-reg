import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore, getAdminAuth } from "@/lib/firebase-admin";
import { signSessionJWT, COOKIE_NAME } from "@/lib/jwt";
import { rateLimit, getClientIP } from "@/lib/rate-limit";
import { validateUSN, getBranchName, getSection } from "@/lib/usnValidator";

const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  try {
    const { email, otp, usn } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email, OTP, and USN are required" }, { status: 400 });
    }
    if (!otp || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: "OTP must be a 6-digit code" }, { status: 400 });
    }
    if (!usn || typeof usn !== "string") {
      return NextResponse.json({ error: "Email, OTP, and USN are required" }, { status: 400 });
    }

    // IP rate limiting: 10 attempts per IP per 15 min
    const ip = getClientIP(req);
    const { allowed, retryAfterMs } = rateLimit(ip, "verify-otp", 10, 15 * 60 * 1000);
    if (!allowed) {
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      return NextResponse.json(
        { error: `Too many attempts. Please try again in ${retryAfterSec} seconds.` },
        { status: 429 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUSN = usn.trim().toUpperCase();
    const adminDb = getAdminFirestore();

    // Validate USN against local CSV-derived list
    const usnCheck = validateUSN(cleanUSN);
    if (!usnCheck.valid) {
      return NextResponse.json(
        { error: "Invalid USN or email combination." },
        { status: 400 }
      );
    }

    // Look up student/registration in Firebase for email match and user data
    const [studentDoc, regDoc] = await Promise.all([
      adminDb.collection("students").doc(cleanUSN).get(),
      adminDb.collection("registrations").doc(cleanUSN).get(),
    ]);

    // If student exists in Firebase, verify email matches
    const storedEmail = (regDoc.exists ? regDoc.data()?.email : studentDoc.exists ? studentDoc.data()?.email : null);
    if (storedEmail && storedEmail.trim().toLowerCase() !== cleanEmail) {
      return NextResponse.json(
        { error: "Invalid USN or email combination." },
        { status: 400 }
      );
    }

    // Find the most recent unused OTP for this email
    const otpSnap = await adminDb
      .collection("otp_codes")
      .where("email", "==", cleanEmail)
      .where("used", "==", false)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (otpSnap.empty) {
      return NextResponse.json(
        { error: "No verification code found. Please request a new one." },
        { status: 400 }
      );
    }

    const otpDocRef = otpSnap.docs[0].ref;
    const otpData = otpSnap.docs[0].data();

    // Check expiry
    if (Date.now() > otpData.expiresAt) {
      await otpDocRef.update({ used: true });
      return NextResponse.json(
        { error: "Code expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Check attempts
    if (otpData.attempts >= MAX_ATTEMPTS) {
      await otpDocRef.update({ used: true });
      return NextResponse.json(
        { error: "Too many attempts. Please request a new code." },
        { status: 400 }
      );
    }

    // Verify OTP
    if (otpData.otp !== otp.trim()) {
      await otpDocRef.update({ attempts: otpData.attempts + 1 });
      return NextResponse.json(
        { error: "Invalid code. Please try again." },
        { status: 400 }
      );
    }

    // Mark as used
    await otpDocRef.update({ used: true, verifiedAt: Date.now() });

    // Build user data from registration, student record, or local CSV data
    const source = regDoc.exists ? regDoc.data()! : studentDoc.exists ? studentDoc.data()! : null;
    const userData = {
      usn: cleanUSN,
      name: source?.name || "",
      email: cleanEmail,
      branch: source?.branch || getBranchName(cleanUSN),
      section: source?.section || getSection(cleanUSN),
      eventId: (regDoc.exists && source?.eventId) || null,
    };

    // Create JWT session token
    const jwt = await signSessionJWT({
      usn: userData.usn,
      name: userData.name,
      email: userData.email,
      branch: userData.branch,
      section: userData.section,
    });

    // Create Firebase custom token for client-side Firestore auth
    const customToken = await getAdminAuth().createCustomToken(cleanUSN);

    // Build response with Set-Cookie
    const response = NextResponse.json({
      success: true,
      customToken,
      user: userData,
    });

    response.cookies.set(COOKIE_NAME, jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (err) {
    console.error("Verify OTP error:", err);
    return NextResponse.json(
      { error: "Verification failed. Please try again." },
      { status: 500 }
    );
  }
}
