import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface CreateNotificationData {
  userId: string;
  type:
    | "invite_received"
    | "request_received"
    | "invite_accepted"
    | "invite_rejected"
    | "request_approved"
    | "request_rejected"
    | "kicked_from_team"
    | "member_left_team"
    | "team_dissolved"
    | "lead_transferred";
  title: string;
  message: string;
  teamId: string;
  teamName: string | null;
  fromUSN: string;
  fromName: string;
  linkUrl: string;
}

export async function createNotification(data: CreateNotificationData) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    await setDoc(doc(db, "notifications", id), {
      ...data,
      id,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}
