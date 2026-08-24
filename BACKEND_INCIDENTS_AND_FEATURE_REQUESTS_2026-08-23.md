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

**Update 2026-08-24 (frontend aligned).** Backend confirmed the contract (reply items 72-2): status endpoint path, stable field names (`emailSent`/`emailFailed`/`inAppSent`/`inAppSkipped`/`certificatesIssued`/`certificatesFailed`), the terminal vocab (`COMPLETED`/`COMPLETED_WITH_ERRORS`/`FAILED`), the 10-minute watchdog that auto-fails stuck jobs with `WORKER_NEVER_STARTED`, and the new `GET .../challenge-winners/announcements/latest` (404 when none). The admin UI now **restores progress after a reload via `/latest`** (no client-side id persistence) and maps `WORKER_NEVER_STARTED` to clear copy. The tolerant parser already reads the confirmed field names, so no rename was needed.

---

## 3. Feature request — "End Challenge" lifecycle, and gate winner announcement behind it

**Desired behavior.** Congratulations messages and certificates must only be sendable **after the challenge has ended**. "Ending" a challenge is an explicit, guarded, **terminal** action that finalizes everything.

**Confirmed product decisions** (from the organiser — these are settled, not open questions; they also apply to mobile/web):
- **Ending is terminal — no re-open.** Once ended, applications and scoring are permanently closed and the winner set is frozen. Announcement is therefore effectively one-shot (re-runs only retry delivery for the same frozen set, they don't recompute winners).
- **"Scoring complete" = every SHORTLISTED/SELECTED application has ≥1 judge score.** It is *not* required that every assigned judge has scored every assigned application — a single judge score per application clears the gate.
- **Announcement is hard-gated behind the ended state.** Preview/leaderboard stay visible before ending, but announce is blocked until the challenge is ended.

**Proposed contract (please confirm/adjust).**
- Endpoint, e.g. `POST /api/v1/client/challenges/{challengeId}/end` (or `/events/{eventId}/end`).
- Ending atomically:
  1. Closes applications (no new submissions),
  2. Closes scoring (no new/edited scores),
  3. **Requires all shortlisted/selected applications to have ≥1 judge score** — reject with a stable code (e.g. `SCORING_INCOMPLETE`) and ideally the list of unscored application ids if any remain,
  4. Transitions the challenge to a terminal status and freezes the SELECTED set,
  5. Unlocks the winner preview/announce endpoints.
- The `announce` endpoint should **hard-reject** when the challenge is not yet ended (stable code, e.g. `CHALLENGE_NOT_ENDED`), so the gate is enforced server-side and not just in the admin UI.

**Open question for backend (still blocking — affects mobile/web too).**
- **What is the exact challenge status vocabulary, and which value is the terminal "ended" state?** Today the challenge detail surfaces values like `LIVE`; we need the canonical set and the precise "ended" string. The FE currently matches a defensive set (`ENDED`/`COMPLETED`/`CLOSED`/`FINISHED`/`CONCLUDED`) and surfaces the live status in the UI so we can confirm the real value on staging — please pin it down so we can match exactly.

**Frontend behavior (shipped, interim).** Until the End-Challenge endpoint exists, the admin UI **shows the winner preview but blocks announcing** until the challenge status reads as ended. The Announce button is disabled with an amber "Winners can only be announced after the challenge has ended…" note that echoes the current status. Once the backend confirms the terminal status value (and, later, ships the explicit End action), we'll align the gate and build the End-Challenge button.

**Update 2026-08-24 (frontend aligned).** Backend shipped `POST /api/v1/client/challenges/{challengeId}/end` and pinned the canonical `EventStatus` set (`DRAFT, PUBLISHED, UPCOMING, LIVE, ENDED, CANCELLED`) with `ENDED` as the terminal state (reply item 72-3). The FE now:
- keys the ended check off **`ENDED` alone** (dropped the defensive `COMPLETED`/`CLOSED`/`FINISHED`/`CONCLUDED` set);
- ships an **End Challenge** action on the challenge **Overview** tab, client-admin only (super-admin and viewers never see it), behind a strong terminal confirm dialog, with an "already ended" state once status is `ENDED`;
- surfaces the **`SCORING_INCOMPLETE` (409)** rejection inline, reading `data.unscoredApplicationIds` to show the count and directing the organiser to score them first (no toast for this code — it's shown in-panel);
- hard-gates announce behind `ENDED` (unchanged) and now **freezes** application status changes, the applications open/close toggle, and the scoring toggle once ended, to avoid `CHALLENGE_ENDED` rejections.

**One small follow-up ask (non-blocking).** For `SCORING_INCOMPLETE`, `data.unscoredApplicationIds` lets us show a count, but the End action lives on the Overview tab which doesn't have the applications list loaded. If the payload could also include a minimal label per id (e.g. `teamName`), we could name the offending teams inline instead of just a count. Not required — current UX points the organiser to the Applications/Leaderboard tab.

---

## 4. Application intake validation gaps (server-side enforcement needed)

These were observed in live applications and should be enforced at submission time on the backend, because they affect the mobile and web apps as well — the admin app only sees the result.

- **i. Every team member must have a registered Attend account.** Confirmed with the organiser: members **without** a registered Attend account are currently being added to applications, and this should be **blocked**. Every listed team member must resolve to a real Attend user (or, at minimum, have an accepted invite — see iii) before the application is finalized and shown to the admin. Please reject submissions containing members that don't map to a registered Attend account, with a stable code (e.g. `MEMBER_NOT_REGISTERED`), and confirm how `hasAttendAccount` is derived so the admin UI can display it reliably. This ties directly to the consent requirement in (iii).
- **ii. Minimum team size not enforced.** With `minTeamSize = 2`, single-member applications are still coming through. Submissions below `minTeamSize` (and above `maxTeamSize`) should be rejected with a clear code.
- **iii. Member consent before submission.** When a team lead assembles an application on mobile/web, each listed member should have to log in and **accept** membership before the application is finalized and shown to the admin — so no one is added to a team without consenting.
- **iv. Email uniqueness within a challenge.** The same email is appearing in multiple applications for the same challenge. An email should belong to at most one application per challenge; the backend should reject or de-duplicate, rather than letting a person be split across competing teams.

---

## 5. Defense-in-depth — reject `SELECTED` for unscored applications

The admin UI now blocks moving an application to `SELECTED` unless it has been scored (this is the winner set, so unscored winners make no sense). Please also enforce this server-side: reject `PUT /api/v1/client/challenges/{challengeId}/applications/{applicationId}/status` with `{ "status": "SELECTED" }` when the application has no score, using a stable code (e.g. `APPLICATION_NOT_SCORED`).
