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

---

## 11. NEW — Registrar detail page: register event counts, representative email, and event format all missing

**Context:** `GET /api/v1/admin/registrars/{id}` (and its `registers`/`events` sub-resources) backs the Super Admin Registrar profile page. Reviewed against a registrar with 15 real events on file:

- **Registers table "Events" column shows `0`** for every register row (e.g. "Crafwell Engineering LTD — Events: 0"), even though the registrar's own Events section confirms 15 events exist. Each object in `registrar.registers[]` (or `GET /api/v1/admin/registrars/{id}/registers`) needs a populated `eventCount` (we also now accept `eventsCount`/`totalEvents`/`numberOfEvents` as fallbacks on the frontend, but none of those are present either) — looks like the per-register event association/count just isn't being computed.
- **Representative `email` is empty** ("—" shown) for at least one registrar. Frontend reads `contactEmail`, `email`, `repEmail`, and nested `representative.email`/`representative.contactEmail` — none are populated in this case. Please confirm whether this representative genuinely has no email on file, or whether the field is being dropped/not selected in the registrar-detail query.
- **Events table "Format" column shows `—` for all 15 rows.** Frontend reads `evt.format` (same field name/shape used successfully on the main `/events` list, so this isn't a frontend mapping issue) — the registrar-scoped events endpoint just isn't returning `format` on each event object.

**Frontend status:** Fallback chains widened for register event-count and representative email; a "View all events" sub-page (`/registrars/{id}/events`) was added so we're no longer dumping all events inline — but this needs the endpoint to actually support `page`/`size` query params for real pagination. Right now `GET /api/v1/admin/registrars/{id}/events` appears to always return the full list regardless of params — please confirm/add pagination support (`page`, `size`, returning `totalCount`/`totalElements`) on that endpoint.

**Ask:** Please check (a) per-register event-count population, (b) why representative email is empty for some registrars, (c) `format` on the registrar-scoped events endpoint, and (d) add real pagination to `GET /api/v1/admin/registrars/{id}/events`.

---

## 12. NEW — Super Admin: missing/incorrect endpoints found this pass (Registrars, Events, Dashboard)

Several issues from this review turned out to be the frontend hitting the wrong (org-scoped) endpoint for a platform-admin screen — same root pattern as items 5/6 earlier in this doc. Fixed what we could on our side; flagging the rest.

**a) Attendees tab on Super Admin event detail always showed 0 — FIXED on frontend, please confirm the endpoint exists.**
`useEventAttendees` (used only for `super_admin`) was calling `GET /api/v1/client/events/{id}/attendees` — an org-scoped endpoint that 403s/returns empty for `super_admin` (no client org). Changed it to call `GET /api/v1/admin/events/{id}/attendees`, mirroring the existing `GET /api/v1/admin/events/{id}/documents` pattern. **Please confirm this admin endpoint exists** (or tell us the correct path if it's named differently) — we can't verify from the frontend alone.

**b) Events page "Organizer" filter always empty for Super Admin — PARTIALLY FIXED on frontend.**
The dropdown sourced its options from `GET /api/v1/client/registers`, which is org-scoped and returns nothing for `super_admin`. We've disabled that call for `super_admin` and hidden the Organizer filter for that role. In its place, we added a **cascading Register filter**: pick a Registrar first, then a second dropdown scoped to that registrar's own registers via the existing `GET /api/v1/admin/registrars/{id}/registers` endpoint. This covers the common case (drill into one registrar's registers) but there's still no way to filter/search registers across *all* registrars at once. **Ask (still open):** is there (or could there be) a platform-wide "list all registers/organisations" endpoint for `super_admin`, e.g. `GET /api/v1/admin/registers`, returning `{ id, name, registrarId }` for every register across every registrar? That would let us add a true cross-org filter alongside the per-registrar one.

**c) Dashboard "Platform Users" — Active/Suspended always showed 0.**
`GET /api/v1/admin/dashboard` doesn't return `activeUsers`/`suspendedUsers` (confirmed — not a naming mismatch, checked the raw payload). We've added a client-side fallback that counts statuses from the loaded users page, but that's only exact up to however many users we fetch (currently 100) — not a real fix for orgs with more users. **Ask:** please add `activeUsers`/`suspendedUsers` counts to the dashboard-overview response (or to `GET /api/v1/admin/stats`), computed server-side across all users.

**d) Registrar detail page was entirely read-only — no update endpoint existed.**
There was no way to edit a registrar's company info (name, industry, RC number, plan, address, website) or representative details (name, email, phone) after enrolment — only suspend/activate/reject/logo mutations existed. We've added an Edit modal on the frontend that calls `PATCH /api/v1/admin/registrars/{id}` with any subset of `{ companyName, industry, rcNumber, plan, address, website, representativeName, representativeEmail, representativePhone }`. **Please confirm/add this endpoint** — it doesn't exist in the frontend's prior integration and we're not certain it exists on your side either.

