import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const db = getAdminFirestore();
    const snap = await db.collection("events").get();
    const events = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          eventId: d.id,
          name: data.name,
          description: data.description,
          capacity: data.capacity,
          dateTime: data.dateTime,
          registrationCount: data.registrationCount || 0,
          isActive: data.isActive,
        };
      })
      .filter((e) => e.isActive)
      .sort((a, b) => (a.dateTime > b.dateTime ? 1 : -1));
    return NextResponse.json({ events });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
