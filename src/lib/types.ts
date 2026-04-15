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
  eventType: "individual" | "team"; // Event participation type
  teamSize?: number; // Required for team events (2-10 members)
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
  eventId2: string | null;   // Optional second individual event
  paymentId: string | null;
  paymentStatus: "free" | "paid" | "pending" | null;
  paymentId2: string | null;
  paymentStatus2: "free" | "paid" | "pending" | null;
  orderId2: string | null;
  teamEventId: string | null;    // Team event participation
  teamId: string | null;         // Team reference
  registeredAt: Date | null;
}

// Team registration for team-based events
export interface Team {
  teamId: string;
  teamName: string;
  eventId: string;
  leaderUSN: string;
  leaderName: string;
  leaderEmail: string;
  leaderPhone: string;
  memberUSNs: string[]; // Array of team member USNs (including leader)
  memberCount: number;
  status: "pending" | "verified" | "paid" | "complete" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
  otpVerificationStatus: Record<string, boolean>; // USN -> verified status
  paymentId?: string;
  paymentStatus?: "free" | "paid" | "pending";
  totalAmount?: number; // Total payment amount (price × team size)
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
  // email intentionally excluded — not stored in localStorage to reduce XSS exposure
  branch: string;
  section: string;
  eventId: string | null;
  eventId2?: string | null;  // Optional second individual event
  teamEventId?: string | null; // Team event participation
  teamId?: string | null; // Team reference
  registeredAt: string;
}
