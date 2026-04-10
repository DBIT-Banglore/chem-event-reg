"use client";

import { useState, useEffect, useRef } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { AppNotification } from "@/lib/types";
import { Bell, CalendarDays, CheckCircle } from "lucide-react";

function getTimeAgo(date: Date | null): string {
  if (!date) return "";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getNotifIcon(type: AppNotification["type"]) {
  const size = { width: 14, height: 14 };
  switch (type) {
    case "event_selected":
      return <CalendarDays style={{ ...size, color: "#10b981" }} />;
    case "event_changed":
      return <CheckCircle style={{ ...size, color: "#2563eb" }} />;
    default:
      return <Bell style={{ ...size, color: "var(--muted)" }} />;
  }
}

export default function NotificationBell({ userId }: { userId: string }) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(userId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: "relative", background: "none", border: "none",
          cursor: "pointer", padding: "8px", display: "flex", alignItems: "center",
        }}
        aria-label="Notifications"
      >
        <Bell style={{ width: 20, height: 20, color: "var(--ink)" }} />
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: 4, right: 4,
            width: 16, height: 16, borderRadius: "50%",
            background: "var(--red)", color: "#fff",
            fontSize: "9px", fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)",
          width: 320, maxHeight: 400, overflowY: "auto",
          background: "var(--paper)", border: "1.5px solid var(--ink)",
          zIndex: 100, boxShadow: "4px 4px 0 var(--ink)",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", borderBottom: "1.5px solid var(--line)",
          }}>
            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              Notifications {unreadCount > 0 && `(${unreadCount})`}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{ fontSize: "10px", fontWeight: 700, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>
              No notifications yet
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => { if (!n.read) markAsRead(n.id); }}
                style={{
                  padding: "12px 16px", borderBottom: "1px solid var(--line)",
                  cursor: "pointer", background: n.read ? "transparent" : "rgba(232,52,26,0.04)",
                }}
              >
                <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <div style={{ marginTop: 2, flexShrink: 0 }}>{getNotifIcon(n.type)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: "12px", color: "var(--ink)", marginBottom: "2px" }}>{n.title}</p>
                    <p style={{ fontSize: "11px", color: "var(--muted)", lineHeight: 1.5 }}>{n.message}</p>
                    <p style={{ fontSize: "10px", color: "var(--muted)", marginTop: "4px" }}>{getTimeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--red)", flexShrink: 0, marginTop: 4 }} />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
