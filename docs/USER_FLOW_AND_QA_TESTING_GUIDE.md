# ATTEND ADMIN PORTAL
## Comprehensive User Flow & QA Testing Guide

**Project:** Attend Admin Portal (attend-admin)
**Target Audience:** QA Engineers, Product Testers, Event Coordinators, System Administrators
**Last Updated:** August 2026

## 📋 Table of Contents
- [1. Overview & Role Matrix](#1-overview--role-matrix)
- [2. Authentication & Session Flow](#2-authentication--session-flow)
- [3. Super Admin User Flows](#3-super-admin-user-flows)
- [4. Register & Shareholder Management Flows](#4-register--shareholder-management-flows)
- [5. Event Creation & Setup Flows](#5-event-creation--setup-flows)
- [6. Event Operations & Participant Management Flows](#6-event-operations--participant-management-flows)
- [7. Live Control Room Operations](#7-live-control-room-operations)
- [8. QR Check-In & Onsite Verification Flows](#8-qr-check-in--onsite-verification-flows)
- [9. Voting, Resolutions & Quorum Engine Flows](#9-voting-resolutions--quorum-engine-flows)
- [10. Post-AGM Compliance & Statutory Reporting Flows](#10-post-agm-compliance--statutory-reporting-flows)
- [11. Hackathon & Innovation Challenge Flows](#11-hackathon--innovation-challenge-flows)
- [12. System Settings & Team Management Flows](#12-system-settings--team-management-flows)
- [13. End-to-End QA Test Scenarios](#13-end-to-end-qa-test-scenarios)

---

## 1. Overview & Role Matrix
The Attend Admin Portal is an enterprise hybrid event, AGM (Annual General Meeting), voting, and innovation challenge platform.

### User Roles & Access Rights
| Role | Title | Scope | Description |
|---|---|---|---|
| `super_admin` | Super Admin | System-wide (All Organizations) | Client onboarding, global analytics, global users/registrars, audit logs. |
| `client_admin` / `admin` | Client Admin / Event Manager | Organization-wide | Create/manage events, upload registers, control live AGM, run voting, export compliance reports. |
| `judge` | Hackathon Judge | Scoped to Assigned Challenges | View submissions, rate projects against rubrics, submit scores, view leaderboards. |
| `registrar` / `kyc_officer` | Registrar / KYC Officer | Event & Register Scoped | Verify attendee identity, inspect uploaded registers, conduct manual QR check-ins. |
| `viewer` | Read-only Viewer | View Only | View event dashboards, reports, and attendance stats without editing rights. |

---

## 2. Authentication & Session Flow

### Flow 2.1: User Login
**Precondition:** User has active credentials in the database.
**Steps:**
1. Navigate to `/login`.
2. Input valid Email Address and Password.
3. Click **Sign In**.

**Expected Outcome:**
- Request hits `POST /api/auth/login` (BFF proxy).
- HTTP-Only `refreshToken` cookie is set by server proxy.
- Client-readable `accessToken` cookie is stored.
- User profile details fetched via `useGetMe()`.
- User is redirected to `/` (Dashboard) or target `callbackUrl`.

**QA Validation & Edge Cases:**
- **Invalid Password / Non-existent Email:** Red toast notification displaying error message; stays on `/login`.
- **Expired/Invalid Token:** Unauthenticated access to protected routes (`/(dashboard)/*`) triggers middleware (`proxy.ts`) redirect to `/login?callbackUrl=...`.

### Flow 2.2: Password Reset Request & Execution
**Steps:**
1. Navigate to `/forgot-password`.
2. Enter registered email address and submit.
3. Open password reset link received via email (`/reset-password?token=...`).
4. Enter new password (min. 8 characters, complex) and confirm.
5. Click **Reset Password**.

**Expected Outcome:** Toast confirms success; user is directed to `/login` to sign in with new credentials.

### Flow 2.3: Session Auto-Refresh & Logout
- **Silent Refresh:** When `accessToken` expires (401 response), Axios interceptor (`src/lib/api-client.ts`) transparently calls `/api/auth/refresh` using the HTTP-Only `refreshToken` and retries the original request without user interruption.
- **Logout:** Clicking **Logout** in user menu clears client cookies, clears React Query cache, invokes `POST /api/auth/logout`, and redirects to `/login`.

### Flow 2.4: Two-Factor Authentication (MFA) Setup & Enforcement
**Steps:**
1. Upon initial login (or if MFA policy is enforced organization-wide), user is directed to `/mfa-setup`.
2. Scan QR code using Authenticator App (Google/Microsoft Authenticator) or select SMS fallback.
3. Enter 6-digit verification code.
**Expected Outcome:** 2FA is activated. On subsequent logins, a 2FA prompt appears after Step 2 of Flow 2.1, requiring the TOTP code before issuing the `accessToken`.

---

## 3. Super Admin User Flows

### Flow 3.1: Client Organization Onboarding
- **Role:** `super_admin`
- **Route:** `/` or `/admin`
**Steps:**
1. Click **Onboard Client / Organization**.
2. Fill in: Organization Name, Business Email, Phone Number, Primary Domain, Address, and Account Tier.
3. Click **Create Organization**.
**Expected Outcome:** Organization record created; available in organization dropdowns.

### Flow 3.2: Managing Client Admins
- **Role:** `super_admin`
**Steps:**
1. Navigate to **Client Admins** section.
2. Click **Invite Client Admin**.
3. Select target Organization, enter Full Name and Email, assign initial permissions.
4. Click **Send Invitation**.
**Expected Outcome:** Client Admin profile created; user receives invitation email with temporary credentials / setup link.

### Flow 3.3: System-Wide Audit Log Inspection
- **Role:** `super_admin`
- **Route:** `/audit`
**Steps:**
1. Select date range filters (Start Date, End Date).
2. Filter by User Email, Action Type (e.g., `EVENT_CREATED`, `VOTE_CAST`, `REGISTER_UPLOADED`), or Entity ID.
3. Click **Export Audit Log** (CSV download).
**Expected Outcome:** Table populates with timestamped log entries; CSV download matches filtered criteria.

---

## 4. Register & Shareholder Management Flows

### Flow 4.1: Register Import via CSV
- **Role:** `client_admin`, `registrar`
- **Route:** `/registers/enrol` or `/registers`
**Steps:**
1. Click **Enrol New Register**.
2. Enter Register Title (e.g., "2026 Annual Shareholder Register") and select Company / Organization.
3. Upload CSV file matching standard format (Account Number, Full Name, Shareholding / Voting Units, Email, Phone, Category).
4. Review auto-mapped CSV headers.
5. Click **Process & Validate Register**.

**Expected Outcome:**
- System parses file (PapaParse).
- Data validation highlights duplicate account numbers, missing emails, or invalid unit amounts.
- On confirmation, register status changes to `ACTIVE` with calculated total shareholder count and total shares/voting weight.

### Flow 4.2: Register Search, Member Update & Proxy Delegation
- **Route:** `/registers/[id]`
**Steps:**
1. Search for a shareholder by Name, Account Number, or Email.
2. Click on a shareholder row to view detail drawer.
3. To edit holding: Update Share Count and click **Save Changes**.
4. To assign proxy: Click **Assign Proxy**, select Proxy Type (Chairman of Meeting vs Designated Proxy), enter Proxy Name and Email, and save.
**Expected Outcome:** Shareholder record reflects updated voting units; proxy flag is activated with assigned proxy details.

---

## 5. Event Creation & Setup Flows

### Flow 5.1: AGM / EGM Meeting Setup Wizard
- **Role:** `client_admin`
- **Route:** `/events/create`
**Wizard Steps:**
- **Step 1: Event Info:** Select Event Type (AGM / EGM), Select Format (Virtual, In-Person, or Hybrid). Fill Title, Description, Date, Start/End Time, Venue (if hybrid/in-person).
- **Step 2: Video & Integration Settings:** Enable Auto-Create Zoom Meeting toggle (optional). If enabled, specify `zoomDurationMinutes` (default 120). If manual stream link preferred, paste YouTube Live URL or generic RTMP embed link.
- **Step 3: Register & Voting Configuration:** Select attached Shareholder Register (from active registers). Enable Voting & Resolutions. Configure voting weight model (e.g., 1 Share = 1 Vote or 1 Person = 1 Vote). Add Initial Resolutions (e.g., "Resolution 1: Re-election of Directors", "Resolution 2: Dividend Approval"). Specify resolution type (Ordinary / Special Majority).
- **Step 4: Documents & Agenda:** Upload AGM Annual Report PDF, Notice of Meeting PDF, and Proxy Form PDF. Set document visibility (Public vs Registered Attendees Only).
- **Step 5: Review & Publish:** Review event summary card. Click **Publish Event**.

**Expected Outcome:**
- Event created in database with status `PUBLISHED`.
- If Zoom auto-create was selected, system calls backend Zoom OAuth API, creates meeting with waiting room, and populates `streamUrl` with Zoom join URL.

### Flow 5.2: Innovation Challenge / Hackathon Event Setup
- **Route:** `/events/create` -> Select Hackathon / Innovation Challenge
**Steps:**
1. Enter Challenge Name, Host Organization, Start/End Registration Dates, Finale Date.
2. Define Tracks/Categories (e.g., "Fintech", "Healthtech", "AI & Data").
3. Set Submission Requirements (Repository URL, Video Demo, Pitch Deck).
4. Define Scoring Rubric Criteria & Weights (e.g., Innovation: 30%, Technical Execution: 40%, Presentation: 30%).
5. Assign Judges (select from registered judge users).
6. Click **Publish Challenge**.
**Expected Outcome:** Challenge is live for participant registration and judge assignment.

### Flow 5.3: Bulk Dispatch Event Invitations / Notices
**Precondition:** Event is `PUBLISHED` and attached to an `ACTIVE` register.
**Steps:**
1. Navigate to `/events/[id]/dispatch`.
2. Review email template (Notice of Meeting, credentials, and unique QR code).
3. Select target audience (All Shareholders vs Unregistered Only).
4. Click **Send Bulk Invites**.
**Expected Outcome:** System triggers asynchronous email jobs via queue. Progress bar updates as emails are dispatched. Audit log records the dispatch event.

---

## 6. Event Operations & Participant Management Flows

### Flow 6.1: Attendee Roster & Manual Registration
- **Route:** `/events/[id]` -> Attendees Tab
**Steps:**
1. View live registration numbers and fill rate progress bar.
2. Filter list by Registration Status (`REGISTERED`, `CHECKED_IN`, `KYC_VERIFIED`).
3. Click **Add Participant** to manually register an attendee (Name, Email, Shareholder Account Number).
4. Click **Resend Invite / Access Link** for any participant.
**Expected Outcome:** New participant added to event roster; notification email sent with unique join link / QR code.

### Flow 6.2: Resolution Management & Edit Pre-Meeting
- **Route:** `/events/[id]` -> Resolutions Tab
**Steps:**
1. View list of attached resolutions.
2. Click **Create Resolution** to add a new item during pre-meeting planning.
3. Select Resolution Type: **Standard** (FOR / AGAINST / ABSTAIN) or **Election** (e.g., "Select 3 out of 5 Directors").
4. Edit resolution text, voting options/candidates, or voting weight multiplier.
5. Change status from `DRAFT` to `READY`.
**Expected Outcome:** Resolutions updated and queued for activation in Live Control Room.

---

## 7. Live Control Room Operations

### Flow 7.1: Host Live Control Room Initialization
- **Role:** `client_admin`, Event Host
- **Route:** `/events/live?eventId={id}`
**Steps:**
1. Open Live Control Room.
2. View left pane: Video/Stream Container.
3. View right pane: Interactive Control Tabs (Resolutions, Polls, Q&A / Speakers, Broadcast Ticker, Attendees).
**Expected Outcome:** Control room connects to real-time WebSockets (STOMP); live snapshot loaded.

### Flow 7.2: Embedded Zoom Client View Operations (Host)
**Precondition:** Event has Zoom meeting configured.
**Steps:**
1. System requests ZAK host token via `/api/zoom/refresh-meeting` and Meeting SDK signature via `/api/zoom/signature`.
2. Click **Launch Zoom Embedded Control** inside `ZoomMeetingCard`.
3. Static iframe `/zoom-meeting.html` initializes Zoom Client View (ZoomMtg).
4. Host joins meeting inside iframe with full host privileges.
5. Host views Waiting Room panel and admits waiting attendees.
6. Host uses floating controls or Q&A tab to inject messages directly into Zoom meeting chat.
**Expected Outcome:** Host manages Zoom session natively inside the portal without external client popups; COOP/COEP headers enable full gallery view.

### Flow 7.3: YouTube Live Broadcast Operations
**Precondition:** Event `streamUrl` contains YouTube video or live link.
**Steps:**
1. Live Control Room detects YouTube URL.
2. If standard embed URL (`youtube.com/embed/...` or `youtube.com/watch?v=...`), renders embeddable iframe player.
3. If vanity/channel URL (`youtube.com/@channel/live`), renders fallback "Open Live Stream in YouTube" card to prevent CSP iframe blocking.

### Flow 7.4: Activating & Controlling Live Voting
- **Route:** `/events/live` -> Resolutions Panel
**Steps:**
1. Select a resolution in status `READY`.
2. Click **Open Voting Window**.
3. Real-time ticker broadcasts `VOTING_OPENED` event to all connected participant devices.
4. Monitor live incoming vote tallies (FOR %, AGAINST %, ABSTAIN %, Total Shares Voted, Quorum Progress Bar).
5. *Vote Amendments:* While window is open, participants can change their selection. The system recalculates live tallies seamlessly.
6. Click **Close Voting Window** when time elapses.
7. Click **Publish Results** to show final tallies on participant screens.
**Expected Outcome:** Voting window locks (amendments disabled); votes tallied; results permanently attached to resolution.

### Flow 7.5: Live Polls & Audience Q&A / Hand Raise Management
**Polls Steps:**
1. Navigate to Polls Panel.
2. Click **Create Quick Poll**, enter Question & Options.
3. Click **Launch Poll**. View live bar graph of responses. Click **End Poll**.

**Q&A & Speaker Queue Steps:**
1. Navigate to Q&A Panel.
2. View attendee submitted questions ranked by upvotes.
3. Click **Answer Textually** or mark as **Answered Live**.
4. View Hand Raise Queue (attendees requesting to speak). Click **Grant Microphone / Promote to Speaker** or **Lower Hand**.

### Flow 7.6: Emergency Broadcasts & Stream Fallbacks
**Steps:**
1. In the event of a stream outage or urgent update, Host navigates to **Broadcast Ticker** tab.
2. Enters emergency alert text (e.g., "Stream dropped, attempting reconnect. Please hold.").
3. Clicks **Push Emergency Notification**.
**Expected Outcome:** Persistent banner appears on all attendee interfaces immediately.

---

## 8. QR Check-In & Onsite Verification Flows

### Flow 8.1: Camera-Based QR Code Check-In
- **Role:** `registrar`, Onsite Usher
- **Route:** `/events/qr-checkin` or `/events/[id]/qr-checkin`
**Steps:**
1. Grant browser camera permissions.
2. Point device camera at attendee's digital/printed QR badge.
3. Scanner (`html5-qrcode`) detects ticket token.
4. System calls `POST /api/v1/events/{id}/checkin`.

**Expected Outcome:**
- Green success banner displays attendee Name, Account Number, Shareholding Count, and Check-In Timestamp.
- Audio chime plays indicating valid check-in.
- Duplicate scan displays yellow banner ("Already Checked In at HH:MM").

### Flow 8.2: Manual Attendee Lookup & KYC Verification
- **Route:** `/participants/kyc`
**Steps:**
1. Enter attendee Name, Email, or Account Number in search field.
2. Verify government-issued ID against system register details.
3. Click **Mark KYC Verified & Check-In**.
**Expected Outcome:** Attendee status updated to `KYC_VERIFIED` & `CHECKED_IN`; badge printing queue triggered.

### Flow 8.3: Proxy Onsite Check-In
**Steps:**
1. Proxy arrives holding a proxy authorization document.
2. Registrar searches for the original Shareholder Account Number.
3. Registrar clicks **Check-In as Proxy**.
4. Enters Proxy's name and uploads/verifies authorization proof.
5. Clicks **Confirm Proxy Check-In**.
**Expected Outcome:** Original shareholder is marked as `REPRESENTED_BY_PROXY`; Proxy receives voting keypad or mobile access to cast shares.

---

## 9. Voting, Resolutions & Quorum Engine Flows

### Flow 9.1: Quorum Calculation & Share Weighting
**System Logic:**
`Total Quorum % = ((Shares Present In Person + Shares Represented By Proxy) / Total Shares In Register) * 100`

**QA Test Procedure:**
1. Load a register with total 1,000,000 shares across 100 shareholders.
2. Check in 10 shareholders holding a combined 550,000 shares.
3. Verify Quorum Widget on Live Control Room displays 55.0% Quorum Attained (`QUORUM MET`).

### Flow 9.2: Proxy Vote Aggregation & Hybrid Tallying
**Steps:**
1. Pre-meeting: 5 shareholders submit proxy forms designating Chairman as proxy to vote "FOR" Resolution 1 (Total Proxy Shares = 200,000).
2. Live meeting: 15 shareholders vote live in person (FOR = 300,000 shares, AGAINST = 50,000 shares).
3. Close resolution voting.

**Expected Outcome:**
- Total FOR Shares = 200,000 (Proxy) + 300,000 (Live) = 500,000 Shares (83.3%).
- Total AGAINST Shares = 50,000 Shares (16.7%).
- Statutory Breakdown report correctly separates Proxy Votes from Live Votes.

---

## 10. Post-AGM Compliance & Statutory Reporting Flows

### Flow 10.1: AGM Minutes Drafting & Finalization
- **Role:** `client_admin`, Legal Secretary
- **Route:** `/events/[id]` -> Post-AGM / Minutes Tab
**Steps:**
1. System pre-populates template with attendance summary and resolution outcomes.
2. Edit text editor content (add discussions, motions, adjournment notes).
3. Review final draft with executive team.
4. Click **Save Draft Minutes** (`PUT /api/v1/client/events/{id}/post-agm/minutes`).
5. Click **Finalise Minutes** (`POST /api/v1/client/events/{id}/post-agm/minutes/finalise`).

**Expected Outcome:**
- Draft saved successfully.
- On finalization, minutes status locks (`FINALISED`), timestamped with user ID. Editing disabled (409 Conflict if edit attempted).

### Flow 10.2: Attendance Certificates Generation & Queueing
**Steps:**
1. Click **Certificate Eligibility & Dispatch**.
2. View count of eligible attendees (Attendees who were both `CHECKED_IN` and `KYC_VERIFIED`).
3. Click **Send Attendance Certificates**.
**Expected Outcome:** API triggers background job (`POST /certificates/send`); notification toast displays queued count (e.g., "142 Certificates Queued for Delivery").

### Flow 10.3: CSV Exports & Statutory Return (SEC / CAC Filing)
**Steps:**
- **Attendance Register Export:** Click **Download Attendance CSV**. Browser downloads formatted file (e.g., `attendance_register_EVT123.csv`).
- **Vote Audit Log Export:** Click **Download Vote Audit CSV**. Browser downloads complete audit trail of every vote cast with timestamp, voter ID, share weight, and decision.
- **Statutory Return Generation:** Click **Generate Statutory Return**. View structured filing document formatted according to regulatory requirements (SEC/CAC guidelines), including meeting details, quorum percentages, and itemized resolution voting tables. Click **Export Document**.

### Flow 10.4: Event Recordings (VOD) & Distribution
**Steps:**
1. After meeting concludes, navigate to **Post-AGM / Media** tab.
2. Upload final event recording MP4 or link to YouTube VOD.
3. Set visibility (e.g., "Available to all registered shareholders").
4. Click **Publish VOD & Notify Attendees**.
**Expected Outcome:** Notification email sent to absentees; VOD replaces live stream player on the event landing page.

---

## 11. Hackathon & Innovation Challenge Flows

### Flow 11.1: Applicant Team Shortlisting
- **Role:** `client_admin`, Challenge Organizer
- **Route:** `/hackathons/applications` or `/hackathons/[challengeId]`
**Steps:**
1. Select Challenge. View submitted project applications.
2. Inspect Team Details, Github Repo URL, Demo Video, and Pitch Deck.
3. Update application status from `SUBMITTED` to `SHORTLISTED` or `REJECTED`.
**Expected Outcome:** Shortlisted teams move to the Judging Queue.

### Flow 11.2: Hackathon Judge Scoring Workflow
- **Role:** `judge`
- **Route:** `/` (Judge Dashboard) or `/hackathons/judging?id={challengeId}`
**Steps:**
1. Log in as Judge. Dashboard displays assigned Innovation Challenges and pending team evaluations.
2. Click **Score Team** next to a shortlisted project.
3. View project submission side-by-side with scoring rubric slider controls.
4. Rate project across rubrics (e.g., Innovation [1-10], Technical Execution [1-10], Impact [1-10]).
5. Add qualitative Feedback Notes for the team.
6. Click **Save Draft Score** or **Submit Final Score**.
**Expected Outcome:** Progress indicator updates (e.g., "4 / 5 Teams Scored"); calculated weighted score contributed to global leaderboard.

---

## 12. System Settings & Team Management Flows

### Flow 12.1: Organization Profile & Branding Setup
- **Role:** `client_admin`
- **Route:** `/settings`
**Steps:**
1. Upload Organization Logo (PNG/SVG).
2. Set Brand Colors (Primary Hex Code, Accent Hex Code).
3. Update Support Email, Phone, and Default Timezone.
4. Click **Save Settings**.
**Expected Outcome:** UI components reflect brand color customization and uploaded logo across event portals.

### Flow 12.2: Team Member Invitation & Role Allocation
- **Route:** `/settings/team`
**Steps:**
1. Click **Invite Team Member**.
2. Enter Email Address, First Name, Last Name.
3. Select Role (`client_admin`, `event_manager`, `kyc_officer`, `judge`, `viewer`).
4. Click **Send Invitation**.
**Expected Outcome:** User invited; permissions enforced upon first login according to assigned role matrix.

### Flow 12.3: Team Member Offboarding / Deactivation
**Steps:**
1. Locate team member in the Team List table.
2. Click action menu (3 dots) -> **Deactivate Account** (or Revoke Access).
3. Confirm deactivation prompt.
**Expected Outcome:** User status changes to `INACTIVE`. Active sessions are forcefully terminated via WebSocket/token revocation; future login attempts fail.

---

## 13. End-to-End QA Test Scenarios

### Test Scenario A: Complete AGM Lifecycle (Pre-AGM to Post-AGM)
1. **Enrol Register:** Upload `shareholders_sample.csv` (10 shareholders, 500,000 total shares). Verify active register created.
2. **Create AGM Event:** Create Virtual AGM event, attach uploaded register, enable Zoom auto-creation, add 2 resolutions, upload 1 AGM report PDF, publish event.
3. **Check-In Attendees:** Perform 3 QR check-ins and 2 manual KYC check-ins (attending shareholders total 300,000 shares = 60% quorum).
4. **Run Live Control Room:**
   - Launch Host Zoom embedded client view; verify video stream initializes.
   - Open Resolution 1 for voting. Cast votes from test participant devices. Close voting and publish results.
   - Launch a quick poll. Collect responses.
5. **Post-AGM Execution:**
   - Draft and finalise AGM minutes.
   - Queue attendance certificates.
   - Download Attendance CSV and Vote Audit CSV. Verify data integrity against test votes.

### Test Scenario B: Hackathon Judging & Leaderboard Verification
1. Log in as `client_admin` -> Create Innovation Challenge -> Define 3 rubric criteria (30%, 40%, 30%) -> Assign Test Judge.
2. Shortlist 3 test team submissions.
3. Log in as `judge` -> Open `/hackathons/judging` -> Score all 3 teams -> Submit scores.
4. Log in as `client_admin` -> Check Challenge Leaderboard -> Verify weighted rankings match assigned scores.

---
*End of User Flow Guide.*
