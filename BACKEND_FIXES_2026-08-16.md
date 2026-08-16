# Backend fixes requested - 2026-08-16

This handoff covers six production issues found from `attend-admin`. The frontend contracts and affected APIs have been traced below. Please implement the authoritative fixes in the backend, deploy them to staging, and return request/response evidence for each acceptance test.

## Priority summary

| Priority | Issue | Main affected API/data |
| --- | --- | --- |
| P0 | Ending or cancelling an event does not end its Zoom meeting for all participants | Event lifecycle endpoints, stored Zoom meeting ID, Zoom Server-to-Server OAuth |
| P0 | Guest access codes with a label/name and expiry often fail when a guest redeems them | Guest-access create and guest-facing redeem/join endpoints, expiry parsing/validation |
| P1 | CHN must be optional when manually adding or CSV-importing shareholders | Shareholder request DTO, entity/schema nullability, bulk validation and deduplication |
| P1 | Innovation challenge criteria created by an admin are not returned to assigned judges | Innovation config persistence and judge challenge/scoring responses |
| P0 | Sending an attendee broadcast currently returns HTTP 500 | Broadcast send orchestration, channel providers, delivery history and error mapping |
| P1 | Repeated document downloads must never return HTTP 500 | Global-document download endpoint, file storage lookup, counter/audit idempotency |

## 1. End the Zoom meeting when an admin ends or cancels an event

### Current frontend behavior

The Event Settings screen already uses the existing lifecycle endpoints and only changes its local status after a successful API response:

- `POST /api/v1/client/events/{eventId}/end`
- `POST /api/v1/client/events/{eventId}/cancel`

The event detail contains a `zoomMeeting` object with at least `meetingId`, `password`, `joinUrl`, `startUrl`, and `durationMinutes`. There should be no new frontend call containing Zoom credentials or a client-supplied meeting ID.

### Required backend behavior

When either lifecycle endpoint is called for an event that has a backend-created Zoom meeting:

1. Authorize the event transition and resolve the event within the authenticated organisation.
2. Read the authoritative Zoom `meetingId` from the event's persisted Zoom-meeting relation/configuration. Do not accept a meeting ID from the request body.
3. Obtain a Zoom access token using the backend's existing Server-to-Server OAuth integration.
4. Call Zoom:

```http
PUT /v2/meetings/{meetingId}/status
Content-Type: application/json

{ "action": "end" }
```

Zoom documents this operation as changing an in-progress meeting's status to `end`; it disconnects the host and all participants. Please verify the exact HTTP method against the Zoom API version/library in the backend before implementation. The currently expected Zoom REST operation is `PUT`, not a browser-side SDK leave action.

5. Persist the event status as `ENDED` or `CANCELLED` only according to a defined consistency policy.
6. Record an audit event containing the event ID, Zoom meeting ID, actor, requested lifecycle action, Zoom result, and request/correlation ID. Do not log OAuth tokens, start URLs, ZAK values, or passwords.

This must be backend-side. Zoom credentials must never be sent to the browser, and the admin leaving the embedded Zoom client only leaves that client unless the server ends the meeting.

### Consistency and idempotency

- Repeating `/end` or `/cancel` must be idempotent. If the event is already terminal and the Zoom meeting is already ended, return the terminal state without creating a new Zoom meeting or surfacing a generic `500`.
- Treat Zoom's "meeting is not live/already ended" result as an idempotent success where appropriate.
- A missing Zoom configuration means there is no Zoom side effect; the normal event transition should continue.
- A stale/nonexistent Zoom meeting ID must produce a stable, actionable result and an audit record. Do not silently report that everybody was disconnected when Zoom was never reached.
- Prevent concurrent end/cancel requests from racing into inconsistent event states.

Recommended failure policy: if an event is currently `LIVE` and Zoom returns a retryable/infrastructure failure, do not claim full success. Return `502`/`503` with a stable code such as `ZOOM_END_FAILED`, leave enough state for a retry, and do not show the admin an `ENDED` success while participants remain connected. If product chooses to persist the terminal event status first, add a durable outbox/retry job and return a response field that says Zoom termination is pending.

### Response contract

The existing minimal response remains compatible:

```json
{
  "data": {
    "id": "event-uuid",
    "status": "ENDED",
    "updatedAt": "2026-08-16T10:00:00Z"
  }
}
```

