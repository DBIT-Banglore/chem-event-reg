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

    const { eventId, eventId2, slot = 1 } = await req.json();
    if (!eventId) return NextResponse.json({ error: "eventId is required" }, { status: 400 });

    const db = getAdminFirestore();

    // Check registrations are open
    const configSnap = await db.collection("config").doc("global_config").get();
    const config = configSnap.data();
    if (config && config.registrationsOpen === false) {
      return NextResponse.json({ error: "Registrations are currently closed." }, { status: 403 });
    }

    const regRef = db.collection("registrations").doc(usn);
    const eventRef = db.collection("events").doc(eventId);

    // ── COMBINED MODE: confirm both free events at once ──
    if (eventId2) {
      if (eventId === eventId2) {
        return NextResponse.json({ error: "Cannot register for the same event twice." }, { status: 400 });
      }
      const eventRef2 = db.collection("events").doc(eventId2);

      const result = await db.runTransaction(async (txn) => {
        const [regDoc, ev1Doc, ev2Doc] = await Promise.all([
          txn.get(regRef),
          txn.get(eventRef),
          txn.get(eventRef2),
        ]);

        if (!ev1Doc.exists) throw Object.assign(new Error("Event 1 not found"), { status: 404 });
        if (!ev2Doc.exists) throw Object.assign(new Error("Event 2 not found"), { status: 404 });
        if (!regDoc.exists) throw Object.assign(new Error("Registration not found."), { status: 404 });

        const ev1 = ev1Doc.data()!;
        const ev2 = ev2Doc.data()!;
        const regData = regDoc.data()!;

        if (!ev1.isActive) throw Object.assign(new Error(`${ev1.name} is not available.`), { status: 400 });
        if (!ev2.isActive) throw Object.assign(new Error(`${ev2.name} is not available.`), { status: 400 });

        if (ev1.eventType === "team") {
          throw Object.assign(new Error("Team events cannot be selected as individual events. Use the team registration flow."), { status: 400 });
        }
        if (ev2.eventType === "team") {
          throw Object.assign(new Error("Team events cannot be selected as individual events. Use the team registration flow."), { status: 400 });
        }

        const prevEv1 = regData.eventId || null;
        const prevEv2 = regData.eventId2 || null;
        const isNewEv1 = prevEv1 !== eventId;
        const isNewEv2 = prevEv2 !== eventId2;

        if (isNewEv1 && (ev1.registrationCount || 0) >= ev1.capacity) {
          throw Object.assign(new Error(`${ev1.name} is full. Please choose another.`), { status: 409 });
        }
        if (isNewEv2 && (ev2.registrationCount || 0) >= ev2.capacity) {
          throw Object.assign(new Error(`${ev2.name} is full. Please choose another.`), { status: 409 });
        }

        txn.update(regRef, {
          eventId,
          paymentStatus: "free",
          eventId2,
          paymentStatus2: "free",
          updatedAt: FieldValue.serverTimestamp(),
        });

        if (isNewEv1) {
          txn.update(eventRef, { registrationCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
          if (prevEv1 && prevEv1 !== eventId && prevEv1 !== eventId2) {
            txn.update(db.collection("events").doc(prevEv1), { registrationCount: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() });
          }
        }
        if (isNewEv2) {
          txn.update(eventRef2, { registrationCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
          if (prevEv2 && prevEv2 !== eventId && prevEv2 !== eventId2) {
            txn.update(db.collection("events").doc(prevEv2), { registrationCount: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() });
          }
        }

        return { eventId, eventId2 };
      });

      return NextResponse.json({ success: true, eventId: result.eventId, eventId2: result.eventId2 });
    }

    // ── SLOT MODE: single free event ──
    const isSlot2 = slot === 2;

    const result2 = await db.runTransaction(async (txn) => {
      const [eventDoc, regDoc] = await Promise.all([txn.get(eventRef), txn.get(regRef)]);

      if (!eventDoc.exists) throw Object.assign(new Error("Event not found"), { status: 404 });
      const eventData = eventDoc.data()!;
      if (!eventData.isActive) throw Object.assign(new Error("This event is not available."), { status: 400 });
      if (eventData.eventType === "team") throw Object.assign(new Error("Team events cannot be selected as individual events."), { status: 400 });

      if (!regDoc.exists) throw Object.assign(new Error("Registration not found."), { status: 404 });
      const regData = regDoc.data()!;
      const currentEventId = isSlot2 ? (regData.eventId2 || null) : (regData.eventId || null);

      if (isSlot2 && regData.eventId === eventId) {
        throw Object.assign(new Error("You are already registered for this event in slot 1. Choose a different event."), { status: 400 });
      }
      if (!isSlot2 && regData.eventId2 === eventId) {
        throw Object.assign(new Error("You are already registered for this event in slot 2. Choose a different event."), { status: 400 });
      }

      if (currentEventId === eventId) return { eventId };

      if ((eventData.registrationCount || 0) >= eventData.capacity) {
        throw Object.assign(new Error("This event is full. Please choose another."), { status: 409 });
      }

      txn.update(regRef, {
        ...(isSlot2 ? { eventId2: eventId, paymentStatus2: "free" } : { eventId, paymentStatus: "free" }),
        updatedAt: FieldValue.serverTimestamp(),
      });
      txn.update(eventRef, { registrationCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });

      if (currentEventId) {
        txn.update(db.collection("events").doc(currentEventId), {
          registrationCount: FieldValue.increment(-1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      return { eventId };
    });

    return NextResponse.json({ success: true, eventId: result2.eventId });
  } catch (err) {
    console.error("select-event error:", err);
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status });
  }
}
