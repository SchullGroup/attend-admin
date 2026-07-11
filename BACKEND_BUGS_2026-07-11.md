# Backend bugs — for backend team

## 1. Revoke access doesn't actually revoke — ✅ FIXED (backend, 2026-07-11)

**Endpoint:** `DELETE /api/v1/client/organisation/team/{id}/revoke` (also accepts `POST`)

**Was:** Revoke returned `200 OK` and the UI showed the member as revoked, but the status update was silently dropped before it reached the database (persistence-context ordering bug) — the user's account stayed `ACTIVE` and could still log in.

**Now:** Fixed server-side. Revoked users are actually deactivated and can no longer log in. No request/response shape change — nothing for FE to update, just re-verify the flow blocks login.

---

## 2. Monthly RSVP Trend — 500 Internal Server Error — ✅ FIXED (backend, 2026-07-11)

**Endpoint:** `GET /api/v1/client/analytics/monthly-trend`

**Was:** A native SQL query result was being cast to the wrong Java type, throwing on every call (confirmed 500 on every request, not intermittent).

**Now:** Fixed. Returns `200` with the expected shape:
```json
{ "data": { "trend": [ { "month": "Jan 2025", "registrations": 12 }, ... ] } }
```
FE's `useAnalyticsMonthlyTrend()` already parses this shape correctly — no code change needed.

---

## 3. Shareholder `phone` not showing in list — ✅ FIXED (backend, 2026-07-11) + 2 new endpoints

**Endpoints:**
- `POST /api/v1/client/registers/{registerId}/shareholders` (bulk create/upsert)
- `GET  /api/v1/client/registers/{registerId}/shareholders` (list)

**Was:** `phone` didn't exist anywhere in the backend (not on the DB table, not on any DTO) — silently dropped on create, never present in the list response.

**Now:** Both endpoints support `phone` — send it in each shareholder object on upload, it comes back in the list response. Shareholders created *before* this fix will show `phone: null` until edited or re-uploaded (no historical backfill).

**New — single-shareholder update:**
```
PATCH /api/v1/client/registers/{registerId}/shareholders/{shareholderId}
```
Body — all fields optional, send only what changed:
```json
{ "fullName": "...", "chn": "...", "email": "...", "phone": "...", "units": 150000, "status": "ACTIVE" }
```
Returns the updated shareholder object. Returns `409` if the new `chn` collides with another shareholder in the same register.

**New — single-shareholder delete:**
```
DELETE /api/v1/client/registers/{registerId}/shareholders/{shareholderId}
```
(Correction to earlier note in this file: delete did **not** already exist — both PATCH and DELETE above are brand new endpoints.)

**FE status:** Wired up — `useUpdateShareholder()` / `useDeleteShareholder()` added in `src/api/registers.ts`, edit (pencil icon, inline row) and delete buttons added to the Shareholders table in `RegisterShareholdersSection.tsx`. Typecheck clean.

---

## 4. (Related, already worked around on frontend) Missing `sizeBytes` causes 500 on document upload

**Endpoint:** `POST /api/v1/client/events/{id}/documents`

For reference/pattern-matching against bug #2 (now fixed): this endpoint previously 500'd whenever the request body omitted `sizeBytes` (present in the Swagger schema but not documented as required). Frontend now always sends it on every upload path, masking the issue — but the same root pattern (likely an NPE from `sizeBytes.longValue()` or similar without a null check) is worth a final check if any other endpoint that computes a derived/formatted field (like `sizeLabel`) still omits a null guard.

---

## 5. Team role "Admin" needs the same API access as the org owner (client_admin) — ✅ FIXED (backend, 2026-07-11)

**Context:** Team Members supports 4 roles: `ADMIN`, `EVENT_MANAGER`, `VIEWER`, `JUDGE`. Product requirement: a team member with role `ADMIN` should get an experience identical to the organisation's owner/`client_admin` — same dashboard, same data, same endpoints. (We had a frontend bug where "Admin" was accidentally being treated as platform "Super Admin" — that's fixed now — but once fixed, several endpoints started failing for Admin-role users, which looks like a **backend-side permission gap**, not a frontend routing issue.)

