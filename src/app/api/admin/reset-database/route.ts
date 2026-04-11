import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore, getAdminAuth } from "@/lib/firebase-admin";

/**
 * POST /api/admin/reset-database
 *
 * Server-side database reset using admin SDK (bypasses Firestore rules).
 * Requires a valid Firebase ID token from an admin user.
 */
export async function POST(req: NextRequest) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { idToken, clearCSV, clearOtpCodes, clearEvents } = body;

    if (!idToken) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Verify the Firebase ID token
    let adminAuth;
    try {
      adminAuth = getAdminAuth();
    } catch (err) {
      console.error("Failed to initialize Firebase Admin Auth:", err);
      return NextResponse.json({ error: "Server configuration error: Firebase Admin not initialized. Check FIREBASE_SERVICE_ACCOUNT_KEY env var." }, { status: 500 });
    }

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
      if (!decoded.uid) throw new Error("No UID in token");
    } catch (err) {
      console.error("ID token verification failed:", err);
      return NextResponse.json({ error: "Token verification failed. Try logging out and back in." }, { status: 401 });
    }

    let adminDb;
    try {
      adminDb = getAdminFirestore();
    } catch (err) {
      console.error("Failed to initialize Firebase Admin Firestore:", err);
      return NextResponse.json({ error: "Server configuration error: Firestore Admin not initialized." }, { status: 500 });
    }

    const deleted: string[] = [];

    // Always clear:
    await deleteCollection(adminDb, "registrations");
    deleted.push("registrations");

    await deleteCollection(adminDb, "notifications");
    deleted.push("notifications");

    // Optional:
    if (clearCSV) {
      await deleteCollection(adminDb, "students");
      deleted.push("students");
    }

    if (clearOtpCodes) {
      await deleteCollection(adminDb, "otp_codes");
      deleted.push("otp_codes");
    }

    if (clearEvents) {
      await deleteCollection(adminDb, "events");
      deleted.push("events");
    } else {
      // Reset registrationCount to 0 on all events so capacity is accurate after reset
      const eventsSnap = await adminDb.collection("events").get();
      if (!eventsSnap.empty) {
        for (let i = 0; i < eventsSnap.docs.length; i += 450) {
          const batch = adminDb.batch();
          eventsSnap.docs.slice(i, i + 450).forEach((d) =>
            batch.update(d.ref, { registrationCount: 0 })
          );
          await batch.commit();
        }
        deleted.push("event registration counts reset");
      }
    }

    return NextResponse.json({
      success: true,
      message: `Database reset complete. Cleared: ${deleted.join(", ")}.`,
    });
  } catch (err) {
    console.error("Reset database error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error during database reset.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Delete all documents in a collection using batched writes (admin SDK).
 */
async function deleteCollection(
  db: FirebaseFirestore.Firestore,
  collectionName: string
) {
  try {
    const snap = await db.collection(collectionName).get();
    if (snap.empty) return;

    // Batch in groups of 450 (Firestore limit is 500)
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 450) {
      const batch = db.batch();
      docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    console.error(`Failed to delete collection "${collectionName}":`, err);
    throw new Error(`Failed to clear ${collectionName}: ${err instanceof Error ? err.message : "unknown error"}`);
  }
}
