import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import Razorpay from "razorpay";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
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

    // Rate limit: 10 payment verifications per hour per user
    const rl = rateLimit(usn, "team-payment-verify", 10, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many payment attempts. Try again later." }, { status: 429 });
    }

    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, teamId } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !teamId) {
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

    // Fetch order from Razorpay server-side to verify notes/amount
    let razorpayOrder: Record<string, any>;
    try {
      razorpayOrder = await razorpay.orders.fetch(razorpay_order_id) as Record<string, any>;
    } catch {
      console.error("[team-payment/verify] Failed to fetch Razorpay order", razorpay_order_id);
      return NextResponse.json({ error: "Could not verify order with payment provider" }, { status: 502 });
    }

    // Verify order belongs to this authenticated user (team leader)
    const orderTeamId = (razorpayOrder.notes as Record<string, string>)?.teamId;
    if (!orderTeamId || orderTeamId !== teamId) {
      return NextResponse.json({ error: "Order does not belong to this team" }, { status: 403 });
    }

    const db = getAdminFirestore();
    const teamRef = db.collection("teams").doc(teamId);
    const eventRef = db.collection("events").doc(razorpayOrder.notes?.eventId);

    const result = await db.runTransaction(async (txn) => {
      // ── Phase 1: ALL READS ────────────────────────────────────────────────
      const [teamDoc, eventDoc] = await Promise.all([txn.get(teamRef), txn.get(eventRef)]);

      if (!teamDoc.exists) throw Object.assign(new Error("Team not found"), { status: 404 });
      if (!eventDoc.exists) throw Object.assign(new Error("Event not found"), { status: 404 });

      const team = teamDoc.data()!;
      const event = eventDoc.data()!;

      // Verify user is team leader
      if (team.leaderUSN !== usn) {
        throw Object.assign(new Error("Only team leader can verify payment"), { status: 403 });
      }

      // Idempotency: already processed this team payment
      if (team.paymentId === razorpay_payment_id && team.status === "paid") {
        return { alreadyProcessed: true, paymentId: razorpay_payment_id, teamId };
      }

      // Verify team is in correct state for payment
      if (team.status !== "verified") {
        throw Object.assign(new Error(`Team status is ${team.status}, cannot process payment`), { status: 400 });
      }

      // Verify all members are still verified
      const allMembersVerified = Object.values(team.otpVerificationStatus || {}).every(Boolean);
      if (!allMembersVerified) {
        throw Object.assign(new Error("Not all team members have verified"), { status: 400 });
      }

      // Verify paid amount matches expected (prevent underpayment)
      const expectedAmount = Number(razorpayOrder.amount);
      const paidAmount = Number(razorpayOrder.amount_paid ?? razorpayOrder.amount);
      if (paidAmount < expectedAmount) {
        console.error(`[team-payment/verify] Underpayment: expected ${expectedAmount}, got ${paidAmount}`);
        throw Object.assign(new Error("Insufficient payment amount"), { status: 400 });
      }

      // Read all member registration + student docs before any writes
      const memberUSNs = team.memberUSNs as string[];
      const memberRegRefs = memberUSNs.map((u: string) => db.collection("registrations").doc(u));
      const memberStudentRefs = memberUSNs.map((u: string) => db.collection("students").doc(u));

      const [memberRegDocs, memberStudentDocs] = await Promise.all([
        Promise.all(memberRegRefs.map((ref) => txn.get(ref))),
        Promise.all(memberStudentRefs.map((ref) => txn.get(ref))),
      ]);

      // Capacity check (non-transactional, best-effort — fine for this use case)
      const currentTeamCount = await db
        .collection("teams")
        .where("eventId", "==", team.eventId)
        .where("status", "in", ["paid", "complete"])
        .get();

      const occupiedSlots = currentTeamCount.docs.reduce((total, doc) => {
        return total + (doc.data()?.memberCount || 0);
      }, 0);

      if (occupiedSlots + team.memberCount > event.capacity) {
        throw Object.assign(new Error("Event has become full. Payment recorded but team cannot join."), { status: 409 });
      }

      // ── Phase 2: ALL WRITES ───────────────────────────────────────────────

      // Update team payment status
      txn.update(teamRef, {
        status: "paid",
        paymentId: razorpay_payment_id,
        paymentStatus: "paid",
        totalAmount: paidAmount / 100,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Update event registration count (increment by team size)
      txn.update(eventRef, {
        registrationCount: FieldValue.increment(team.memberCount),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Update all team member registration records
      for (let i = 0; i < memberUSNs.length; i++) {
        const memberUSN = memberUSNs[i];
        const memberRegRef = memberRegRefs[i];
        const memberRegDoc = memberRegDocs[i];

        if (memberRegDoc.exists) {
          txn.update(memberRegRef, {
            teamEventId: team.eventId,
            teamId: teamId,
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
          const memberStudentDoc = memberStudentDocs[i];
          if (memberStudentDoc.exists) {
            const studentData = memberStudentDoc.data()!;
            txn.set(memberRegRef, {
              usn: memberUSN,
              name: studentData.name,
              email: studentData.email,
              phone: studentData.phone,
              branch: studentData.branch,
              section: studentData.section,
              teamEventId: team.eventId,
              teamId: teamId,
              registeredAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        }
      }

      return { alreadyProcessed: false, paymentId: razorpay_payment_id, teamId };
    });

    return NextResponse.json({
      success: true,
      paymentId: result.paymentId,
      teamId: result.teamId,
      message: "Team payment verified successfully! All team members are now registered."
    });
  } catch (err) {
    console.error("[POST /api/payment/verify-team-payment]", err);
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to verify payment" }, { status });
  }
}