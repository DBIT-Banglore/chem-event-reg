"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection, query, where, orderBy, limit,
  onSnapshot, doc, updateDoc, writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppNotification } from "@/lib/types";

export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [newNotification, setNewNotification] = useState<AppNotification | null>(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (!userId) return;
    isInitialLoad.current = true;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const items: AppNotification[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        items.push({
          id: data.id,
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          eventId: data.eventId || "",
          eventName: data.eventName || null,
          read: data.read,
          createdAt: data.createdAt?.toDate() || null,
        });
      });

      setNotifications(items);
      setUnreadCount(items.filter((n) => !n.read).length);

      // Detect truly new notifications (not from initial load)
      if (!isInitialLoad.current) {
        for (const change of snapshot.docChanges()) {
          if (change.type === "added") {
            const data = change.doc.data();
            const notif: AppNotification = {
              id: data.id,
              userId: data.userId,
              type: data.type,
              title: data.title,
              message: data.message,
              eventId: data.eventId || "",
              eventName: data.eventName || null,
              read: data.read,
              createdAt: data.createdAt?.toDate() || null,
            };
            setNewNotification(notif);

            // Browser notification
            if (typeof window !== "undefined" && Notification.permission === "granted") {
              new Notification(data.title, {
                body: data.message,
                icon: "/favicon.ico",
              });
            }
          }
        }
      }
      isInitialLoad.current = false;
    });

    return () => unsub();
  }, [userId]);

  const markAsRead = useCallback(async (notifId: string) => {
    try {
      await updateDoc(doc(db, "notifications", notifId), { read: true });
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    try {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        batch.update(doc(db, "notifications", n.id), { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  }, [notifications]);

  const clearNewNotification = useCallback(() => {
    setNewNotification(null);
  }, []);

  return { notifications, unreadCount, newNotification, clearNewNotification, markAsRead, markAllAsRead };
}
