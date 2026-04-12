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

    // Verify Razorpay signature before touching Firestore
    const expectedSig = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSig !== razorpay_signature) {
      return NextResponse.json({ error: "Payment verification failed. Invalid signature." }, { status: 400 });
    }

    const db = getAdminFirestore();
    const regRef = db.collection("registrations").doc(usn);
    const eventRef = db.collection("events").doc(eventId);

    const result = await db.runTransaction(async (txn) => {
      const [regDoc, eventDoc] = await Promise.all([txn.get(regRef), txn.get(eventRef)]);

      if (!eventDoc.exists) throw Object.assign(new Error("Event not found"), { status: 404 });
      if (!regDoc.exists) throw Object.assign(new Error("Registration not found"), { status: 404 });

      const reg = regDoc.data()!;
      const event = eventDoc.data()!;

      // Idempotency: if this exact payment was already recorded, return success without re-processing
      if (reg.paymentId === razorpay_payment_id && reg.paymentStatus === "paid") {
        return { alreadyProcessed: true, paymentId: razorpay_payment_id, eventId: reg.eventId };
      }

      // Also guard against replaying a different payment for the same order
      if (reg.orderId === razorpay_order_id && reg.paymentStatus === "paid") {
        return { alreadyProcessed: true, paymentId: reg.paymentId, eventId: reg.eventId };
      }

      const currentEventId = reg.eventId || null;
      const isNewEvent = currentEventId !== eventId;

      // Capacity check (only when switching to a new event)
      if (isNewEvent && (event.registrationCount || 0) >= event.capacity) {
        throw Object.assign(
          new Error("Event is now full. Payment recorded but slot unavailable. Contact admin."),
          { status: 409 }
        );
      }

      // Confirm slot + record payment
      txn.update(regRef, {
        eventId,
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        paymentStatus: "paid",
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (isNewEvent) {
        txn.update(eventRef, {
          registrationCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
        if (currentEventId) {
          txn.update(db.collection("events").doc(currentEventId), {
            registrationCount: FieldValue.increment(-1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      return { alreadyProcessed: false, paymentId: razorpay_payment_id, eventId };
    });

    return NextResponse.json({ success: true, paymentId: result.paymentId, eventId: result.eventId });
  } catch (err) {
    console.error("[payment/verify]", err);
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status });
  }
}
