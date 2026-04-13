import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { rateLimit, getClientIP } from "@/lib/rate-limit";
import { validateUSN, getBranchName, getSection } from "@/lib/usnValidator";

function generateOTP(): string {
  return randomInt(100000, 1000000).toString();
}

// ── Brevo multi-key round-robin with fallback ─────────────────────────────
// Env format: BREVO_KEYS=apikey1:sender1@mail.com,apikey2:sender2@mail.com,...
// Falls back to single BREVO_API_KEY + BREVO_SENDER_EMAIL if BREVO_KEYS is not set.

interface BrevoCredential {
  apiKey: string;
  senderEmail: string;
}

function getBrevoCredentials(): BrevoCredential[] {
  const multi = process.env.BREVO_KEYS;
  if (multi) {
    return multi.split(",").map((entry) => {
      const [apiKey, senderEmail] = entry.trim().split(":");
      return { apiKey, senderEmail };
    });
  }
  // Single key fallback
  if (process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL) {
    return [{ apiKey: process.env.BREVO_API_KEY, senderEmail: process.env.BREVO_SENDER_EMAIL }];
  }
  return [];
}

// Simple round-robin counter (resets on server restart, which is fine)
let rrIndex = 0;

async function sendWithBrevo(
  cred: BrevoCredential,
  toEmail: string,
  subject: string,
  html: string
): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": cred.apiKey,
      },
      body: JSON.stringify({
        sender: { name: "Idea Lab — DBIT", email: cred.senderEmail },
        to: [{ email: toEmail }],
        subject,
        htmlContent: html,
      }),
    });

    if (res.ok) return { ok: true, status: res.status };

    const errData = await res.json().catch(() => ({}));
    const errMsg = errData?.message || errData?.code || `HTTP ${res.status}`;
    console.error(`Brevo key ...${cred.apiKey.slice(-8)} failed: ${errMsg}`);
    return { ok: false, status: res.status, error: errMsg };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    console.error(`Brevo key ...${cred.apiKey.slice(-8)} exception: ${msg}`);
    return { ok: false, status: 0, error: msg };
  }
}

// ── Round-robin with fallback: start from next key in rotation,
// if it fails (rate limit / error), try remaining keys in order.

async function sendEmailWithFallback(
  toEmail: string,
  subject: string,
  html: string
): Promise<void> {
  const creds = getBrevoCredentials();
  if (creds.length === 0) throw new Error("No Brevo API keys configured");

  const startIdx = rrIndex % creds.length;
  rrIndex++;

  // Try starting from round-robin pick, then wrap around
  for (let attempt = 0; attempt < creds.length; attempt++) {
    const idx = (startIdx + attempt) % creds.length;
    const result = await sendWithBrevo(creds[idx], toEmail, subject, html);
    if (result.ok) return;
    // If rate-limited (429) or unauthorized (401), try next key
    // For other errors, also try next key
    console.warn(`Key ${idx + 1}/${creds.length} failed (${result.status}), trying next...`);
  }

  throw new Error("All Brevo API keys exhausted. Could not send email.");
}

/** Masks an email so only first/last char of local part are visible. */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || !local) return "***@***";
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}

// ── OTP email template — dark brand system matching site ──────────────────

