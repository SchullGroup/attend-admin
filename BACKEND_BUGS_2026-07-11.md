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

## 3. (Related, already worked around on frontend) Missing `sizeBytes` causes 500 on document upload

**Endpoint:** `POST /api/v1/client/events/{id}/documents`

For reference/pattern-matching against bug #2: this endpoint previously 500'd whenever the request body omitted `sizeBytes` (present in the Swagger schema but not documented as required). Frontend now always sends it, masking the issue — but the same root pattern (likely an NPE from `sizeBytes.longValue()` or similar without a null check) is worth checking on `monthly-trend` and other endpoints that compute derived/formatted fields.
