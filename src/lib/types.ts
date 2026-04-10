/**
 * Shared TypeScript interfaces for Idea Lab Platform
 */

// CSV-imported master student data
export interface Student {
  usn: string;
  name: string;
  email: string;
  phone: string;
  branch: string;
  section: string;
  importedAt: Date | null;
  importBatch: string;
}

// Event/Theme created by admin
export interface ProgrammeEvent {
  eventId: string;
  name: string;
  description: string;
  capacity: number;
  dateTime: string; // ISO string
  registrationCount: number;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

// Student registration record
export interface Registration {
  usn: string;
  name: string;
  email: string;
  phone: string;
  branch: string;
  section: string;
  eventId: string | null;
  registeredAt: Date | null;
}

// Global configuration
export interface Config {
  registrationsOpen: boolean;
  csvLastUploadedAt: Date | null;
}

// App notification (kept minimal)
export interface AppNotification {
  id: string;
  userId: string;
  type: "event_selected" | "event_changed";
  title: string;
  message: string;
  eventId: string;
  eventName: string | null;
  read: boolean;
  createdAt: Date | null;
}

// localStorage session data
export interface SessionData {
  usn: string;
  name: string;
  email: string;
  branch: string;
  section: string;
  eventId: string | null;
  registeredAt: string;
}
