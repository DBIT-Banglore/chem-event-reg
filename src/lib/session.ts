/**
 * Session Management
 *
 * localStorage functions remain for UI data cache.
 * New functions handle JWT cookie auth + Firebase custom token auth.
 */

import { SessionData } from "./types";
import { signInWithCustomToken, signOut } from "firebase/auth";
import { auth } from "./firebase";

const SESSION_KEY = "idealab_session";

// ── localStorage session (UI data cache) ──────────────────────────────────

export function getSession(): SessionData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export function setSession(data: SessionData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

export function isLoggedIn(): boolean {
  return getSession() !== null;
}

export function updateSessionEvent(eventId: string | null): void {
  const session = getSession();
  if (!session) return;
  session.eventId = eventId;
  setSession(session);
}

// ── Firebase Auth initialization from JWT cookie ──────────────────────────

/**
 * Check if Firebase Auth is active; if not, call /api/auth/firebase-token
 * to get a custom token and sign in. Returns true if auth is active/restored.
 */
export async function initializeAuth(): Promise<boolean> {
  // If already signed in, we're good
  if (auth.currentUser) return true;

  try {
    const res = await fetch("/api/auth/firebase-token");
    if (!res.ok) return false;

    const { customToken } = await res.json();
    if (!customToken) return false;

    await signInWithCustomToken(auth, customToken);
    return true;
  } catch {
    return false;
  }
}

/**
 * Full logout: clear localStorage + Firebase signOut + clear JWT cookie
 */
export async function fullLogout(): Promise<void> {
  clearSession();

  try {
    await signOut(auth);
  } catch {
    // Ignore Firebase signout errors
  }

  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Ignore network errors on logout
  }
}
