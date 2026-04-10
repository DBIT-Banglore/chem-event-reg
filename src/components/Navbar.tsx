"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSession, fullLogout } from "@/lib/session";
import { useState, useEffect } from "react";
import { LogOut } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";

export default function Navbar() {
  const pathname = usePathname();
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null);

  useEffect(() => {
    setSession(getSession());
    // Request browser notification permission
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const handleLogout = async () => {
    await fullLogout();
    window.location.href = "/";
  };

  const isActive = (path: string) => pathname === path;

  return (
    <nav>
      <Link href="/" className="nav-logo">
        <div className="logo-mark">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F2EFE9" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
          </svg>
        </div>
        Idea Lab
      </Link>
      <div className="nav-right">
        {session ? (
          <>
            <Link
              href="/dashboard"
              className="nav-link"
              style={isActive("/dashboard") ? { color: "var(--ink)" } : undefined}
            >
              Dashboard
            </Link>
            <Link
              href="/team/browse"
              className="nav-link"
              style={isActive("/team/browse") ? { color: "var(--ink)" } : undefined}
            >
              Browse Teams
            </Link>
            <Link
              href="/status"
              className="nav-link"
              style={isActive("/status") ? { color: "var(--ink)" } : undefined}
            >
              Status
            </Link>
            <NotificationBell userId={session.usn} />
            <button onClick={handleLogout} className="nav-btn" style={{ gap: "6px" }}>
              <LogOut style={{ width: 14, height: 14 }} />
              Logout
            </button>
          </>
        ) : (
          <>
            <Link href="/status" className="nav-link">Check Status</Link>
            <Link href="/register" className="nav-btn">
              Register
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
