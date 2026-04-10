# Chem Event Reg — DBIT

Individual programme registration platform for DBIT students to register for Chemistry department events.

> **Repo** — [github.com/DBIT-Banglore/chem-event-reg](https://github.com/DBIT-Banglore/chem-event-reg) *(private)*
> **Built by** — Dept. of Computer Science & Engineering, Section B — Don Bosco Institute of Technology, Bangalore

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Auth Flow](#auth-flow)
- [Student Flow](#student-flow)
- [Admin Flow](#admin-flow)
- [Firestore Schema](#firestore-schema)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)

---

## Overview

**Chem Event Reg** lets DBIT students register for Chemistry department events through a verified, step-by-step flow:

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
| Framework | Next.js 15 (App Router, TypeScript) |
| Database | Firebase Firestore |
| Auth (client) | Firebase Auth — custom token |
| Auth (server) | Firebase Admin SDK — server-side writes, batch ops |
| Session | JWT via `jose` — HTTP-only cookie |
| Email / OTP | Brevo Email API |
| Deployment | Vercel |

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

---

## Admin Flow

Navigate to `/admin` and sign in with a Firebase account listed in `ADMIN_EMAILS`.

The admin panel has five tabs:

| Tab | Purpose |
|---|---|
| **Dashboard** | Registration count, event stats, top events |
| **Events** | Create, edit, toggle active/inactive, delete events |
| **Students** | Student table with event column, search and filter |
| **Settings** | Open/close registrations, upload student CSV, reset database |
| **Export** | Download all registrations as CSV or XLS |

**Event fields:** `name`, `description`, `capacity`, `dateTime`, `isActive`

> An event can only be deleted if it has **zero registrations**.

---

## Firestore Schema

### `events/{eventId}`

```
eventId          string      // EVT-<timestamp>
name             string
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

Copy `env.local` to `.env.local` and fill in all values before running the app.

```env
# Firebase client config (public)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin SDK (server-side only)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Brevo — OTP email delivery
BREVO_API_KEY=

# Session signing
JWT_SECRET=

# Access control
ADMIN_EMAILS=           # Comma-separated. If empty, any Firebase user can access /admin.
ALLOWED_ORIGINS=        # Comma-separated, e.g. http://localhost:3000,https://yourdomain.in
```

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
git clone https://github.com/DBIT-Banglore/chem-event-reg.git
cd chem-event-reg

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
