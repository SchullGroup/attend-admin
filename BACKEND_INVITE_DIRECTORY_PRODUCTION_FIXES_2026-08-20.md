# Backend invite-directory production fixes — 2026-08-20

This is a focused follow-up to `BACKEND_INVITE_ONLY_REGISTRATION_2026-08-19.md` based on testing the implemented invite directory with **9,939 invitees**. It covers three backend/data-contract issues that must be resolved before the feature can safely support production lists, where a single event may contain **500,000+ invitees**.

The three issues are related:

1. Large imports are unreliable because the current implemented request transfers the full parsed CSV as one JSON array.
2. An admin cannot safely undo a wrong import or remove/revoke an individual invite.
3. Invitation emails are received, but invite/campaign status is not persisted consistently; list summary values remain stale or incorrect.

## Priority summary

| Priority | Issue | Production impact |
| --- | --- | --- |
| P0 | Importing about 10,000 rows fails intermittently and requires retries | A 500,000-row production import is not viable and retries can create duplicates or ambiguous state |
| P0 | Emails are delivered while invite rows remain `UNSENT` and campaign/list counters do not advance | Admins may resend to the same recipients, reporting is incorrect, and campaign completion cannot be trusted |
| P1 | No import rollback or usable per-invite removal/revocation | A wrong CSV cannot be safely corrected before sending |

## Current frontend/API behavior

The admin currently uses these endpoints:

```http
POST /api/v1/client/events/{eventId}/invites
POST /api/v1/client/events/{eventId}/invites/import
GET  /api/v1/client/events/{eventId}/invite-imports/{jobId}
GET  /api/v1/client/events/{eventId}/invites
POST /api/v1/client/events/{eventId}/invite-campaigns
GET  /api/v1/client/events/{eventId}/invite-campaigns/{campaignId}
POST /api/v1/client/events/{eventId}/invites/{inviteId}/resend
DELETE /api/v1/client/events/{eventId}/invites/{inviteId}
```

Despite the original handoff proposing `multipart/form-data`, the currently implemented frontend must parse the complete CSV in the browser and submit this shape:

```json
{
  "invites": [
    {
      "email": "person@example.com",
      "firstName": "Example",
      "lastName": "Person",
      "phone": "+234...",
      "tierId": "optional-tier-id",
      "tierName": "optional-tier-name"
    }
  ]
}
```

That contract is not suitable for 500,000 rows. It creates a large browser allocation, a large JSON serialization/allocation, a large request body, a large backend deserialization allocation, and a long request vulnerable to proxy/server timeouts. Retrying the whole request is also unsafe unless import creation is idempotent.

The frontend now refreshes `GET /invites` whenever a polled campaign-progress response changes. Therefore, if a fresh network response still returns `unsent: 9938` and `sent: 1`, this is not a React Query display-cache issue; the API/read model itself has not advanced.

---

# 1. Make 500,000+ row imports reliable and asynchronous

## Required architecture

Backend may choose the project's preferred storage and queue technologies, but the external behavior must follow these principles:

1. Upload the **original CSV file**, not a browser-parsed JSON array.
2. Acknowledge import creation quickly with `202 Accepted` and a durable job ID.
3. Parse and persist rows asynchronously in a worker.
4. Stream rows and write bounded database batches; never hold the full file or all parsed invite entities in memory.
5. Make job creation and batch processing idempotent and resumable.
6. Importing rows must **not send invitation email**. Sending remains a separate campaign action.

## Recommended upload flow: direct-to-object-storage

This is the preferred design for 500,000+ rows because the API process does not proxy a very large file.

### Step 1 — create an upload session

```http
POST /api/v1/client/events/{eventId}/invite-imports/upload-session
Content-Type: application/json
Idempotency-Key: <client-generated-uuid>
```

```json
{
  "filename": "audience.csv",
  "contentType": "text/csv",
  "sizeBytes": 48239102,
  "sha256": "optional-but-recommended-file-hash"
}
```

