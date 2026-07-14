# Pending Backend Fixes — attend-admin

Consolidated from `BACKEND_FIXES.md`, `BACKEND_BUGS_2026-07-11.md`, and `BACKEND_BUGS_9_10_2026-07-11.md`.
This file lists **only what's still open** as of 2026-07-14 — fixed/shipped items, and items closed out by team decision, have been left out. See those three files for full history.

**Process ask:** once you've worked through these, please generate a short `.md` file summarizing exactly what was implemented/fixed for each item (endpoint, what changed, any new field names or response-shape notes) and send it back — makes it much faster for us to re-verify each item against the live app in one pass instead of re-testing blind.

---

## ⚠️ Backend response (2026-07-14) — `staging` is 102 commits behind `dev`

Backend flagged that `origin/staging` is 102 commits behind `dev` (their own backend repo), and the missing commits include the entire Register/Registrar feature (`09f7af7`), the entire Challenge/Hackathon admin feature (`6b15d41`, `0294519`), and all five rounds of analytics fixes from tickets #10–#15 (`f4c0dd5` through `a1314c6`). If the app we've been testing against is served from `staging`, **items 1, 1b, 2, and 2b below are very likely already fixed in `dev`** and just never reached the environment we tested — backend re-verified the exact code paths for each and found the logic already matches what we asked for. Getting `dev` merged into `staging` and redeployed is on backend's own side to sort out — flagging it here for visibility, not as an action item for us.

Full per-item outcomes from this response:

- **1 (Registrar detail data gaps)** — all three confirmed already correct in `dev`: `eventCount` per register computed live via `eventRepository.countByRegister(r)`; `representativeEmail` correctly mapped from `Stakeholder.representativeEmail` when set; `GET /api/v1/admin/registrars/{id}/events` genuinely paginated server-side (`PageRequest.of(page, size)`, respects `page`/`size`). **One separate, real (non-deployment) data gap:** `representativeEmail` was added to the `Stakeholder` entity partway through backend's work — any registrar enrolled *before* that column existed has `representativeEmail: null` in the DB permanently, with no automatic historical backfill. New enrollments capture it correctly. Existing registrars can be manually backfilled via the `PATCH /api/v1/admin/registrars/{id}` endpoint we already integrated (the registrar Edit modal).

