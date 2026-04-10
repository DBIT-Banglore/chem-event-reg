"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, clearSession, initializeAuth } from "@/lib/session";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { SessionData } from "@/lib/types";

interface SessionGuardProps {
  children: (session: SessionData) => React.ReactNode;
}

export default function SessionGuard({ children }: SessionGuardProps) {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      const s = getSession();
      if (!s) {
        router.replace("/register");
        return;
      }

      // Ensure Firebase Auth is active (from JWT cookie)
      const authOk = await initializeAuth();
      if (!authOk) {
        // No valid JWT cookie — session is forged or expired
        clearSession();
        router.replace("/register");
        return;
      }

      // Quick Firestore validation
      try {
        const regDoc = await getDoc(doc(db, "registrations", s.usn));
        if (!regDoc.exists()) {
          clearSession();
          router.replace("/register");
          return;
        }
      } catch (err) {
        // If permission-denied, try re-initializing auth
        if (err instanceof Error && err.message.includes("permission")) {
          const retryAuth = await initializeAuth();
          if (!retryAuth) {
            clearSession();
            router.replace("/register");
            return;
          }
        }
        // Other network errors — trust local session
      }

      setSession(s);
      setChecking(false);
    };
    check();
  }, [router]);

  if (checking || !session) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return <>{children(session)}</>;
}