function buildEmailHtml(otp: string, baseUrl: string): string {
  const digits = otp.split("");

  const digitCells = digits
    .map(
      (d, i) =>
        `<td style="width:48px;height:56px;border:1px solid #4a4a4a;text-align:center;vertical-align:middle;font-size:28px;font-weight:700;color:#ffffff;font-family:Arial,Helvetica,sans-serif;${i > 0 ? "padding-left:8px;" : ""}">${d}</td>` +
        (i < 5 ? `<td style="width:8px;"></td>` : "")
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Chem Event Verification Code</title>
  <style>
    @media only screen and (max-width:600px){
      .email-card{width:100%!important}
      .email-body{padding:28px 20px 20px 20px!important}
      .email-hdr{padding:18px 20px!important}
      .email-ftr{padding:20px!important}
      .otp-cell{width:40px!important;height:48px!important;font-size:24px!important}
      .hero-title{font-size:28px!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a0a0a;margin:0;padding:0;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table class="email-card" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#171717;border:1px solid #2e2e2e;">

          <!-- Header -->
          <tr>
            <td class="email-hdr" style="background:#050505;padding:22px 32px;border-bottom:1px solid #2e2e2e;">
              <table width="100%" role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="font-size:18px;line-height:1.2;font-weight:700;color:#ffffff;letter-spacing:0.5px;font-family:Arial,Helvetica,sans-serif;">
                    ChemNova 2026
                  </td>
                  <td align="right" style="font-size:11px;color:#8f8f8f;letter-spacing:3px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">
                    DBIT
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Red accent strip -->
          <tr>
            <td style="background:#ef2b14;padding:12px 32px;text-align:center;color:#ffffff;font-size:10px;letter-spacing:4px;text-transform:uppercase;font-weight:700;font-family:Arial,Helvetica,sans-serif;">
              Chemistry Department • Secure Access • One-Time Code
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td class="email-body" style="padding:40px 40px 20px;">
              <div style="font-size:11px;color:#a1a1a1;letter-spacing:5px;text-transform:uppercase;margin-bottom:14px;font-family:Arial,Helvetica,sans-serif;">
                Verification Code
              </div>
              <div class="hero-title" style="font-size:36px;line-height:1.15;font-weight:700;color:#ffffff;margin-bottom:16px;font-family:Arial,Helvetica,sans-serif;">
                Confirm Your Registration
              </div>
              <div style="font-size:15px;line-height:1.7;color:#d2d2d2;font-family:Arial,Helvetica,sans-serif;">
                Enter code below to verify your student email and continue your
                registration for <strong style="color:#ffffff;">Chem Event Reg</strong>.
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:#2b2b2b;"></div>
            </td>
          </tr>

          <!-- OTP digit boxes -->
          <tr>
            <td style="padding:32px 40px 16px;" align="center">
              <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;text-align:center;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="display:inline-table;margin:0 auto;">
                  <tr>${digitCells}</tr>
                </table>
              </div>
              <div style="margin-top:16px;font-size:13px;color:#9a9a9a;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
                Your code:&nbsp;
                <span style="color:#ffffff;letter-spacing:8px;font-weight:700;font-family:Arial,Helvetica,sans-serif;background:#2b2b2b;padding:4px 8px;border:1px solid #4a4a4a;">${otp}</span>
              </div>
            </td>
          </tr>

          <!-- Expiry -->
          <tr>
            <td style="padding:20px 40px 0 40px;">
              <div style="border:1px solid #ef2b14;color:#ef2b14;padding:16px 20px;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;font-family:Arial,Helvetica,sans-serif;">
                &#9888; This code expires in 10 minutes
              </div>
            </td>
          </tr>

          <!-- Primary CTA -->
          <tr>
            <td align="center" style="padding:28px 40px 8px 40px;">
              <a href="${baseUrl}/register?usn=${encodeURIComponent(otp)}"
                 style="display:inline-block;background:#ef2b14;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;">
                Enter Verification Code
              </a>
            </td>
          </tr>

          <!-- Secondary CTA -->
          <tr>
            <td align="center" style="padding:6px 40px 28px 40px;">
              <a href="${baseUrl}"
                 style="display:inline-block;color:#bdbdbd;text-decoration:none;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">
                Visit Website
              </a>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:#2b2b2b;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="email-ftr" style="padding:24px 40px 32px 40px;font-size:13px;line-height:1.8;color:#9a9a9a;font-family:Arial,Helvetica,sans-serif;">
              If you didn't request this code, you can safely ignore this email.<br><br>
              <span style="color:#ffffff;">Chem Event Reg — Chemistry Department</span><br>
              Don Bosco Institute of Technology, Bangalore<br>
              Built by Mithun Gowda B • Lekhan HR — Dept. of CSE, DBIT
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Route handler ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { usn, sendOtp } = await req.json();

    if (!usn || typeof usn !== "string") {
      return NextResponse.json({ error: "USN is required" }, { status: 400 });
    }

    const cleanUSN = usn.trim().toUpperCase();

    if (!/^[A-Z0-9]{6,12}$/.test(cleanUSN)) {
      return NextResponse.json({ error: "Invalid USN format." }, { status: 400 });
    }

    const adminDb = getAdminFirestore();

    // Check if student is in database (students or registrations)
    const [studentDoc, regDoc] = await Promise.all([
      adminDb.collection("students").doc(cleanUSN).get(),
      adminDb.collection("registrations").doc(cleanUSN).get(),
    ]);

    // Get student info - prioritise registration data if exists
    let studentData = null;
    let emailToSend = null;

    if (regDoc.exists) {
      studentData = regDoc.data()!;
      emailToSend = studentData.email;
    } else if (studentDoc.exists) {
      studentData = studentDoc.data()!;
      emailToSend = studentData.email;
    }

    // If no student data found - return error
    if (!studentData || !emailToSend) {
      return NextResponse.json({
        found: false,
        error: "USN not found in student database. Contact your admin to upload student CSV.",
      });
    }

    // If just looking up USN (not sending OTP), return student info
    if (!sendOtp) {
      return NextResponse.json({
        success: true,
        student: {
          usn: cleanUSN,
          name: studentData.name || "",
          email: emailToSend, // Actual email for verification (frontend will keep this private)
          maskedEmail: maskEmail(emailToSend), // Display only
          branch: studentData.branch || "",
          section: studentData.section || "",
        },
        otpSent: false,
      });
    }

    // IP rate limiting: 5 sends per IP per 15 min
    const ip = getClientIP(req);
    const perMin = rateLimit(ip, "send-otp-min", 5, 60 * 1000);
    if (!perMin.allowed) {
      const sec = Math.ceil(perMin.retryAfterMs / 1000);
      return NextResponse.json(
        { error: `Too many requests. Please wait ${sec}s before trying again.` },
        { status: 429 }
      );
    }
    const perHour = rateLimit(ip, "send-otp-hr", 30, 60 * 60 * 1000);
    if (!perHour.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in an hour." },
        { status: 429 }
      );
    }

    const otp = generateOTP();
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000;

    // Rate limit: max 1 OTP per email per 60 seconds
    const recentSnap = await adminDb
      .collection("otp_codes")
      .where("email", "==", emailToSend)
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

    // Store OTP in Firestore (admin SDK)
    await adminDb.collection("otp_codes").add({
      email: emailToSend,
      otp,
      expiresAt,
      used: false,
      attempts: 0,
      createdAt: now,
    });

    // Send email with round-robin + fallback
    const baseUrl = req.nextUrl.origin;
    await sendEmailWithFallback(
      emailToSend,
      `${otp} is your ChemNova 2026 verification code`,
      buildEmailHtml(otp, baseUrl)
    );

    return NextResponse.json({
      success: true,
      student: {
        usn: cleanUSN,
        name: studentData.name || "",
        email: emailToSend, // Actual email for verification (frontend will keep this private)
        maskedEmail: maskEmail(emailToSend), // Display only
        branch: studentData.branch || "",
        section: studentData.section || "",
      },
      otpSent: true,
    });
  } catch (err) {
    console.error("Send OTP error:", err);
    return NextResponse.json(
      { error: "Failed to send verification code. Please try again." },
      { status: 500 }
    );
  }
}
