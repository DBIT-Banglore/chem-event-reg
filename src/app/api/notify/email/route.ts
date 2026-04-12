import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";

// ── Brevo multi-key round-robin with fallback (separate counter from OTP) ──

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
  if (process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL) {
    return [{ apiKey: process.env.BREVO_API_KEY, senderEmail: process.env.BREVO_SENDER_EMAIL }];
  }
  return [];
}

let notifyRRIndex = 0;

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
    console.error(`[notify] Brevo key ...${cred.apiKey.slice(-8)} failed: ${errMsg}`);
    return { ok: false, status: res.status, error: errMsg };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    console.error(`[notify] Brevo key ...${cred.apiKey.slice(-8)} exception: ${msg}`);
    return { ok: false, status: 0, error: msg };
  }
}

async function sendEmailWithFallback(
  toEmail: string,
  subject: string,
  html: string
): Promise<void> {
  const creds = getBrevoCredentials();
  if (creds.length === 0) throw new Error("No Brevo API keys configured");

  const startIdx = notifyRRIndex % creds.length;
  notifyRRIndex++;

  for (let attempt = 0; attempt < creds.length; attempt++) {
    const idx = (startIdx + attempt) % creds.length;
    const result = await sendWithBrevo(creds[idx], toEmail, subject, html);
    if (result.ok) return;
    console.warn(`[notify] Key ${idx + 1}/${creds.length} failed (${result.status}), trying next...`);
  }

  throw new Error("All Brevo API keys exhausted. Could not send notification email.");
}

// ── Email templates ─────────────────────────────────────────────────────

