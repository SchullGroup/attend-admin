# Backend Incidents and Feature Requests - 2026-08-23

Findings from innovation-challenge (winner announcement) and invite-import testing on staging. Nothing below should be treated as fixed until the backend is deployed and the supplied reference IDs have been checked in server logs. The frontend has already shipped the mitigations noted under each item; the underlying processing/validation work is on the backend.

---

## 1. Invite import job is stuck at `PENDING` and never processes

**Request (browser/JSON import path)**

```text
GET /api/v1/client/events/a7a68420-8946-4053-91b9-560948f08320/invite-imports/3693dcc0-1e80-41c2-939d-b03f86d1a8ba
```

**Observed response (polled repeatedly, unchanged)**

```json
{
  "data": {
    "id": "3693dcc0-1e80-41c2-939d-b03f86d1a8ba",
    "eventId": "a7a68420-8946-4053-91b9-560948f08320",
    "originalFilename": "JSON Import",
    "status": "PENDING",
    "totalRows": 0,
    "processedRows": 0,
    "acceptedRows": 0,
    "createdRows": 0,
    "updatedRows": 0,
    "duplicateRows": 0,
    "rejectedRows": 0,
    "errorReportUrl": null,
    "startedAt": "2026-08-23T22:39:17.05823",
    "completedAt": null,
    "lastHeartbeatAt": null,
    "errorCode": null,
    "errorMessage": null
  },
  "message": "Import job status retrieved.",
  "referenceId": "40c52c10-784f-45a0-b16a-70b513819b61",
  "status": true
}
```

**What happened.** A ~100-record CSV was uploaded. Because it is under the browser-parse limit, the frontend parses it client-side and posts the rows as JSON to `POST /invites/import` (this is why `originalFilename` is `"JSON Import"` — that label is expected for this path, not a bug). The job is created but stays at `PENDING` forever: `startedAt` is set, but `lastHeartbeatAt` is `null`, `totalRows` never leaves `0`, and no counters advance. The worker appears to never pick the job up.

**Asks.**
- Trace the reference ID and confirm whether the JSON-import job is ever enqueued/consumed by a worker. This looks like a stalled or missing queue consumer for the `/invites/import` (non-CSV-upload-session) path.
- Confirm the semantics of `lastHeartbeatAt` and whether a watchdog should mark long-`PENDING` jobs as `FAILED` with an `errorCode`, so clients can stop and show a real error rather than an open-ended spinner.
- Confirm whether `totalRows` is set at enqueue time (from the submitted array length) or only after the worker starts — this affects how we show progress.

**Frontend mitigation (shipped).** The import progress poll is now bounded (stops after ~3 min) and the UI shows a "this import hasn't started processing / may be stuck" note instead of polling indefinitely. No invites are created until the backend actually processes the job.

---

## 2. Winner announcement is accepted (`202`) but nothing is ever sent

**Request**

```text
POST /api/v1/client/events/fc79621a-0742-41e5-84c1-9efcae320da7/challenge-winners/announce
```

**Observed response (`202 Accepted`; job then stays `PENDING`)**

```json
{
  "data": {
    "id": "9d624227-debf-456b-859e-0b76b929cf62",
    "eventId": "fc79621a-0742-41e5-84c1-9efcae320da7",
    "status": "PENDING",
    "totalRecipients": 6,
    "emailSent": 0,
    "emailFailed": 0,
    "inAppSent": 0,
    "inAppSkipped": 0,
    "certificatesIssued": 0,
    "certificatesFailed": 0,
    "startedAt": "2026-08-23T22:54:16.669837243",
    "completedAt": null,
    "errorCode": null,
    "errorMessage": null
  },
  "message": "Winner announcement accepted and processing asynchronously.",
  "referenceId": "e6a7e7f5-514d-47bb-9206-e6bf7b4f86e2",
  "status": true
}
```

**What happened.** The announcement is accepted with 6 recipients, but `emailSent`, `inAppSent`, and `certificatesIssued` all remain `0` — no emails, in-app notifications, or certificates are ever produced. Same symptom as item 1: an async job is created but never processed to completion.

