import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/jwt";
import { rateLimit, getClientIP } from "@/lib/rate-limit";
import { getBranchName, getSection, validateUSN } from "@/lib/usnValidator";
import { FieldValue } from "firebase-admin/firestore";

const NAME_MAX = 100;
const PHONE_RE = /^\d{10}$/;

export async function POST(req: NextRequest) {
  try {
    // Must be authenticated (OTP already verified)
    const payload = await getSessionFromRequest(req);
    if (!payload?.usn) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const usn = (payload.usn as string).toUpperCase();

    // Rate limit: 5 registration attempts per IP per 10 min
    const ip = getClientIP(req);
    const rl = rateLimit(ip, "register", 5, 10 * 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    // Validate USN format
    const usnCheck = validateUSN(usn);
    if (!usnCheck.valid) {
      return NextResponse.json({ error: "Invalid USN." }, { status: 400 });
    }

    const body = await req.json();
    const { name, email, phone } = body;

    // Input validation
    if (!name || typeof name !== "string" || !name.trim() || name.trim().length > NAME_MAX) {
      return NextResponse.json({ error: "Valid name is required (max 100 chars)." }, { status: 400 });
    }
    if (!phone || typeof phone !== "string" || !PHONE_RE.test(phone.trim())) {
      return NextResponse.json({ error: "Valid 10-digit phone number is required." }, { status: 400 });
    }
    // Email is now optional since it was verified during OTP step
    // Only validate if email is provided
    if (email && typeof email === "string" && email.trim() && !email.trim().includes("@")) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }

    const cleanName = name.trim();
    const cleanEmail = email && email.trim() ? email.trim().toLowerCase() : null;
    const cleanPhone = phone.trim();

    const db = getAdminFirestore();

    // Check if student exists in the students CSV collection
    const [studentDoc, existingReg] = await Promise.all([
      db.collection("students").doc(usn).get(),
      db.collection("registrations").doc(usn).get(),
    ]);

    if (!studentDoc.exists && !existingReg.exists) {
      return NextResponse.json({ error: "USN not found in student database. Contact admin." }, { status: 404 });
    }

    // Already registered — return existing registration
    if (existingReg.exists) {
      const data = existingReg.data()!;
      return NextResponse.json({
        success: true,
        alreadyRegistered: true,
        user: {
          usn,
          name: data.name,
          email: data.email,
          branch: data.branch,
          section: data.section,
          eventId: data.eventId || null,
        },
      });
    }

    // Verify the email matches what's in the student database (if stored)
    const storedEmail = studentDoc.exists ? studentDoc.data()?.email : null;
    if (storedEmail && storedEmail.trim().toLowerCase() !== cleanEmail) {
      return NextResponse.json({ error: "Email does not match our records." }, { status: 400 });
    }

    const branch = studentDoc.data()?.branch || getBranchName(usn);
    const section = studentDoc.data()?.section || getSection(usn);

    // Create initial registration (no payment fields — only server writes payment data)
    await db.collection("registrations").doc(usn).set({
      name: cleanName,
      usn,
      email: cleanEmail, // Will use existing email from students collection if null
      phone: cleanPhone,
      branch,
      section,
      eventId: null,
      registeredAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      alreadyRegistered: false,
      user: { usn, name: cleanName, email: cleanEmail, branch, section, eventId: null },
    });
  } catch (err) {
    console.error("[auth/register]", err);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
