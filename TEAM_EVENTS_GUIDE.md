# Team Events Guide — ChemNova 2026

## Overview

Team events allow groups of students to register together as a team for a single event. Each team has a designated leader and members who must all verify their participation via OTP before the team can proceed to payment.

---

## Admin Guide: Creating a Team Event

1. Go to the **Admin Panel** → **Events** tab.
2. Click **Add Event**.
3. Fill in event details (name, description, date/time, capacity, price).
4. Set **Event Type** to `team`.
5. Set **Team Size** (e.g., `3` for a 3-member team).
6. Save the event.

The event will now appear in the **Team Event** section of the student dashboard.

---

## Student Guide: Registering as a Team

### Step 1: Browse Team Events
- Log in to the dashboard.
- Scroll to the **TEAM EVENT** section.
- Click **Browse Team Events**.

### Step 2: Create a Team
- Select a team event by clicking **Create Team**.
- Enter a unique **Team Name**.
- Add the USNs of your team members (excluding yourself — you are auto-added as leader).
- Click **Create Team & Send OTPs**.

### Step 3: OTP Verification
- OTPs are sent to each team member's registered email.
- The **team leader is auto-verified** and does not receive an OTP.
- Each member must enter their 6-digit OTP in the dashboard.
- The team leader can verify OTPs on behalf of any member, or resend OTPs if needed.
- All members must verify within **24 hours** of team creation.

### Step 4: Payment (Leader Only)
- Once all members are verified, the team status changes to **Verified**.
- The team leader sees a **Pay for Team** button.
- Clicking it opens the Razorpay payment gateway for the total amount (price × team size).
- After successful payment, the team status changes to **Paid** and all members are registered.

---

## Technical Architecture

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/registration/create-team` | Creates a team, sends OTPs to non-leader members |
| `POST` | `/api/registration/verify-team-otp` | Verifies a member's OTP |
| `POST` | `/api/registration/resend-team-otp` | Resends OTP to a specific member (leader only) |
| `POST` | `/api/payment/create-team-order` | Creates a Razorpay order for the team |
| `POST` | `/api/payment/verify-team-payment` | Verifies team payment and marks team as paid |
| `GET`  | `/api/events` | Lists all events (includes `eventType` and `teamSize` fields) |

### Firestore Collections

- **`teams/{teamId}`** — team record with `memberUSNs`, `otpVerificationStatus`, `status`, `leaderUSN`
- **`otp_codes/{id}`** — OTP records keyed by email + teamId
- **`registrations/{usn}`** — updated with `teamId` and `teamEventId` after verification/payment

### Team Status Flow

```
pending → verified → paid/complete
       ↘ cancelled (if 24h window expires)
```

---

## Troubleshooting

### OTP not received
- Ask the team leader to click **Resend** next to your USN.
- Check your spam/junk folder.
- Ensure your email is correctly uploaded in the student CSV.

### "USN not found in student database"
- Contact your admin to verify the student CSV has been uploaded with correct data.
- USN format must match exactly (e.g., `1DB22CS001`).

### "You are already registered for a team event"
- You can only be in one team per event period. Contact admin if you need to change teams.

### Event is full
- The event capacity counts teams, not individual members. If the event shows as full, no more teams can register.

### OTP expired
- OTPs expire after **10 minutes**. Ask the team leader to resend via the dashboard.

### Verification window expired
- Teams must complete all member OTP verification within **24 hours** of team creation. If the window expires, create a new team.
