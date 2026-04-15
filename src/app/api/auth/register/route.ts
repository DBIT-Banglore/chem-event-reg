import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/jwt";
import { rateLimit, getClientIP } from "@/lib/rate-limit";
import { getBranchName, getSection, validateUSN } from "@/lib/usnValidator";
import { FieldValue } from "firebase-admin/firestore";
import { sanitizeName, sanitizePhone, sanitizeEmail, containsXSSPatterns } from "@/lib/sanitize";

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

    // XSS Protection - Check for malicious patterns first
    if (name && containsXSSPatterns(name)) {
      return NextResponse.json({ error: "Invalid input: malicious content detected." }, { status: 400 });
    }
    if (email && containsXSSPatterns(email)) {
      return NextResponse.json({ error: "Invalid input: malicious content detected." }, { status: 400 });
    }

    // Input sanitization and validation
    const nameSanitized = sanitizeName(name);
    if (!nameSanitized.isValid) {
      return NextResponse.json({ error: "Valid name is required (letters, spaces, hyphens, apostrophes only)." }, { status: 400 });
    }

    const phoneSanitized = sanitizePhone(phone);
    if (!phoneSanitized.isValid) {
      return NextResponse.json({ error: "Valid 10-digit phone number is required." }, { status: 400 });
    }

    // Email is optional, but sanitize if provided
    let cleanEmail = null;
    if (email && email.trim()) {
      const emailSanitized = sanitizeEmail(email);
      if (!emailSanitized.isValid) {
        return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
      }
      cleanEmail = emailSanitized.sanitized;
    }

    const cleanName = nameSanitized.sanitized;
    const cleanPhone = phoneSanitized.sanitized;

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

    // Email was already verified via OTP — use stored email if none was submitted
    const storedEmail: string | null = studentDoc.exists ? (studentDoc.data()?.email ?? null) : null;
    const resolvedEmail = cleanEmail ?? storedEmail;

    const branch = studentDoc.data()?.branch || getBranchName(usn);
    const section = studentDoc.data()?.section || getSection(usn);

    // Create initial registration (no payment fields — only server writes payment data)
    await db.collection("registrations").doc(usn).set({
      name: cleanName,
      usn,
      email: resolvedEmail,
      phone: cleanPhone,
      branch,
      section,
      eventId: null,
      registeredAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      alreadyRegistered: false,
      user: { usn, name: cleanName, email: resolvedEmail, branch, section, eventId: null },
    });
  } catch (err) {
    console.error("[auth/register]", err);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
