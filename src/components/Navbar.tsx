"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSession, fullLogout } from "@/lib/session";
import { useState, useEffect } from "react";
import { LogOut } from "lucide-react";

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
          {/* Calendar icon — Event Registration */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F2EFE9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
        Event Registration
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
            <button onClick={handleLogout} className="nav-btn" style={{ gap: "6px" }}>
              <LogOut style={{ width: 14, height: 14 }} />
              Logout
            </button>
          </>
        ) : (
          <>
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
