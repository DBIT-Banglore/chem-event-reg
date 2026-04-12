import { getAdminAuth } from "@/lib/firebase-admin";

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

/**
 * Verifies the Firebase ID token AND confirms the caller's email is in ADMIN_EMAILS.
 * Throws with statusCode 401 on an invalid token and 403 if the user is not an admin.
 */
export async function requireAdmin(idToken: string): Promise<void> {
  let decoded: Awaited<ReturnType<ReturnType<typeof getAdminAuth>["verifyIdToken"]>>;
  try {
    decoded = await getAdminAuth().verifyIdToken(idToken);
  } catch {
    const err = new Error("Invalid or expired authentication token");
    (err as NodeJS.ErrnoException).code = "401";
    throw err;
  }

  const email = (decoded.email ?? "").toLowerCase();
  if (ADMIN_EMAILS.size === 0 || !ADMIN_EMAILS.has(email)) {
    const err = new Error("Forbidden: admin access required");
    (err as NodeJS.ErrnoException).code = "403";
    throw err;
  }
}

/** Extracts an HTTP status code from errors thrown by requireAdmin(). */
export function adminErrStatus(err: unknown): number {
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "401") return 401;
    if (code === "403") return 403;
  }
  return 500;
}
