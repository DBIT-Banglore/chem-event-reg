import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { rateLimit, getClientIP } from "@/lib/rate-limit";
import { validateUSN, getBranchName, getSection } from "@/lib/usnValidator";
import { sendEmail } from "@/lib/brevo";

// Issue #1: Use a cryptographically secure RNG instead of Math.random()
function generateOTP(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

// Issue #2: Store an HMAC hash of the OTP rather than the plaintext value
function hashOTP(otp: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET env var is not set");
  return crypto.createHmac("sha256", secret).update(otp).digest("hex");
}

// Issue #10: Brevo sending now delegated to shared lib/brevo.ts

// ── Email template ────────────────────────────────────────────────────────

function buildEmailHtml(otp: string): string {
  const digits = otp.split("");
  const digitCells = digits
    .map(
      (d, i) =>
        `<td style="width:44px;height:52px;text-align:center;vertical-align:middle;font-size:26px;font-weight:800;font-family:'Bebas Neue','Arial Black',Impact,sans-serif;color:#0D0D0D;background:#E8E4DD;border:1.5px solid #0D0D0D;${i < 5 ? "border-right:none;" : ""}">${d}</td>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#E8E4DD;font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E8E4DD;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="500" cellpadding="0" cellspacing="0" style="max-width:500px;width:100%;background:#F2EFE9;border:1.5px solid #0D0D0D;">

        <!-- Header: matches Navbar -->
        <tr>
          <td style="background:#0D0D0D;padding:16px 32px;border-bottom:1.5px solid #0D0D0D;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-family:'Bebas Neue','Arial Black',Impact,sans-serif;font-size:24px;font-weight:700;color:#F2EFE9;letter-spacing:0.01em;">&#9788; IDEA LAB</td>
                <td align="right" style="font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:10px;font-weight:600;color:#7A7670;text-transform:uppercase;letter-spacing:2px;">DBIT</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Ticker-style accent bar -->
        <tr>
          <td style="background:#E8341A;padding:8px 32px;">
            <p style="margin:0;font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:10px;font-weight:600;color:#F2EFE9;text-transform:uppercase;letter-spacing:3px;text-align:center;">Email Verification &bull; Secure Access &bull; One-Time Code</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 32px 32px;">
            <!-- Section label -->
            <p style="margin:0 0 4px;font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#7A7670;">Verification Code</p>
            <!-- Heading -->
            <p style="margin:0 0 20px;font-family:'Bebas Neue','Arial Black',Impact,sans-serif;font-size:32px;font-weight:700;color:#0D0D0D;letter-spacing:0.01em;line-height:1.1;">Confirm Your Identity</p>
            <!-- Description -->
            <p style="margin:0 0 28px;font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:400;color:#0D0D0D;line-height:1.6;">Enter the code below to verify your student email on Idea Lab.</p>

            <!-- Divider -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr><td style="border-top:1.5px solid rgba(13,13,13,0.12);font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>

            <!-- OTP digit boxes -->
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 12px;">
              <tr>${digitCells}</tr>
            </table>

            <!-- Copyable OTP -->
            <p style="margin:0 0 28px;text-align:center;font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:11px;color:#7A7670;">Tap to copy: <span style="font-family:'Courier New',monospace;font-size:18px;font-weight:700;color:#0D0D0D;letter-spacing:6px;user-select:all;-webkit-user-select:all;">${otp}</span></p>

            <!-- Divider -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr><td style="border-top:1.5px solid rgba(13,13,13,0.12);font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>

            <!-- Expiry warning (matches app's red accent pattern) -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="padding:12px 16px;background:#F2EFE9;border:1.5px solid #E8341A;border-left:4px solid #E8341A;">
                  <p style="margin:0;font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:12px;font-weight:600;color:#E8341A;text-transform:uppercase;letter-spacing:0.5px;">&#9888; This code expires in 10 minutes</p>
                </td>
              </tr>
            </table>

            <!-- Ignore notice -->
            <p style="margin:0;font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:12px;color:#7A7670;line-height:1.7;">If you didn't request this code, you can safely ignore this email.</p>
          </td>
        </tr>

        <!-- Footer: matches app footer style -->
        <tr>
          <td style="padding:20px 32px;border-top:1.5px solid rgba(13,13,13,0.12);background:#F2EFE9;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:11px;color:#7A7670;line-height:1.6;">Don Bosco Institute of Technology<br>Kumbalagodu, Bangalore</td>
                <td align="right" valign="bottom" style="font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:10px;color:#aaa;">Automated message<br>Do not reply</td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Route handler ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { email, usn } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!usn || typeof usn !== "string") {
      return NextResponse.json({ error: "USN is required" }, { status: 400 });
    }

    // IP rate limiting: 5 sends per IP per 15 min
    const ip = getClientIP(req);
    const { allowed, retryAfterMs } = rateLimit(ip, "send-otp", 5, 15 * 60 * 1000);
    if (!allowed) {
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      return NextResponse.json(
        { error: `Too many requests. Please try again in ${retryAfterSec} seconds.` },
        { status: 429 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUSN = usn.trim().toUpperCase();
    const adminDb = getAdminFirestore();

    // Validate USN against local CSV-derived list (not Firebase)
    const usnCheck = validateUSN(cleanUSN);
    if (!usnCheck.valid) {
      return NextResponse.json(
        { error: usnCheck.error || "Invalid USN." },
        { status: 400 }
      );
    }

    // Check if email matches in students or registrations (Firebase lookup for email match only)
    const [studentDoc, regDoc] = await Promise.all([
      adminDb.collection("students").doc(cleanUSN).get(),
      adminDb.collection("registrations").doc(cleanUSN).get(),
    ]);

    // If student exists in Firebase, verify email matches
    const storedEmail = (regDoc.exists ? regDoc.data()?.email : studentDoc.exists ? studentDoc.data()?.email : null);
    if (storedEmail && storedEmail.trim().toLowerCase() !== cleanEmail) {
      return NextResponse.json(
        { error: "Email does not match the USN on record." },
        { status: 400 }
      );
    }

    const otp = generateOTP();
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000;

    // Rate limit: max 1 OTP per email per 60 seconds
    const recentSnap = await adminDb
      .collection("otp_codes")
      .where("email", "==", cleanEmail)
      .where("used", "==", false)
      .where("createdAt", ">", now - 60 * 1000)
      .limit(1)
      .get();

    if (!recentSnap.empty) {
      return NextResponse.json(
        { error: "Please wait 60 seconds before requesting another code." },
        { status: 429 }
      );
    }

    // Issue #2: Store HMAC hash of the OTP — not the plaintext value
    await adminDb.collection("otp_codes").add({
      email: cleanEmail,
      otpHash: hashOTP(otp),
      expiresAt,
      used: false,
      attempts: 0,
      createdAt: now,
    });

    // Issue #10: Use shared Brevo utility
    await sendEmail(
      cleanEmail,
      `${otp} is your Idea Lab verification code`,
      buildEmailHtml(otp)
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Send OTP error:", err);
    return NextResponse.json(
      { error: "Failed to send verification code. Please try again." },
      { status: 500 }
    );
  }
}
