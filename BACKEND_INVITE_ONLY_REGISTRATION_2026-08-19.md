# Backend Request: Scalable Invite-Only Registration

**Date:** 2026-08-19  
**Applies to:** Product Launch, Innovation Challenge, and General Event  
**Priority:** High

## Objective

Provide one reusable invite-only registration system for Product Launch, Innovation Challenge, and General Event. It must support one invite, pasted email lists, and very large CSV audiences without request timeouts or browser-driven email loops.

Invite-only access must be enforced by the backend registration flow. The frontend hiding a registration button is not an access-control mechanism.

## Product Decisions for Initial Release

Use these defaults unless product confirms otherwise:

- Identity is based on email address for the first release.
- Email comparison is case-insensitive after trimming whitespace.
- Invitations are non-transferable. An invite for one email cannot register another email.
- Importing people does not automatically send email.
- Sending invitations is a separate, explicit admin action.
- Duplicate imports update/reuse the existing invite instead of creating another row.
- Audience tiers are optional. Use a default tier when none is supplied.

## Event Types and Configuration

The feature must work when `audienceTargeting` is `INVITE_ONLY` for:

- `PRODUCT_LAUNCH`
- `INNOVATION_CHALLENGE`
- `GENERAL_EVENT`

The existing accepted audience value should remain:

```json
{
  "audienceTargeting": "INVITE_ONLY"
}
```

Product Launch already has audience-tier endpoints. The underlying invitation capability should be made event-level and reusable by all three event types. Existing Product Launch tier endpoints may remain as compatibility aliases if changing them would break clients.

## Required Behaviour

### Open registration

If an event uses `OPEN_REGISTRATION`, registration continues to work as it does today.

### Invite-only registration

When an event uses `INVITE_ONLY`, the registration endpoint must:

1. Normalize the submitted email.
2. Find an active invite for the same event and normalized email.
3. Reject registration if no matching invite exists.
4. Reject revoked or expired invites.
5. Enforce event capacity atomically.
6. Complete registration using the existing registration transaction.
7. Mark the invite `REGISTERED` and set `registeredAt` only after registration succeeds.
8. Return the existing successful registration response shape where possible.

Suggested rejection:

```http
HTTP 403 Forbidden
```

```json
{
  "success": false,
  "message": "This event is invite-only. No active invitation was found for this email."
}
```

Do not reveal whether an arbitrary email exists in the wider user database.

## Invite Link Security

Each invitation email should contain a cryptographically random token. Store only its hash in the database.

Required rules:

- Token has sufficient entropy, for example 32 random bytes.
- Token is scoped to one event and one invite.
- Registration using the token is bound to the invited email.
- Raw token is never logged or stored.
- Revoking an invite invalidates the token immediately.
- A completed invitation cannot be used to register another account.
- Expiry should be optional at event/invite level. If unset, the event end/cancellation state still prevents registration.

Possession of a token alone must not permit registration with a different email.

## Suggested Data Model

Names may be adapted to current conventions.

### `event_invite`

| Field | Notes |
|---|---|
| `id` | UUID |
| `event_id` | Required FK and indexed |
| `email` | Original/display form |
| `normalized_email` | Trimmed and lowercase |
| `first_name` | Optional |
| `last_name` | Optional |
| `phone` | Optional metadata; not an identity key initially |
| `tier_id` | Optional audience tier |
| `status` | Invite status enum |
| `token_hash` | Unique hashed token |
| `source` | `SINGLE`, `PASTE`, `CSV`, or other existing source |
| `import_job_id` | Optional FK |
| `invited_at` | Nullable until email is queued/sent |
| `registered_at` | Nullable |
| `expires_at` | Optional |
| `revoked_at` | Optional |
| `created_by` | Admin actor |
| `created_at`, `updated_at` | Audit fields |

Required unique constraint:

```text
UNIQUE (event_id, normalized_email)
```

### Invite statuses

Use at least:

```text
IMPORTED
QUEUED
SENT
DELIVERED
BOUNCED
FAILED
REGISTERED
REVOKED
EXPIRED
```

`DELIVERED` and `BOUNCED` depend on Postmark webhooks. If delivery webhooks are not part of the first implementation, keep the model extensible and report `SENT`/`FAILED` initially.

### `invite_import_job`