- **1b (RSVP=0 / register filter)** — confirmed already correct in `dev`: each event row's `registrationCount` computed via `registrationRepository.countByEvent(e)`, `registerId` via `e.getRegister().getId()`. **Additional detail not previously known:** the platform-wide `GET /api/v1/admin/events` endpoint's `EventSummaryResponse` now includes **both** `registerId` *and* `registerName` (we'd only been told about `registerId` before) — worth widening our fallback chain on the main Events page too, not just the registrar-scoped pages, once this is confirmed live. Backend's explicit ask: **if we retest against `dev`/latest and RSVPs are still `0`, send the raw JSON response for one event** so they can compare field-by-field — that would be a genuinely new signal, not deployment lag.

- **2 (Shortlisted mismatch)** — confirmed `GET /api/v1/admin/challenges` computes `shortlistedCount`/`shortlistedTeams` live per request via `applicationRepository.countByEventAndStatus(event, SHORTLISTED)`, not a cached/denormalized counter — nothing to go stale. The entire challenge-management feature is among the commits missing from `staging`, consistent with this reappearing there.

- **2b (Open Challenge 404)** — backend specifically checked for an ID-space mismatch (since that was the real root cause behind 1b previously) and it doesn't reproduce: `GET /api/v1/admin/challenges` (list) and `GET /api/v1/admin/challenges/{id}` (detail) use the same `Event.id` and the same `ChallengeSpecification` type filter (`INNOVATION_CHALLENGE`, `HACKATHON`). An id from the list will always resolve on the detail endpoint in current source. If `staging` predates the challenge feature entirely, hitting this route there 404s regardless of id — indistinguishable from "Challenge not found" on our end.

- **3 (Avg Watch column)** — confirmed genuinely never implemented: no join/leave timestamp tracking exists anywhere in the schema for virtual attendees, not a partial/broken feature returning null. Real watch-time tracking would need new session start/end events from the video layer — a real feature to scope separately if wanted, not a bug fix. **We've dropped the column from Client Admin's Per-Event Breakdown table accordingly.**

- **4 (`*Change` fields null)** — backend re-verified `getAnalyticsSummary`'s comparison logic is structurally identical to the client-scoped `getStats` logic that's confirmed returning real values (both compare last-7-days vs. the 7 days before that, `null` only when the prior-week bucket is empty) — no code-level bug found by inspection alone. Backend added a diagnostic log line (`Analytics summary week-over-week diag: ...`) to `getAnalyticsSummary` that dumps the raw this-week/prior-week counts for all four metrics on every call, since they don't have access to our live database to check actual row timestamps. **Our next step:** hit `GET /api/v1/admin/analytics/summary` once against latest `dev` (not stale `staging`), then pull that log line from the server logs and send it back — determines whether prior-week counts are genuinely zero platform-wide (making `null` correct) or something else is wrong.

- **5 (Event Format Distribution)** — **real bug found and fixed**, independent of the deployment-lag issue (would've stayed broken even on a fresh `dev` deploy). Both endpoints were returning the raw Java enum name (`"HYBRID"`, `"IN_PERSON"`, `"VIRTUAL"` — uppercase) instead of the lowercase values (`hybrid`/`in_person`/`virtual`) our spec asked for and our label-mapping expects. Counts were being computed correctly the whole time; the casing mismatch just meant every lookup silently failed to match, so the widget always fell through to "No format data yet." Fixed server-side, no frontend change needed (frontend already expects lowercase).

**Backend's own verification (compile/wiring only, not live-data correctness — they don't have access to our staging/production DB):**
```
mvn -q -o compile                      → EXIT=0
mvn test -Dtest=EventApplicationTests  → EXIT=0 (Spring context boots cleanly)
```

---

## Needs code fix

### 1. Registrar detail page: data gaps — backend confirms fixed in `dev`; one real data gap remains
**Endpoint:** `GET /api/v1/admin/registrars/{id}` and sub-resources
- Registers table "Events" column showing `0` per register, pagination on `.../events` — backend confirms both work correctly in current `dev` source (see deployment-lag note above). Awaiting re-test against confirmed-current code.
- Representative `email` empty for some registrars — **confirmed as a real, permanent data gap, not a bug:** `representativeEmail` was added to the `Stakeholder` entity partway through backend's work, so any registrar enrolled *before* that column existed has `null` forever with no auto-backfill. **Action for us:** existing registrars missing this field can be manually backfilled through the registrar Edit modal we already built (`PATCH /api/v1/admin/registrars/{id}`) — this isn't something to keep waiting on backend for.

*(Format column is now confirmed working — resolved, removed from this list.)*

### 1b. RSVP count `0` / register filter returns 0 results — backend confirms fixed in `dev`
**Endpoint:** `GET /api/v1/admin/registrars/{id}` and `GET /api/v1/admin/registrars/{id}/events`
Re-verified live on 2026-07-14 against "Meristem Registrars LTD" and it did not reproduce as fixed at the time (RSVPs = `0` everywhere, register filter matched nothing) — backend's response attributes this to the `staging`/`dev` deployment lag described above, and re-confirmed line-by-line that `registrationCount` (via `registrationRepository.countByEvent(e)`) and `registerId` (via `e.getRegister().getId()`) are both genuinely populated in current source, not defaulted to 0.

**New detail from this response:** the platform-wide `GET /api/v1/admin/events` endpoint's `EventSummaryResponse` now also includes `registerName` alongside `registerId` (previously we only knew about `registerId`) — worth widening the fallback/display logic on the main Events page to use `registerName` the same way we already do on the registrar-scoped pages, once confirmed live.

**Ask (from backend):** if we retest against `dev`/latest and RSVPs are *still* `0`, send the raw JSON response for one event — that would indicate a genuinely new, different bug rather than deployment lag.

### 2. Applications "Shortlisted" count mismatch — backend confirms fixed in `dev`
**Endpoint:** `GET /api/v1/admin/challenges` (list)
Reproduced live on 2026-07-14: "Crafwell Innovation Challenge 2026" had 7/7 applications with status `Shortlisted`, but the challenge-selection table showed **Shortlisted: 0** for the same challenge. Backend confirmed `GET /api/v1/admin/challenges` computes this count live per request via `applicationRepository.countByEventAndStatus(event, SHORTLISTED)` — not a cached/stale counter, nothing to go stale. The entire challenge-management feature is among the commits missing from `staging` (see deployment-lag note above), which lines up with why this reappeared. Awaiting re-test against confirmed-current code.

### 2b. "Open Challenge" from the Applications view 404s ("Challenge not found") — backend confirms fixed in `dev`
**Endpoint:** `GET /api/v1/admin/challenges/{challengeId}`
From `/hackathons/applications`, selecting a challenge and clicking "Open Challenge" navigated to `/hackathons/{challengeId}` using the exact same `id` shown in the list/applications view, but the detail page rendered "Challenge not found." Frontend now distinguishes a genuine empty response from an actual request error (shows the HTTP status if the request errored) for easier diagnosis next time. Backend specifically checked for an ID-space mismatch between the list and detail endpoints (the actual root cause of a similar bug in 1b previously) — confirmed it does **not** reproduce: both endpoints use the same `Event.id` and the same `ChallengeSpecification` type filter. If `staging` predates the challenge feature entirely, hitting this route there 404s regardless of id, which looks identical to "Challenge not found" from our side. Awaiting re-test against confirmed-current code.

### 3. "Avg Watch" column always blank — ✅ RESOLVED (2026-07-14)
**Endpoint:** Per-Event Breakdown row field `avgWatchMinutes`, both admin and client `event-performance`
Backend confirmed there's no join/leave timestamp tracking anywhere in the schema — this was never wired up, not a partial bug. Column dropped from the Client Admin Per-Event Breakdown table (`analytics/page.tsx`) rather than showing a permanent "—". Real watch-time tracking would be new feature work if wanted later, not a bug fix.

### 4. Week-over-week `*Change` fields stay `null` even with sufficient history
**Endpoint:** `GET /api/v1/admin/analytics/summary`
Confirmed via raw response: `eventsHosted: 18` (clear history exists) but all four `*Change` fields (`registrationsChange`, `eventsHostedChange`, `docsChange`, `votesCastChange`) are still `null` after creating a new test event. Per the field's own spec, `null` should only mean "no prior-week data" — that doesn't match an account with 18+ events spanning back several days. Needs confirmation of whether the comparison logic is actually computing a value under real conditions, or unconditionally returning `null`.

**Confirmed frontend is not the problem:** `StatCard` in `SuperAdminAnalytics.tsx` already renders the trend badge whenever `change !== undefined` — no code change needed there. This is proven working end-to-end on the *client-scoped* `GET /api/v1/client/analytics/stats` equivalent, which does return real `change` values (`+14%`, `-5.3%`, etc.) and displays correctly. The admin `summary` endpoint specifically is the one still stuck on `null` — same rendering code, same wiring, different backend endpoint's data.

**2026-07-14 update:** backend added a diagnostic log line (`Analytics summary week-over-week diag: ...`) to `getAnalyticsSummary` that dumps real this-week/prior-week counts on every call — no code-level bug found in the comparison logic itself, it's structurally identical to the working client-scoped version. **Next step (us):** hit `GET /api/v1/admin/analytics/summary` against `dev` and pull that log line — determines whether `null` is legitimately correct (empty prior-week bucket) or something else is wrong.

### 5. Event Format Distribution — ✅ RESOLVED (2026-07-14), needs live re-verification
**Endpoints:** `GET /api/v1/admin/analytics/event-format`, `GET /api/v1/client/analytics/event-format`
Root cause found: both endpoints were returning the raw Java enum name (`"HYBRID"`, `"IN_PERSON"`, `"VIRTUAL"` — uppercase) instead of lowercase (`hybrid`/`in_person`/`virtual`). Counts were being computed correctly all along — the casing mismatch against our label-mapping table meant every lookup silently failed, so the widget always fell through to "No format data yet." Fixed server-side to lowercase the format value on both endpoints. No frontend change needed (already expects lowercase). **Needs a live check once deployed** to close out for real.

---

### 7. NEW (2026-07-14) — `POST /events/{id}/zoom` must be idempotent (root cause of host/attendee meeting split)

**Endpoint:** `POST /api/v1/client/events/{eventId}/zoom`

Confirmed behavior: calling this endpoint for an event that already has a Zoom meeting **creates a brand-new meeting** (new meetingId/joinUrl) instead of returning the existing one with a fresh ZAK. The frontend calls it mid-event to refresh the host's expired ZAK (ZAKs live ~2 h), so every refresh rotates the meeting.

The attendee app does pick up the fresh joinUrl (streamUrl is rewritten on rotation), so new/re-joining attendees land in the new meeting. The split came from the admin frontend pinning the host to the OLD meetingNumber on refresh — host stranded in a meeting attendees were no longer joining, staring at an empty room while attendees queued in a waiting room the host couldn't see. That pinning is now fixed frontend-side (the embed adopts the rotated meeting), but rotation still hurts: attendees **already connected** when it rotates are left behind in the old meeting until they manually re-join, and any previously shared/calendar join links go dead.

**Ask:** when the event already has a Zoom meeting, return the SAME meeting (same meetingId/joinUrl/password) with a freshly generated `startUrl`/ZAK. Only create a new meeting when none exists. If the old meeting is somehow unusable, end it via the S2S OAuth app before creating a replacement, and update the event's streamUrl atomically.

Also worth owning server-side (the frontend's JWT-app routes for these are dead — Zoom killed JWT apps in 2023): force-ending stale meetings, and setting `settings.waiting_room` at meeting creation.

---

## Needs confirmation only

### 6. Dashboard "Platform Users" Active/Suspended counts
**Endpoint:** `GET /api/v1/admin/dashboard`
Confirmed missing `activeUsers`/`suspendedUsers` — not a naming mismatch. Frontend has a client-side fallback (counts from the loaded users page) that's only accurate up to the page size fetched (100). Needs server-side aggregate counts across all users.

---

## Summary table

| # | Item | Type | Priority |
|---|------|------|----------|
| 1 | Registrar detail: event counts, pagination — backend confirms fixed in `dev`; rep-email gap is real (old rows only, backfillable via Edit modal) | Bug — awaiting re-test | Medium |
| 1b | RSVP=0 + register filter — backend confirms fixed in `dev`; send raw JSON if still `0` on retest | Bug — awaiting re-test | **High** |
| 2 | Shortlisted count mismatch — backend confirms fixed in `dev` | Bug — awaiting re-test | Medium |
| 2b | "Open Challenge" 404s — backend confirms fixed in `dev` | Bug — awaiting re-test | Medium |
| 3 | Avg Watch column always blank | ✅ Resolved — column dropped (never implemented, confirmed) | Done |
| 4 | Week-over-week `*Change` stuck at `null` (admin only — client works) | Bug — diagnostic logging added, needs one live check | **High** |
| 5 | Event Format Distribution empty on both admin + client endpoints | ✅ Fixed (lowercase enum bug) — needs live re-verification | Done (verify) |
| 6 | Dashboard active/suspended user counts | Bug | Medium |
| 7 | `POST /zoom` rotates meeting instead of refreshing ZAK | Bug — root cause of live-event waiting-room split | **High** |
| F1 | Live event polls (non-AGM) | New feature | High |
| F2 | Press Kit tab (Product Launch) | New feature | High |
| F3 | Resources tab (Innovation Challenge) | New feature | Medium |

---

## NEW FEATURE REQUESTS (not bugs — net-new backend work)

General note across all three below: CRUD endpoints are **client-admin only**. Super admin gets **read-only** access (view/monitor across orgs, no create/edit/delete). Participant-facing endpoints (vote, view released press kit, view resources) are a **separate consumer** — the mobile/attendee app team will pick those up directly; we're listing them here so backend knows they're needed, but this dashboard won't call them itself.

### F1. Live event polls — for non-AGM live events (Launch, General, Innovation Challenge), client admin only

AGM already has real voting (resolutions). This is a **separate, lighter-weight polling feature** for the live-session experience on other event types — think the attached YouTube-live-poll reference screenshot ("How would you rate today's session so far? Excellent / Good / Fair / Poor").

**Reuse existing infra:** there's already a working STOMP/SockJS connection in `use-live-websocket.ts`, subscribed to `/topic/live.{eventId}` for Q&A (`QUESTION_SUBMITTED`, `QUESTION_MODERATED`, `QUESTION_ANSWERED` message types). Please extend the **same topic** with new message types rather than standing up a separate socket:
- `POLL_OPENED` — `{ pollId, question, options: [{id, label}], type: "SINGLE_CHOICE", closesAt?: ISO timestamp | null }`
- `POLL_RESULTS_UPDATED` — `{ pollId, results: [{optionId, votes, percentage}], totalVotes }` (pushed on every new vote, live)
- `POLL_CLOSED` — `{ pollId, finalResults: [...] }`

**Rules confirmed with product:**
- One vote per participant per poll — server tracks voter identity and rejects a second vote (409), same pattern as AGM resolution voting.
- Results broadcast live to all connected participants as votes come in (not admin-only).
- Only **one poll open at a time** per event — creating a new poll while one is still open should be rejected (409) until the current one is closed.
- A poll can be closed either manually (admin action) or automatically at a `closesAt` time limit if one was set at creation — "flexible till closed."

**REST endpoints needed (client admin):**
- `POST /api/v1/client/events/{eventId}/polls` — create + open a poll: `{ question, options: string[], closesAt?: ISO }`
- `PATCH /api/v1/client/events/{eventId}/polls/{pollId}/close` — manually close
- `GET /api/v1/client/events/{eventId}/polls` — list (history + live results for the currently open one, if any)
- `DELETE /api/v1/client/events/{eventId}/polls/{pollId}` — remove a poll (e.g. created by mistake, not yet opened to votes)

**Participant-side (for the mobile app team, not this dashboard):**
- `POST /api/v1/participant/events/{eventId}/polls/{pollId}/vote` — `{ optionId }`, one-vote-per-participant enforced server-side
- Participants receive `POLL_OPENED` / `POLL_RESULTS_UPDATED` / `POLL_CLOSED` via the same websocket subscription

**Frontend work (once endpoints exist):** add a "Polls" tab to the Live Control Room (client admin only) — create-poll form, live results bar chart driven by the websocket, manual "Close Poll" button. Super admin gets a read-only results view.

### F2. Press Kit tab — Product Launch events, client admin only

New tab on Product Launch events (both the admin's event detail page and the attendee-facing live event view) for distributing embargoed press materials. Reference screenshot: a "Digital Press Kit" list with per-document "Released 10:02 AM" / "Embargoed" states and a "Release All" button.

**REST endpoints needed (client admin CRUD):**
- `POST /api/v1/client/events/{eventId}/press-kit` — upload a document: `{ title, file (multipart or base64, matching the existing AGM Notice upload pattern), releaseMode: "MANUAL" | "SCHEDULED", releaseAt?: ISO (required if SCHEDULED) }`
- `PATCH /api/v1/client/events/{eventId}/press-kit/{docId}` — update metadata / change embargo time before release
- `PATCH /api/v1/client/events/{eventId}/press-kit/{docId}/release` — manual release (sets `released: true`, `releasedAt: now`)
- `PATCH /api/v1/client/events/{eventId}/press-kit/release-all` — bulk release everything still embargoed
- `DELETE /api/v1/client/events/{eventId}/press-kit/{docId}`
- `GET /api/v1/client/events/{eventId}/press-kit` — list, admin view includes embargoed + released items with full status

**Participant-side (mobile app team):**
- `GET /api/v1/participant/events/{eventId}/press-kit` — returns **only released** documents (embargoed ones simply excluded from this response, not just hidden client-side)
- Ideally a notification/websocket push when a new document is released, so attendees don't have to poll — up to backend team whether this piggybacks on the existing notification service or the live websocket topic.

**Frontend work (once endpoints exist):** new "Press Kit" tab on the Launch event detail page — upload dropzone, per-document embargo toggle (manual vs scheduled date/time picker), status chips, "Release All" button. Super admin: read-only.

### F3. Resources tab — Innovation Challenge events, client admin only

New tab on Innovation Challenge events for reference materials (rulebook PDFs, guides, links to external docs/APIs, workshop video links) — reference screenshot shows a categorized list (Getting Started / Technical Resources / Workshops) mixing PDF, Doc, Link, and Video types.

**REST endpoints needed (client admin CRUD):**
- `POST /api/v1/client/challenges/{challengeId}/resources` — add a resource: `{ title, description, category, type: "PDF" | "DOC" | "LINK" | "VIDEO", file? (for PDF/DOC uploads), externalUrl? (for LINK/VIDEO) }`
- `PATCH /api/v1/client/challenges/{challengeId}/resources/{resourceId}`
- `DELETE /api/v1/client/challenges/{challengeId}/resources/{resourceId}`
- `GET /api/v1/client/challenges/{challengeId}/resources` — list, grouped/groupable by `category`

**Notification requirement:** when a client admin adds a new resource at any point (including after the challenge has started), every participant on that challenge (applicants/team members) should get an in-app notification, similar to the existing challenge-application notification triggers already covered under item 9 in `BACKEND_BUGS_2026-07-11.md` — please wire a new "New resource added" trigger into that same notification service rather than building a separate one.

**Participant-side (mobile app team):**
- `GET /api/v1/participant/challenges/{challengeId}/resources`

**Frontend work (once endpoints exist):** new "Resources" tab on the Innovation Challenge detail page — upload/add-link form, category grouping, edit/delete per resource. Super admin: read-only.
