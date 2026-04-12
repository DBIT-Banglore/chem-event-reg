import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/jwt";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const payload = await getSessionFromRequest(req);
    if (!payload || !payload.usn) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const usn = payload.usn as string;

    const { eventId } = await req.json();
    if (!eventId) return NextResponse.json({ error: "eventId is required" }, { status: 400 });

    const db = getAdminFirestore();

    // Check registrations are open
    const configSnap = await db.collection("config").doc("global_config").get();
    const config = configSnap.data();
    if (config && config.registrationsOpen === false) {
      return NextResponse.json({ error: "Registrations are currently closed." }, { status: 403 });
    }

    const eventRef = db.collection("events").doc(eventId);
    const regRef = db.collection("registrations").doc(usn);

    const result = await db.runTransaction(async (txn) => {
      const [eventDoc, regDoc] = await Promise.all([txn.get(eventRef), txn.get(regRef)]);

      if (!eventDoc.exists) throw Object.assign(new Error("Event not found"), { status: 404 });
      const eventData = eventDoc.data()!;
      if (!eventData.isActive) throw Object.assign(new Error("This event is not available."), { status: 400 });

      if (!regDoc.exists) throw Object.assign(new Error("Registration not found."), { status: 404 });
      const currentEventId = regDoc.data()?.eventId || null;

      // No-op if already on the same event
      if (currentEventId === eventId) return { eventId };

      // Capacity check inside the transaction — prevents race conditions
      if ((eventData.registrationCount || 0) >= eventData.capacity) {
        throw Object.assign(new Error("This event is full. Please choose another."), { status: 409 });
      }

      txn.update(regRef, { eventId, updatedAt: FieldValue.serverTimestamp() });
      txn.update(eventRef, { registrationCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });

      if (currentEventId) {
        txn.update(db.collection("events").doc(currentEventId), {
          registrationCount: FieldValue.increment(-1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      return { eventId };
    });

    return NextResponse.json({ success: true, eventId: result.eventId });
  } catch (err) {
    console.error("select-event error:", err);
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status });
  }
}