If Zoom outcome fields are added, use stable optional fields such as:

```json
{
  "data": {
    "id": "event-uuid",
    "status": "ENDED",
    "updatedAt": "2026-08-16T10:00:00Z",
    "zoomMeetingEndStatus": "ENDED"
  }
}
```

Suggested values are `NOT_CONFIGURED`, `NOT_IN_PROGRESS`, `ENDED`, or `PENDING_RETRY`. Do not return secrets.

### Acceptance tests

- Start a Zoom meeting with host plus two participants, call `/end`, and prove all three clients are disconnected and the event becomes `ENDED`.
- Start a Zoom meeting, call `/cancel`, and prove all clients are disconnected and the event becomes `CANCELLED`.
- End an event without Zoom and confirm the lifecycle transition still succeeds.
- Repeat the same terminal action and confirm idempotent behavior.
- Simulate Zoom timeout/401/429/5xx and verify the documented consistency policy, stable error code, retry behavior, and audit record.
- Confirm one organisation cannot end another organisation's event or Zoom meeting.

## 2. Fix named and expiring guest access codes

### Current admin request contract

The admin creates and manages codes through:

- `POST /api/v1/client/events/{eventId}/guest-access`
- `GET /api/v1/client/events/{eventId}/guest-access`
- `DELETE /api/v1/client/events/{eventId}/guest-access/{accessId}`

The create body contains optional fields:

```json
{
  "label": "Board observers",
  "expiresAt": "2026-08-20T17:00:00.000Z",
  "maxUses": 20
}
```

`label` is the admin-entered name/description for a code; it is not the guest's identity and must not become part of code matching. The frontend now converts the admin's `datetime-local` value to an ISO-8601 UTC instant with `toISOString()`. For example, `2026-08-20T18:00` entered in Lagos (UTC+1) is sent as `2026-08-20T17:00:00.000Z`. Backend must accept this format and return a field-level `400`, not a generic `500`, for malformed expiry values.

### Reported defect

Codes created with an empty body generally work, while codes with a label/name and expiry frequently fail when the guest attempts to use them. This points to create-time serialization, stored expiry timezone/type, or redeem-time predicates rather than code generation alone.

### Required backend investigation and fix

Trace one code from creation through guest redemption/join and inspect all predicates in one transaction:

- event and access-code tenant/event association;
- normalized code lookup (trim and case policy);
- `revoked` state;
- expiry comparison;
- `maxUses` and `useCount` comparison;
- atomic increment of `useCount` only after successful redemption;
- event status/access rules; and
- whether `label` accidentally participates in lookup, equality, or uniqueness.

Required behavior:

- `label`, `expiresAt`, and `maxUses` are independently optional. Every combination must work.
- A non-empty `label` must not change redemption behavior.
- An unexpired code is valid; define the exact boundary (`now < expiresAt` is recommended, making equality expired).
- Enforce max uses atomically to prevent concurrent redemptions exceeding the limit.
- A failed redemption must not consume a use.
- Code comparison must follow a single documented normalization rule at create and redeem time.
- Return `400` with a field-level message for an invalid `expiresAt` or `maxUses`, never a generic `500`.
- Return stable guest-facing errors without leaking whether an unrelated event/code exists. Internally distinguish at least revoked, expired, exhausted, invalid, and event-unavailable states for logs/support.

### Required timezone contract

The frontend now sends an absolute instant, so backend must implement and document this authoritative contract:

1. Accept an ISO-8601 instant/offset such as `2026-08-20T17:00:00Z` or `2026-08-20T18:00:00+01:00`.
2. Store expiry as an instant (`timestamptz`/UTC), not a timezone-free server-local value.
3. Return ISO-8601 with `Z` or an explicit offset.
4. If offset-free input remains supported for backward compatibility, interpret it in the event/organisation timezone and document that timezone in the response.

Please answer explicitly: **Does every create, list, redeem, and join path preserve and compare this instant consistently?**

### Guest-facing APIs affected

The admin repository does not own the participant application's guest route, so backend must identify and include the actual endpoint(s) used to redeem a code and fetch/join the event, for example `/api/v1/guest/...`. The fix is incomplete if only code creation/listing is tested; it must include the guest redemption path used in production.

### Acceptance matrix

Test guest redemption for all of these cases:

