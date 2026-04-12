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
  price: number;    // Entry fee in INR; 0 = free
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
  eventId2: string | null;   // Optional second event
  paymentId: string | null;
  paymentStatus: "free" | "paid" | "pending" | null;
  paymentId2: string | null;
  paymentStatus2: "free" | "paid" | "pending" | null;
  orderId2: string | null;
  registeredAt: Date | null;
}

// Global configuration
export interface Config {
  registrationsOpen: boolean;
  csvLastUploadedAt: Date | null;
}

// App notification (kept minimal)

// localStorage session data
export interface SessionData {
  usn: string;
  name: string;
  email: string;
  branch: string;
  section: string;
  eventId: string | null;
  eventId2?: string | null;
  registeredAt: string;
}
