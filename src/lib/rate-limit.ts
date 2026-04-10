/**
 * In-memory rate limiter with auto-cleanup
 *
 * Map-based, keyed by `${ip}:${action}`.
 * Cleans up expired entries every 5 minutes.
 */

import { NextRequest } from "next/server";

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Auto-cleanup every 5 minutes
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      // Remove entries with no recent timestamps (older than 30 min)
      entry.timestamps = entry.timestamps.filter((t) => now - t < 30 * 60 * 1000);
      if (entry.timestamps.length === 0) store.delete(key);
    }
  }, 5 * 60 * 1000);
  // Don't block process exit
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

export function rateLimit(
  ip: string,
  action: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  ensureCleanup();

  const key = `${ip}:${action}`;
  const now = Date.now();
  const entry = store.get(key) || { timestamps: [] };

  // Filter to only timestamps within the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    const oldest = entry.timestamps[0];
    const retryAfterMs = windowMs - (now - oldest);
    return { allowed: false, retryAfterMs };
  }

  entry.timestamps.push(now);
  store.set(key, entry);
  return { allowed: true, retryAfterMs: 0 };
}

/**
 * Extract the real client IP.
 *
 * On Vercel: use `request.ip` (set by the edge network, not spoofable).
 * Behind a trusted reverse proxy: use the LAST IP in X-Forwarded-For
 * (the proxy appends the real client IP; earlier entries are client-supplied).
 * Direct connections (no proxy): ignore X-Forwarded-For entirely (client-spoofable).
 */
export function getClientIP(request: NextRequest): string {
  // Vercel provides a reliable IP via its edge network
  // NextRequest.ip is set by Vercel Edge and cannot be spoofed by clients
  const vercelIp = (request as NextRequest & { ip?: string }).ip;
  if (vercelIp) return vercelIp;

  // Behind a trusted reverse proxy: the proxy appends the real client IP
  // as the last entry. Earlier entries are client-controlled and untrusted.
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ips = forwarded.split(",").map((s) => s.trim());
    // Use the rightmost (last) IP — set by the nearest trusted proxy
    return ips[ips.length - 1];
  }

  // x-real-ip is typically set by Nginx and is generally trustworthy
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}