| Label | Expiry | Max uses | Expected |
| --- | --- | --- | --- |
| omitted | omitted | omitted | succeeds |
| supplied | omitted | omitted | succeeds |
| omitted | future | omitted | succeeds before expiry |
| supplied | future | omitted | succeeds before expiry |
| supplied | future | supplied | succeeds until limit |
| supplied | past | any | stable expired response |
| any | any | exhausted | stable exhausted response, no extra increment |
| any | any | revoked | stable revoked response |

Also test expiry boundaries using the API server, database, and client in different timezones.

## 3. Make shareholder CHN optional for manual and CSV uploads

### Current frontend contract

CHN is optional everywhere in `attend-admin`, including manual register entry, register CSV import, and the custom shareholder list uploaded while creating an AGM.

The manual register form and register CSV parser omit `chn` when it is blank. They send the same endpoint:

`POST /api/v1/client/registers/{registerId}/shareholders`

Manual add is wrapped as a one-row bulk request:

```json
{
  "shareholders": [
    {
      "fullName": "Ada Example",
      "email": "ada@example.com",
      "status": "ACTIVE"
    }
  ],
  "replace": false
}
```

Register CSV upload uses the same shape with multiple rows. When CHN is supplied, frontend normalizes it to a value such as `CHN123456`; when blank or when the CSV has no CHN column, the `chn` property is omitted/undefined. The frontend display copy explicitly marks CHN as optional.

The AGM creation flow accepts a custom `.csv` or `.xlsx` shareholder list inside the event request. Its client-side CSV header validation now requires only `fullName`; `chn`, `email`, `phone`, `units`, and `status` are optional. The affected event-create contracts are:

- `POST /api/v1/client/events` using `agmConfig.shareholderListBase64` and `agmConfig.shareholderListFilename`.
- The admin AGM event-creation endpoint used by the backend for the corresponding top-level AGM fields (currently sent through the admin event-create mutation).

Backend processing of the embedded AGM shareholder file must apply the same optional-CHN rules as direct register imports. A file that has valid shareholder rows but no CHN header must not be rejected.

### Required backend behavior and data changes

- Make `chn` nullable/optional in the request DTO, validation layer, domain model, persistence entity, and database column.
- Do not apply `@NotBlank`, required-header validation, or equivalent rules to CHN.
- Accept both an omitted `chn` and explicit `null` if the API's normal PATCH/create null policy permits it. Document whether an empty string is normalized to `null` or rejected with `400`; normalization to `null` is recommended for bulk CSV ingestion.
- Do not generate a fake CHN solely to satisfy uniqueness.
- If a unique index exists, use a database strategy that permits multiple nulls. For PostgreSQL, a normal unique index permits multiple nulls; a partial unique index scoped to non-null values and register is explicit:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_register_shareholder_nonnull_chn
    ON register_shareholders (register_id, chn)
    WHERE chn IS NOT NULL;
