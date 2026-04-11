import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getSessionFromRequest } from "@/lib/jwt";

export async function POST(req: NextRequest) {
  try {
    const payload = await getSessionFromRequest(req);
    if (!payload?.usn) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const usn = payload.usn as string;

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, eventId } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !eventId) {
      return NextResponse.json({ error: "Missing payment details" }, { status: 400 });
    }

    // Verify signature
    const expectedSig = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSig !== razorpay_signature) {
      return NextResponse.json({ error: "Payment verification failed. Invalid signature." }, { status: 400 });
    }

    const db = getAdminFirestore();

    // Re-check event capacity before confirming
    const eventDoc = await db.collection("events").doc(eventId).get();
    if (!eventDoc.exists) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    const eventData = eventDoc.data()!;

    const regDoc = await db.collection("registrations").doc(usn).get();
    if (!regDoc.exists) return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    const currentEventId = regDoc.data()?.eventId || null;

    if (currentEventId !== eventId) {
      // Only check capacity if switching to a new event
      if ((eventData.registrationCount || 0) >= eventData.capacity) {
        return NextResponse.json({ error: "Event is now full. Payment recorded but slot unavailable. Contact admin." }, { status: 409 });
      }
    }

    // Atomic batch: confirm slot + save payment info
    const batch = db.batch();

    batch.update(db.collection("registrations").doc(usn), {
      eventId,
      paymentId: razorpay_payment_id,
      paymentStatus: "paid",
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (currentEventId !== eventId) {
      batch.update(db.collection("events").doc(eventId), {
        registrationCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (currentEventId) {
        batch.update(db.collection("events").doc(currentEventId), {
          registrationCount: FieldValue.increment(-1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    await batch.commit();

    return NextResponse.json({ success: true, paymentId: razorpay_payment_id, eventId });
  } catch (err) {
    console.error("[payment/verify]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
