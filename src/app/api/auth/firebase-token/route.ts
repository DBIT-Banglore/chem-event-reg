import { NextRequest, NextResponse } from "next/server";
import { verifySessionJWT, COOKIE_NAME } from "@/lib/jwt";
import { getAdminAuth } from "@/lib/firebase-admin";

/**
 * GET /api/auth/firebase-token
 *
 * Reads JWT from cookie, creates a fresh Firebase custom token.
 * Used to re-authenticate Firebase Auth when its session expires.
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const payload = await verifySessionJWT(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const customToken = await getAdminAuth().createCustomToken(payload.usn);

    return NextResponse.json({ customToken, usn: payload.usn });
  } catch (err) {
    console.error("Firebase token error:", err);
    return NextResponse.json(
      { error: "Failed to create token" },
      { status: 500 }
    );
  }
}