function getAppUrl(req: NextRequest): string {
  // Auto-detect from request headers — no env var needed
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

// ── Shared layout primitives ───────────────────────────────────────────────

const EMAIL_STYLES = `<style>
  @media only screen and (max-width:620px){
    .ec{width:100%!important}
    .pad{padding-left:20px!important;padding-right:20px!important}
    .pad-top{padding-top:28px!important}
    .h1{font-size:38px!important;line-height:0.95!important}
    .fr{display:none!important;visibility:hidden!important;max-height:0!important;overflow:hidden!important}
    .btn-full{display:block!important;text-align:center!important}
  }
</style>`;

function emailNav(): string {
  return `
    <tr>
      <td class="pad" style="background:#F2EFE9;padding:14px 36px;border-bottom:1.5px solid #0D0D0D;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="background:#0D0D0D;border-radius:50%;width:28px;height:28px;text-align:center;vertical-align:middle;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F2EFE9" stroke-width="2.5" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
                </svg>
              </td>
              <td style="padding-left:10px;font-family:'Bebas Neue','Arial Black',Impact,sans-serif;font-size:24px;letter-spacing:0.06em;color:#0D0D0D;vertical-align:middle;">Idea Lab</td>
            </tr></table>
          </td>
          <td align="right" style="font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.16em;color:#7A7670;vertical-align:middle;">DBIT</td>
        </tr></table>
      </td>
    </tr>`;
}

function emailTicker(items: string[]): string {
  const cells = items.map((item, i) =>
    `<td style="padding:0 14px;${i < items.length - 1 ? "border-right:1px solid rgba(255,255,255,0.15);" : ""}vertical-align:middle;white-space:nowrap;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:6px;vertical-align:middle;"><div style="width:5px;height:5px;background:#E8341A;border-radius:50%;display:inline-block;"></div></td>
        <td style="font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#F2EFE9;vertical-align:middle;">${item}</td>
      </tr></table>
    </td>`
  ).join("");
  return `
    <tr>
      <td style="background:#0D0D0D;padding:0;">
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="min-width:100%;height:36px;"><tr>${cells}</tr></table>
        </div>
      </td>
    </tr>`;
}

function emailEyebrow(label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:16px;width:100%;">
      <tr>
        <td style="vertical-align:middle;white-space:nowrap;padding-right:12px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:7px;vertical-align:middle;">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="#E8341A" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12"/></svg>
            </td>
            <td style="font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:#E8341A;vertical-align:middle;">${label}</td>
          </tr></table>
        </td>
        <td style="border-top:1.5px solid #E8341A;width:100%;vertical-align:middle;">&nbsp;</td>
      </tr>
    </table>`;
}

function emailFooter(): string {
  return `
    <tr>
      <td class="pad" style="padding:18px 36px;border-top:1.5px solid #0D0D0D;background:#F2EFE9;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-family:'Bebas Neue','Arial Black',Impact,sans-serif;font-size:12px;letter-spacing:0.08em;color:#7A7670;line-height:1.7;">
            &copy; 2026 Idea Lab &mdash; Chemistry Dept, DBIT Bangalore<br>
            <span style="font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:10px;font-weight:600;letter-spacing:0.04em;">By Mithun Gowda B &amp; Lekhan HR</span>
          </td>
          <td class="fr" align="right" valign="bottom" style="font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:10px;color:#7A7670;white-space:nowrap;line-height:1.6;">
            Dept. of CSE<br>Section B
          </td>
        </tr></table>
      </td>
    </tr>`;
}

function buildInviteEmail(fromName: string, teamName: string, inviteId: string, baseUrl: string): string {
  const inviteUrl = `${baseUrl}/invite/${inviteId}`;
  const safeFrom = escapeHtml(fromName);
  const safeTeam = escapeHtml(teamName);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet">
  ${EMAIL_STYLES}
</head>
<body style="margin:0;padding:0;background:#E8E4DD;font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E8E4DD;padding:32px 12px;">
    <tr><td align="center">
      <table class="ec" role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#F2EFE9;border:1.5px solid #0D0D0D;">

        ${emailNav()}
        ${emailTicker(["Idea Lab","DBIT Bangalore","Team Invite","Action Required"])}

        <!-- HERO -->
        <tr>
          <td class="pad pad-top" style="padding:44px 36px 0;">
            ${emailEyebrow("Team Invitation &mdash; Action Required")}

            <div style="margin-bottom:18px;">
              <div class="h1" style="font-family:'Bebas Neue','Arial Black',Impact,sans-serif;font-size:54px;line-height:0.92;letter-spacing:0.01em;color:#0D0D0D;">You&apos;re</div>
              <div class="h1" style="font-family:'Bebas Neue','Arial Black',Impact,sans-serif;font-size:54px;line-height:0.92;letter-spacing:0.01em;color:transparent;-webkit-text-stroke:2px #0D0D0D;">Invited</div>
              <div class="h1" style="font-family:'Bebas Neue','Arial Black',Impact,sans-serif;font-size:54px;line-height:0.92;letter-spacing:0.01em;color:#0D0D0D;">to join.</div>
            </div>

            <p style="margin:0 0 32px;font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:14px;color:#7A7670;line-height:1.7;">
              <strong style="color:#0D0D0D;">${safeFrom}</strong> has invited you to join <strong style="color:#0D0D0D;">${safeTeam}</strong> on Idea Lab. Accept or decline from your dashboard.
            </p>
          </td>
        </tr>

        <!-- DIVIDER -->
        <tr><td class="pad" style="padding:0 36px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1.5px solid #0D0D0D;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>

        <!-- CTA BLOCK -->
        <tr>
          <td class="pad" style="padding:36px 36px;border-bottom:1.5px solid rgba(13,13,13,0.12);">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
              <tr>
                <td style="padding-right:8px;vertical-align:middle;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7A7670" stroke-width="2" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </td>
                <td style="font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#7A7670;vertical-align:middle;">View Invitation</td>
              </tr>
            </table>

            <!-- CTA button — full-width on mobile -->
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;width:100%;">
              <tr>
                <td style="background:#0D0D0D;padding:14px 32px;text-align:center;">
                  <a href="${inviteUrl}" style="font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:13px;font-weight:700;color:#F2EFE9;text-decoration:none;text-transform:uppercase;letter-spacing:0.08em;">
                    View Invite &nbsp;&#8594;
                  </a>
                </td>
              </tr>
            </table>

            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:4px 10px;border:1.5px solid rgba(13,13,13,0.12);">
                  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                    <td style="padding-right:6px;vertical-align:middle;">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#7A7670" stroke-width="2.5" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                    </td>
                    <td style="font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#7A7670;vertical-align:middle;">Secure &mdash; Idea Lab</td>
                  </tr></table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Ignore notice -->
        <tr>
          <td class="pad" style="padding:22px 36px;">
            <p style="margin:0;font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:12px;color:#7A7670;line-height:1.7;">
              Weren&apos;t expecting this invite? You can safely ignore this email.
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

function buildRequestEmail(fromName: string, teamName: string, baseUrl: string): string {
  const dashboardUrl = `${baseUrl}/dashboard`;
  const safeFrom = escapeHtml(fromName);
  const safeTeam = escapeHtml(teamName);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet">
  ${EMAIL_STYLES}
</head>
<body style="margin:0;padding:0;background:#E8E4DD;font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E8E4DD;padding:32px 12px;">
    <tr><td align="center">
      <table class="ec" role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#F2EFE9;border:1.5px solid #0D0D0D;">

        ${emailNav()}
        ${emailTicker(["Idea Lab","DBIT Bangalore","Join Request","Review Needed"])}

        <!-- HERO -->
        <tr>
          <td class="pad pad-top" style="padding:44px 36px 0;">
            ${emailEyebrow("Join Request &mdash; Review Needed")}

            <div style="margin-bottom:18px;">
              <div class="h1" style="font-family:'Bebas Neue','Arial Black',Impact,sans-serif;font-size:54px;line-height:0.92;letter-spacing:0.01em;color:#0D0D0D;">New</div>
              <div class="h1" style="font-family:'Bebas Neue','Arial Black',Impact,sans-serif;font-size:54px;line-height:0.92;letter-spacing:0.01em;color:transparent;-webkit-text-stroke:2px #0D0D0D;">Join</div>
              <div class="h1" style="font-family:'Bebas Neue','Arial Black',Impact,sans-serif;font-size:54px;line-height:0.92;letter-spacing:0.01em;color:#0D0D0D;">Request.</div>
            </div>

            <p style="margin:0 0 32px;font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:14px;color:#7A7670;line-height:1.7;">
              <strong style="color:#0D0D0D;">${safeFrom}</strong> wants to join <strong style="color:#0D0D0D;">${safeTeam}</strong>. Review the request from your dashboard and accept or decline.
            </p>
          </td>
        </tr>

        <!-- DIVIDER -->
        <tr><td class="pad" style="padding:0 36px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1.5px solid #0D0D0D;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>

        <!-- CTA BLOCK -->
        <tr>
          <td class="pad" style="padding:36px 36px;border-bottom:1.5px solid rgba(13,13,13,0.12);">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
              <tr>
                <td style="padding-right:8px;vertical-align:middle;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7A7670" stroke-width="2" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </td>
                <td style="font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#7A7670;vertical-align:middle;">Go to Dashboard</td>
              </tr>
            </table>

            <!-- CTA button — full-width on mobile -->
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;width:100%;">
              <tr>
                <td style="background:#0D0D0D;padding:14px 32px;text-align:center;">
                  <a href="${dashboardUrl}" style="font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:13px;font-weight:700;color:#F2EFE9;text-decoration:none;text-transform:uppercase;letter-spacing:0.08em;">
                    Review Request &nbsp;&#8594;
                  </a>
                </td>
              </tr>
            </table>

            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:5px 10px;border:1.5px solid rgba(232,52,26,0.3);border-left:3px solid #E8341A;">
                  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                    <td style="padding-right:6px;vertical-align:middle;">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#E8341A" stroke-width="2.5" xmlns="http://www.w3.org/2000/svg">
                        <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                      </svg>
                    </td>
                    <td style="font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#E8341A;vertical-align:middle;">Action Required &mdash; Review Pending</td>
                  </tr></table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Notice -->
        <tr>
          <td class="pad" style="padding:22px 36px;">
            <p style="margin:0;font-family:'Instrument Sans','Helvetica Neue',Arial,sans-serif;font-size:12px;color:#7A7670;line-height:1.7;">
              You&apos;re receiving this because you&apos;re the lead of ${safeTeam}.
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

// ── Route handler ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { type, toUSN, fromName, teamName, teamId, inviteId } = await req.json();

    if (!type || !toUSN || !fromName || !teamName || !teamId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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

    if (type === "invite") {
      await sendEmailWithFallback(
        toEmail,
        `${fromName} invited you to join ${teamName} — Idea Lab`,
        buildInviteEmail(fromName, teamName, inviteId, baseUrl)
      );
    } else if (type === "request") {
      await sendEmailWithFallback(
        toEmail,
        `${fromName} wants to join ${teamName} — Idea Lab`,
        buildRequestEmail(fromName, teamName, baseUrl)
      );
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[notify/email] Error:", err);
    return NextResponse.json({ success: true }); // Don't expose errors, fail silently
  }
}
