import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireAdmin, adminErrStatus } from "@/lib/admin-auth";
import { FieldValue } from "firebase-admin/firestore";

// GET — list all events
export async function GET(req: NextRequest) {
  try {
    const idToken = req.headers.get("x-admin-token") || "";
    if (!idToken) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    await requireAdmin(idToken);

    const db = getAdminFirestore();
    const snap = await db.collection("events").orderBy("createdAt", "desc").get();
    const events = snap.docs.map((d) => ({ eventId: d.id, ...d.data() }));
    return NextResponse.json({ events });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: adminErrStatus(err) });
  }
}

// POST — create event
export async function POST(req: NextRequest) {
  try {
    const { idToken, name, description, capacity, dateTime, isActive, price, eventType, teamSize } = await req.json();
    if (!idToken) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    await requireAdmin(idToken);

    if (!name?.trim()) return NextResponse.json({ error: "Event name is required" }, { status: 400 });
    if (!capacity || capacity < 1) return NextResponse.json({ error: "Capacity must be at least 1" }, { status: 400 });
    if (!dateTime) return NextResponse.json({ error: "Date/time is required" }, { status: 400 });

    // Team event validation
    const eventTypeValue = eventType || "individual";
    if (eventTypeValue === "team") {
      if (!teamSize || teamSize < 2) {
        return NextResponse.json({ error: "Team events require at least 2 members" }, { status: 400 });
      }
      if (teamSize > 10) {
        return NextResponse.json({ error: "Team events cannot exceed 10 members" }, { status: 400 });
      }
    }

    const db = getAdminFirestore();
    const eventId = `EVT-${Date.now()}`;
    await db.collection("events").doc(eventId).set({
      eventId,
      name: name.trim(),
      description: description?.trim() || "",
      capacity: Number(capacity),
      dateTime,
      price: Number(price) || 0,
      registrationCount: 0,
      isActive: isActive ?? true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      eventType: eventTypeValue,
      teamSize: eventTypeValue === "team" ? Number(teamSize) : null,
    });
    return NextResponse.json({ success: true, eventId });
  } catch (err) {
    console.error("[POST /api/admin/events]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: adminErrStatus(err) });
  }
}

// PUT — update event
export async function PUT(req: NextRequest) {
  try {
    const { idToken, eventId, ...updates } = await req.json();
    if (!idToken) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    await requireAdmin(idToken);
    if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

    const db = getAdminFirestore();
    const allowed = ["name", "description", "capacity", "dateTime", "isActive", "price", "eventType", "teamSize"];
    const safeUpdates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    for (const key of allowed) {
      if (key in updates) safeUpdates[key] = updates[key];
    }
    if (safeUpdates.name) safeUpdates.name = (safeUpdates.name as string).trim();
    if (safeUpdates.capacity) safeUpdates.capacity = Number(safeUpdates.capacity);
    if ("price" in safeUpdates) safeUpdates.price = Number(safeUpdates.price) || 0;

    // Team event validation for updates
    if ("eventType" in updates && updates.eventType === "team") {
      if (!("teamSize" in updates) || !updates.teamSize || updates.teamSize < 2) {
        return NextResponse.json({ error: "Team events require at least 2 members" }, { status: 400 });
      }
      if (updates.teamSize && updates.teamSize > 10) {
        return NextResponse.json({ error: "Team events cannot exceed 10 members" }, { status: 400 });
      }
    }

    await db.collection("events").doc(eventId).update(safeUpdates);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PUT /api/admin/events]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: adminErrStatus(err) });
  }
}

// DELETE — delete event (only if registrationCount === 0)
export async function DELETE(req: NextRequest) {
  try {
    const { idToken, eventId } = await req.json();
    if (!idToken) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    await requireAdmin(idToken);
    if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

    const db = getAdminFirestore();
    const eventDoc = await db.collection("events").doc(eventId).get();
    if (!eventDoc.exists) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    if ((eventDoc.data()?.registrationCount || 0) > 0) {
      return NextResponse.json({ error: "Cannot delete event with registrations. Deactivate it instead." }, { status: 400 });
    }
    await db.collection("events").doc(eventId).delete();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/admin/events]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: adminErrStatus(err) });
  }
}
