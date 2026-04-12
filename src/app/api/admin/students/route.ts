import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore, getAdminAuth } from "@/lib/firebase-admin";

export async function PUT(req: NextRequest) {
  try {
    const { idToken, usn, data } = await req.json();
    if (!idToken || !usn || !data) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await getAdminAuth().verifyIdToken(idToken);

    // Issue #9: Apply field allowlist \u2014 prevent injection of arbitrary Firestore fields
    const ALLOWED_FIELDS = ["name", "email", "phone", "branch", "section"];
    const safeData: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in data) safeData[key] = data[key];
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
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { idToken, usn } = await req.json();
    if (!idToken || !usn) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await getAdminAuth().verifyIdToken(idToken);

    const adminDb = getAdminFirestore();
    await adminDb.collection("students").doc(usn).delete();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Student delete error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
