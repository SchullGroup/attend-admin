# Backend clarification: invite campaign selection semantics

## Context

The frontend has integrated the asynchronous invite-import and invite-campaign
contracts from the latest backend handoff (items 59-62). The current frontend
must remain compatible with the existing campaign endpoint while the exact
recipient predicates for `TIER` and `IMPORT_JOB` are confirmed.

No frontend behavior should be changed until these semantics are explicit.

## Questions requiring backend confirmation

### 1. `TIER` selection

Request example:

```json
{
  "selection": "TIER",
  "tierId": "<tier-uuid>"
}
```

Please confirm the exact recipient predicate:

- Is the campaign limited to invites in the selected tier whose
  `deliveryStatus` is `NOT_SENT` or `FAILED`?
- Are `QUEUED` or `PROCESSING` rows excluded or safely claimed by the campaign
  worker?
- Are `SENT`, `DELIVERED`, and `BOUNCED` rows excluded from a new campaign?
- Are `REVOKED`, `EXPIRED`, and `REGISTERED` invites excluded regardless of
  delivery status?

Please also confirm what `selectedCount` means for this selection. It should
  be the durable number of recipients selected by the campaign, not a count
  inferred by the frontend from a paginated invite list.

### 2. `IMPORT_JOB` selection

Request example:

```json
{
  "selection": "IMPORT_JOB",
  "importJobId": "<job-uuid>"
}
```

The import contract defines:

```text
acceptedRows = createdRows + updatedRows
```

Please confirm whether campaign recipients are:

- all active invite rows touched by the job (`createdRows + updatedRows`),
  subject to sendability/status rules;
- only rows newly created by the job;
- or all rows touched by the job, including rows already sent before the
  campaign was created.

Please confirm whether the campaign should select only currently sendable
  rows, for example `NOT_SENT` and retryable `FAILED`, and how it handles a
  row that was revoked, registered, or sent after the import completed.

## Compatibility expectations

To avoid breaking current clients while the contract is clarified:

1. Keep accepting the existing `POST /invite-campaigns` request shape and the
   existing `selection` values.
2. Treat the backend campaign response as authoritative for `selectedCount`,
   `queuedCount`, `sentCount`, `failedCount`, and `skippedCount`.
3. Keep `IMPORT_JOB` idempotent: retrying the same request must not create a
   second campaign or resend recipients unexpectedly.
4. Keep selection tenant- and event-scoped.
5. Return a stable `400` validation response when a required reference is
   missing (`tierId` for `TIER`, `importJobId` for `IMPORT_JOB`).
6. Return a stable response/error code when the referenced tier or import job
   does not belong to the event/organisation.

## Suggested response

Please reply with the exact predicates, for example:

```text
TIER:
- Eligible delivery statuses: ...
- Excluded registration statuses: ...
- selectedCount definition: ...

IMPORT_JOB:
- Included rows: created / updated / both
- Eligible delivery statuses: ...
- Excluded registration statuses: ...
- selectedCount definition: ...
```
