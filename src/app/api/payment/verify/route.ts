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

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, eventId, eventId2, slot = 1 } = await req.json();

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

    // ── COMBINED MODE: both events paid in one transaction ──
    if (eventId2) {
      const eventRef2 = db.collection("events").doc(eventId2);

      const result = await db.runTransaction(async (txn) => {
        const [regDoc, ev1Doc, ev2Doc] = await Promise.all([
          txn.get(regRef),
          txn.get(eventRef),
          txn.get(eventRef2),
        ]);

        if (!regDoc.exists) throw Object.assign(new Error("Registration not found"), { status: 404 });
        if (!ev1Doc.exists) throw Object.assign(new Error("Event 1 not found"), { status: 404 });
        if (!ev2Doc.exists) throw Object.assign(new Error("Event 2 not found"), { status: 404 });

        const reg = regDoc.data()!;
        const ev1 = ev1Doc.data()!;
        const ev2 = ev2Doc.data()!;

        // Idempotency: already processed this combined order
        if (reg.orderId === razorpay_order_id && reg.paymentStatus === "paid") {
          return { alreadyProcessed: true, paymentId: razorpay_payment_id, eventId, eventId2 };
        }

        const isNewEv1 = (reg.eventId || null) !== eventId;
        const isNewEv2 = (reg.eventId2 || null) !== eventId2;

        if (isNewEv1 && (ev1.registrationCount || 0) >= ev1.capacity) {
          throw Object.assign(new Error(`${ev1.name} is now full. Contact admin.`), { status: 409 });
        }
        if (isNewEv2 && (ev2.registrationCount || 0) >= ev2.capacity) {
          throw Object.assign(new Error(`${ev2.name} is now full. Contact admin.`), { status: 409 });
        }

        // Update both slots with the same payment details
        const price1 = Number(ev1.price) || 0;
        const price2 = Number(ev2.price) || 0;

        txn.update(regRef, {
          eventId,
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          paymentStatus: "paid",
          paymentAmount: price1,
          eventId2,
          orderId2: razorpay_order_id,
          paymentId2: razorpay_payment_id,
          paymentStatus2: "paid",
          paymentAmount2: price2,
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Decrement old events if switching, increment new
        const prevEv1 = reg.eventId || null;
        const prevEv2 = reg.eventId2 || null;

        if (isNewEv1) {
          txn.update(eventRef, { registrationCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
          if (prevEv1 && prevEv1 !== eventId && prevEv1 !== eventId2) {
            txn.update(db.collection("events").doc(prevEv1), {
              registrationCount: FieldValue.increment(-1),
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        }
        if (isNewEv2) {
          txn.update(eventRef2, { registrationCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
          if (prevEv2 && prevEv2 !== eventId && prevEv2 !== eventId2) {
            txn.update(db.collection("events").doc(prevEv2), {
              registrationCount: FieldValue.increment(-1),
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        }

        return { alreadyProcessed: false, paymentId: razorpay_payment_id, eventId, eventId2 };
      });

      return NextResponse.json({ success: true, paymentId: result.paymentId, eventId: result.eventId, eventId2: result.eventId2 });
    }

    // ── SLOT MODE: single event (adding 2nd event later from dashboard) ──
    const isSlot2 = slot === 2;

    const result = await db.runTransaction(async (txn) => {
      const [regDoc, eventDoc] = await Promise.all([txn.get(regRef), txn.get(eventRef)]);

      if (!eventDoc.exists) throw Object.assign(new Error("Event not found"), { status: 404 });
      if (!regDoc.exists) throw Object.assign(new Error("Registration not found"), { status: 404 });

      const reg = regDoc.data()!;
      const event = eventDoc.data()!;

      const slotPaymentId = isSlot2 ? reg.paymentId2 : reg.paymentId;
      const slotOrderId = isSlot2 ? reg.orderId2 : reg.orderId;
      const slotStatus = isSlot2 ? reg.paymentStatus2 : reg.paymentStatus;
      const slotEventId = isSlot2 ? reg.eventId2 : reg.eventId;

      if (slotPaymentId === razorpay_payment_id && slotStatus === "paid") {
        return { alreadyProcessed: true, paymentId: razorpay_payment_id, eventId: slotEventId };
      }
      if (slotOrderId === razorpay_order_id && slotStatus === "paid") {
        return { alreadyProcessed: true, paymentId: slotPaymentId, eventId: slotEventId };
      }

      const currentSlotEventId = slotEventId || null;
      const isNewEvent = currentSlotEventId !== eventId;

      if (isNewEvent && (event.registrationCount || 0) >= event.capacity) {
        throw Object.assign(
          new Error("Event is now full. Payment recorded but slot unavailable. Contact admin."),
          { status: 409 }
        );
      }

      const updatePayload = isSlot2
        ? { eventId2: eventId, orderId2: razorpay_order_id, paymentId2: razorpay_payment_id, paymentStatus2: "paid", paymentAmount2: Number(event.price) || 0, updatedAt: FieldValue.serverTimestamp() }
        : { eventId, orderId: razorpay_order_id, paymentId: razorpay_payment_id, paymentStatus: "paid", paymentAmount: Number(event.price) || 0, updatedAt: FieldValue.serverTimestamp() };

      txn.update(regRef, updatePayload);

      if (isNewEvent) {
        txn.update(eventRef, {
          registrationCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
        if (currentSlotEventId) {
          txn.update(db.collection("events").doc(currentSlotEventId), {
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
