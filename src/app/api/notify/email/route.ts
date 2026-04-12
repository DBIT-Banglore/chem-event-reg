import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getSessionFromRequest } from "@/lib/jwt";
import { rateLimit, getClientIP } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/brevo";

// ── Email templates ─────────────────────────────────────────────────────

function getAppUrl(req: NextRequest): string {
  const origin = req.headers.get("origin");
  if (origin) return origin;
  const host = req.headers.get("host");
  if (host) {
    const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
    return `${proto}://${host}`;
  }
  return "https://idealab.dfriendsclub.in";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildInviteEmail(fromName: string, teamName: string, inviteId: string, baseUrl: string): string {
  const inviteUrl = `${baseUrl}/invite/${inviteId}`;
  const safeFrom = escapeHtml(fromName);
  const safeTeam = escapeHtml(teamName);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#E8E4DD;font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E8E4DD;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="500" cellpadding="0" cellspacing="0" style="max-width:500px;width:100%;background:#F2EFE9;border:1.5px solid #0D0D0D;">

        <!-- Header -->
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

        <!-- Accent bar -->
        <tr>
          <td style="background:#E8341A;padding:8px 32px;">
            <p style="margin:0;font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:10px;font-weight:600;color:#F2EFE9;text-transform:uppercase;letter-spacing:3px;text-align:center;">Team Invite &bull; Action Required</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 32px 32px;">
            <p style="margin:0 0 4px;font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#7A7670;">Team Invitation</p>
            <p style="margin:0 0 20px;font-family:'Bebas Neue','Arial Black',Impact,sans-serif;font-size:32px;font-weight:700;color:#0D0D0D;letter-spacing:0.01em;line-height:1.1;">You're Invited!</p>
            <p style="margin:0 0 28px;font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:400;color:#0D0D0D;line-height:1.6;"><strong>${safeFrom}</strong> has invited you to join <strong>${safeTeam}</strong> on Idea Lab.</p>

            <!-- Divider -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr><td style="border-top:1.5px solid rgba(13,13,13,0.12);font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>

            <!-- CTA Button -->
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
              <tr>
                <td style="background:#0D0D0D;padding:14px 32px;">
                  <a href="${inviteUrl}" style="font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:700;color:#F2EFE9;text-decoration:none;text-transform:uppercase;letter-spacing:1px;">View Invite</a>
                </td>
              </tr>
            </table>

            <!-- Divider -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr><td style="border-top:1.5px solid rgba(13,13,13,0.12);font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>

            <p style="margin:0;font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:12px;color:#7A7670;line-height:1.7;">If you weren't expecting this invite, you can safely ignore this email.</p>
          </td>
        </tr>

        <!-- Footer -->
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

function buildRequestEmail(fromName: string, teamName: string, baseUrl: string): string {
  const dashboardUrl = `${baseUrl}/dashboard`;
  const safeFrom = escapeHtml(fromName);
  const safeTeam = escapeHtml(teamName);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#E8E4DD;font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E8E4DD;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="500" cellpadding="0" cellspacing="0" style="max-width:500px;width:100%;background:#F2EFE9;border:1.5px solid #0D0D0D;">

        <!-- Header -->
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

        <!-- Accent bar -->
        <tr>
          <td style="background:#E8341A;padding:8px 32px;">
            <p style="margin:0;font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:10px;font-weight:600;color:#F2EFE9;text-transform:uppercase;letter-spacing:3px;text-align:center;">Join Request &bull; Review Needed</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 32px 32px;">
            <p style="margin:0 0 4px;font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#7A7670;">Join Request</p>
            <p style="margin:0 0 20px;font-family:'Bebas Neue','Arial Black',Impact,sans-serif;font-size:32px;font-weight:700;color:#0D0D0D;letter-spacing:0.01em;line-height:1.1;">New Request</p>
            <p style="margin:0 0 28px;font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:400;color:#0D0D0D;line-height:1.6;"><strong>${safeFrom}</strong> wants to join <strong>${safeTeam}</strong>. Review the request on your dashboard.</p>

            <!-- Divider -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr><td style="border-top:1.5px solid rgba(13,13,13,0.12);font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>

            <!-- CTA Button -->
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
              <tr>
                <td style="background:#0D0D0D;padding:14px 32px;">
                  <a href="${dashboardUrl}" style="font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:700;color:#F2EFE9;text-decoration:none;text-transform:uppercase;letter-spacing:1px;">Go to Dashboard</a>
                </td>
              </tr>
            </table>

            <!-- Divider -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr><td style="border-top:1.5px solid rgba(13,13,13,0.12);font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>

            <p style="margin:0;font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:12px;color:#7A7670;line-height:1.7;">You're receiving this because you're the lead of ${safeTeam}.</p>
          </td>
        </tr>

        <!-- Footer -->
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

// ── Route handler ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Issue #3: Require a valid JWT session — unauthenticated callers cannot send emails
    const payload = await getSessionFromRequest(req);
    if (!payload?.usn) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const senderUSN = payload.usn as string;

    // Issue #3: IP rate limit — 5 notification emails per IP per 15 minutes
    const ip = getClientIP(req);
    const { allowed, retryAfterMs } = rateLimit(ip, "notify-email", 5, 15 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many requests. Try again in ${Math.ceil(retryAfterMs / 1000)}s.` },
        { status: 429 }
      );
    }

    const { type, toUSN, fromName, teamName, teamId, inviteId } = await req.json();

    if (!type || !toUSN || !fromName || !teamName || !teamId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Issue #3: Verify the authenticated user's name matches fromName to prevent spoofing
    const senderName = payload.name as string | undefined;
    if (senderName && senderName.toLowerCase() !== (fromName as string).toLowerCase()) {
      return NextResponse.json({ error: "fromName does not match authenticated user" }, { status: 403 });
    }

    if (type === "invite" && !inviteId) {
      return NextResponse.json({ error: "inviteId is required for invite type" }, { status: 400 });
    }

    // Look up recipient's email from registrations
    const adminDb = getAdminFirestore();
    const regDoc = await adminDb.collection("registrations").doc(toUSN.toUpperCase()).get();

    if (!regDoc.exists || !regDoc.data()?.email) {
      // Student not registered yet or no email — skip silently
      return NextResponse.json({ success: true });
    }

    const toEmail = regDoc.data()!.email;
    const baseUrl = getAppUrl(req);

    // Issue #10: Use shared Brevo utility (single round-robin counter)
    if (type === "invite") {
      await sendEmail(
        toEmail,
        `${fromName} invited you to join ${teamName} — Idea Lab`,
        buildInviteEmail(fromName, teamName, inviteId, baseUrl)
      );
    } else if (type === "request") {
      await sendEmail(
        toEmail,
        `${fromName} wants to join ${teamName} — Idea Lab`,
        buildRequestEmail(fromName, teamName, baseUrl)
      );
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    // Suppress sender USN lint warning
    void senderUSN;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[notify/email] Error:", err);
    return NextResponse.json({ success: true }); // Don't expose errors, fail silently
  }
}
