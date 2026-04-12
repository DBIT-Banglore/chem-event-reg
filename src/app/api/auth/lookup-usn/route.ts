import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { validateUSN } from "@/lib/usnValidator";
import { rateLimit, getClientIP } from "@/lib/rate-limit";

/**
 * POST /api/auth/lookup-usn
 *
 * Looks up a USN in registrations and students collections (admin SDK).
 * Used before authentication — the client can't query Firestore directly
 * because rules require auth != null.
 */
export async function POST(req: NextRequest) {
  try {
    // Issue #8: Rate limit — 20 lookups per IP per 15 minutes to prevent roster enumeration
    const ip = getClientIP(req);
    const { allowed, retryAfterMs } = rateLimit(ip, "lookup-usn", 20, 15 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many requests. Try again in ${Math.ceil(retryAfterMs / 1000)}s.` },
        { status: 429 }
      );
    }

    const { usn } = await req.json();

    if (!usn || typeof usn !== "string") {
      return NextResponse.json({ error: "USN is required" }, { status: 400 });
    }

    const cleanUSN = usn.trim().toUpperCase();

    // Validate format + existence in local CSV-derived list
    const check = validateUSN(cleanUSN);
    if (!check.valid) {
      return NextResponse.json(
        { found: false, error: check.error || "Invalid USN" },
        { status: 400 }
      );
    }

    const adminDb = getAdminFirestore();

    // Check if already registered (returning student)
    const regDoc = await adminDb.collection("registrations").doc(cleanUSN).get();
    if (regDoc.exists) {
      const data = regDoc.data()!;
      // Mask email for privacy: a****z@domain.com
      const email = data.email || "";
      const [local, domain] = email.split("@");
      let maskedEmail = email;
      if (domain) {
        maskedEmail = local.length <= 2
          ? `${local[0]}***@${domain}`
          : `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
      }

      return NextResponse.json({
        found: true,
        returning: true,
        student: {
          name: data.name || "",
          email: data.email || "",
          maskedEmail,
          phone: data.phone || "",
          branch: data.branch || check.branch || "",
          section: data.section || check.section || "",
        },
      });
    }

    // Check students collection (CSV-imported)
    const studentDoc = await adminDb.collection("students").doc(cleanUSN).get();
    if (studentDoc.exists) {
      const data = studentDoc.data()!;
      // Issue #7: Apply same email masking as returning students — don't expose raw email to unauthenticated callers
      const email = data.email || "";
      const [local, domain] = email.split("@");
      let maskedEmail = email;
      if (domain) {
        maskedEmail = local.length <= 2
          ? `${local[0]}***@${domain}`
          : `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
      }

      return NextResponse.json({
        found: true,
        returning: false,
        student: {
          name: data.name || "",
          maskedEmail,
          phone: data.phone || "",
          branch: data.branch || check.branch || "",
          section: data.section || check.section || "",
        },
      });
    }

    // USN is valid per local list but not in Firebase collections
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
