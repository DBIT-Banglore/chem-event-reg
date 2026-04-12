import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { validateUSN } from "@/lib/usnValidator";

/**
 * POST /api/auth/lookup-usn
 *
 * Looks up a USN in registrations and students collections (admin SDK).
 * Used before authentication — the client can't query Firestore directly
 * because rules require auth != null.
 *
 * NOTE: For status lookups, registered students are found directly by USN doc
 * before any format/list validation, so all registered users can check status.
 */
export async function POST(req: NextRequest) {
  try {
    const { usn } = await req.json();

    if (!usn || typeof usn !== "string") {
      return NextResponse.json({ error: "USN is required" }, { status: 400 });
    }

    const cleanUSN = usn.trim().toUpperCase();

    // Basic length/character sanity check (not strict list validation)
    if (!/^[A-Z0-9]{6,12}$/.test(cleanUSN)) {
      return NextResponse.json({ found: false, error: "Invalid USN format." }, { status: 400 });
    }

    const adminDb = getAdminFirestore();

    // ── 1. Check registrations FIRST (no list validation needed — direct doc lookup) ──
    const regDoc = await adminDb.collection("registrations").doc(cleanUSN).get();
    if (regDoc.exists) {
      const data = regDoc.data()!;
      const email = data.email || "";
      const [local, domain] = email.split("@");
      let maskedEmail = email;
      if (domain) {
        maskedEmail = local.length <= 2
          ? `${local[0]}***@${domain}`
          : `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
      }

      // Fetch event name for slot 1
      const eventId = data.eventId || null;
      let eventName: string | null = null;
      if (eventId) {
        const eventDoc = await adminDb.collection("events").doc(eventId).get();
        if (eventDoc.exists) eventName = eventDoc.data()?.name || null;
      }

      // Fetch event name for slot 2
      const eventId2 = data.eventId2 || null;
      let eventName2: string | null = null;
      if (eventId2) {
        const eventDoc2 = await adminDb.collection("events").doc(eventId2).get();
        if (eventDoc2.exists) eventName2 = eventDoc2.data()?.name || null;
      }

      return NextResponse.json({
        found: true,
        returning: true,
        eventId,
        eventName,
        eventId2,
        eventName2,
        student: {
          usn: cleanUSN,
          name: data.name || "",
          email: data.email || "",
          maskedEmail,
          phone: data.phone || "",
          branch: data.branch || "",
          section: data.section || "",
        },
      });
    }

    // ── 2. Not registered yet — validate format + check students collection ──
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
          email: data.email || "",
          maskedEmail: "",
          phone: data.phone || "",
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
