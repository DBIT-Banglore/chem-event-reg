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

    // Get event
    const eventDoc = await db.collection("events").doc(eventId).get();
    if (!eventDoc.exists) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    const eventData = eventDoc.data()!;
    if (!eventData.isActive) return NextResponse.json({ error: "This event is not available." }, { status: 400 });

    // Issue #4: Block payment bypass — paid events must go through the Razorpay payment flow
    if ((eventData.price || 0) > 0) {
      return NextResponse.json(
        { error: "This event requires payment. Please use the payment flow." },
        { status: 403 }
      );
    }

    // Get current registration
    const regDoc = await db.collection("registrations").doc(usn).get();
    if (!regDoc.exists) return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    const currentEventId = regDoc.data()?.eventId || null;

    // If same event, no-op
    if (currentEventId === eventId) {
      return NextResponse.json({ success: true, eventId });
    }

    // Check capacity (current count < capacity)
    const currentCount = eventData.registrationCount || 0;
    if (currentCount >= eventData.capacity) {
      return NextResponse.json({ error: "This event is full. Please choose another." }, { status: 409 });
    }

    // Atomic update: decrement old, increment new, update registration
    const batch = db.batch();

    // Update registration
    batch.update(db.collection("registrations").doc(usn), {
      eventId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Increment new event count
    batch.update(db.collection("events").doc(eventId), {
      registrationCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Decrement old event count if there was one
    if (currentEventId) {
      batch.update(db.collection("events").doc(currentEventId), {
        registrationCount: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    return NextResponse.json({ success: true, eventId });
  } catch (err) {
    console.error("select-event error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