Suggested response:

```json
{
  "success": true,
  "data": {
    "uploadId": "uuid",
    "storageKey": "tenant/event/import/uuid.csv",
    "uploadUrl": "short-lived-signed-url",
    "expiresAt": "2026-08-20T18:45:00Z",
    "requiredHeaders": {}
  }
}
```

For files above the storage provider's reliable single-request threshold, return a multipart/resumable upload contract rather than one signed PUT URL.

### Step 2 — browser uploads directly to storage

The frontend uploads bytes to the signed URL. Storage keys must be generated and scoped by the backend; never accept an arbitrary bucket key as authority to read another tenant's object.

### Step 3 — finalize and queue the import

```http
POST /api/v1/client/events/{eventId}/invite-imports
Content-Type: application/json
Idempotency-Key: <client-generated-uuid>
```

```json
{
  "uploadId": "uuid",
  "defaultTierId": "optional-tier-uuid"
}
```

```http
HTTP 202 Accepted
```

```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "status": "PENDING"
  }
}
```

Before queuing, backend must verify upload ownership, event ownership, object existence, declared/actual size, supported content type, and optional hash. A finalized `uploadId` must not create multiple import jobs.

## Acceptable alternative: streamed multipart API upload

If direct storage upload cannot be delivered immediately, this remains an acceptable transitional contract:

```http
POST /api/v1/client/events/{eventId}/invites/import
Content-Type: multipart/form-data

file: audience.csv
defaultTierId: optional UUID
```

The API must stream the multipart part to durable temporary/object storage and return `202` after creating a job. It must not read the entire multipart file into a `byte[]`, string, parsed-row list, or request-scoped entity list. Proxy, gateway, and server request-size/time limits must be explicitly configured and tested.

Do **not** make frontend-side JSON chunking the primary production design. It can be a temporary fallback only if every chunk has a durable upload session, chunk number, checksum, idempotency key, resume status, and explicit finalize operation. Independent requests containing untracked chunks are not sufficient.

## Worker and database requirements

- Stream CSV parsing from storage.
- Validate the header once and reject unsupported schemas with a useful job error.
- Process configurable batches, initially benchmarked around 1,000–5,000 rows rather than one transaction for the whole file.
- Use bulk insert/upsert facilities appropriate to the database; avoid one query/transaction per row.
- Normalize email once using the same rule as invite lookup and registration enforcement (`trim` plus case-insensitive canonical comparison).
- Enforce a unique key equivalent to `(event_id, normalized_email)`.
- Associate every accepted row with the import job that created it and record when an existing row was updated instead.
- Commit job counters only with the corresponding row batch so progress never claims uncommitted rows.
- Persist a durable checkpoint (for example last committed row/batch) and resume from it after worker restart.
- Make retry of a committed batch a no-op/upsert, not duplicate rows.
- Generate a downloadable rejected-row CSV with row number, safe field values, and stable rejection reason.
- Keep original uploads/error reports for a defined retention period, then delete them through lifecycle policy.
- Prevent simultaneous workers from processing the same job using a lease/lock with expiry and recovery.

## Job state and progress contract

Recommended states:

```text
AWAITING_UPLOAD | PENDING | VALIDATING | PROCESSING | COMPLETED |
FAILED | CANCEL_REQUESTED | CANCELLED | ROLLING_BACK | ROLLED_BACK |
ROLLBACK_PARTIAL | ROLLBACK_FAILED
```

