import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { validateUSN } from "@/lib/usnValidator";
import { rateLimit, getClientIP } from "@/lib/rate-limit";

/** Masks an email so only the first/last char of local part are visible. */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || !local) return "***@***";
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}

/**
 * POST /api/auth/lookup-usn
 *
 * Looks up a USN — used before authentication to prefill the registration form.
 * Returns ONLY non-sensitive info: name, branch, section, masked email.
 * Phone numbers and real email addresses are NEVER returned.
 */
export async function POST(req: NextRequest) {
  try {
    // ── Rate limiting: 5/min per IP + 30/hr per IP ──────────────────────────
    const ip = getClientIP(req);
    const perMin = rateLimit(ip, "lookup-usn-min", 5, 60 * 1000);
    if (!perMin.allowed) {
      const sec = Math.ceil(perMin.retryAfterMs / 1000);
      return NextResponse.json(
        { error: `Too many requests. Please wait ${sec}s before trying again.` },
        { status: 429 }
      );
    }
    const perHour = rateLimit(ip, "lookup-usn-hr", 30, 60 * 60 * 1000);
    if (!perHour.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in an hour." },
        { status: 429 }
      );
    }

    const { usn } = await req.json();

    if (!usn || typeof usn !== "string") {
      return NextResponse.json({ error: "USN is required" }, { status: 400 });
    }

    const cleanUSN = usn.trim().toUpperCase();

    if (!/^[A-Z0-9]{6,12}$/.test(cleanUSN)) {
      return NextResponse.json({ found: false, error: "Invalid USN format." }, { status: 400 });
    }

    const adminDb = getAdminFirestore();

    // ── 1. Check registrations FIRST ────────────────────────────────────────
    const regDoc = await adminDb.collection("registrations").doc(cleanUSN).get();
    if (regDoc.exists) {
      const data = regDoc.data()!;

      // Fetch event names in parallel
      const [ev1Snap, ev2Snap] = await Promise.all([
        data.eventId ? adminDb.collection("events").doc(data.eventId).get() : Promise.resolve(null),
        data.eventId2 ? adminDb.collection("events").doc(data.eventId2).get() : Promise.resolve(null),
      ]);

      return NextResponse.json({
        found: true,
        returning: true,
        eventId: data.eventId || null,
        eventName: ev1Snap?.exists ? ev1Snap.data()?.name || null : null,
        eventId2: data.eventId2 || null,
        eventName2: ev2Snap?.exists ? ev2Snap.data()?.name || null : null,
        student: {
          usn: cleanUSN,
          name: data.name || "",
          // Never expose real email or phone — masked display only
          maskedEmail: maskEmail(data.email || ""),
          branch: data.branch || "",
          section: data.section || "",
        },
      });
    }

    // ── 2. Not registered yet — validate + check students collection ─────────
    const check = validateUSN(cleanUSN);
    if (!check.valid) {
      return NextResponse.json(
        { found: false, error: check.error || "Invalid USN" },
        { status: 400 }
      );
    }

    const studentDoc = await adminDb.collection("students").doc(cleanUSN).get();
    if (studentDoc.exists) {
      const data = studentDoc.data()!;
      return NextResponse.json({
        found: true,
        returning: false,
        student: {
          name: data.name || "",
          // Never expose real email or phone
          maskedEmail: maskEmail(data.email || ""),
          branch: data.branch || check.branch || "",
          section: data.section || check.section || "",
        },
      });
    }

    return NextResponse.json({
      found: false,
      error: "USN not found in the student database. Contact your admin to ensure the CSV has been uploaded.",
    });
  } catch (err) {
    console.error("Lookup USN error:", err);
    return NextResponse.json(
      { error: "Failed to look up USN. Please try again." },
      { status: 500 }
    );
  }
}
