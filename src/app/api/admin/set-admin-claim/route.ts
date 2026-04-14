import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";

/**
 * POST /api/admin/set-admin-claim
 * Sets or removes the `admin: true` custom claim on a Firebase user.
 *
 * Body: { secret: string; uid: string; grant: boolean }
 *
 * Protected by a CLAIM_SECRET env var (set this in your hosting environment).
 * This endpoint is intentionally NOT protected by requireAdmin() because it's
 * used to bootstrap the very first admin account.
 */
export async function POST(req: NextRequest) {
  try {
    const { secret, uid, grant } = await req.json();

    const CLAIM_SECRET = process.env.CLAIM_SECRET;
    if (!CLAIM_SECRET) {
      return NextResponse.json({ error: "CLAIM_SECRET env var not set" }, { status: 500 });
    }
    if (secret !== CLAIM_SECRET) {
      return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
    }
    if (!uid || typeof uid !== "string") {
      return NextResponse.json({ error: "uid required" }, { status: 400 });
    }

    await getAdminAuth().setCustomUserClaims(uid, { admin: grant !== false });

    return NextResponse.json({ success: true, uid, admin: grant !== false });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
