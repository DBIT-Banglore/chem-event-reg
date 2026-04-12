import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { rateLimit, getClientIP } from "@/lib/rate-limit";
import { validateUSN, getBranchName, getSection } from "@/lib/usnValidator";

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

/**
 * Round-robin with fallback: start from the next key in rotation,
 * if it fails (rate limit / error), try the remaining keys in order.
 */
async function sendEmailWithFallback(
  toEmail: string,
  subject: string,
  html: string
): Promise<void> {
  const creds = getBrevoCredentials();
  if (creds.length === 0) throw new Error("No Brevo API keys configured");

  const startIdx = rrIndex % creds.length;
  rrIndex++;

  // Try starting from the round-robin pick, then wrap around
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

// ── Shared email layout helpers ───────────────────────────────────────────

/** Paper nav bar — matches the actual Navbar (paper bg, ink border-bottom, logo-mark, Bebas brand) */
function emailNav(): string {
  return `
    <tr>
      <td style="background:#F2EFE9;padding:14px 36px;border-bottom:1.5px solid #0D0D0D;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="background:#0D0D0D;border-radius:50%;width:26px;height:26px;text-align:center;vertical-align:middle;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F2EFE9" stroke-width="2.5" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
                </svg>
              </td>
              <td style="padding-left:8px;font-family:'Bebas Neue','Arial Black',Impact,sans-serif;font-size:22px;letter-spacing:0.06em;color:#0D0D0D;vertical-align:middle;">Idea Lab</td>
            </tr></table>
          </td>
          <td align="right" style="font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.16em;color:#7A7670;vertical-align:middle;">DBIT</td>
        </tr></table>
      </td>
    </tr>`;
}

/** Dark ticker strip — matches .ticker (ink bg, paper text, red dot separators) */
function emailTicker(items: string[]): string {
  const cells = items.map((item, i) =>
    `<td style="padding:0 20px;${i < items.length - 1 ? "border-right:1px solid rgba(255,255,255,0.12);" : ""}vertical-align:middle;white-space:nowrap;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:8px;vertical-align:middle;"><div style="width:5px;height:5px;background:#E8341A;border-radius:50%;display:inline-block;"></div></td>
        <td style="font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#F2EFE9;vertical-align:middle;">${item}</td>
      </tr></table>
    </td>`
  ).join("");
  return `
    <tr>
      <td style="background:#0D0D0D;height:38px;overflow:hidden;padding:0 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table>
      </td>
    </tr>`;
}

/** Eyebrow row — matches .hero-eyebrow (red dot, uppercase label, red flex line) */
function emailEyebrow(label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:16px;width:100%;">
      <tr>
        <td style="vertical-align:middle;white-space:nowrap;padding-right:12px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:8px;vertical-align:middle;">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#E8341A" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="5"/></svg>
            </td>
            <td style="font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#E8341A;vertical-align:middle;">${label}</td>
          </tr></table>
        </td>
        <td style="border-top:1.5px solid #E8341A;width:100%;vertical-align:middle;">&nbsp;</td>
      </tr>
    </table>`;
}

/** Footer row — matches footer (.footer-brand: Bebas Neue, muted, exact copyright text) */
function emailFooter(): string {
  return `
    <tr>
      <td style="padding:20px 36px;border-top:1.5px solid #0D0D0D;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-family:'Bebas Neue','Arial Black',Impact,sans-serif;font-size:13px;letter-spacing:0.1em;color:#7A7670;line-height:1.6;">
            &copy; 2026 Chem Event Reg &mdash; Chemistry Department,<br>Don Bosco Institute of Technology, Bangalore
          </td>
          <td align="right" valign="bottom" style="font-family:'Bebas Neue','Arial Black',Impact,sans-serif;font-size:11px;letter-spacing:0.08em;color:#7A7670;line-height:1.6;white-space:nowrap;">
            Built by Dept. of CSE,<br>Section B &mdash; DBIT
          </td>
        </tr></table>
      </td>
    </tr>`;
}

// ── OTP email template ────────────────────────────────────────────────────

function buildEmailHtml(otp: string): string {
  const digits = otp.split("");
  const digitCells = digits
    .map(
      (d, i) =>
        `<td style="width:48px;height:56px;text-align:center;vertical-align:middle;font-size:28px;font-family:'Bebas Neue','Arial Black',Impact,sans-serif;color:#0D0D0D;background:#F2EFE9;border:1.5px solid #0D0D0D;${i < 5 ? "border-right:none;" : ""}">${d}</td>`
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
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#F2EFE9;border:1.5px solid #0D0D0D;">

        ${emailNav()}
        ${emailTicker(["Registrations Open","Chemistry Department","DBIT Bangalore","Email Verification","Secure Access","One-Time Code"])}

        <!-- HERO SECTION -->
        <tr>
          <td style="padding:48px 36px 0;">
            ${emailEyebrow("Verification Code &mdash; 2026")}

            <!-- Heading (matches .hero-h1 + .stroke-text) -->
            <div style="margin-bottom:20px;">
              <div style="font-family:'Bebas Neue','Arial Black',Impact,sans-serif;font-size:56px;line-height:0.92;letter-spacing:0.01em;color:#0D0D0D;">Confirm</div>
              <div style="font-family:'Bebas Neue','Arial Black',Impact,sans-serif;font-size:56px;line-height:0.92;letter-spacing:0.01em;color:transparent;-webkit-text-stroke:2px #0D0D0D;">Your</div>
              <div style="font-family:'Bebas Neue','Arial Black',Impact,sans-serif;font-size:56px;line-height:0.92;letter-spacing:0.01em;color:#0D0D0D;">Identity.</div>
            </div>

            <!-- Description (matches .hero-desc) -->
            <p style="margin:0 0 40px;font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:15px;color:#7A7670;line-height:1.7;max-width:400px;">
              Enter the code below to verify your student email and complete your Chem Event registration on Idea Lab.
            </p>
          </td>
        </tr>

        <!-- DIVIDER -->
        <tr><td style="padding:0 36px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1.5px solid #0D0D0D;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>

        <!-- OTP STAT BLOCK (matches .stat-block: full-width, border-bottom) -->
        <tr>
          <td style="padding:40px 36px;border-bottom:1.5px solid rgba(13,13,13,0.12);">
            <!-- stat-label -->
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr>
                <td style="padding-right:8px;vertical-align:middle;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7A7670" stroke-width="2" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                </td>
                <td style="font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#7A7670;vertical-align:middle;">Your One-Time Code</td>
              </tr>
            </table>

            <!-- Digit boxes -->
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
              <tr>${digitCells}</tr>
            </table>

            <!-- Copyable plain code -->
            <p style="margin:0 0 28px;font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:11px;color:#7A7670;letter-spacing:0.02em;">
              Or copy:&nbsp;<span style="font-family:'Courier New',monospace;font-size:18px;font-weight:700;color:#0D0D0D;letter-spacing:6px;">${otp}</span>
            </p>

            <!-- Expiry (.step-tag red variant: border-left accent, lightning icon) -->
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:5px 12px;border:1.5px solid rgba(232,52,26,0.3);border-left:3px solid #E8341A;">
                  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                    <td style="padding-right:7px;vertical-align:middle;">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#E8341A" stroke-width="2.5" xmlns="http://www.w3.org/2000/svg">
                        <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                      </svg>
                    </td>
                    <td style="font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#E8341A;vertical-align:middle;">Expires in 10 minutes &mdash; do not share</td>
                  </tr></table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Ignore notice -->
        <tr>
          <td style="padding:24px 36px;">
            <p style="margin:0;font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:12px;color:#7A7670;line-height:1.7;">
              If you didn't request this code, you can safely ignore this email. Your account remains secure.
            </p>
          </td>
        </tr>

        ${emailFooter()}

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

    // Store OTP in Firestore (admin SDK)
    await adminDb.collection("otp_codes").add({
      email: cleanEmail,
      otp,
      expiresAt,
      used: false,
      attempts: 0,
      createdAt: now,
    });

    // Send email with round-robin + fallback
    await sendEmailWithFallback(
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
