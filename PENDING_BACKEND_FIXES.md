# Pending Backend Fixes — attend-admin

Consolidated from `BACKEND_FIXES.md`, `BACKEND_BUGS_2026-07-11.md`, and `BACKEND_BUGS_9_10_2026-07-11.md`.
This file lists **only what's still open** as of 2026-07-14 — fixed/shipped items, and items closed out by team decision, have been left out. See those three files for full history.

**Process ask:** once you've worked through these, please generate a short `.md` file summarizing exactly what was implemented/fixed for each item (endpoint, what changed, any new field names or response-shape notes) and send it back — makes it much faster for us to re-verify each item against the live app in one pass instead of re-testing blind.

---

## Needs code fix

### 1. Registrar detail page: data gaps
**Endpoint:** `GET /api/v1/admin/registrars/{id}` and sub-resources
- Registers table "Events" column always shows `0` per register — `eventCount` (or any alias) isn't populated.
- Representative `email` empty for at least one registrar — unclear if genuinely missing or dropped from the query.
- `GET /api/v1/admin/registrars/{id}/events` doesn't appear to support real pagination (`page`/`size` ignored, always returns the full list).

*(Format column is now confirmed working — resolved, removed from this list.)*

### 1b. REOPENED — RSVP count still `0` for every event, register filter still returns 0 results
**Endpoint:** `GET /api/v1/admin/registrars/{id}` and `GET /api/v1/admin/registrars/{id}/events`
Backend's 2026-07-14 response marked this fixed (item 14b/f — `registrationCount`/`registerId` added, confirmed same ID space as the standalone registers endpoint). Re-verified live on 2026-07-14 against "Meristem Registrars LTD" and **it does not reproduce as fixed**: every event row on both the registrar detail page and the `/registrars/{id}/events` sub-page still shows RSVPs = `0`, and selecting a register from the Register filter dropdown still returns no matching events. Frontend's fallback chain (`registrationCount ?? rsvpCount ?? registrationsCount ?? totalRsvps ?? rsvps ?? 0`) already tries every reasonable field-name alias, so this isn't a naming mismatch on our end. As a partial mitigation we've widened the register filter to also match on `registerName` (case-insensitive) instead of only `registerId`, and added a Register column to both event tables so the actual `registerName` value being returned (if any) is now visible for debugging — but the RSVP count itself has no client-side workaround. **Ask:** please re-check with this specific registrar/account whether `registrationCount` and a matching `registerId` are actually present in the live response, since the fix doesn't appear to be reflected yet.

### 2. Applications "Shortlisted" count mismatch — RECONFIRMED with fresh reproduction
**Endpoint:** `GET /api/v1/admin/challenges` (list)
Re-verified live on 2026-07-14: "Crafwell Innovation Challenge 2026" has **7/7 applications with status `Shortlisted`** (confirmed by opening the challenge and viewing every row in the Applications table). The challenge-selection table on `/hackathons/applications` still shows **Shortlisted: 0** for this same challenge. Frontend already reads `c.shortlistedCount ?? c.shortlistedTeams ?? 0` (both aliases backend has mentioned), so this isn't a naming issue — the list endpoint's per-challenge shortlisted count field is returning `0`/absent while the actual application statuses say otherwise. **Ask:** please confirm `GET /api/v1/admin/challenges` computes this count from live `ChallengeApplication.status = SHORTLISTED` rows rather than a stale/cached counter.

### 2b. NEW — "Open Challenge" from the Applications view 404s ("Challenge not found")
**Endpoint:** `GET /api/v1/admin/challenges/{challengeId}`
From `/hackathons/applications`, selecting a challenge and clicking "Open Challenge" navigates to `/hackathons/{challengeId}` using the exact same `id` shown in the challenge list/applications view — but the detail page renders "Challenge not found." Frontend now distinguishes a genuine empty response from an actual request error (shows the HTTP status if the request errored) so this will be easier to diagnose next time it happens, but as of this report we don't have the live status code. **Ask:** please check whether `GET /api/v1/admin/challenges/{id}` works for the same `id` values returned by the list endpoint `GET /api/v1/admin/challenges` — if the two endpoints use different ID spaces (similar to the registerId issue in 1b), that would explain this.

