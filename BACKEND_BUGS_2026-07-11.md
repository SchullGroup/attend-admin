# Backend bugs — for backend team

## 1. Revoke access doesn't actually revoke

**Endpoint:** `DELETE /api/v1/client/organisation/team/{id}/revoke`

**Expected:** After calling this, the team member should no longer be able to log in / their session and future logins should be rejected.

**Actual:** The endpoint returns `200 OK` (success), and the UI reflects the member as revoked, but the revoked user can still log in normally afterward — their access is not actually being invalidated server-side.

**Suspected cause:** The revoke handler is likely only flipping a status flag on the team member record (e.g. `status = REVOKED`) without also invalidating that user's active session/refresh tokens, or without checking that status flag during the login/auth flow.

**Repro steps:**
1. As a client admin, go to Team Members and revoke a member's access.
2. Confirm the 200 response and that the UI shows them as revoked.
3. Log in as that revoked user — login still succeeds.

---

## 2. Monthly RSVP Trend — 500 Internal Server Error

**Endpoint:** `GET /api/v1/client/analytics/monthly-trend`

**Expected:** Returns the last 6 months of registration counts, shape:
```json
{ "data": { "trend": [ { "month": "Jan 2025", "registrations": 12 }, ... ] } }
```

**Actual:** Consistently returns `500 Internal Server Error` (confirmed via Network tab, ~350–700ms response time, small response body returned but not yet inspected for stack trace — request the raw response body/exception from server logs for this endpoint).

**Repro:** `GET https://attend-api.schulltech.com/api/v1/client/analytics/monthly-trend` with a valid client admin bearer token — reproduces every time, not intermittent.

**Note:** Every other `/api/v1/client/analytics/*` endpoint (`stats`, `by-type`, `rsvps-by-event`, `fill-rate-overview`, `check-in-overview`, `event-performance`) returns `200` normally — this is isolated to `monthly-trend`.

---

## 3. Shareholder `phone` not showing in list — likely not persisted or not returned

**Endpoint:** `GET /api/v1/client/registers/{id}/shareholders` (and the `POST` create endpoints that feed it)

**Expected:** A shareholder added with a phone number (via "Add Manually" or CSV upload, both of which send `phone` in the request body) should show that phone number when the list is fetched afterward.

**Actual:** Every shareholder in the list shows "—" for phone, even ones added with a phone number filled in. Confirmed on the frontend side that the `POST /api/v1/client/registers/{id}/shareholders` request body does include `phone`.

**Confirmed via direct API call** — `GET /api/v1/client/registers/083006e2-1666-4b30-9450-9614100c551a/shareholders?page=0&size=100` returns shareholder objects with NO `phone` key at all (not even `null`):
```json
{
  "chn": "CHN234567892",
  "email": "jasperbusiness247@gmail.com",
  "fullName": "Ezepue James",
  "id": "7a32fc08-df75-4d04-afe6-b36de0932c5e",
  "status": "ACTIVE",
  "units": 120000
}
```
So this is confirmed backend-side — either:
1. The create handler isn't persisting `phone` when saving the shareholder record, or
2. It's persisted fine, but the `GET` list response serializer is omitting `phone` from the shareholder DTO entirely.

**Ask:** Check whether `phone` is present in the database row after creation. If it is, the fix is adding `phone` to the shareholder list response DTO/serializer. If it isn't, the fix is in the create handler.

**Also flagging:** there's currently no edit/update endpoint for a single shareholder (only create-single, create-bulk, and delete). If shareholder records need to be correctable after creation (e.g. fixing a typo'd phone/email/CHN), please add `PUT`/`PATCH /api/v1/client/registers/{id}/shareholders/{shareholderId}`. Delete already exists and works (`DELETE /api/v1/client/registers/{id}/shareholders/{shareholderId}`) — this is only a request for edit support.

---

## 4. (Related, already worked around on frontend) Missing `sizeBytes` causes 500 on document upload

**Endpoint:** `POST /api/v1/client/events/{id}/documents`

For reference/pattern-matching against bug #2: this endpoint previously 500'd whenever the request body omitted `sizeBytes` (present in the Swagger schema but not documented as required). Frontend now always sends it, masking the issue — but the same root pattern (likely an NPE from `sizeBytes.longValue()` or similar without a null check) is worth checking on `monthly-trend` and other endpoints that compute derived/formatted fields.
