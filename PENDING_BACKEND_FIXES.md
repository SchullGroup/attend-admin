# Backend Status — attend-admin

Restructured **2026-07-15**. Single source of truth for backend work: what's open, what's awaiting re-test, what needs an answer only, and what's closed. Full history lives in `BACKEND_FIXES.md`, `BACKEND_BUGS_2026-07-11.md`, and `BACKEND_BUGS_9_10_2026-07-11.md` — this file supersedes their statuses.

**Process ask (standing):** when you fix items from this file, send back a short `.md` summarizing what changed per item (endpoint, change, any new field names) so we can re-verify in one pass instead of re-testing blind.

---

## ⚠️ Meta-issue first: `staging` is 102 commits behind `dev`

Backend flagged (2026-07-14) that `origin/staging` is missing the entire Register/Registrar feature, the entire Challenge/Hackathon admin feature, and all five rounds of analytics fixes. Every item in the "awaiting re-test" bucket below is claimed fixed in `dev` — if we've been testing against `staging`, those failures are deployment lag, not code bugs. **Nothing in that bucket can move until backend confirms which environment we test against and syncs it.** This is the single highest-leverage backend action in this file.

---

## 🔴 OPEN — needs backend code fix (6)

### O1. `POST /events/{id}/zoom` must be idempotent *(was item 7)* — **High**
**Endpoint:** `POST /api/v1/client/events/{eventId}/zoom`

Calling this for an event that already has a Zoom meeting **creates a brand-new meeting** (new meetingId/joinUrl) instead of returning the existing one with a fresh ZAK. The frontend calls it mid-event to refresh the host's expired ZAK (~2 h lifetime), so every refresh rotates the meeting. The attendee app picks up the rewritten streamUrl, so new joiners land in the new meeting — but attendees **already connected** are stranded in the old one, and pre-shared/calendar links go dead. (The admin embed previously pinned the host to the old meetingNumber, which inverted the split — that's fixed frontend-side; the embed now adopts the rotated meeting.)

**Ask:** if the event already has a meeting, return the SAME meeting (same meetingId/joinUrl/password) with a freshly generated `startUrl`/ZAK. Create a new meeting only when none exists; if the old one is unusable, end it via the S2S OAuth app and update `streamUrl` atomically.

**Related server-side ownership (frontend JWT-app routes are dead — Zoom killed JWT apps in 2023):**
- Set `settings.waiting_room: true` at meeting creation.
- Force-ending stale meetings (if ever needed) must be S2S OAuth, backend-side.
- **NEW (2026-07-14):** the participant Expo app will embed the **native** Meeting SDK, which needs a differently-shaped SDK JWT than the web signature (no `mn`/`role` claims). Please confirm whether the existing participant signature endpoint can issue the native variant (e.g. via a `platform` param) — see `PARTICIPANT_ZOOM_JOIN_CONTEXT.md` §4.

### O2. `GET /client/registers/{id}` returns 500 *(was item 8)* — **High**
Reproduced live: `GET /api/v1/client/registers/083006e2-1666-4b30-9450-9614100c551a` → 500. This one call gates the entire register detail page, so the Events Registry and Document Vault tabs go down with it even though their own calls might succeed. **Treat "documents not loading" and "register page 500" as one root cause.** Ask: fix the 500 (id-specific or general); share the stack trace if useful.

### O3. Super admin can't suspend a registrar *(was item 9)* — **High**
`PATCH /api/v1/admin/registrars/{id}/suspend` fails for super admin. Frontend calls it exactly as documented (`useSuspendRegistrar`, no body). Check permissions/implementation for the super admin role.

### O4. Week-over-week `*Change` fields stay `null` on admin summary *(was item 4)* — **High**
`GET /api/v1/admin/analytics/summary` returns `null` for all four `*Change` fields even with 18+ events of history, while the client-scoped equivalent (`GET /client/analytics/stats`) returns real values through identical frontend rendering. Backend inspected the logic (structurally identical to the working client version, no bug found) and added a diagnostic log line (`Analytics summary week-over-week diag: ...`). **Blocked on our follow-up F-A below** — one call against current `dev`, then pull that log line.