**Asks.**
- Trace the reference ID and confirm the challenge-winner announcement worker is running and consuming these jobs.
- **Confirm the status-polling contract**, which is currently inferred on the frontend:
  - Status endpoint: is `GET /api/v1/client/events/{eventId}/challenge-winners/announcements/{id}` correct? If not, please provide the exact path. Is there a "get latest announcement for event" endpoint so the admin UI can restore progress after a reload without persisting the id client-side?
  - Response fields: FE now reads the job id as `data.id` and counters as `emailSent` / `emailFailed` / `inAppSent` / `inAppSkipped` / `certificatesIssued` / `certificatesFailed`. Please confirm these names are stable (the FE keeps `announcementId` / `emailsSent` fallbacks for now).
  - Terminal statuses: FE treats `COMPLETED`, `COMPLETED_WITH_ERRORS`, and `FAILED` as terminal. Confirm the full status vocabulary.

**Frontend mitigation (shipped).** The FE now maps `data.id` → tracked announcement id (previously read a non-existent `announcementId`, so progress never rendered), seeds the progress card from the 202 body, and bounds the status poll so a stuck job / missing status endpoint no longer loops forever.

---

## 3. Feature request — "End Challenge" lifecycle, and gate winner announcement behind it

**Desired behavior.** Congratulations messages and certificates must only be sendable **after the challenge has ended**. "Ending" a challenge should be an explicit, guarded action that finalizes everything.

**Proposed contract (please confirm/adjust).**
- Endpoint, e.g. `POST /api/v1/client/challenges/{challengeId}/end` (or `/events/{eventId}/end`).
- Ending atomically:
  1. Closes applications (no new submissions),
  2. Closes scoring (no new/edited scores),
  3. **Requires all shortlisted/selected applications to be scored** — reject with a stable code (e.g. `SCORING_INCOMPLETE`) and ideally the list of unscored application ids if any remain,
  4. Transitions the challenge to a terminal status,
  5. Unlocks the winner preview/announce endpoints.
- The `preview` and `announce` endpoints should **hard-reject** when the challenge is not yet ended (stable code, e.g. `CHALLENGE_NOT_ENDED`), so the gate is enforced server-side and not just in the admin UI.

**Questions for backend (these also affect the mobile/web apps).**
- What is the challenge status vocabulary, and which value is the terminal "ended" state (`ENDED`? `COMPLETED`?)? Today the challenge detail surfaces values like `LIVE`; the FE needs the canonical set.
- Definition of "all shortlisted scored": every SHORTLISTED/SELECTED application having **≥1 judge score**, or **every assigned judge** having scored **every** assigned application?
- Is ending **reversible** (re-open to fix a mistake), or terminal? This determines whether announcement is strictly one-shot.
- On end, are SELECTED assignments frozen, or can the organiser still adjust winners before announcing?

---

## 4. Application intake validation gaps (server-side enforcement needed)

These were observed in live applications and should be enforced at submission time on the backend, because they affect the mobile and web apps as well — the admin app only sees the result.

- **i. Member Attend-account / membership integrity.** Team members appear on applications without a consistent Attend-account relationship. Please confirm how `hasAttendAccount` is derived and whether membership should require a real Attend user. *(FE note: we'd like this clarified — see the open question we're raising with the product owner.)*
- **ii. Minimum team size not enforced.** With `minTeamSize = 2`, single-member applications are still coming through. Submissions below `minTeamSize` (and above `maxTeamSize`) should be rejected with a clear code.
- **iii. Member consent before submission.** When a team lead assembles an application on mobile/web, each listed member should have to log in and **accept** membership before the application is finalized and shown to the admin — so no one is added to a team without consenting.
- **iv. Email uniqueness within a challenge.** The same email is appearing in multiple applications for the same challenge. An email should belong to at most one application per challenge; the backend should reject or de-duplicate, rather than letting a person be split across competing teams.

---

## 5. Defense-in-depth — reject `SELECTED` for unscored applications

The admin UI now blocks moving an application to `SELECTED` unless it has been scored (this is the winner set, so unscored winners make no sense). Please also enforce this server-side: reject `PUT /api/v1/client/challenges/{challengeId}/applications/{applicationId}/status` with `{ "status": "SELECTED" }` when the application has no score, using a stable code (e.g. `APPLICATION_NOT_SCORED`).