**Endpoints currently failing/empty for a logged-in user with role `ADMIN`:**
- `GET /api/v1/client/organisation/team` — Team Members page shows "Failed to load team members." (request fails outright)
- `GET /api/v1/client/organisation/profile` — Platform Settings page loads with every Organisation Info / Branding field blank (request resolves but with no usable data — looks like a silent 403/empty payload rather than a network error)
- `GET /api/v1/client/challenges` (Innovation Challenges list) — possibly the same gap; shows "No active challenges yet" for an org that should have challenges. Needs confirming — could also just be an org with genuinely zero challenges, but flagging since it matches the same pattern as the two confirmed cases above.

**Root cause (backend):**
- `OrganisationController` (team members, company profile, branding — everything under `/api/v1/client/organisation`) was locked to `hasAnyRole('CLIENT_ADMIN', 'EVENT_MANAGER', 'VIEWER')` — `ADMIN` was missing from the list entirely, causing a straight 403 before it ever reached the service layer. **Fixed** — `ADMIN` added to the class-level permission.
- `ClientChallengeController` was locked to `hasRole('CLIENT_ADMIN')` at the class level, with only 5 of its ~18 endpoints individually overridden for `ADMIN` (list, detail, applications, judge panel, leaderboard, export, toggling applications/scoring were all still `CLIENT_ADMIN`-only). This is why the UI showed "No active challenges yet" instead of an error — the FE was swallowing the 403 into an empty state. **Fixed** — class-level rule changed to `hasAnyRole('CLIENT_ADMIN', 'ADMIN')`, redundant per-method overrides removed.

**Revoke restriction — confirmed, no change needed:** `CLIENT_ADMIN` is not an assignable team role (`TeamMemberRole` only has `ADMIN`, `EVENT_MANAGER`, `VIEWER`, `JUDGE`); the only code path anywhere that grants `RoleName.CLIENT_ADMIN` is the super-admin service, never through team invites or self-service. So `@PreAuthorize("hasRole('CLIENT_ADMIN')")` on revoke/reactivate/invite is already a hard server-side guarantee — no team member can ever hold that role. Already correct.

---

## 6. Notifications for team role "Admin" — ✅ FIXED (backend, 2026-07-11)

**Root cause:** Three notification triggers (new event registration, hackathon team applications, innovation challenge applications) queried only `RoleName.CLIENT_ADMIN`, so `ADMIN`-role team members never received them. **Fixed** — added `findActiveByStakeholderAndRoleIn` repository query, updated all three call sites to notify both `CLIENT_ADMIN` and `ADMIN`.

**Caveat:** "Document uploads" and "event reminders" aren't implemented as notification triggers anywhere in the backend yet — not an `ADMIN`-specific gap, just not built at all. That would be new work, not a bug fix, if wanted later.

---

## 7. NEW — Event Manager needs event-management action access

Frontend now hides the genuinely owner-only actions from `EVENT_MANAGER` (Suspend register, Revoke/Reactivate team member, Invite team member, Enrol new register, Open/Close resolution voting, Audit Log). But `EVENT_MANAGER` should still be able to perform day-to-day event management, and right now the following actions all return **"You do not have permission to perform this action."** (403) for that role:

- Import from Register (Expected Attendees / Stakeholders tab)
- Add / Save Resolution (Resolutions tab)
- Refresh Zoom Meeting Token
- Unfeature Event
- Status Controls — Publish, Go Live, Cancel Event

**Ask:** Please grant `EVENT_MANAGER` write access to these five actions/endpoints — they're event-management operations the role is meant to perform, distinct from the org-owner-only actions listed above which should stay restricted to `client_admin`.

**Also:** Notifications for `EVENT_MANAGER` should be scoped to events only (RSVP updates, event reminders, resolution activity, document uploads, etc.) — please exclude Innovation Challenge notifications for this role, since that entire feature area is hidden from their dashboard.

---

## 8. NEW — Viewer role should be read-only server-side, not just client-side

**Context:** `VIEWER` is meant to have read + export access to almost everything (Events, Innovation Challenges, Documents, Resolutions/Vote Records, Stakeholders/Expected Attendees) but no write access anywhere. Frontend now hides every write control for `VIEWER` — Audit Log, Notifications, QR Check-In, and Settings are hidden/read-only; Document upload/delete, Resolution add/open/close vote, Agenda add/edit/delete, Expected Attendees import/add/delete/bulk-delete, quorum edit, offline vote entry, share-weighted tallies toggle, and the Innovation Challenge detail page (applications review, judge assignment, scoring) are all hidden for this role. Broadcast and Settings tabs on the event detail page are hidden entirely for `VIEWER`.

