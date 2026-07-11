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

## 5. NEW — Team role "Admin" needs the same API access as the org owner (client_admin)

**Context:** Team Members supports 4 roles: `ADMIN`, `EVENT_MANAGER`, `VIEWER`, `JUDGE`. Product requirement: a team member with role `ADMIN` should get an experience identical to the organisation's owner/`client_admin` — same dashboard, same data, same endpoints. (We had a frontend bug where "Admin" was accidentally being treated as platform "Super Admin" — that's fixed now — but once fixed, several endpoints started failing for Admin-role users, which looks like a **backend-side permission gap**, not a frontend routing issue.)

**Endpoints currently failing/empty for a logged-in user with role `ADMIN`:**
- `GET /api/v1/client/organisation/team` — Team Members page shows "Failed to load team members." (request fails outright)
- `GET /api/v1/client/organisation/profile` — Platform Settings page loads with every Organisation Info / Branding field blank (request resolves but with no usable data — looks like a silent 403/empty payload rather than a network error)
- `GET /api/v1/client/challenges` (Innovation Challenges list) — possibly the same gap; shows "No active challenges yet" for an org that should have challenges. Needs confirming — could also just be an org with genuinely zero challenges, but flagging since it matches the same pattern as the two confirmed cases above.

**Ask:** Please confirm whether these three endpoints scope access to the organisation owner specifically (vs. any team member of that organisation), and if so, extend read access (and normal read/write per the role's intended permissions) to the `ADMIN` team role at minimum. `EVENT_MANAGER`/`VIEWER`/`JUDGE` scoping can stay as originally designed — this is specifically about `ADMIN` matching `client_admin`.

**Also:** please confirm `DELETE /api/v1/client/organisation/team/{id}/revoke` is restricted server-side to the actual org owner only — frontend now also hides the Revoke/Suspend UI for every role except `client_admin`, but that's a client-side convenience, not a security boundary, so the backend should enforce this too.

---

## 6. NEW — Notifications for team role "Admin"

**Ask:** Team members with role `ADMIN` should receive notifications the same way the org owner (`client_admin`) does (event reminders, RSVP updates, document uploads, etc. — whatever the org owner currently gets). Please confirm notification generation targets the whole organisation's `ADMIN`-role members, not just the owner account.
