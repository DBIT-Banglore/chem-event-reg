import { getAdminAuth } from "@/lib/firebase-admin";

// Define a custom error type with status code
interface AdminError extends Error {
  statusCode?: number;
}

/**
 * Verifies the Firebase ID token AND confirms the caller has the
 * `admin: true` custom claim set in Firebase Authentication.
 * Throws with statusCode 401 on an invalid token and 403 if the user is not an admin.
 */
export async function requireAdmin(idToken: string): Promise<void> {
  let decoded: Awaited<ReturnType<ReturnType<typeof getAdminAuth>["verifyIdToken"]>>;
  try {
    decoded = await getAdminAuth().verifyIdToken(idToken);
  } catch {
    const err = new Error("Invalid or expired authentication token") as AdminError;
    err.statusCode = 401;
    throw err;
  }

  if (!decoded.admin) {
    const err = new Error("Forbidden: admin access required") as AdminError;
    err.statusCode = 403;
    throw err;
  }
}

/** Extracts an HTTP status code from errors thrown by requireAdmin(). */
export function adminErrStatus(err: unknown): number {
  if (err instanceof Error && "statusCode" in err) {
    return (err as AdminError).statusCode || 500;
  }
  return 500;
}