| Field | Notes |
|---|---|
| `id` | UUID returned immediately after upload |
| `event_id` | Indexed |
| `original_filename` | Display/audit value |
| `status` | `PENDING`, `PROCESSING`, `COMPLETED`, `COMPLETED_WITH_ERRORS`, `FAILED` |
| `total_rows` | Parsed data rows |
| `processed_rows` | Progress counter |
| `accepted_rows` | New valid invites |
| `updated_rows` | Existing invites updated/reused |
| `duplicate_rows` | Duplicates within the same file |
| `rejected_rows` | Invalid rows |
| `error_report_url` | Optional generated CSV |
| `created_by` | Admin actor |
| timestamps | Created, started, completed |

### `invite_campaign`

| Field | Notes |
|---|---|
| `id` | UUID |
| `event_id` | Indexed |
| `status` | `PENDING`, `PROCESSING`, `COMPLETED`, `COMPLETED_WITH_ERRORS`, `CANCELLED`, `FAILED` |
| `selection_type` | `ALL_UNSENT`, `SELECTED`, `TIER`, `IMPORT_JOB`, `FAILED` |
| `selection_reference` | Tier/import reference where needed |
| counters | Selected, queued, sent, failed, skipped |
| `created_by` | Admin actor |
| timestamps | Created, started, completed |

## CSV Import

### Accepted format

Required column:

```text
email
```

Optional columns:

```text
firstName,lastName,phone,tier
```

Column matching should be case-insensitive and tolerate spaces, underscores, and hyphens. A template endpoint is useful but not required if a static template is agreed with frontend.

Example:

```csv
email,firstName,lastName,phone,tier
ada@example.com,Ada,Okafor,+2348012345678,VIP
tunde@example.com,Tunde,Adeyemi,,General
```

### Processing requirements

- Accept multipart upload and return `202 Accepted` with a job ID quickly.
- Parse the CSV asynchronously.
- Stream the file instead of loading the entire file into memory.
- Process database writes in bounded batches, for example 500-1,000 rows.
- Deduplicate by normalized email within the file and against existing event invites.
- Upsert idempotently using `(event_id, normalized_email)`.
- Do not send invitation emails during import.
- Record row-level validation failures and make a CSV error report downloadable.
- Set a configurable maximum file size and row count and return a clear validation error when exceeded.
- Never create one background job or transaction per row.

Recommended error report columns:

```text
rowNumber,email,errorCode,errorMessage
```

Examples of errors:

- Missing email.
- Invalid email syntax.
- Unknown tier.
- Duplicate row in file.
- Event capacity policy violation, if imports are limited by capacity.

## Email Campaign Processing

Bulk sending must be asynchronous and separated from CSV import.

Required behaviour:

- Creating a campaign returns `202 Accepted` and a campaign ID.
- Queue emails in controlled batches.
- Use idempotency so retrying a campaign request does not send duplicate emails.
- Skip `REGISTERED`, `REVOKED`, and `EXPIRED` invites.
- Support retrying failed invites without resending successful ones.
- Respect Postmark rate limits and application worker capacity.
- Record provider message ID when available.
- Do not keep the HTTP request open while emails are sent.
- Campaign progress must be queryable after page refresh.

The email should include event title, date/time, organiser, invite link, and the correct Event Management contact footer (`events@experienceattend.com`).

## Proposed API

All admin endpoints require the existing client-admin authorization and event ownership checks.

### Create one or a small pasted list

```http
POST /api/v1/client/events/{eventId}/invites
```

```json
{
  "invites": [
    {
      "email": "ada@example.com",
      "firstName": "Ada",
      "lastName": "Okafor",
      "tierId": "optional-tier-uuid"
    }
  ]
}
```

This endpoint is for bounded lists only. Enforce a configurable maximum such as 200 records and direct larger lists to CSV import.

Suggested response:

```json
{
  "success": true,
  "data": {
    "received": 1,
    "created": 1,
    "updated": 0,
    "rejected": 0,
    "items": []
  }
}
```

Creating an invite must not imply that an email was already sent.

### Upload CSV

```http
POST /api/v1/client/events/{eventId}/invites/import
Content-Type: multipart/form-data

file: audience.csv
defaultTierId: optional UUID
```

Response:

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

### Import progress