```http
GET /api/v1/client/events/{eventId}/invite-imports/{jobId}
```

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "eventId": "uuid",
    "originalFilename": "audience.csv",
    "status": "PROCESSING",
    "totalRows": 500000,
    "processedRows": 125000,
    "acceptedRows": 121000,
    "createdRows": 118000,
    "updatedRows": 3000,
    "duplicateRows": 2500,
    "rejectedRows": 1500,
    "errorReportUrl": null,
    "startedAt": "2026-08-20T17:00:00Z",
    "completedAt": null,
    "lastHeartbeatAt": "2026-08-20T17:02:10Z",
    "errorCode": null,
    "errorMessage": null
  }
}
```

Counters must be non-negative and monotonic while processing, and on terminal completion:

```text
processedRows = acceptedRows + duplicateRows + rejectedRows
acceptedRows = createdRows + updatedRows
processedRows = totalRows
```

If the backend uses a different definition, document it and make the equation explicit. Never leave a job indefinitely `PROCESSING` after a worker dies; lease expiry/reconciliation must retry it or move it to a diagnosable terminal state.

## Limits and performance acceptance criteria

Backend must publish configuration for maximum file bytes, maximum rows, maximum field lengths, and concurrent imports per tenant. Values must be based on a load test, not guessed from the current 10,000-row behavior.

Required tests:

1. Import valid files with 10,000, 100,000, and 500,000 rows.
2. The initial API call returns a job/upload contract without waiting for CSV parsing.
3. API and worker memory remain bounded as row count increases.
4. Kill the worker halfway through 500,000 rows; restart it and prove the job completes with no duplicate invites.
5. Retry upload-session creation/finalization with the same idempotency key and prove only one job exists.
6. Include duplicate emails within one file and duplicates already in the event; verify deterministic counters and one event invite per normalized email.
7. Include malformed rows and prove valid rows complete while rejected rows appear in the error report.
8. Navigate away/refresh during processing and prove status can be recovered using the durable job ID.
9. Start two imports for the same event and prove uniqueness, counters, and rollback provenance remain correct.
10. Verify one tenant cannot finalize, inspect, cancel, or roll back another tenant's upload/job.

---

# 2. Add safe individual revocation and import-scoped rollback

The admin needs both operations:

- remove/revoke one incorrect person; and
- undo all rows introduced by a wrong CSV **before sending**.

An invitation email that has already left the provider cannot be recalled. Therefore, API naming and responses must distinguish removing an unsent row from revoking future use of an already-sent invitation.

## Required list item identity

`GET /api/v1/client/events/{eventId}/invites` must return a stable `id` for every row. The frontend cannot call per-invite actions safely if items contain only names/email.

Minimum fields needed:

```json
{
  "id": "invite-uuid",
  "email": "person@example.com",
  "firstName": "Example",
  "lastName": "Person",
  "tierId": "tier-uuid",
  "tierName": "VIP",
  "importJobId": "import-job-uuid",
  "deliveryStatus": "SENT",
  "registrationStatus": "INVITED",
  "revokedAt": null,
  "createdAt": "2026-08-20T17:00:00Z",
  "updatedAt": "2026-08-20T17:10:00Z"
}
```

## Revoke one invite

Keep the existing route if preferred:

```http
DELETE /api/v1/client/events/{eventId}/invites/{inviteId}
```

Required semantics:

- `UNSENT`: remove from active selection and retain an audit/tombstone record.
- `QUEUED`: atomically revoke and make every not-yet-started send worker skip it.
- `SENT`/`DELIVERED`/`BOUNCED`/`FAILED`: allow revocation. It cannot recall email, but it must invalidate the invite token and prevent future invite-only registration through that invite.
- `REGISTERED`: do not silently delete the registration. Either return `409 INVITE_ALREADY_REGISTERED` and direct the admin to the registration cancellation flow, or perform an explicitly named registration-cancellation operation. Backend must confirm which policy is used.
- Repeating revoke must be idempotent.
- Never hard-delete provider-send history, campaign membership, delivery events, registration audit history, or security-relevant token history.
- Store only a hash of an invitation token; revocation must invalidate validation immediately.

Suggested response:

```json
{
  "success": true,
  "data": {
    "id": "invite-uuid",
    "registrationStatus": "REVOKED",
    "revokedAt": "2026-08-20T18:00:00Z",
    "emailRecallPossible": false
  }
}
```

## Roll back one import job

Use an explicit async action because a 500,000-row rollback may not complete inside one HTTP request:

```http
POST /api/v1/client/events/{eventId}/invite-imports/{jobId}/rollback
Content-Type: application/json
Idempotency-Key: <client-generated-uuid>
```

```json
{
  "mode": "CREATED_BY_IMPORT"
}
```

```http
HTTP 202 Accepted
```

```json
{
  "success": true,
  "data": {
    "rollbackJobId": "uuid",
    "importJobId": "uuid",
    "status": "PENDING",
    "candidateCount": 9939
  }
}
```

### Safe rollback semantics

The default rollback must be **import-scoped**, not “delete every invite currently on the event”:

1. Remove/revoke only invite rows that were **created by this import job**.
2. Do not delete older/manual invites merely because the same email appeared in the wrong CSV.
3. For a pre-existing invite updated by this job, either restore its recorded pre-import values from an import-change journal or leave it unchanged and report it as `preservedUpdatedRows`. Do not delete it.
4. If no campaign has selected/sent any candidate, remove candidates from the active directory while retaining tombstone/audit provenance.
5. If a candidate is queued, cancel/skip it atomically where possible.
6. If email has already been sent, revoke the invite/token and report it separately; do not claim the email was removed.
7. If the person has registered, preserve the registration and report a conflict/preserved count unless a separate explicit registration-cancellation policy is invoked.
8. Repeating the same rollback request must be idempotent.
9. Campaign workers must re-check active/revoked state immediately before provider submission, not rely solely on a campaign snapshot created before rollback.

Recommended terminal response/progress fields:

```json
{
  "success": true,
  "data": {
    "rollbackJobId": "uuid",
    "importJobId": "uuid",
    "status": "COMPLETED",
    "candidateCount": 9939,
    "removedUnsentRows": 9900,
    "cancelledQueuedRows": 20,
    "revokedSentRows": 10,
    "preservedRegisteredRows": 2,
    "preservedUpdatedRows": 7,
    "failedRows": 0,
    "completedAt": "2026-08-20T18:10:00Z"
  }
}
```

The exact route can instead be `DELETE /invite-imports/{jobId}/invites`, but it must still return an asynchronous job for large imports and preserve the semantics above.

## Optional bulk selection endpoint

After per-row and import rollback work, a filtered bulk revoke can support admin-selected rows:

```http
POST /api/v1/client/events/{eventId}/invites/bulk-revoke
```

```json
{
  "inviteIds": ["uuid-1", "uuid-2"],
  "reason": "Incorrect audience upload"
}
```

Do not expose an unqualified synchronous `DELETE /invites` that can erase an entire event through an accidental click. Any “all” operation needs an explicit selection (`IMPORT_JOB`, `ALL_UNSENT`, or filter snapshot), confirmation count, idempotency key, authorization, audit record, and asynchronous progress.

## Deletion/revocation acceptance tests

1. Revoke one unsent invite; it no longer appears in `ALL_UNSENT` campaign selection.
2. Revoke a queued invite while a campaign runs; the worker skips it and increments a defined skipped/revoked count.
3. Revoke a sent invite; its email cannot be recalled, but its token no longer authorizes registration.
4. Repeat each revoke and receive the same effective result without a `500`.
5. Roll back a completed 500,000-row import before sending and remove all rows created by that job without touching prior/manual rows.
6. Roll back an import that updated an older invite; preserve/restore the older invite rather than deleting it.
7. Roll back after partial sending; report unsent removals and sent revocations separately.
8. Roll back with registered candidates; preserve registrations and report them explicitly.
9. Race campaign sending against rollback and prove no row revoked before provider submission is sent afterward.
10. Verify all operations enforce event/tenant ownership and create audit records.

---

# 3. Persist send results and make campaign/list counters trustworthy

## Observed production-like evidence

The admin imported 9,939 people and started sending. Multiple accounts received invitation email, but a fresh invite-list response remained:

```json
{
  "data": {
    "summary": {
      "total": 9939,
      "unsent": 9938,
      "queued": 0,
      "sent": 1,
      "delivered": 0,
      "failed": 0,
      "bounced": 0,
      "registered": 1,
      "revoked": 0
    }
  }
}
```

This appears to be the first test invite/registration only. Later recipients received email, but those sends were not reflected in the authoritative invite summary.

No campaign-progress payload was captured for this occurrence, so backend must inspect both the campaign row/counters and the underlying invite/send rows for the affected campaign. The list summary alone cannot show whether selection, queueing, provider submission, transaction commit, read replica/cache invalidation, or webhook processing failed.

## Required investigation

Trace one campaign and several known recipient emails end to end using correlation IDs:

1. Campaign creation and the immutable/traceable selected recipient set.
2. Queue publication/outbox commit for every selected recipient or batch.
3. Worker consumption and attempt number.
4. Invite/campaign membership lookup in the correct tenant/event.
5. Provider request and provider message ID.
6. Database commit of attempt and delivery state.
7. Campaign aggregate update/reconciliation.
8. `GET /invite-campaigns/{campaignId}` source of truth.
9. `GET /invites` summary query, including cache and read-replica behavior.
10. Provider webhook processing for delivered/bounced events.

Likely failure classes to explicitly rule out:

- email is submitted before the database transaction commits, then status persistence rolls back/fails;
- worker sends but an exception prevents status/counter update;
- worker updates a send-attempt table while the summary counts a different/stale invite status column;
- campaign queues only one row despite selecting many;
- messages are published outside a transactional outbox and job/counter state diverges;
- non-idempotent retry sends duplicates after persistence failure;
- summary result or ORM collection is cached without invalidation;
- reads use a replica whose lag is unbounded or not visible;
- bulk database update bypasses ORM cache/listener behavior;
- campaign is marked terminal before all recipient jobs reach terminal state;
- provider success is incorrectly deferred until a delivery webhook, leaving accepted messages as `UNSENT`;
- status updates use an incorrect event/invite/campaign identifier.

## Authoritative send semantics

Use separate delivery and registration dimensions internally:

```text
delivery_status:
  NOT_SENT | QUEUED | PROCESSING | SENT | DELIVERED | BOUNCED | FAILED

