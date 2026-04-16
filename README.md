# IDEATHON — DBIT

Individual programme registration platform for DBIT students to register for IDEATHON events conducted by the Chemistry Department.

> **Repo** — [github.com/DBIT-Banglore/ideathon](https://github.com/DBIT-Banglore/ideathon) *(private)*
> **Built by** — Dept. of Computer Science & Engineering, Section B — Don Bosco Institute of Technology, Bangalore

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Security & CORS](#security--cors)
- [Auth Flow](#auth-flow)
- [Student Flow](#student-flow)
- [Admin Flow](#admin-flow)
- [Firestore Schema](#firestore-schema)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)

---

## Overview

**IDEATHON** lets DBIT students register for IDEATHON events through a verified, step-by-step flow:

1. Student enters their USN — validated against an admin-uploaded CSV whitelist.
2. An OTP is sent to their college email (`usn@dbit.in`) via Brevo.
3. After OTP verification, the student completes a profile form and selects one event.
4. Admins manage events, control registration windows, and export data.

Key constraints enforced by the platform:

- Each student may be registered to **one event at a time**.
- Students can **change their event** while registrations are open.
- Events have a **capacity limit**; selection is blocked once full.
- Admins can **open/close** the registration window globally.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Database | Firebase Firestore |
| Auth (client) | Firebase Auth — custom token |
| Auth (server) | Firebase Admin SDK — server-side writes, batch ops |
| Session | JWT via `jose` — HTTP-only cookie |
| Email / OTP | Brevo Email API |
| Payment | Razorpay Payment Gateway |
| Deployment | Netlify |
| Security | Custom middleware with CORS & rate limiting |

---

## Security & CORS

### 🔒 Production Security Lock

The application implements strict **Cross-Origin Resource Sharing (CORS)** policies to prevent unauthorized access:

- **Production Environment**: Only allows requests from `https://ideathon.dfriendsclub.in`
- **Development Environment**: Allows localhost for testing (`http://localhost:3000`, `http://localhost:3001`, `http://192.0.0.4:3000`)

### 🛡️ Security Features

1. **CORS Protection**
   - Middleware validates `Origin` header on all API requests
   - Rejects requests from unauthorized domains with HTTP 403
   - Supports preflight OPTIONS requests with proper CORS headers

2. **Rate Limiting**
   - Global API limit: 200 requests per hour per IP
   - OTP sending: 5 requests per 15 minutes per IP
   - USN lookup: 5 requests per minute, 30 per hour per IP

3. **Security Headers**
   - `X-Frame-Options: DENY` - Prevents clickjacking
   - `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
   - `Strict-Transport-Security` - Enforces HTTPS
   - `Content-Security-Policy` - Restricts resource loading
   - `Permissions-Policy` - Blocks camera/microphone/geolocation access

4. **Input Validation**
   - USN format validation (alphanumeric, 6-12 characters)
   - Email format validation with length restrictions
   - Sanitization of all user inputs

5. **Authentication**
   - JWT-based session management with HTTP-only cookies
   - Firebase Admin SDK for server-side operations
   - Custom token issuance for client-side Firebase auth

### 🔧 CORS Configuration

CORS settings are configured in two places:

1. **Next.js Middleware** (`src/middleware.ts`)
   - Enforces origin validation at the application level
   - Automatically switches between production/development origins

2. **Netlify Configuration** (`netlify.toml`)
   - Additional CORS headers for Netlify deployment
   - Security headers for all routes

### 📝 Custom CORS Origins

To allow additional domains in production, set the `ALLOWED_ORIGINS` environment variable:

```env
ALLOWED_ORIGINS=https://ideathon.dfriendsclub.in,https://your-custom-domain.com
```

**⚠️ Security Warning**: Only add trusted domains to `ALLOWED_ORIGINS`. Each added domain can make API requests to your application.

---

## Auth Flow

```
Student enters USN
        │
        ▼
Validated against Firestore `students` collection
        │
        ▼
OTP sent to usn@dbit.in via Brevo
        │
        ▼
Student verifies OTP
        │
        ▼
JWT session cookie set + Firebase custom token issued
        │
        ▼
Dashboard protected by SessionGuard + middleware JWT check
```

- **USN check** — looks up the `students/{usn}` document (populated by CSV upload).
- **Session** — JWT cookie signed with `JWT_SECRET`; verified in Next.js middleware on every protected route.
- **Firebase custom token** — issued server-side after OTP verification; lets the client SDK make authorised Firestore reads.

---

## Student Flow

```
/register  →  Step 1: USN  →  Step 2: OTP  →  Step 3: Profile form  →  Step 4: Event selection  →  /dashboard
```

**Dashboard** shows:

- Profile card — name, USN, branch, section.
- Selected event card — name, description, date/time, capacity.
- **Change Event** button (visible only while registrations are open).
- Event picker modal listing all active events with available capacity.

**Team Events:**
- Students can register for **1 individual event + 1 team event** (instead of 2 individual events)
- Team registration requires team leader to enter all team members' USNs
- OTPs are sent to all team members for verification
- Team leader pays for all team members once all OTPs are verified
- Team status tracker shows verification progress for each member
- Team member list shows individual verification status and actions

---

## Team Events Feature

### Team Event Registration Flow

1. **Team Creation:** Team leader selects a team-based event and enters team name
2. **Team Members:** Leader enters USNs of all team members (excluding themselves as leader)
3. **Validation:** System validates all USNs exist in student database and team size matches event requirements
4. **OTP Verification:** OTPs are sent to all team members (including leader) via email
5. **Member Verification:** Each team member must verify their OTP within 24 hours
6. **Payment:** Once all members verified, team leader proceeds to payment for the entire team
7. **Completion:** After successful payment, all team members are registered for the event

### Team Event Rules

- **Team Size:** Set by admin when creating team events (2-10 members)
- **Capacity:** Team registration counts as multiple slots based on team size
- **Verification:** All team members must verify OTPs within 24 hours
- **Payment:** Team leader pays total amount (event price × team size)
- **Security:** Team members cannot be in multiple teams for same event
- **Cancellation:** Teams can be cancelled if not all members verified within 24 hours

---

## Admin Flow

Navigate to `/admin` and sign in with a Firebase account listed in `ADMIN_EMAILS`.

The admin panel has five tabs:

| Tab | Purpose |
|---|---|
| **Dashboard** | Registration count, event stats, top events |
| **Events** | Create, edit, toggle active/inactive, delete events (individual + team) |
| **Students** | Student table with event column, search and filter |
| **Settings** | Open/close registrations, upload student CSV, reset database |
| **Export** | Download all registrations as CSV or XLS |

**Event fields:** `name`, `description`, `capacity`, `dateTime`, `isActive`, `eventType` (`individual` | `team`), `teamSize` (for team events, 2-10 members)

> An event can only be deleted if it has **zero registrations**.

### Team Event Management

**Creating Team Events:**
- Select event type: "Individual" or "Team"
- For team events, specify team size (2-10 members)
- Team events show different capacity indicators (team-based counting)
- Admin can view all registered teams and their verification status

**Team Event Rules:**
- Team size must match admin-specified requirements
- All team members must verify OTPs within 24 hours
- Payment is per team, not per individual member
- Team leader pays total amount for entire team

---

## Firestore Schema

### `events/{eventId}`

```
eventId          string      // EVT-<timestamp>
name             string
description      string
capacity         number
dateTime         string      // ISO 8601 datetime
price            number       // Entry fee in INR; 0 = free
registrationCount number
isActive         boolean
eventType         string      // "individual" | "team" (default: "individual")
teamSize         number       // Required for team events (2-10 members)
createdAt        Timestamp
updatedAt        Timestamp
```

### `teams/{teamId}`

```
teamId             string     // TEAM-<timestamp>
teamName           string
eventId            string     // Reference to team event
leaderUSN          string     // Team leader's USN
leaderName         string     // Team leader's name
leaderEmail        string     // Team leader's email
leaderPhone        string     // Team leader's phone
memberUSNs         string[]   // Array of all team member USNs (including leader)
memberCount        number     // Total team members
status             string     // "pending" | "verified" | "paid" | "complete" | "cancelled"
createdAt          Timestamp
updatedAt          Timestamp
otpVerificationStatus  Record<string, boolean>  // USN -> verified status
paymentId          string     // Razorpay payment ID (after payment)
paymentStatus      string     // "free" | "paid" | "pending"
totalAmount        number     // Total payment amount (price × team size)
```

### `registrations/{usn}`

```
usn              string
name             string
email            string
phone            string
branch           string
section          string
eventId           string | null       // Individual event
eventId2          string | null      // Second individual event
teamEventId      string | null      // Team event participation
teamId           string | null      // Team reference
paymentId        string | null
paymentStatus     "free" | "paid" | "pending" | null
paymentId2       string | null
paymentStatus2   "free" | "paid" | "pending" | null
orderId2         string | null
registeredAt      Timestamp
updatedAt         Timestamp
```

### `students/{usn}`

Populated by admin CSV upload. Read-only for client sessions.

### `config/global_config`

```
registrationsOpen  boolean
csvLastUploadedAt Timestamp
```

### `otp_codes/{otpId}`

```
email            string
otp              string     // 6-digit verification code
expiresAt        number     // Unix timestamp (10 min expiry)
used             boolean
attempts         number     // Verification attempt count
createdAt         number     // Unix timestamp
teamId           string     // Optional: team ID for team context
```

> **Security Notes:**
- **Students collection:** NO client access (server-side only)
- **Registrations:** Read own data only, NO client writes
- **Events:** Public read, admin writes only  
- **Teams:** Server access only (admin SDK)
- **OTP codes:** NO client access (admin SDK only)
description      string
capacity         number
dateTime         string      // ISO 8601 datetime
registrationCount number
isActive         boolean
createdAt        Timestamp
updatedAt        Timestamp
```

### `registrations/{usn}`

```
usn              string
name             string
email            string
branch           string
section          string
phone            string
eventId          string | null
registeredAt     Timestamp
updatedAt        Timestamp
```

### `students/{usn}`

Populated by admin CSV upload. Read-only for client sessions.

### `config/global_config`

```
registrationsOpen  boolean
```

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in all required values.

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-firebase-client-email
FIREBASE_PRIVATE_KEY=your-firebase-private-key
FIREBASE_DATABASE_URL=your-firebase-database-url

# Firebase Client Config (public - prefix with NEXT_PUBLIC_)
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-firebase-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-firebase-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-firebase-app-id

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Email Service (Brevo)
BREVO_API_KEY=your-brevo-api-key
BREVO_SENDER_EMAIL=noreply@yourdomain.com
# Optional: Multiple API keys for load balancing (comma-separated)
# BREVO_KEYS=key1:sender1@mail.com,key2:sender2@mail.com

# Razorpay Payment Gateway
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret

# Admin Configuration
ADMIN_EMAILS=admin1@domain.com,admin2@domain.com

# CORS Configuration (Optional - defaults provided)
# Production defaults to: https://ideathon.dfriendsclub.in
# Development defaults to: http://localhost:3000,http://localhost:3001,http://192.0.0.4:3000
# ALLOWED_ORIGINS=https://ideathon.dfriendsclub.in,https://your-custom-domain.com

# Environment
NODE_ENV=production
```

### Required Environment Variables

| Variable | Required | Description |
|---|---|---|
| `FIREBASE_PROJECT_ID` | ✅ | Your Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | ✅ | Service account email for Firebase Admin |
| `FIREBASE_PRIVATE_KEY` | ✅ | Service account private key for Firebase Admin |
| `JWT_SECRET` | ✅ | Secret key for JWT signing (min 32 characters) |
| `BREVO_API_KEY` | ✅ | API key for Brevo email service |
| `BREVO_SENDER_EMAIL` | ✅ | Verified sender email for OTP emails |
| `RAZORPAY_KEY_ID` | ✅ | Razorpay key ID for payments |
| `RAZORPAY_KEY_SECRET` | ✅ | Razorpay key secret for payment verification |
| `ADMIN_EMAILS` | ✅ | Comma-separated list of admin email addresses |

### Optional Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ALLOWED_ORIGINS` | Auto-detected | Comma-separated list of allowed CORS origins |
| `BREVO_KEYS` | `BREVO_API_KEY` | Multiple Brevo API keys for load balancing |
| `NODE_ENV` | `development` | Environment mode (`production` or `development`) |

---

## Project Structure

```
src/
├── app/
│   ├── register/               # 4-step registration (USN → OTP → Profile → Event)
│   ├── dashboard/              # Student dashboard
│   ├── admin/                  # Admin panel (5 tabs)
│   └── api/
│       ├── admin/events/       # CRUD events — Firebase Auth gated
│       ├── events/             # Public GET for active events
│       ├── registration/
│       │   └── select-event/   # Atomic event selection via Firestore batch
│       └── auth/               # OTP flow, JWT issuance, Firebase custom token
├── components/
│   ├── StudentRegistrationForm.tsx
│   ├── StudentTable.tsx
│   ├── SessionGuard.tsx
│   └── Navbar.tsx
└── lib/
    ├── types.ts                # ProgrammeEvent, Registration, Config, SessionData
    ├── firebase.ts             # Client SDK initialisation
    ├── firebase-admin.ts       # Admin SDK initialisation
    ├── jwt.ts                  # signSessionJWT, verifySessionJWT, getSessionFromRequest
    └── session.ts              # localStorage session helpers + initializeAuth
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with Firestore enabled
- A Brevo account with a verified sender domain

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/DBIT-Banglore/ideathon.git
cd ideathon

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp env.local .env.local
# Edit .env.local and fill in all required values

# 4. Start the development server
npm run dev
```

### First-time admin setup

1. Go to `/admin` and sign in with a Firebase account.
2. Under **Settings → Upload CSV**, upload the student whitelist.
   - CSV format: `usn,name,email,branch,section`
3. Under **Events**, create at least one event and set it to **active**.
4. Under **Settings**, toggle **Registrations Open**.
5. Students can now register at `/register`.

### Student registration

Direct students to `/register`. They will need:

- Their DBIT USN (must be present in the uploaded CSV).
- Access to their college email (`usn@dbit.in`) to receive the OTP.
