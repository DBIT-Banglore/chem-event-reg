import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { rateLimit, getClientIP } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const ip = getClientIP(req);
  const rl = rateLimit(ip, "events", 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

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
          price: data.price ?? 0,
          registrationCount: data.registrationCount || 0,
          isActive: data.isActive,
          eventType: data.eventType || "individual",
          teamSize: data.teamSize || null,
        };
      })
      .filter((e) => e.isActive)
      .sort((a, b) => (a.dateTime > b.dateTime ? 1 : -1));
    return NextResponse.json({ events });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}