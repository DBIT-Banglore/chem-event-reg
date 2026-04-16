import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/jwt";
import { rateLimit } from "@/lib/rate-limit";
import { FieldValue } from "firebase-admin/firestore";

function getRazorpay() { return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID!, key_secret: process.env.RAZORPAY_KEY_SECRET! }); }

export async function POST(req: NextRequest) {
  try {
    const payload = await getSessionFromRequest(req);
    if (!payload?.usn) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const usn = payload.usn as string;

    // Rate limit: 10 order creation attempts per hour per user
    const rl = rateLimit(usn, "team-payment-create", 10, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many payment attempts. Try again later." }, { status: 429 });
    }

    const body = await req.json();
    const { teamId } = body;

    if (!teamId) {
      return NextResponse.json({ error: "Team ID is required" }, { status: 400 });
    }

    const db = getAdminFirestore();

    // Fetch team details
    const teamDoc = await db.collection("teams").doc(teamId).get();
    if (!teamDoc.exists) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const teamData = teamDoc.data()!;

    // Verify user is team leader
    if (teamData.leaderUSN !== usn) {
      return NextResponse.json({ error: "Only team leader can create payment order" }, { status: 403 });
    }

    // Verify all team members are verified
    const allMembersVerified = Object.values(teamData.otpVerificationStatus || {}).every(Boolean);
    if (!allMembersVerified) {
      const pendingMembers = teamData.memberUSNs.filter(
        (memberUSN: string) => !teamData.otpVerificationStatus?.[memberUSN]
      );
      return NextResponse.json({
        error: "Not all team members have verified their OTPs",
        pendingMembers,
        status: 400
      });
    }

    // Verify team status allows payment
    if (teamData.status === "paid" || teamData.status === "complete") {
      return NextResponse.json({
        error: "Team has already paid for this event",
        alreadyPaid: true,
        status: 400
      });
    }

    if (teamData.status === "cancelled") {
      return NextResponse.json({
        error: "This team has been cancelled",
        status: 400
      });
    }

    // Fetch event details
    const eventDoc = await db.collection("events").doc(teamData.eventId).get();
    if (!eventDoc.exists) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const eventData = eventDoc.data()!;

    // Verify event is still active
    if (!eventData.isActive) {
      return NextResponse.json({ error: "Event is not currently active" }, { status: 400 });
    }

    // Verify team still fits in capacity
    const currentTeamCount = await db
      .collection("teams")
      .where("eventId", "==", teamData.eventId)
      .where("status", "in", ["paid", "complete"])
      .get();

    const occupiedSlots = currentTeamCount.docs.reduce((total, team) => {
      return total + (team.data()?.memberCount || 0);
    }, 0);

    if (occupiedSlots + teamData.memberCount > eventData.capacity) {
      return NextResponse.json({
        error: "Event has become full. Please choose another event.",
        status: 409
      });
    }

    // Calculate total payment amount
    const pricePerMember = Number(eventData.price) || 0;
    const totalAmount = pricePerMember * teamData.memberCount;

    // Handle free events
    if (totalAmount === 0) {
      // For free events, directly update team status
      await db.collection("teams").doc(teamId).update({
        status: "complete",
        paymentStatus: "free",
        totalAmount: 0,
        updatedAt: FieldValue.serverTimestamp()
      });

      // Update event registration count
      await db.collection("events").doc(teamData.eventId).update({
        registrationCount: FieldValue.increment(teamData.memberCount),
        updatedAt: FieldValue.serverTimestamp()
      });

      // Update all team member registration records
      const memberUpdates = (teamData.memberUSNs as string[]).map(async (memberUSN: string) => {
        const memberRegDoc = await db.collection("registrations").doc(memberUSN).get();
        if (memberRegDoc.exists) {
          await db.collection("registrations").doc(memberUSN).update({
            teamEventId: teamData.eventId,
            teamId: teamId,
            updatedAt: FieldValue.serverTimestamp()
          });
        } else {
          // Create registration if doesn't exist
          const memberStudentDoc = await db.collection("students").doc(memberUSN).get();
          if (memberStudentDoc.exists) {
            const studentData = memberStudentDoc.data()!;
            await db.collection("registrations").doc(memberUSN).set({
              usn: memberUSN,
              name: studentData.name,
              email: studentData.email,
              phone: studentData.phone,
              branch: studentData.branch,
              section: studentData.section,
              teamEventId: teamData.eventId,
              teamId: teamId,
              registeredAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp()
            });
          }
        }
      });

      await Promise.all(memberUpdates);

      return NextResponse.json({
        free: true,
        teamId,
        teamName: teamData.teamName,
        eventId: teamData.eventId,
        eventName: eventData.name,
        memberCount: teamData.memberCount,
        status: "complete"
      });
    }

    // Create Razorpay order for paid events
    const order = await getRazorpay().orders.create({
      amount: totalAmount * 100, // Razorpay expects amount in smallest currency unit (paise)
      currency: "INR",
      receipt: `TEAM-${teamId}-${Date.now()}`.slice(0, 40),
      notes: {
        teamId,
        teamName: teamData.teamName,
        eventId: teamData.eventId,
        eventName: eventData.name,
        leaderUSN: teamData.leaderUSN,
        memberCount: teamData.memberCount,
        amountPerMember: pricePerMember,
        totalAmount: totalAmount
      },
    });

    return NextResponse.json({
      free: false,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      teamId,
      teamName: teamData.teamName,
      eventId: teamData.eventId,
      eventName: eventData.name,
      memberCount: teamData.memberCount,
      amountPerMember: pricePerMember,
      totalAmount: totalAmount,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("[POST /api/payment/create-team-order]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create order" }, { status: 500 });
  }
}