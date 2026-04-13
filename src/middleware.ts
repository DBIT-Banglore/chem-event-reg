import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { rateLimit, getClientIP } from "@/lib/rate-limit";

const COOKIE_NAME = "idealab_token";

// Allowed origins — STRICT MODE: Only production and specific local development
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || "https://idealab.dfriendsclub.in,https://chem-event.netlify.app")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
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

  // CSP - Allow inline scripts needed by Next.js/React development
  // Production still allows inline scripts for compatibility
  response.headers.set(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://checkout.razorpay.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com wss://*.firebaseio.com https://api.brevo.com https://api.razorpay.com https://lumberjack.razorpay.com; frame-src https://api.razorpay.com`
  );
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  return response;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Route protection: /dashboard/* ─────────────────────────────
  if (pathname.startsWith("/dashboard")) {
    const payload = await getJWTPayload(req);
    if (!payload) {
      const url = req.nextUrl.clone();
      url.pathname = "/register";
      return addSecurityHeaders(NextResponse.redirect(url));
    }
  }

  // ── Route protection: /register/* ─────────────────────────────
  if (pathname.startsWith("/register")) {
    // Add security headers for registration routes
    return addSecurityHeaders(NextResponse.next());
  }

  // ── Route protection: /status/* ─────────────────────────────
  if (pathname.startsWith("/status")) {
    return addSecurityHeaders(NextResponse.next());
  }

  // ── API origin checking ─────────────────────────────────────────────────
  if (pathname.startsWith("/api")) {
    // Global rate limit: 100 requests per hour per IP (reduced for security)
    const ip = getClientIP(req);
    const globalRl = rateLimit(ip, "global_api", 100, 60 * 60_000);
    if (!globalRl.allowed) {
      return addSecurityHeaders(NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 }));
    }

    // STRICT RATE LIMITING for authentication endpoints
    if (pathname.startsWith("/api/auth")) {
      const authRl = rateLimit(ip, "auth_api", 20, 15 * 60_000); // 20 requests per 15 minutes
      if (!authRl.allowed) {
        return addSecurityHeaders(NextResponse.json({ error: "Too many authentication attempts. Please try again later." }, { status: 429 }));
      }
    }

    // STRICT RATE LIMITING for admin endpoints
    if (pathname.startsWith("/api/admin")) {
      const adminRl = rateLimit(ip, "admin_api", 10, 5 * 60_000); // 10 requests per 5 minutes
      if (!adminRl.allowed) {
        return addSecurityHeaders(NextResponse.json({ error: "Too many admin requests. Please try again later." }, { status: 429 }));
      }
    }

    // CORS checking for API calls
    // In development, allow localhost requests; in production, enforce strict CORS
    const host = req.headers.get("host");
    const isLocalhost = host?.startsWith("localhost");
    const origin = getOrigin(req);

    if (!isLocalhost && origin && !ALLOWED_ORIGINS.has(origin)) {
      return addSecurityHeaders(NextResponse.json({ error: "Forbidden: Cross-origin requests not allowed" }, { status: 403 }));
    }
  }

  // ── Apply security headers to all responses ─────────────────────────────
  const response = NextResponse.next();
  return addSecurityHeaders(response);
}