### O5. Event Format Distribution still empty — reopened 2026-07-15 *(was item 5)* — **High**
`GET /api/v1/admin/analytics/event-format` and `GET /api/v1/client/analytics/event-format` still return "No format data yet" live, after the 2026-07-14 casing fix (uppercase enum → lowercase values). Frontend parsing is case-agnostic and shape-defensive — a correct response either way would render. Either this is the staging/dev lag again, or the fix didn't take. Needs a check against confirmed-current `dev`; if still empty there, we'll send the raw response body.

### O6. Dashboard Active/Suspended user counts missing *(was item 6)* — Medium
`GET /api/v1/admin/dashboard` confirmed missing `activeUsers`/`suspendedUsers` (raw payload checked — not a naming mismatch). Frontend fallback counts only the loaded page (100 users max). Ask: server-side aggregate counts on the dashboard response (or `GET /admin/stats`).

---

## 🟡 AWAITING RE-TEST — backend says fixed in `dev`, blocked on the staging sync (4)

| ID | Item | What to re-verify once environments sync |
|---|---|---|
| R1 *(was 1)* | Registrar detail: per-register `eventCount`, pagination on `.../registrars/{id}/events` | Events column non-zero; `page`/`size` respected. **Rep-email is NOT part of this:** confirmed a permanent data gap for registrars enrolled before the column existed — backfill via our Edit modal (`PATCH /admin/registrars/{id}`), nothing to wait on. |
| R2 *(was 1b)* | RSVP=0 + register filter matching nothing on registrar events | `registrationCount` and `registerId` populated; filter matches. Backend's ask: if RSVPs are **still** 0 on current `dev`, send raw JSON for one event. Bonus: `GET /admin/events` now also returns `registerName` — widen main Events page fallback once confirmed. |
| R3 *(was 2)* | Shortlisted count mismatch (summary says 7, per-challenge row says 0) | `shortlistedTeams`/`shortlistedCount` live-computed per request; FE already reads both. |
| R4 *(was 2b)* | "Open Challenge" → 404 "Challenge not found" | List and detail confirmed same ID space in `dev`; on `staging` the whole feature is missing, which 404s identically. |

---

## 🟠 NEEDS AN ANSWER ONLY — asks sent, never answered (7)

These need a reply/confirmation, not necessarily code. Oldest first; sources in brackets.

1. **EVENT_MANAGER write access** — grant the role: Import from Register, Add/Save Resolution, Refresh Zoom Meeting Token, Unfeature Event, Publish/Go Live/Cancel. Also scope its notifications to events only (no Innovation Challenge noise). *(BACKEND_BUGS item 7)*
2. **VIEWER server-side read-only enforcement** — confirm 403 on all write endpoints (documents, expected-attendees, votes, agenda, challenges, status changes, Zoom refresh) even for crafted requests; confirm read + export stays. Client-side hiding is UX, not security. *(item 8)*
3. **Judge notification coverage** — confirm the judge feed fires on: panel assignment/removal, new application on assigned challenge, scoring opens/closes, shortlist published; and that it's scoped to challenges only. *(item 9)*
4. **Shareholder CSV schema** — authoritative required/optional column headers (exact casing) for the shareholder CSV import; whether `.xlsx` follows the same schema; any header-name flexibility. We're currently validating client-side against guesses derived from one error message (`name`, `email`, `sharecount`). *(item 16)*
5. **`GET /api/v1/admin/events/{id}/attendees` exists?** — FE switched super-admin attendee reads to this path (mirroring `/admin/events/{id}/documents`); never confirmed. *(item 12a)*
6. **Platform-wide registers list for super admin** — e.g. `GET /api/v1/admin/registers` returning `{ id, name, registrarId }` across all registrars, for a true cross-org filter. *(item 12b)*
7. **Enroll endpoint accepts `address`/`website`?** — FE now sends both on `POST /admin/registrars/enroll`; if unknown keys are silently ignored, they're being dropped without error. *(item 12e)*

Plus three low-priority confirmations carried from `BACKEND_FIXES.md`: quorum PATCH → confirm `GET .../results` returns the configured threshold (`requiredQuorumPercentage` or alias); share-weighted → confirm the per-resolution field name in `.../results` (`shareWeightedTalliesEnabled`?); Post-AGM CSV exports → confirm raw CSV text, not JSON-wrapped.

