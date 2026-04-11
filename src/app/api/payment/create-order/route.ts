import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/jwt";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(req: NextRequest) {
  try {
    const payload = await getSessionFromRequest(req);
    if (!payload?.usn) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const usn = payload.usn as string;

    const { eventId } = await req.json();
    if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

    const db = getAdminFirestore();

    // Get event details
    const eventDoc = await db.collection("events").doc(eventId).get();
    if (!eventDoc.exists) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    const event = eventDoc.data()!;
    if (!event.isActive) return NextResponse.json({ error: "Event is not available" }, { status: 400 });
    if ((event.registrationCount || 0) >= event.capacity) {
      return NextResponse.json({ error: "Event is full" }, { status: 409 });
    }

    const price = Number(event.price) || 0;

    // Free event — no order needed
    if (price === 0) {
      return NextResponse.json({ free: true, eventId, eventName: event.name });
    }

    // Create Razorpay order (amount in paise)
    const order = await razorpay.orders.create({
      amount: price * 100,
      currency: "INR",
      receipt: `${usn}-${eventId}-${Date.now()}`.slice(0, 40),
      notes: { usn, eventId, eventName: event.name },
    });

    return NextResponse.json({
      free: false,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      eventName: event.name,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("[create-order]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
