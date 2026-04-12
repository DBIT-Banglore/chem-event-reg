import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireAdmin, adminErrStatus } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  try {
    const { idToken, updates } = await req.json();
    if (!idToken || !updates || typeof updates !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await requireAdmin(idToken);

    const adminDb = getAdminFirestore();
    await adminDb.collection("config").doc("global_config").set(updates, { merge: true });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Config update error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: adminErrStatus(err) }
    );
  }
}