### 3. "Avg Watch" column always blank
**Endpoint:** Per-Event Breakdown row field `avgWatchMinutes`, both admin and client `event-performance`
Never populated on any event, on either Super Admin or Client Admin. Needs a decision: implement watch-time tracking, or confirm it's not built yet so the frontend can drop the column instead of showing a permanent "—".

### 4. Week-over-week `*Change` fields stay `null` even with sufficient history
**Endpoint:** `GET /api/v1/admin/analytics/summary`
Confirmed via raw response: `eventsHosted: 18` (clear history exists) but all four `*Change` fields (`registrationsChange`, `eventsHostedChange`, `docsChange`, `votesCastChange`) are still `null` after creating a new test event. Per the field's own spec, `null` should only mean "no prior-week data" — that doesn't match an account with 18+ events spanning back several days. Needs confirmation of whether the comparison logic is actually computing a value under real conditions, or unconditionally returning `null`.

**Confirmed frontend is not the problem:** `StatCard` in `SuperAdminAnalytics.tsx` already renders the trend badge whenever `change !== undefined` — no code change needed there. This is proven working end-to-end on the *client-scoped* `GET /api/v1/client/analytics/stats` equivalent, which does return real `change` values (`+14%`, `-5.3%`, etc.) and displays correctly. The admin `summary` endpoint specifically is the one still stuck on `null` — same rendering code, same wiring, different backend endpoint's data.

### 5. Event Format Distribution — confirmed still broken on both Super Admin and Client Admin, needs real implementation
**Endpoints:** `GET /api/v1/admin/analytics/event-format`, `GET /api/v1/client/analytics/event-format`
Re-confirmed on 2026-07-14: still shows "No format data yet" on the Super Admin Analytics page (screenshot taken on the live `/analytics` page, KYC Verification Breakdown on the same row renders real data from the same account, so this isn't a general analytics outage). The prior theory that this was just the "Last 30 Days" default range hiding out-of-window events did not hold up.

**Ask:** please implement (or fix) both endpoints to return a real aggregation of this org's (client) / the platform's (admin) events grouped by their `format` field, with counts for exactly the three values the event model already uses: `hybrid`, `in_person`, `virtual` (frontend will map these to "Hybrid" / "In Person" / "Virtual" labels). Response shape frontend already expects:
```json
{ "data": { "formats": [ { "format": "hybrid", "count": 4, "color": "#..." }, { "format": "virtual", "count": 6 }, { "format": "in_person", "count": 2 } ] } }
```
(`color` optional — frontend has its own fallback palette.) Since `GET /api/v1/admin/events` and the client Events page both already show real, populated `format` values per event, this should be a straightforward group-by/count over existing data, not new data collection.

---

## Needs confirmation only

### 6. Dashboard "Platform Users" Active/Suspended counts
**Endpoint:** `GET /api/v1/admin/dashboard`
Confirmed missing `activeUsers`/`suspendedUsers` — not a naming mismatch. Frontend has a client-side fallback (counts from the loaded users page) that's only accurate up to the page size fetched (100). Needs server-side aggregate counts across all users.

---

## Summary table

| # | Item | Type | Priority |
|---|------|------|----------|
| 1 | Registrar detail: event counts, rep email, pagination | Bug | Medium |
| 1b | RSVP=0 + register filter still broken despite claimed fix | Bug — reopened, needs re-check | **High** |
| 2 | Shortlisted count mismatch | Bug — reconfirmed with fresh repro | Medium |
| 2b | "Open Challenge" 404s from Applications view | Bug — new | Medium |
| 3 | Avg Watch column always blank | Bug or not-implemented | Low |
| 4 | Week-over-week `*Change` stuck at `null` (admin only — client works) | Bug | **High** |
| 5 | Event Format Distribution empty on both admin + client endpoints | Bug — needs real implementation | **High** |
| 6 | Dashboard active/suspended user counts | Bug | Medium |
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