---

## 🔵 OUR OWN FOLLOW-UPS (frontend/user side — not backend's queue)

- **F-A.** Hit `GET /admin/analytics/summary` against current `dev`, pull the `Analytics summary week-over-week diag:` server log line, send to backend (unblocks O4).
- **F-B.** Re-test R1–R4 once backend confirms environments are synced.
- **F-C.** Backfill representative emails for pre-column registrars via the registrar Edit modal (R1 note).
- **F-D.** Revoke-access live test: confirm an already-open tab is kicked on its next API call, not just new logins blocked. *(BACKEND_FIXES item 5)*
- **F-E.** Once R2 confirms live, widen main Events page to use `registerName`.

---

## ✅ FIXED & CLOSED (ledger — no action)

| Item | Outcome |
|---|---|
| Revoke access didn't deactivate | Fixed backend 07-11 (persistence-ordering bug) |
| Monthly RSVP trend 500 | Fixed backend 07-11 (SQL type cast) |
| Shareholder `phone` missing | Fixed 07-11 + new PATCH/DELETE shareholder endpoints, FE wired |
| Team `ADMIN` role parity with client_admin | Fixed 07-11 (controller role lists) |
| Team `ADMIN` notifications | Fixed 07-11 (3 triggers now include ADMIN). Note: doc-upload & event-reminder triggers don't exist at all — new work if wanted |
| Analytics `?range=` param | Added on all 7 admin analytics endpoints (`30d|90d|12m|all`); `documentDownloads` always all-time (no per-download timestamps) |
| Admin summary `*Change` fields | Added (week-over-week) — **values stuck at null tracked as O4** |
| Client-scoped `event-format` endpoint | Added — **empty-response bug tracked as O5** |
| Client `stats` per-stat `change` fields | Added & confirmed live 07-14 |
| Client `engagement` endpoint | Confirmed exists; `avgWatchTime`/`pollResponseRate` legitimately null (no infrastructure) |
| `pollResponses` → `qaResponses` | Renamed, backed by real EventQuestion counts. **Confirmed: no polls feature exists anywhere** — FE removed the Poll Response Rate card |
| `shortlistedTeams` field | Added (verification folded into R3) |
| Registrar events `registrationCount`/`registerId` | Added in `dev` (verification folded into R2) |
| `createdAt` on `GET /admin/events` | Added; insertion-order sort confirmed working-as-designed |
| Avg Watch column | Closed by decision — no watch-time tracking exists; FE dropped the column. Real tracking = new feature |
| Innovation Challenge stub audit | Backend audited — no stubs/mocks anywhere, all live queries |
| Quorum endpoint | Shipped & integrated (confirm-nit in 🟠 above) |
| Per-resolution share-weighted tallies | Shipped & integrated (confirm-nit in 🟠 above) |
| Analytics trio (trend/performance/export) | Shipped, contracts match |
| Post-AGM suite (minutes, certificates, exports, statutory return) | Shipped & integrated (CSV confirm-nit in 🟠 above) |

---

## ⚪ PRESUMED CLOSED IN EARLIER CONSOLIDATION — reconfirm if still relevant

Dropped from tracking when this file was first consolidated; no explicit fix confirmation on record:

- **Live "Elapsed" time** — `elapsedMinutes` on `GET /client/live/{eventId}` was missing/0. Status unknown; the Live Control Room header still reads it.
- **Document size** — `sizeBytes`/`sizeLabel` empty on the document vault endpoints. Status unknown.
- **`POST /expected-attendees/import` 500** — FE permanently works around it (shareholders-list + bulk-upload); the "fix or deprecate from Swagger" question was never answered.
- **`sizeBytes` null-guard pattern** — the derived-field NPE pattern behind two past 500s; suggested sweep never confirmed.

---

## 🚧 NEW FEATURE REQUESTS (net-new backend work)

General note: CRUD endpoints are **client-admin only**; super admin gets **read-only**. Participant-facing endpoints are for the mobile/attendee team — listed so backend knows they're needed; this dashboard won't call them.

### F1. Live event polls — non-AGM live events (Launch, General, Innovation Challenge) — High

