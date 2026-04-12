import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireAdmin, adminErrStatus } from "@/lib/admin-auth";
import { FieldValue } from "firebase-admin/firestore";
import { rateLimit, getClientIP } from "@/lib/rate-limit";

const MAX_STUDENTS = 5000;

export async function POST(req: NextRequest) {
  try {
    const { idToken, students } = await req.json();
    if (!idToken || !students || !Array.isArray(students)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await requireAdmin(idToken);

    // Rate limit: 3 uploads per hour per IP (destructive operation)
    const ip = getClientIP(req);
    const rl = rateLimit(ip, "admin-upload-csv", 3, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many upload attempts. Try again later." }, { status: 429 });
    }

    if (students.length > MAX_STUDENTS) {
      return NextResponse.json({ error: `Max ${MAX_STUDENTS} students per upload` }, { status: 400 });
    }

    // Validate each student record before writing to Firestore
    const validStudents: Array<Record<string, string>> = [];
    const errors: string[] = [];

    for (const s of students) {
      const usn   = typeof s.usn   === "string" ? s.usn.trim().toUpperCase()   : "";
      const name  = typeof s.name  === "string" ? s.name.trim().slice(0, 100)  : "";
      const email = typeof s.email === "string" ? s.email.trim().toLowerCase() : "";
      const phone = typeof s.phone === "string" ? s.phone.trim().slice(0, 15)  : "";
      const branch  = typeof s.branch  === "string" ? s.branch.trim().slice(0, 100)  : "";
      const section = typeof s.section === "string" ? s.section.trim().slice(0, 10)  : "";

      if (!/^[A-Z0-9]{6,15}$/.test(usn)) { errors.push(`Invalid USN: ${usn}`); continue; }
      if (!name)                           { errors.push(`Missing name for ${usn}`); continue; }
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push(`Invalid email for ${usn}`); continue;
      }

      validStudents.push({ usn, name, email, phone, branch, section });
    }

    // Abort if more than 10% of records are invalid
    if (errors.length > students.length * 0.1) {
      return NextResponse.json({ error: "Too many invalid records", details: errors.slice(0, 20) }, { status: 400 });
    }

    const adminDb = getAdminFirestore();
    const batchId = `batch_${Date.now()}`;

    // Batch write students in groups of 450
    for (let i = 0; i < validStudents.length; i += 450) {
      const batch = adminDb.batch();
      validStudents.slice(i, i + 450).forEach((s) => {
        const ref = adminDb.collection("students").doc(s.usn);
        batch.set(ref, {
          usn: s.usn,
          name: s.name,
          email: s.email,
          phone: s.phone,
          branch: s.branch,
          section: s.section,
          importedAt: FieldValue.serverTimestamp(),
          importBatch: batchId,
        });
      });
      await batch.commit();
    }

    // Update config
    await adminDb.collection("config").doc("global_config").set(
      { csvLastUploadedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    return NextResponse.json({ success: true, count: validStudents.length, skipped: errors.length });
  } catch (err) {
    console.error("CSV upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: adminErrStatus(err) }
    );
  }
}