registration_status:
  INVITED | REGISTERED | REVOKED | EXPIRED
```

Definitions:

- `NOT_SENT`: no active/accepted provider send exists.
- `QUEUED`: durable outbox/recipient job exists but provider submission has not started.
- `PROCESSING`: a worker owns a lease and is attempting submission.
- `SENT`: provider accepted the message and returned success/message ID. This must not wait for a delivered webhook.
- `DELIVERED`: verified provider webhook confirms delivery.
- `FAILED`: sending reached a terminal failure under retry policy.
- `BOUNCED`: provider webhook reports bounce.
- `REGISTERED`: participant registration succeeded; this is independent of email delivery status.
- `REVOKED`: invitation is no longer valid; this is independent of whether an email was previously sent.

An invite may be both `SENT` and `REGISTERED`, or `DELIVERED` and `REGISTERED`. Do not force these facts into one enum where registering overwrites delivery state.

## Required state persistence order

Use a durable outbox/recipient-job model:

1. In one database transaction, create campaign, campaign-recipient rows, and outbox work records; set invite delivery status to `QUEUED` where appropriate.
2. Commit before a worker can consume the work.
3. Worker claims a recipient using a lease/atomic transition and a stable provider idempotency/message key.
4. Submit to the email provider.
5. Persist a send-attempt record including provider message ID and transition that recipient/invite to `SENT` in a reliable transaction.
6. On retryable provider failure, persist the failed attempt and next retry time; do not return the invite to `NOT_SENT`.
7. On terminal failure, transition to `FAILED`.
8. Process delivery/bounce webhooks idempotently using provider event/message IDs.
9. Reconcile aggregates from recipient rows and alert/fix drift rather than trusting counters that can diverge permanently.

The hardest failure is “provider accepted email but database commit failed.” A retry must not blindly send another email. Use the provider's supported idempotency mechanism where available; otherwise use a deterministic message/metadata key, persist attempts before submission, query/reconcile provider state where possible, and route ambiguous attempts to reconciliation rather than automatic duplicate send.

## Campaign progress contract

```http
GET /api/v1/client/events/{eventId}/invite-campaigns/{campaignId}
```

The response must be durable after browser refresh and include enough information to diagnose/reconcile:

```json
{
  "success": true,
  "data": {
    "campaignId": "uuid",
    "eventId": "uuid",
    "status": "PROCESSING",
    "selectionType": "ALL_UNSENT",
    "selectedCount": 9938,
    "queuedCount": 8000,
    "processingCount": 20,
    "sentCount": 1800,
    "deliveredCount": 100,
    "failedCount": 100,
    "skippedCount": 18,
    "revokedCount": 0,
    "startedAt": "2026-08-20T17:00:00Z",
    "completedAt": null,
    "lastHeartbeatAt": "2026-08-20T17:03:00Z",
    "errorCode": null
  }
}
```

Define campaign status as:

```text
PENDING | PROCESSING | COMPLETED | COMPLETED_WITH_FAILURES |
FAILED | CANCEL_REQUESTED | CANCELLED
```

A campaign must not become terminal until every selected recipient is in exactly one terminal campaign outcome. Recommended invariant at completion:

```text
selectedCount = sentCount + failedCount + skippedCount + revokedCount
```

`deliveredCount` is a later subset/outcome of accepted sends and is **not** added to that equation. If `sentCount` is presented as “currently SENT but not DELIVERED,” expose an additional `acceptedCount` for the invariant instead. Backend and frontend must not use ambiguous definitions.

While processing, the analogous invariant should include all non-terminal states:

```text
selectedCount = queuedCount + processingCount + acceptedTerminalCount
              + failedCount + skippedCount + revokedCount
