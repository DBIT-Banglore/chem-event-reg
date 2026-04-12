/**
 * JWT Session Management — Server-side only
 *
 * Uses `jose` (HS256) for Edge-compatible JWT signing/verification.
 * Cookie name: idealab_token
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export const COOKIE_NAME = "idealab_token";

export interface SessionJWTPayload extends JWTPayload {
  usn: string;
  name: string;
  email: string;
  branch: string;
  section: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET env var is not set");
  return new TextEncoder().encode(secret);
}

export async function signSessionJWT(payload: {
  usn: string;
  name: string;
  email: string;
  branch: string;
  section: string;
}): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .setIssuer("chemnova-2026")
    .setAudience("chemnova-student")
    .sign(getSecret());
}

export async function verifySessionJWT(
  token: string
): Promise<SessionJWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: "chemnova-2026",
      audience: "chemnova-student",
    });
    return payload as SessionJWTPayload;
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(req: import("next/server").NextRequest): Promise<Record<string, unknown> | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const jwtSecret = process.env.JWT_SECRET;
  // Never fall back to an empty secret — empty secret lets anyone forge tokens
  if (!jwtSecret) return null;
  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret, {
      issuer: "chemnova-2026",
      audience: "chemnova-student",
    });
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}
