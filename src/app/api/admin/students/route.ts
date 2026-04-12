import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireAdmin, adminErrStatus } from "@/lib/admin-auth";

// Fields that admins are allowed to update on student records
const ALLOWED_STUDENT_FIELDS = new Set([
  "name", "email", "phone", "branch", "section", "usn",
]);

export async function GET(req: NextRequest) {
  try {
    const idToken = req.headers.get("x-admin-token") || "";
    await requireAdmin(idToken);

    const adminDb = getAdminFirestore();

    const [studentsSnap, registrationsSnap] = await Promise.all([
      adminDb.collection("students").get(),
      adminDb.collection("registrations").orderBy("registeredAt", "desc").get().catch(() =>
        adminDb.collection("registrations").orderBy("createdAt", "desc").get()
      ),
    ]);

    const students = studentsSnap.docs.map((d) => {
      const data = d.data();
      return {
        usn: data.usn || d.id,
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        branch: data.branch || "",
        section: data.section || "",
      };
    });

    const registrations = registrationsSnap.docs.map((d) => {
      const data = d.data();
      return {
        name: data.name,
        usn: data.usn,
        phone: data.phone,
        email: data.email || "",
        branch: data.branch,
        section: data.section,
        eventId: data.eventId || null,
        paymentStatus: data.paymentStatus || null,
        paymentId: data.paymentId || null,
        paymentAmount: data.paymentAmount ?? null,
        eventId2: data.eventId2 || null,
        paymentStatus2: data.paymentStatus2 || null,
        paymentId2: data.paymentId2 || null,
        paymentAmount2: data.paymentAmount2 ?? null,
      };
    });

    return NextResponse.json({ students, registrations });
  } catch (err) {
    console.error("Admin data fetch error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fetch failed" },
      { status: adminErrStatus(err) }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { idToken, usn, data } = await req.json();
    if (!idToken || !usn || !data || typeof data !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await requireAdmin(idToken);

    // Allowlist fields to prevent mass assignment
    const safeData: Record<string, unknown> = {};
    for (const key of Object.keys(data)) {
      if (ALLOWED_STUDENT_FIELDS.has(key)) {
        safeData[key] = data[key];
      }
    }
    if (Object.keys(safeData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const adminDb = getAdminFirestore();
    await adminDb.collection("students").doc(usn).update(safeData);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Student update error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: adminErrStatus(err) }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { idToken, usn } = await req.json();
    if (!idToken || !usn) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await requireAdmin(idToken);

    const adminDb = getAdminFirestore();
    await adminDb.collection("students").doc(usn).delete();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Student delete error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: adminErrStatus(err) }
    );
  }
}