**e) Enrol Registrar form was missing Address/Website fields.**
The registrar detail page displays `address` and `website` (when present), but the enrol form never collected them — meaning every registrar created through the normal enrolment flow would have those fields permanently blank. Added both fields to the enrol form and started sending them in the `POST /api/v1/admin/registrars/enroll` payload as `address`/`website`. **Please confirm the enroll endpoint accepts these two optional fields** — if it currently ignores unknown JSON keys, no error will surface on our end and the fields just won't persist.

**Also — general ask:** for (a)–(d) above, if any of these admin endpoints don't exist yet, please let us know so we can either wait on them or figure out an interim read-only workaround; we'd rather not guess at endpoint shapes that silently fail.

---

## 13. NEW — Analytics: date-range filter, week-over-week %, scope of Event Format/Per-Event widgets, Q&A field naming

**Context:** Analytics data is now populated (thanks — `by-type` and `audit-logs` plus the rest look real). Follow-up items from reviewing the populated dashboard:

**a) Date-range dropdown ("Last 30 Days / 90 Days / 12 Months / All Time") was decorative — now wired, needs backend support confirmed.**
The selector already existed in the UI but wasn't connected to anything — every analytics call ignored it and always returned whatever the backend's default window is. We've now wired the selected period through to every analytics hook (`summary`, `top-organisers`, `by-type`, `kyc-breakdown`, `event-format`, `engagement`, `event-performance`) as a `?range=` query param with values `30d` | `90d` | `12m` | `all`. **Please confirm whether `/api/v1/admin/analytics/*` endpoints already support a range param — if so, what's the actual param name/values (we guessed `range`/`30d` etc. — happy to change to match) — and if not, please add support so the date filter is functional instead of cosmetic.**

**b) Week-over-week percentage change on summary cards.**
The summary cards (Total Registrations, Docs Distributed) already had optional `registrationsChange`/`docsChange` fields wired on the frontend with a trend arrow + %, but the endpoint never returns them so the indicators never show. We've added the same wiring for Events Hosted and Votes Cast (`eventsHostedChange`, `votesCastChange`). **Ask:** please add all four `*Change` fields to `GET /api/v1/admin/analytics/summary`, specifically as **week-over-week** percentage change (this week vs. the prior 7 days), not just "vs prior period" — that's the comparison the product wants surfaced here.

**c) "Event Format Distribution" and "Per-Event Breakdown" should exist for Client Admin, not (or not only) Super Admin.**
Both currently only exist as `super_admin`-scoped platform-wide widgets (`GET /api/v1/admin/analytics/event-format`, `GET /api/v1/admin/analytics/event-performance`). Per product direction, these are actually more useful scoped to a single organisation's own events — a Client Admin should be able to see their own event format mix and per-event RSVP/attendance breakdown on their own analytics page. **Ask:** please create client-scoped equivalents (e.g. `GET /api/v1/client/analytics/event-format`, `GET /api/v1/client/analytics/event-performance`) so we can add these to the Client Admin analytics view. Happy to keep or drop the Super Admin versions depending on whether platform-wide rollups are still wanted there.

**d) "Poll Responses" column on Per-Event Breakdown — likely mislabeled.**
The platform's live-session engagement feature is Q&A (see `client-live.ts` / live session Q&A panel) — there's no evidence of a separate per-event "polls" feature anywhere else in the product. We suspect the `pollResponses` field on `event-performance` rows is actually meant to represent Q&A engagement for that event, so we've relabeled the column to "Q&A Responses" on the frontend and now read `qaResponses` first, falling back to `pollResponses` for backward compatibility. **Please confirm:** should this field be renamed to `qaResponses` server-side, or is there a genuinely separate polls feature we're not aware of that should stay distinct from Q&A? (Note: the separate "Poll Response Rate" card in Engagement Metrics is untouched — that one does appear to map to a real, distinct polls feature used during live sessions.)

**e) General ask — confirm all Innovation Challenge data is live/real, no stubs.**
We audited the frontend and confirmed there's no mock or hardcoded data anywhere in the Innovation Challenges area (Challenges list, Applications, Judging, Leaderboard, Judge assignment) — everything is wired to `client-challenges.ts` / `admin-challenges.ts` / `judge.ts` hooks hitting real endpoints. If any of those endpoints are still returning stubbed/placeholder data on your side, please let us know which ones so we can flag it clearly instead of it looking like a frontend bug.
