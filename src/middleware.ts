import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { rateLimit, getClientIP } from "@/lib/rate-limit";

const COOKIE_NAME = "idealab_token";

// Admin emails — loaded from env
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

// Allowed origins — loaded from env or defaults
// PRODUCTION: Strictly locked to chem-event.netlify.app
// DEVELOPMENT: Allow localhost for testing
const getDefaultOrigins = () => {
  if (process.env.NODE_ENV === "production") {
    // Production: Only allow the specific Netlify domain
    return "https://chem-event.netlify.app";
  } else {
    // Development: Allow localhost and local network
    return "http://localhost:3000,http://localhost:3001,http://192.0.0.4:3000";
  }
};

const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || getDefaultOrigins())
    .split(",")
    .map((s) => s.trim())
);

function getOrigin(req: NextRequest): string | null {
  return req.headers.get("origin") || req.headers.get("referer")?.replace(/\/[^/]*$/, "") || null;
}

function isSameOriginRequest(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");

  // If no origin header, it's likely a same-origin request or server-side
  if (!origin) {
    return true;
  }

  // Check if the origin matches the current host
  const originHost = new URL(origin).hostname;
  return originHost === host;
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) return new Uint8Array(0);
  return new TextEncoder().encode(secret);
}

async function getJWTPayload(req: NextRequest): Promise<Record<string, unknown> | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const secret = getSecret();
    if (secret.length === 0) return null;
    const { payload } = await jwtVerify(token, secret);
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  const isDev = process.env.NODE_ENV === "development";
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://checkout.razorpay.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com wss://*.firebaseio.com https://api.brevo.com https://api.razorpay.com`
  );
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return response;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Route protection: /dashboard/* ─────────────────────────────────────
  if (pathname.startsWith("/dashboard")) {
    const payload = await getJWTPayload(req);
    if (!payload) {
      const url = req.nextUrl.clone();
      url.pathname = "/register";
      return addSecurityHeaders(NextResponse.redirect(url));
    }
  }

  // ── /admin/* passes through — uses its own Firebase email/password auth ──
  // Security headers still applied; Firebase Auth has built-in brute-force protection.

  // ── API origin checking ─────────────────────────────────────────────────
  if (pathname.startsWith("/api")) {
    // Global rate limit: 200 requests per hour per IP
    const ip = getClientIP(req);
    const globalRl = rateLimit(ip, "global_api", 200, 60 * 60_000);
    if (!globalRl.allowed) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    // Allow same-origin requests (admin panel calling its own API)
    if (isSameOriginRequest(req)) {
      // Same-origin requests are always allowed
      return NextResponse.next();
    }

    const origin = getOrigin(req);

    if (!origin) {
      // Allow server-side calls (SSR/API-to-API within the same app)
      const host = req.headers.get("host");
      const isLocalhost = host?.startsWith("localhost");
      const isSameHost = ALLOWED_ORIGINS.has(`https://${host}`) || ALLOWED_ORIGINS.has(`http://${host}`);
      if (!isLocalhost && !isSameHost) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (!ALLOWED_ORIGINS.has(origin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // ── Apply security headers to all responses ─────────────────────────────
  const response = NextResponse.next();
  return addSecurityHeaders(response);
}

export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
    "/admin/:path*",
  ],
};