```

- CHN uniqueness must be scoped to the register/tenant, unless a documented business rule requires global uniqueness.
- Keep CHN-based upsert when a non-null CHN is present. When CHN is absent, use the existing normalized email/phone identity policy. Do not merge two unrelated people merely because both have `chn = null`.
- `GET` list/detail/search responses must allow `chn: null` or omission without serialization failures.
- `PATCH /api/v1/client/registers/{registerId}/shareholders/{shareholderId}` must preserve an omitted CHN and support clearing it according to the documented null policy.
- Any CSV template/parser on the backend must not require a `CHN` header or non-empty CHN cells.
- Apply the same rule to embedded custom shareholder lists decoded from AGM event-creation payloads; do not maintain a second parser/schema that still requires CHN.

### Acceptance tests

- Add one shareholder manually without CHN and confirm persistence and retrieval.
- Import a CSV with no CHN column and confirm every otherwise-valid row is processed.
- Import a CSV with a CHN column containing a mixture of blank and populated values.
- Create an AGM with a custom CSV that contains `fullName` but no CHN column and confirm event creation and shareholder targeting both succeed.
- Repeat AGM creation with `.xlsx` data containing blank CHN cells.
- Add multiple shareholders with null CHN in the same register; no uniqueness error should occur.
- Submit duplicate non-null CHNs in the same register and confirm the documented upsert/conflict behavior.
- Confirm null CHNs in separate tenants cannot cause cross-tenant matching.
- Search/list/export shareholders with null CHN without a `500` or literal fake value.

## 4. Return innovation challenge criteria to judges

### Current create contracts

The event creation screen has two role-based submission paths, and both already send the configured criteria:

- Client-admin path: `POST /api/v1/client/events`, using `innovationChallengeConfig.judgingCriteria`.
- Admin path: `POST /api/v1/admin/events/innovation`, using top-level `judgingCriteria`.

Client-admin payload fragment:

```json
{
  "innovationChallengeConfig": {
    "judgingCriteria": [
      { "criterion": "Innovation", "weight": 40 },
      { "criterion": "Impact", "weight": 35 },
      { "criterion": "Feasibility", "weight": 25 }
    ]
  }
}
```

Admin payload fragment:

```json
{
  "judgingCriteria": [
    { "criterion": "Innovation", "weight": 40 },
    { "criterion": "Impact", "weight": 35 },
    { "criterion": "Feasibility", "weight": 25 }
  ]
}
```

The frontend validates that configured weights total 100. Verify both request DTO/service mapping paths persist the criteria into the same authoritative challenge data and do not drop them before the judge projection is built.

### Reported defect and required scope

The criteria are visible/configured on the admin side but assigned judges do not receive them. This request is about **criteria visibility**. Do not introduce a new per-criterion score submission model in this change; the current judge score body may remain `{ "score": number, "comment": string? }`.

### Required persistence and response behavior

- Persist every criterion with a stable ID (recommended), challenge/event ID, display name, description if supported, weight, and deterministic order.
- Preserve the name consistently. Creation currently uses `criterion`; the judge scoring frontend currently expects each response item as `{ name, weight, description? }`. Either map persisted `criterion` to response `name`, or standardize one field across APIs and notify frontend before deployment.
- Do not return default/hard-coded criteria when event-specific criteria exist.
- Return criteria only after verifying the judge is assigned/authorized for that challenge.
- The source of truth must be the criteria saved with the challenge at creation/update time.

At minimum, add criteria to:

`GET /api/v1/judge/challenges/{challengeId}/scoring`

Required response fragment:

```json
{
  "data": {
    "challengeId": "challenge-uuid",
    "challengeTitle": "2026 Innovation Challenge",
    "criteria": [
      {
        "name": "Innovation",
        "weight": 40,
        "description": null
      },
      {
        "name": "Impact",
        "weight": 35,
        "description": null
      },
      {
        "name": "Feasibility",
        "weight": 25,
        "description": null
      }
    ],
    "applications": []
  }
}
```

For consistent judge context, also include the criteria in the judge challenge detail endpoint if one exists, and consider a summary/count in:

- `GET /api/v1/judge/judging`
- `GET /api/v1/judge/challenges`
- `GET /api/v1/judge/challenges/{challengeId}` (if implemented)

The scoring endpoint is the blocking contract because the current judge UI already reads `data.criteria` from it.

### Existing and legacy data

- Verify newly created challenges retain all criteria after transaction commit and service/DTO mapping.
- Investigate whether existing challenges have criteria in JSON/config storage but omit them from judge projections; if so, fix projection/query mapping without duplicating rows.
- If legacy challenges genuinely have no stored criteria, return an empty array and provide an admin-visible remediation path. Do not silently invent criteria.
- Ensure event update operations do not accidentally delete criteria when `innovationChallengeConfig` or `judgingCriteria` is omitted.

### Acceptance tests

- Create a challenge with three criteria, read it back as admin, assign a judge, and confirm the judge scoring response returns the same three names, weights, and order.
- Confirm two challenges with different criteria return their own criteria, not a shared default list.
- Confirm an unassigned judge cannot fetch another challenge's criteria.
- Confirm omitted config during an unrelated event update does not erase criteria.
- Confirm an empty-criteria legacy challenge returns `criteria: []`, not `null` or `500`.

## 5. Fix HTTP 500 when sending an attendee broadcast

### Clarified frontend meaning of "broadcast"

In this repository, the event **Broadcast** tab is the attendee messaging feature. It is not a video-stream start/stop API. The failing write contract used by the frontend is:

`POST /api/v1/client/events/{eventId}/broadcast`

The frontend also reads:

- `GET /api/v1/client/events/{eventId}/broadcast/recipients`
- `GET /api/v1/client/events/{eventId}/broadcast/history?page=0&size=20`

The send request supports `EMAIL`, `SMS`, `PUSH`, `IN_APP`, and `ALL`:

```json
{
  "channel": "EMAIL",
  "subject": "Important event update",
  "message": "The meeting will begin in ten minutes."
}
```

`subject` is required by the current UI for `EMAIL` and `ALL`; `message` is required and limited to 500 characters. The reported defect is that pressing **Send Broadcast** returns HTTP 500. No frontend broadcast change is required for this pass.

### Required backend investigation

Trace the request with one correlation ID through all of these stages:

1. Event lookup, tenant authorization, and recipient selection.
2. Request DTO validation and channel enum mapping.
3. Recipient contact normalization and filtering.
4. Provider calls for email, SMS, push, and in-app delivery.
5. Broadcast-history persistence and per-channel counters.
6. Transaction boundaries, especially if a provider call fails after a history row is created.

Inspect for null contact fields, empty recipient lists, unsupported provider configuration, enum casing differences, missing email subject, serialization errors, and database constraints on delivery counters/history. Provider configuration failures and bad request data must not escape as an unclassified HTTP 500.

### Required behavior

- Validate the event, channel, subject rules, message length, and recipient availability before dispatch.
- Return `400` with field-level errors for malformed payloads, `403` for cross-tenant access, and `404` for an event not visible to the authenticated organisation.
- If a requested provider is not configured, return a stable `503`/`422` code such as `BROADCAST_CHANNEL_UNAVAILABLE`; do not throw a generic `500`.
- For `ALL`, define whether delivery is best-effort per channel or all-or-nothing. Best-effort is recommended because one unavailable provider should not erase successful sends through other channels.
- Persist one history record with accurate `totalRecipients`, `emailSent`, `smsSent`, `pushSent`, `inAppSent`, and `skipped` values. Counts must never be negative or null.
- Do not report a message as sent before provider acceptance is known. If delivery is queued asynchronously, return an explicit `QUEUED` state and update history after worker processing.
- Prevent accidental duplicate delivery when the frontend retries after a timeout. Support an idempotency key or a server-generated dispatch ID that can be safely queried/retried.
- Sanitize provider errors in the API response while retaining provider request IDs and full diagnostics in backend logs.

Recommended success response:

```json
{
  "data": {
    "id": "broadcast-uuid",
    "eventId": "event-uuid",
    "channel": "EMAIL",
    "status": "SENT",
    "totalRecipients": 120,
    "emailSent": 116,
    "smsSent": 0,
    "pushSent": 0,
    "inAppSent": 0,
    "skipped": 4,
    "createdAt": "2026-08-16T11:30:00Z"
  }
}
```

### Acceptance tests

- Send a valid email broadcast and confirm a non-500 success, provider acceptance, and matching history counts.
- Test `SMS`, `PUSH`, `IN_APP`, and `ALL` independently, including recipients with missing contact fields.
- Send to an event with zero eligible recipients and confirm a stable documented response rather than a `500`.
- Disable one provider and confirm a stable channel-unavailable or partial-delivery response.
- Submit missing subject, empty message, more than 500 characters, and an unsupported channel; each must return a deterministic `400`.
- Retry the same dispatch after a simulated timeout and prove recipients do not receive duplicate messages.
- Confirm the resulting item appears in broadcast history with accurate counters and tenant isolation.

## 6. Make repeated document downloads reliable and idempotent

### Current frontend contract

The global document vault downloads files through:

`GET /api/v1/client/documents/{documentId}/download`

The frontend requests the response as a binary blob and saves it using the document's original filename. The same document may be downloaded repeatedly by the same or different authorized users. The document model exposed to the frontend includes `fileUrl`, `cloudinaryPublicId`, `originalFilename`, `mimeType`, `sizeBytes`, and `downloadCount`.

There is also a detail endpoint:

`GET /api/v1/client/documents/{documentId}`

The current frontend comments indicate that detail retrieval may include `fileData` and increment a counter. Backend must define one authoritative counting policy so detail fetches, downloads, retries, and redirects do not conflict.

### Reported defect

A document can download successfully once and then return HTTP 500 on a later download. A successful first download must not mutate, consume, move, or invalidate the stored file reference. Download counting or audit persistence must not make the binary operation single-use.

### Required backend investigation

For one affected document, compare the database row and storage object before and after the first successful request. Trace:

- tenant/document authorization;
- file URL or Cloudinary public-ID resolution;
- storage-provider response and redirect handling;
- binary streaming/content-disposition construction;
- `downloadCount` increment logic;
- download audit insertion and unique constraints;
- entity versioning/optimistic-lock failures; and
- transaction lifecycle when the client disconnects or retries.

Common failure candidates include a one-time signed URL being persisted and reused, a unique audit constraint that allows only one record per user/document, a non-atomic read-modify-write counter, a null file stream after the first request, or a transaction committing counter state before storage retrieval succeeds.

### Required behavior

- Every authorized request must resolve the original immutable storage object or generate a fresh signed URL when the provider requires expiring URLs.
- Never persist a temporary one-time URL as the canonical file location.
- Increment `downloadCount` atomically, for example with `download_count = download_count + 1`; concurrent requests must not lose updates or trigger optimistic-lock HTTP 500 errors.
- A download audit table must allow repeated downloads. Each attempt/success should have its own ID and timestamp; do not enforce uniqueness on only `(document_id, user_id)`.
- Count only according to one documented rule. Recommended: increment after storage retrieval is successfully established, once per accepted download request. Do not increment on authorization failure, missing storage object, or provider failure.
- Repeated GET requests are operationally idempotent with respect to file availability: they may increment analytics, but must return the same file bytes and must not change or delete the underlying object.
- Return the correct `Content-Type`, `Content-Length` when known, and safe `Content-Disposition` filename on every request.
- Map missing documents to `404`, unauthorized/cross-tenant access to `403`/`404` per security policy, missing storage objects to a stable `410` or `502`, and provider timeouts to `503`. Do not expose provider credentials or raw stack traces.
- If the API redirects to Cloudinary/object storage, generate a fresh usable URL per request and preserve the same status/error contract.

### Acceptance tests

- Download the same document at least five times sequentially and verify identical file hash/size and no HTTP 500.
- Download the same document concurrently from at least ten requests and verify every authorized request succeeds and `downloadCount` follows the documented rule.
- Repeat downloads after the original signed URL's expiry window and prove a fresh valid URL/object stream is returned.
- Verify a failed provider request does not corrupt the document row or prevent the next retry from succeeding.
- Verify download-audit rows can be created repeatedly for the same user and document.
- Confirm cross-tenant access cannot retrieve the file or increment its counter.
- Confirm a missing storage object returns the documented stable error and correlation ID, not a generic `500`.
- Confirm `GET /api/v1/client/documents/{documentId}` does not unexpectedly consume or invalidate the subsequent `/download` request.

## Required backend response to this handoff

Please return:

1. Backend commit and staging deployment identifiers.
2. The actual guest-facing redemption/join endpoint(s) affected by item 2.
3. The chosen `expiresAt` timezone and wire-format contract.
4. Database migrations for nullable CHN and challenge criteria, including index/constraint changes.
5. Sanitized request/response samples and correlation IDs for the acceptance tests.
6. Automated regression-test results for all six items.
7. Any proposed response-contract changes before frontend implementation depends on them.

## Product verification update - 2026-08-16

The product-side verification result is:

| Item | Status | Follow-up |
| --- | --- | --- |
| End/cancel event ends Zoom for everyone | Confirmed working | Keep regression coverage for both lifecycle endpoints and repeated requests. |
| Named and expiring guest access codes | Confirmed working | Keep the label/expiry/max-use acceptance matrix as regression coverage. |
| Optional shareholder CHN | Still failing | Remains open. Apply the DTO, persistence, uniqueness, direct import, and embedded AGM import changes in section 3. |
| Challenge criteria visible to judges | Confirmed working | Keep authorization and event-specific criteria regression coverage. |

The CHN failure should be logged with the failed endpoint, sanitized request body/file headers, response body, status, request ID, and whether it occurred in manual entry, direct register CSV import, or AGM custom-list import. A successful frontend request can omit `chn`; the backend must not convert that omission into a required-field or uniqueness failure.

## Additional open issue: two-hour inactivity expiry may not be enforced correctly

The original requirement is in `BACKEND_FIXES_2026-08-10.md`: expire an admin session after **120 minutes without authenticated activity**. This is a sliding server-side idle timeout, not a fixed access-token lifetime and not a fixed 120-minute lifetime from login.

### Current frontend behavior

- The browser access-token cookie has a one-day client-side lifetime.
- The HttpOnly refresh-token cookie has a seven-day client-side lifetime.
- These cookie lifetimes are storage ceilings only. They do not implement or override the two-hour backend idle policy.
- Authenticated API requests use the access token. On an ordinary access-token `401`, the frontend may call `POST /api/auth/refresh`, which proxies to `POST /api/v1/auth/refresh-token`.
- The frontend recognizes backend codes `IDLE_TIMEOUT` and `SESSION_EXPIRED`, clears local auth state, redirects to login, and shows: `Your session expired after 2 hours of inactivity. Please log in again.`
- The frontend has been tightened so an explicit `401` idle-expiry response is terminal and is not followed by a refresh attempt.

Therefore, the authoritative fix must remain backend-side. A seven-day refresh cookie must not allow a session idle for more than 120 minutes to resume.

### Required backend model

Maintain an authoritative server-side session record keyed to the access/refresh token family, for example:

```text
sessionId
userId
deviceId
refreshTokenHash / tokenFamilyId
lastActivityAt
revokedAt
revokeReason
createdAt
absoluteExpiresAt (optional separate maximum lifetime)
```

For every authenticated request:

1. Resolve the active server-side session/token family.
2. Reject it when revoked or when `serverNow >= lastActivityAt + 120 minutes`.
3. On rejection, revoke the session/token family and return `401` with stable code `IDLE_TIMEOUT` or `SESSION_EXPIRED`.
4. Only after successful authentication/authorization, advance `lastActivityAt` using server time. Throttle writes if needed, but do not create a gap large enough to expire an actively used session incorrectly.
5. Do not count public requests, failed authentication, static assets, browser mouse movement, or merely keeping a tab open as authenticated activity.

For `POST /api/v1/auth/refresh-token`:

1. Resolve the same server-side session/token family from the refresh token.
2. Apply the same 120-minute idle check **before** issuing or rotating any token.
3. If idle-expired, revoke the whole token family and return the same stable `401` expiry code. Do not issue a new access or refresh token.
4. A successful refresh may update `lastActivityAt`, because it is an authenticated session operation, but it must not resurrect an already expired session.

JWT `exp`, access-token TTL, refresh-token TTL, and cookie `maxAge` may remain separate security limits. None of them is a substitute for `lastActivityAt` enforcement.

### Response contract

Return the stable code at the top level or in the existing standard error envelope, consistently for both protected endpoints and refresh:

```json
{
  "status": "FAILURE",
  "code": "IDLE_TIMEOUT",
  "error": "Session expired",
  "message": "Your session expired after 2 hours of inactivity. Please log in again."
}
```

Do not return a generic `INVALID_TOKEN` for this case if the server knows the session expired from inactivity, and do not return HTTP `500`.

### Required acceptance evidence

- At T+119 minutes with no activity, an authenticated request succeeds and advances the idle deadline.
- At T+121 minutes with no activity, a protected endpoint returns `401 IDLE_TIMEOUT` and the session is revoked.
- At T+121 minutes, calling refresh directly also returns `401 IDLE_TIMEOUT` and issues no tokens.
- Activity at T+90 minutes allows the same session to remain valid until 120 minutes after that activity, proving this is sliding rather than fixed from login.
- Browser mouse/keyboard activity without an authenticated request does not extend the backend session.
- A background polling/websocket policy is explicitly decided and tested. If those calls count as activity, a dashboard left open may never become idle; if product expects human inactivity, passive polling must not extend `lastActivityAt`.
- The expiry applies to `SUPER_ADMIN`, `CLIENT_ADMIN`, `ADMIN`, `JUDGE`, `EVENT_MANAGER`, and `VIEWER`.
- Concurrent tabs for the same session share one authoritative deadline and cannot race to revive an expired token family.
- Server/database clock handling uses UTC/server time and is covered at the exact 120-minute boundary.
- Audit records include session ID, user ID, device ID, last activity, expiry time, request ID, and reason, without raw access/refresh tokens.

Please return the session entity/cache fields used, the exact activity-update rule, token TTL configuration, sanitized protected-request and refresh responses at T+121, and automated test results. Without that evidence, changing JWT or cookie expiry to two hours does not satisfy this requirement.
