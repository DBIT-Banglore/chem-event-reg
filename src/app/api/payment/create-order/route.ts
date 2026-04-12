import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/jwt";
import { rateLimit } from "@/lib/rate-limit";

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

    // Rate limit: 10 order creation attempts per hour per user
    const rl = rateLimit(usn, "payment-create", 10, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many payment attempts. Try again later." }, { status: 429 });
    }

    const body = await req.json();
    const { eventId, eventId2 } = body;

    // Validate slot strictly
    const rawSlot = body.slot;
    let slot: 1 | 2 = 1;
    if (rawSlot !== undefined && rawSlot !== null) {
      if (rawSlot === 2 || rawSlot === "2") {
        slot = 2;
      } else if (rawSlot !== 1 && rawSlot !== "1") {
        return NextResponse.json({ error: "slot must be 1 or 2" }, { status: 400 });
      }
    }

    if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

    const db = getAdminFirestore();

    // ── COMBINED MODE: both eventId and eventId2 provided (initial registration) ──
    if (eventId2) {
      if (eventId === eventId2) {
        return NextResponse.json({ error: "Cannot register for the same event twice." }, { status: 400 });
      }

      const [ev1Doc, ev2Doc] = await Promise.all([
        db.collection("events").doc(eventId).get(),
        db.collection("events").doc(eventId2).get(),
      ]);
      if (!ev1Doc.exists) return NextResponse.json({ error: "Event 1 not found" }, { status: 404 });
      if (!ev2Doc.exists) return NextResponse.json({ error: "Event 2 not found" }, { status: 404 });

      const ev1 = ev1Doc.data()!;
      const ev2 = ev2Doc.data()!;
      if (!ev1.isActive) return NextResponse.json({ error: `${ev1.name} is not available` }, { status: 400 });
      if (!ev2.isActive) return NextResponse.json({ error: `${ev2.name} is not available` }, { status: 400 });
      if ((ev1.registrationCount || 0) >= ev1.capacity) {
        return NextResponse.json({ error: `${ev1.name} is full` }, { status: 409 });
      }
      if ((ev2.registrationCount || 0) >= ev2.capacity) {
        return NextResponse.json({ error: `${ev2.name} is full` }, { status: 409 });
      }

      const price1 = Number(ev1.price) || 0;
      const price2 = Number(ev2.price) || 0;
      const total = price1 + price2;

      if (total === 0) {
        return NextResponse.json({ free: true, eventId, eventId2, eventName: ev1.name, eventName2: ev2.name });
      }

      const order = await razorpay.orders.create({
        amount: total * 100,
        currency: "INR",
        receipt: `${usn}-c-${Date.now()}`.slice(0, 40),
        notes: { usn, eventId, eventId2, eventName: ev1.name, eventName2: ev2.name },
      });

      return NextResponse.json({
        free: false,
        combined: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        eventName: ev1.name,
        eventName2: ev2.name,
        price1,
        price2,
        keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      });
    }

    // ── SLOT MODE: single event (used when adding 2nd event from dashboard) ──
    const isSlot2 = slot === 2;

    const regDoc = await db.collection("registrations").doc(usn).get();
    if (regDoc.exists) {
      const reg = regDoc.data()!;
      const slotEventId = isSlot2 ? reg.eventId2 : reg.eventId;
      const slotStatus = isSlot2 ? reg.paymentStatus2 : reg.paymentStatus;

      if (slotStatus === "paid" && slotEventId && slotEventId !== eventId) {
        return NextResponse.json({
          error: `You have already paid for ${isSlot2 ? "your 2nd event" : "an event"}. Contact admin to change your event.`,
        }, { status: 403 });
      }
      if (slotStatus === "paid" && slotEventId === eventId) {
        return NextResponse.json({ free: true, eventId, eventName: eventId, alreadyPaid: true });
      }
      if (isSlot2 && reg.eventId === eventId) {
        return NextResponse.json({ error: "You are already registered for this event in slot 1. Choose a different event." }, { status: 400 });
      }
      if (!isSlot2 && reg.eventId2 === eventId) {
        return NextResponse.json({ error: "You are already registered for this event in slot 2. Choose a different event." }, { status: 400 });
      }
    }

    const eventDoc = await db.collection("events").doc(eventId).get();
    if (!eventDoc.exists) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    const event = eventDoc.data()!;
    if (!event.isActive) return NextResponse.json({ error: "Event is not available" }, { status: 400 });
    if ((event.registrationCount || 0) >= event.capacity) {
      return NextResponse.json({ error: "Event is full" }, { status: 409 });
    }

    const price = Number(event.price) || 0;
    if (price === 0) {
      return NextResponse.json({ free: true, eventId, eventName: event.name });
    }

    const order = await razorpay.orders.create({
      amount: price * 100,
      currency: "INR",
      receipt: `${usn}-${isSlot2 ? "s2" : "s1"}-${Date.now()}`.slice(0, 40),
      notes: { usn, eventId, slot: String(slot), eventName: event.name },
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
