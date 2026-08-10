# Backend fixes requested - 2026-08-10

This document consolidates the current backend work needed by `attend-admin`. Please implement the behavior and contracts below on the staging API and share any contract changes with frontend.

## 1. Expire sessions after two hours of inactivity

All authenticated `attend-admin` sessions must expire after **2 hours without authenticated activity**.

- This is an inactivity timeout, not a fixed two-hour lifetime from login.
- Each valid authenticated request should advance the session's `lastActivityAt`/idle deadline.
- Once idle for two hours, reject access and refresh attempts, revoke the server-side session, and return `401` using the standard expired-session error shape.
- Enforce this server-side. JWT expiry alone cannot reliably provide a sliding inactivity timeout.
- Apply to `SUPER_ADMIN`, `CLIENT_ADMIN`, `ADMIN`, `JUDGE`, `EVENT_MANAGER`, and `VIEWER`.
- Record session expiry/revocation in the audit log without storing raw access or refresh tokens.

## 2. Prevent concurrent account logins

An `attend-admin` account must have at most one active login session across browsers/devices.

- Apply to `SUPER_ADMIN`, `CLIENT_ADMIN`, `ADMIN`, `JUDGE`, `EVENT_MANAGER`, and `VIEWER`.
- On a successful new login, invalidate every older access/refresh session for that user atomically.
- Older sessions must fail on their next authenticated request or refresh with `401` and a stable code such as `SESSION_REVOKED` or `SIGNED_IN_ELSEWHERE`.
- Preserve the existing `deviceId` sent by the admin frontend and associate it with the session for diagnostics/audit history.
- Password reset, password change, account suspension/revocation, and role removal should also invalidate all existing sessions.
- Avoid a race where two near-simultaneous logins both remain active; enforce uniqueness in the session store/transaction.

## 3. Audit-log filters and CSV export

Extend the audit-log endpoint with server-side filters. The dataset can be large, so filtering and export must not depend on loading all records in the browser.

### List endpoint

For the existing audit-log list endpoint(s), support:

- `startDate`: inclusive ISO-8601 date/time
- `endDate`: inclusive ISO-8601 date/time
- `userEmail`: case-insensitive exact or partial match; please document which
- `actionType`: exact action enum/code
- `entityId`: exact entity/resource ID
- Existing category, severity, search, organisation, and pagination parameters must continue to compose with these filters.
- Validate date ranges and return `400` for invalid dates or `startDate > endDate`.
- Apply filters in the database query before pagination and add appropriate indexes for timestamp, actor email, action type, and entity/resource ID.

### CSV export

Provide an export endpoint, for example:

`GET /api/v1/admin/audit-logs/export?startDate=...&endDate=...&userEmail=...&actionType=...&entityId=...`

- Apply exactly the same authorization and filter semantics as the list endpoint.
- Export all rows matching the active filters, not only the current page.
- Also support exporting explicitly selected entries, either with repeatable `ids` parameters or a documented `POST` export body when selected IDs may exceed URL limits.
- Return a streamed `text/csv` attachment with a useful filename and columns for timestamp, user email, action type, category, severity, entity type/name, entity ID, IP address, organisation, and details.
- Escape spreadsheet-formula prefixes (`=`, `+`, `-`, `@`) in user-controlled cells to prevent CSV injection.
- For very large exports, use an asynchronous job with a downloadable result rather than buffering the full file in application memory.

## 4. Investigate the shared upload endpoint regression

`POST /api/v1/upload` has recently started failing even though the endpoint and frontend integration previously worked.

Please check the current staging logs and the complete upload pipeline: multipart parsing, request/file-size limits, accepted MIME types, Cloudinary/storage credentials, folder handling, timeout behavior, and response serialization.

This shared endpoint is used for organisation/register logos, documents, AGM notices, press-kit files, and challenge resources, so a regression affects several modules. The successful response contract currently expected by frontend is:

```json
{
  "data": {
    "fileUrl": "https://...",
    "cloudinaryPublicId": "..."
  }
}
```

Return actionable `4xx` errors for invalid files and reserve `5xx` for infrastructure/server failures. Please provide a request ID in errors so failed uploads can be correlated with server logs.

## 5. Add a PATCH endpoint for register details

Add an endpoint to edit register metadata such as RC number:

`PATCH /api/v1/client/registers/{registerId}`

The body should accept any subset of editable fields, including at minimum:

```json
{
  "name": "Example Plc Register",
  "email": "registry@example.com",
  "rcNumber": "RC123456",
  "industry": "Financial Services",
  "representativeName": "Ada Example",
  "representativePhone": "+2348012345678",
  "address": "Lagos, Nigeria",
  "website": "https://example.com"
}
```

- Omitted fields must remain unchanged; define whether explicit `null` clears optional fields.
- Scope access to the owning organisation and authorized roles only.
- Validate uniqueness/format rules and return field-level `400`/`409` errors instead of a generic `500`.
- Return the updated register in the same shape as `GET /api/v1/client/registers/{registerId}`.
- Add an audit entry containing changed field names, but do not log sensitive values.

## 6. Fix share-weighted voting units regression

Share-weighted voting previously used each shareholder's share `units`, but votes cast from the web platform no longer include or contribute those units correctly.

Please trace the web vote path from voter/event eligibility through vote persistence and result aggregation.

- When share-weighted voting is enabled, derive authoritative voting units server-side from the shareholder/register or eligible attendee record. Do not trust a client-supplied weight.
- Persist the applied weight with the vote/audit record so historical tallies remain reproducible.
- Vote create and amendment flows must both apply the correct units and avoid double-counting the previous selection.
- Live tallies, final results, quorum calculations, exports, proxy votes, and participant/admin result endpoints must use the same applied weight.
- Define the behavior for missing/null/zero units and return a clear eligibility error where appropriate rather than silently treating a weighted vote as one vote.
- Add regression tests with shareholders holding different units and with a voter changing their vote while voting is open.

## 7. Registers unexpectedly remain PENDING

Some existing registers remain in `PENDING`, which prevents event creation because the event flow lists/accepts only `ACTIVE` registers.

There appears to be an existing approval endpoint:

`POST /api/v1/client/registers/{registerId}/approve`

Please investigate why affected registers were never activated or why approval now fails.

- Confirm the roles allowed to approve and that tenant scoping is correct.
- Confirm successful approval persists `ACTIVE` and that register list/detail responses immediately return the new status.
- Existing valid pending records may need a one-off migration or controlled backfill after identifying why they are pending; do not blindly activate rejected/incomplete records.
- Return a clear `409`/validation response when a register cannot be approved, including the blocking reason.
- Audit who approved the register and when.
- Add a regression test proving an approved register can immediately be used to create an event.

## Acceptance and handoff

For each item, please provide:

1. The staging deployment/commit containing the fix.
2. Final endpoint paths, request parameters/bodies, response examples, and stable error codes.
3. Any required database migration, index, environment-variable, or data-backfill steps.
4. Automated test coverage for session concurrency/idle expiry, filtered audit export, register updates/approval, upload failures, and weighted vote aggregation.