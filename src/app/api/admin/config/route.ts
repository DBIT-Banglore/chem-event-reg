import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireAdmin, adminErrStatus } from "@/lib/admin-auth";

const ALLOWED_CONFIG_KEYS = ["registrationsOpen", "maxEventsPerStudent", "announcementText", "csvLastUploadedAt"] as const;

export async function POST(req: NextRequest) {
  try {
    const { idToken, updates } = await req.json();
    if (!idToken || !updates || typeof updates !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await requireAdmin(idToken);

    // Field allowlist — only recognized config keys can be set
    const safeUpdates: Record<string, unknown> = {};
    for (const key of ALLOWED_CONFIG_KEYS) {
      if (key in updates) safeUpdates[key] = updates[key];
    }
    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json({ error: "No recognized config keys" }, { status: 400 });
    }

    const adminDb = getAdminFirestore();
    await adminDb.collection("config").doc("global_config").set(safeUpdates, { merge: true });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Config update error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: adminErrStatus(err) }
    );
  }
}