Lighter-weight than AGM resolution voting — live-session polls ("Rate today's session: Excellent/Good/Fair/Poor"). **Extend the existing STOMP topic** `/topic/live.{eventId}` (already carries Q&A message types) with:
- `POLL_OPENED` — `{ pollId, question, options: [{id, label}], type: "SINGLE_CHOICE", closesAt?: ISO | null }`
- `POLL_RESULTS_UPDATED` — `{ pollId, results: [{optionId, votes, percentage}], totalVotes }` (pushed per vote)
- `POLL_CLOSED` — `{ pollId, finalResults: [...] }`

Rules (confirmed with product): one vote per participant (409 on second), results broadcast live to everyone, only one poll open at a time per event (409 otherwise), close manually or at `closesAt`.

REST (client admin): `POST /client/events/{eventId}/polls` (create+open), `PATCH .../polls/{pollId}/close`, `GET .../polls` (history + live), `DELETE .../polls/{pollId}` (unopened only). Participant-side: `POST /participant/events/{eventId}/polls/{pollId}/vote` `{ optionId }` + same websocket messages.

FE work once live: "Polls" tab in the Live Control Room — create form, live results chart, close button; super admin read-only.

### F2. Press Kit tab — Product Launch events — High

Embargoed press materials with per-document release states and "Release All".

REST (client admin): `POST /client/events/{eventId}/press-kit` (`{ title, file, releaseMode: "MANUAL"|"SCHEDULED", releaseAt? }`), `PATCH .../press-kit/{docId}` (metadata/embargo), `PATCH .../press-kit/{docId}/release`, `PATCH .../press-kit/release-all`, `DELETE .../press-kit/{docId}`, `GET .../press-kit` (admin sees embargoed + released). Participant-side: `GET /participant/events/{eventId}/press-kit` returns **only released** docs (excluded server-side, not hidden client-side); ideally a push notification on release.

FE work once live: Press Kit tab on Launch event detail — dropzone, embargo toggle (manual/scheduled), status chips, Release All; super admin read-only.

### F3. Resources tab — Innovation Challenge events — Medium

Reference materials (rulebooks, guides, links, workshop videos), categorized.

REST (client admin): `POST /client/challenges/{challengeId}/resources` (`{ title, description, category, type: "PDF"|"DOC"|"LINK"|"VIDEO", file?, externalUrl? }`), `PATCH`/`DELETE .../resources/{resourceId}`, `GET .../resources` (groupable by category). **Notification:** on every new resource (including mid-challenge), notify all challenge participants via the existing notification service (same triggers family as challenge applications). Participant-side: `GET /participant/challenges/{challengeId}/resources`.

FE work once live: Resources tab on challenge detail — add/upload form, category grouping, edit/delete; super admin read-only.

---

## Summary table

| ID | Item | Status | Priority |
|---|---|---|---|
| — | `staging` 102 commits behind `dev` — blocks all R-items | ⚠️ Backend ops | **Highest** |
| O1 | `POST /zoom` rotates meeting instead of refreshing ZAK (+ waiting_room, native-JWT signature variant) | 🔴 Open | **High** |
| O2 | `GET /client/registers/{id}` 500s — takes down register detail + docs + events | 🔴 Open | **High** |
| O3 | Super admin can't suspend registrar | 🔴 Open | **High** |
| O4 | Admin summary `*Change` stuck at `null` (client works) | 🔴 Open — blocked on F-A diag log | **High** |
| O5 | Event Format Distribution empty (admin + client), reopened after casing fix | 🔴 Open | **High** |
| O6 | Dashboard active/suspended user counts | 🔴 Open | Medium |
| R1 | Registrar detail event counts + pagination | 🟡 Awaiting re-test | Medium |
| R2 | Registrar events RSVP=0 + register filter | 🟡 Awaiting re-test | **High** |
| R3 | Shortlisted count mismatch | 🟡 Awaiting re-test | Medium |
| R4 | Open Challenge 404 | 🟡 Awaiting re-test | Medium |
| A1–A7 | Role permissions, CSV schema, endpoint confirmations (see 🟠) | 🟠 Needs answer | Medium |
| F1 | Live event polls | 🚧 New feature | High |
| F2 | Press Kit tab | 🚧 New feature | High |
| F3 | Resources tab | 🚧 New feature | Medium |