**Ask:** Please confirm (or add) server-side enforcement so `VIEWER` gets `403` on all the corresponding write endpoints even if a request is crafted directly (client-side hiding is UX only, not a security boundary). Specifically:
- All `POST`/`PATCH`/`DELETE` under `/api/v1/client/events/{id}/documents`, `/api/v1/client/events/{id}/expected-attendees`, `/api/v1/client/votes/*` (resolutions, open/close voting, quorum, offline votes, share-weighted tallies), `/api/v1/client/events/{id}/agenda`, `/api/v1/client/challenges/*` (application status, judge assignment, scoring)
- Status-change endpoints — publish/go-live/cancel, feature/unfeature, Zoom refresh
- Team management, register management, and broadcast endpoints (already owner/admin/event-manager gated per items 5–7, so `VIEWER` should already fall outside those)

**Also:** Please confirm `VIEWER` still gets read access to everything above (GET endpoints) plus export/download endpoints (CSV export, document download) — the ask is read+export only, not reduced visibility.

---

## 9. NEW — Judge notifications should cover Innovation Challenge activity

**Context:** Judge has its own dedicated feed (`GET /api/v1/judge/notifications`, `PATCH /api/v1/judge/notifications/{id}/read`) — frontend was actually wired to the generic client-org notification feed by mistake, which we've now fixed (the header now calls the judge-specific endpoint for this role instead).

**Ask:** Please confirm the judge notification feed generates entries for the events that matter to a judge specifically:
- Assigned to a challenge (judge added to a challenge's panel)
- Removed/unassigned from a challenge
- New application received for a challenge the judge is assigned to (or on a track/specialty they cover, if that's how assignment works)
- Challenge status changes relevant to judging — e.g. scoring opens/closes, applications close, shortlist published

Also please confirm judge notifications are scoped to Innovation Challenges only (no event/AGM/document notifications — those aren't part of the Judge dashboard at all).

---

## 10. NEW — Super Admin Analytics & Reports: several endpoints return empty/zero despite real data existing

**Context:** `/analytics` for `SUPER_ADMIN` calls 8 endpoints. Two of them return real data — `GET /api/v1/admin/analytics/by-type` (Events by Module: 10 AGM/EGM, 1 Innovation Challenge, 5 General — 16 events with RSVPs) and `GET /api/v1/admin/audit-logs` (Recent Activity Log shows real sign-in/team events with timestamps). The other six all return empty/zero, which is inconsistent with the confirmed 16 events + RSVPs already in the system:

- `GET /api/v1/admin/analytics/summary` — Total Registrations, Events Hosted, Docs Distributed, Votes Cast all show `0`
- `GET /api/v1/admin/analytics/top-organisers` — "No data yet."
- `GET /api/v1/admin/analytics/kyc-breakdown` — "No KYC data yet."
- `GET /api/v1/admin/analytics/event-format` — "No format data yet."
- `GET /api/v1/admin/analytics/engagement` — Avg Watch Time, Poll Response Rate, Q&A Participation, Document Downloads all `0`
- `GET /api/v1/admin/analytics/event-performance` — Per-Event Breakdown table shows "No events yet."

**Frontend status:** Already correctly wired — `useAdminSummaryStats`, `useAdminTopOrganisers`, `useAdminKycBreakdown`, `useAdminEventFormat`, `useAdminEngagement`, `useAdminAnalyticsEventPerformance` in `src/api/super-admin.ts` all call the endpoints above and parse several reasonable field-name fallbacks (e.g. `totalRegistrations ?? registrations ?? totalParticipants`) so this isn't a response-shape mismatch on our end — the responses appear to be genuinely empty.

**Ask:** Please confirm whether these six endpoints are fully implemented and querying real data, or still stubbed/returning placeholder empty responses. Since `by-type` and `audit-logs` prove the underlying event/RSVP data exists and is queryable, we'd expect at minimum `summary` (event/registration/vote counts) and `event-performance` (per-event RSVP/check-in rows) to return non-empty results from the same dataset. If any of `top-organisers`, `kyc-breakdown`, `event-format`, or `engagement` genuinely have no data yet (e.g. no completed KYC records, no engagement tracking implemented), that's fine — just let us know which of the six fall into "not implemented yet" vs "implemented but broken" so we can prioritize accordingly.