```http
GET /api/v1/client/events/{eventId}/invite-imports/{jobId}
```

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "PROCESSING",
    "totalRows": 50000,
    "processedRows": 12500,
    "acceptedRows": 12100,
    "updatedRows": 250,
    "duplicateRows": 100,
    "rejectedRows": 50,
    "errorReportUrl": null
  }
}
```

### List invites

```http
GET /api/v1/client/events/{eventId}/invites?page=0&size=50&search=&status=&tierId=&importJobId=
```

Return a paginated response and summary counters. Filtering and counting must be performed in the database.

Suggested item fields:

```json
{
  "id": "uuid",
  "email": "ada@example.com",
  "firstName": "Ada",
  "lastName": "Okafor",
  "tierId": "uuid",
  "tierName": "VIP",
  "status": "SENT",
  "source": "CSV",
  "invitedAt": "2026-08-19T12:00:00Z",
  "registeredAt": null,
  "createdAt": "2026-08-19T11:55:00Z"
}
```

Suggested summary:

```json
{
  "total": 50000,
  "unsent": 2000,
  "queued": 500,
  "sent": 45000,
  "delivered": 43000,
  "failed": 500,
  "bounced": 200,
  "registered": 18000,
  "revoked": 50
}
```

### Create send campaign

```http
POST /api/v1/client/events/{eventId}/invite-campaigns
```

Examples:

```json
{ "selection": "ALL_UNSENT" }
```

```json
{ "selection": "IMPORT_JOB", "importJobId": "uuid" }
```

```json
{ "selection": "TIER", "tierId": "uuid" }
```

```json
{ "selection": "SELECTED", "inviteIds": ["uuid-1", "uuid-2"] }
```

Response:

```http
HTTP 202 Accepted
```

```json
{
  "success": true,
  "data": {
    "campaignId": "uuid",
    "status": "PENDING",
    "selectedCount": 50000
  }
}
```

### Campaign progress

```http
GET /api/v1/client/events/{eventId}/invite-campaigns/{campaignId}
```

### Resend one invite

```http
POST /api/v1/client/events/{eventId}/invites/{inviteId}/resend
```

This may return `202 Accepted` if all sends use the queue.

### Revoke one invite

```http
DELETE /api/v1/client/events/{eventId}/invites/{inviteId}
```

Do not hard-delete audit history. Mark it `REVOKED`. Define whether a registered invite can be revoked; recommendation: return `409` and use the existing registration cancellation flow instead.

### Export invites

```http
GET /api/v1/client/events/{eventId}/invites/export
```

Return streamed CSV and support the same filters as the list endpoint where practical.

## Existing Endpoint Compatibility

The frontend currently calls:

```http
POST /api/v1/client/events/{eventId}/tiers/invite
POST /api/v1/client/events/{eventId}/tiers/invite/bulk
GET  /api/v1/client/events/{eventId}/tiers/invites/export
```

Current concerns:

- The single and bulk endpoints appear to create and send in one operation.
- The current bulk frontend sends an in-memory JSON array, so it is not suitable for very large lists.
- Audience-tier management is currently shown only for Product Launch.
- General Event supports choosing invite-only at creation but has no shared invite-management UI yet.
- Innovation Challenge is currently sent as `OPEN_REGISTRATION` by the frontend and will be updated once backend support is confirmed.

Recommended compatibility approach:

- Keep current endpoints temporarily.
- Implement them through the new `event_invite` service.
- Keep the current immediate-send behaviour only for small requests if required.
- Add the event-level asynchronous APIs above for the new UI.
- Deprecate the old bulk endpoint for large payloads and reject requests above the configured small-list limit.

## Capacity and Concurrency

- Clarify whether imported invites may exceed capacity. Recommendation: allow an invite list larger than capacity but enforce capacity at registration time.
- Registration capacity checks and registration creation must happen in one transaction or use an equivalent atomic reservation mechanism.
- Return `409 Conflict` when capacity is exhausted.
- Two concurrent requests must not reserve the final place twice.

## Authorization and Audit

- Verify organisation/event ownership on every admin endpoint.
- Record who imported, sent, resent, or revoked invitations.
- Add audit entries for import completion, campaign creation/completion, resend, and revoke actions.
- Do not expose invite tokens in list/export responses.
- Avoid logging full CSV contents or raw tokens.
- Apply rate limiting to public invite validation and registration endpoints.

## Postmark Webhooks

If delivery tracking is included:

- Verify webhook authenticity using the configured Postmark mechanism.
- Map provider message IDs to invite send records.
- Process webhook events idempotently.
- Update `DELIVERED` and `BOUNCED` states without moving a `REGISTERED` invite backwards.
- Keep delivery state separate from registration state internally if one status enum would lose information. The API may expose both `deliveryStatus` and `registrationStatus` instead.

The last point is the more robust design. For example, an invite can be both `DELIVERED` and `REGISTERED`; one combined enum cannot represent both cleanly.

## Recommended Status Design

Prefer two state fields internally:

```text
delivery_status: NOT_SENT | QUEUED | SENT | DELIVERED | BOUNCED | FAILED
registration_status: INVITED | REGISTERED | REVOKED | EXPIRED
```

This avoids state loss and makes filtering/reporting clearer.

## Non-Functional Requirements

- Import and campaign operations survive frontend navigation and refresh.
- A failed worker can retry a batch without duplicate invite rows or duplicate sends.
- List endpoints are paginated and do not return all invitees by default.
- Database queries are indexed for event, normalized email, statuses, tier, and import job.
- Large CSV processing is bounded in memory.
- Progress counters are eventually consistent and monotonic.
- All timestamps use the project's standard UTC representation.
- API errors follow the existing response envelope.

## Acceptance Criteria

1. A Product Launch, Innovation Challenge, or General Event can be created with `audienceTargeting = INVITE_ONLY`.
2. A user without a matching active event invite cannot register for an invite-only event, even when calling the API directly.
3. An invited user can register using the invited email through the normal participant flow.
4. An invite link cannot be used to register a different email.
5. Email matching is case-insensitive and whitespace-normalized.
6. Re-importing the same email for the same event does not create a duplicate row.
7. A client admin can create a single invite without automatically sending it through the new API.
8. A client admin can upload a large CSV and receives a job ID without waiting for parsing or email delivery.
9. Import progress and final accepted/updated/rejected counts are queryable.
10. Invalid CSV rows are available in a downloadable error report.
11. Importing a CSV sends no email until the admin creates a campaign.
12. A send campaign returns quickly and continues asynchronously.
13. Campaign progress remains available after the frontend refreshes.
14. Retrying failed sends does not resend successful invitations.
15. Revoked and registered invitations are skipped by bulk campaigns.
16. Capacity cannot be exceeded by concurrent registrations.
17. Invite list/search/filter/export endpoints enforce event ownership.
18. No raw invitation token is stored, logged, listed, or exported.
19. Existing Product Launch tier invite endpoints continue working during migration or return a documented replacement contract.
20. Automated tests cover access enforcement, normalization, deduplication, revocation, asynchronous job creation, idempotent retry, and capacity concurrency.

## Backend Questions to Confirm

Please confirm these before frontend implementation begins:

1. Which participant registration endpoint(s) will enforce invite-only access?
2. Will invite verification use email plus token, or authenticated email when no token is supplied?
3. Are audience tiers becoming available to all three event types or only Product Launch?
4. What maximum row count/file size will be supported per CSV?
5. Which queue/worker mechanism will process imports and email campaigns?
6. Will Postmark delivery/bounce webhooks be included in this ticket?
7. Will existing `/tiers/invite` endpoints remain compatible?
8. Can invite lists exceed event capacity, with capacity enforced only at registration? This document recommends yes.
9. Will import error reports use a temporary signed URL or an authenticated download endpoint?
10. What frontend URL format should invitation emails use?

## Frontend Work After Contract Confirmation

The admin frontend will add one reusable **Invitations** tab for Product Launch, Innovation Challenge, and General Event with:

- Summary counters.
- Paginated invite list and filters.
- Single invite form.
- Small pasted-list form.
- Real CSV upload with validation preview.
- Persistent import progress.
- Downloadable error report.
- Explicit send-campaign confirmation.
- Campaign progress.
- Resend, retry failed, revoke, and export actions.

The frontend will also stop hardcoding Innovation Challenge to `OPEN_REGISTRATION` and expose its invite-only selector after the backend confirms the creation and registration contracts.