```

Avoid double-counting rows between `queuedCount`, `processingCount`, and terminal outcomes.

## Invite-list summary contract

```http
GET /api/v1/client/events/{eventId}/invites?page=0&size=50
```

The summary must be calculated for the whole event, independent of page size. Filtering behavior must be documented: recommendation is that `summary` reflects the active filters, and a separate `eventSummary` is returned if the UI also needs unfiltered totals.

Because registration and revocation overlap delivery states, do not imply that all displayed counters partition `total`. Prefer:

```json
{
  "deliverySummary": {
    "total": 9939,
    "notSent": 0,
    "queued": 0,
    "processing": 0,
    "sent": 9739,
    "delivered": 100,
    "bounced": 50,
    "failed": 50
  },
  "registrationSummary": {
    "registered": 1,
    "revoked": 0,
    "expired": 0
  }
}
```

If the existing flat summary remains for compatibility, define each value precisely and ensure:

- provider-accepted email increments `sent` without waiting for delivery webhook;
- `delivered`/`bounced` may move later through webhooks;
- `registered` does not decrement/overwrite `sent` or `delivered` internally;
- `revoked` does not erase historical send/delivery facts;
- summary and item rows come from the same authoritative database/read model;
- any cache is invalidated/versioned when send, webhook, registration, or revoke state changes;
- read-replica lag has a bounded policy, and campaign polling can use primary/consistent reads when needed.

## Reconciliation and observability

Add a scheduled/on-demand reconciliation process that derives campaign aggregates from campaign-recipient/send-attempt rows and repairs drift transactionally. It should identify at least:

- campaign selected count differs from recipient-row count;
- provider message ID exists but invite/campaign recipient is not `SENT`/later;
- terminal campaign has non-terminal recipients;
- invite summary differs from grouped authoritative rows;
- recipient is stuck `PROCESSING` beyond lease timeout;
- duplicate provider submissions for the same invite/campaign.

Metrics/alerts should include:

- import jobs stuck without heartbeat;
- campaign recipients stuck queued/processing;
- provider accepted count versus committed `SENT` count;
- outbox age and queue lag;
- retry and terminal failure rates;
- webhook lag/failure rate;
- aggregate reconciliation drift;
- duplicate-send prevention events.

Log correlation identifiers for event, import job, campaign, campaign recipient, invite, worker attempt, outbox item, and provider message ID. Do not log raw invite tokens or full CSV contents.

## Campaign/status acceptance tests

1. Send to 10 recipients using a fake provider; after provider acceptance, all 10 are `SENT` even when no delivery webhooks have arrived.
2. Deliver webhooks for 7 and bounce 1; delivery counters advance without losing registration state.
3. Send to 9,938 recipients and verify campaign/list counters progress beyond the original single test invite.
4. At terminal campaign state, assert the documented recipient-count invariant from database rows, API campaign response, and event summary.
5. Refresh/reopen the admin during a campaign and receive the same durable progress.
6. Force a worker exception after provider acceptance but before normal persistence and prove reconciliation prevents silent `UNSENT` plus duplicate automatic resend.
7. Force database failure, provider timeout, provider 429, and provider 5xx; verify persisted attempts, backoff, terminal state, and idempotency.
8. Process duplicate/out-of-order provider webhooks and prove counters remain correct.
9. Run summary reads through configured cache/read replica and prove changes become visible within the documented bound; use consistent reads for active campaign progress if needed.
10. Run two workers against the same recipient and prove only one provider submission occurs.
11. Revoke a queued invite during sending and prove it is skipped.
12. Register an invitee after `SENT`; prove it is still historically sent and also registered.

---

# Required backend responses before frontend integration

Please confirm the following implementation decisions:

1. Which object storage and queue/worker mechanism will be used?
2. Will upload use direct signed/resumable storage upload or streamed multipart through the API?
3. What tested file-size, row-count, and concurrency limits will be supported?
4. What row batch size and database bulk-upsert strategy will be used?
5. What is the idempotency contract for upload finalization, import batches, campaigns, and provider sends?
6. Does import provenance distinguish rows created by a job from older rows updated by it?
7. Will rollback restore pre-import values for updated rows, or preserve and report those rows unchanged?
8. What is the registered-invite revocation policy? Recommendation: preserve registration and return a stable conflict unless cancellation is explicit.
9. What table/read model is authoritative for campaign progress and invite summary?
10. At what exact point does backend mark an email `SENT`?
11. Which provider idempotency/reconciliation feature prevents duplicates if provider acceptance succeeds but local persistence fails?
12. Are delivery/bounce webhooks configured and verified in the current environment?
13. Are invite-list reads cached or served from a replica? If yes, what is the invalidation/consistency bound?
14. Please provide one affected campaign-progress response and database reconciliation for the observed 9,939-row event.

# Frontend work after backend contract is available

The admin frontend can then:

- replace in-browser full-file parsing/JSON submission with the selected upload-session or multipart contract;
- persist/recover upload and rollback job IDs;
- add per-row revoke actions using returned invite IDs/statuses;
- add “Undo this import” with an explicit impact preview and confirmation;
- display removed, cancelled, revoked, registered-preserved, and failed rollback counts separately;
- render separate delivery and registration state where supplied;
- continue polling durable import/campaign/rollback progress and refreshing invite rows/summary;
- show actionable terminal errors and downloadable rejected-row reports.

The backend fix is complete only when the load, restart, retry, rollback, race, and counter-invariant tests above pass. A larger request-body limit alone does not resolve the production risk.