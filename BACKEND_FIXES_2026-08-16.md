# Backend fixes requested - 2026-08-16

This handoff covers four production issues found from `attend-admin`. The frontend contracts and affected APIs have been traced below. Please implement the authoritative fixes in the backend, deploy them to staging, and return request/response evidence for each acceptance test.

## Priority summary

| Priority | Issue | Main affected API/data |
| --- | --- | --- |
| P0 | Ending or cancelling an event does not end its Zoom meeting for all participants | Event lifecycle endpoints, stored Zoom meeting ID, Zoom Server-to-Server OAuth |
| P0 | Guest access codes with a label/name and expiry often fail when a guest redeems them | Guest-access create and guest-facing redeem/join endpoints, expiry parsing/validation |
| P1 | CHN must be optional when manually adding or CSV-importing shareholders | Shareholder request DTO, entity/schema nullability, bulk validation and deduplication |
| P1 | Innovation challenge criteria created by an admin are not returned to assigned judges | Innovation config persistence and judge challenge/scoring responses |

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
  "expiresAt": "2026-08-20T18:00:00",
  "maxUses": 20
}
```

`label` is the admin-entered name/description for a code; it is not the guest's identity and must not become part of code matching. The frontend currently sends a plain local date-time without milliseconds or `Z` because the backend previously returned a generic `500` when given an ISO instant.

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

### Open timezone question requiring backend confirmation

The product has not yet defined what timezone a value such as `2026-08-20T18:00:00` represents. Backend must propose and document one authoritative contract before frontend changes format. Recommended contract:

1. Accept an ISO-8601 instant/offset such as `2026-08-20T17:00:00Z` or `2026-08-20T18:00:00+01:00`.
2. Store expiry as an instant (`timestamptz`/UTC), not a timezone-free server-local value.
3. Return ISO-8601 with `Z` or an explicit offset.
4. If offset-free input remains supported for backward compatibility, interpret it in the event/organisation timezone and document that timezone in the response.

Please answer explicitly: **Which timezone is used today for offset-free `expiresAt`, and which request format should frontend send going forward?**

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

Both the manual form and CSV parser already omit `chn` when it is blank. They send the same endpoint:

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

CSV upload uses the same shape with multiple rows. When CHN is supplied, frontend normalizes it to a value such as `CHN123456`; when blank or when the CSV has no CHN column, the `chn` property is omitted/undefined. The frontend display copy now explicitly marks CHN as optional.

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

### Acceptance tests

- Add one shareholder manually without CHN and confirm persistence and retrieval.
- Import a CSV with no CHN column and confirm every otherwise-valid row is processed.
- Import a CSV with a CHN column containing a mixture of blank and populated values.
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

## Required backend response to this handoff

Please return:

1. Backend commit and staging deployment identifiers.
2. The actual guest-facing redemption/join endpoint(s) affected by item 2.
3. The chosen `expiresAt` timezone and wire-format contract.
4. Database migrations for nullable CHN and challenge criteria, including index/constraint changes.
5. Sanitized request/response samples and correlation IDs for the acceptance tests.
6. Automated regression-test results for all four items.
7. Any proposed response-contract changes before frontend implementation depends on them.
