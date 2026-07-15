# Backend Status — attend-admin

Updated **2026-07-15 (evening)** after backend's full response (`BACKEND_STATUS_FOR_FE_2026-07-15.md`). Previous restructure same day; full history in `BACKEND_FIXES.md`, `BACKEND_BUGS_2026-07-11.md`, `BACKEND_BUGS_9_10_2026-07-11.md`.

**Headline:** O1/O2/O3 fixed, all three feature requests (F1–F3) built and merged to `staging`, every outstanding ask answered. The ball is now almost entirely in OUR court: one big re-test pass, two product decisions, one credentials/spec handoff, and new feature UI work.

---

## 🔵 OUR COURT — everything actionable is on us now

### Re-test pass (backend says safe to re-test now — staging was merged today)
| What | Verify |
|---|---|
| O1 Zoom idempotency | Refresh no longer changes meeting #; `hostZak` field present. **FE already updated** to prefer `hostZak` (falls back to startUrl parsing). `?forceNew=true` exists for genuinely broken meetings — don't use by default |
| O2 Register detail 500 | `GET /client/registers/{id}` renders; Events + Documents tabs come back with it |
| O3 Registrar suspend | Was an HTTP-method mismatch (route only took POST, FE sends PATCH) — now accepts PATCH |
| O6 Dashboard user counts | Backend says already computed across all users — if still 0/missing live, send raw payload |
| R1–R4 | Registrar counts/pagination, RSVPs + register filter, shortlisted counts, Open Challenge nav — all confirmed correct in code; failures were the stale `staging` deploy |
| Quorum threshold | Returned as `quorumPercentage` + `quorumMet` — FE alias chain updated |
| Share-weighted | `shareWeightedTalliesEnabled` confirmed, event-level and per-resolution — FE already reads it first |
| Post-AGM CSVs | Confirmed raw CSV, not JSON-wrapped |
| Enroll `address`/`website` | Accepted and saved |
| `GET /admin/events/{id}/attendees` | Exists — super-admin Attendees tab should work |

### Still-blocked items where backend needs something from us
- **O4 (`*Change` null):** hit `GET /admin/analytics/summary` once against the fresh deploy, pull the `Analytics summary week-over-week diag:` server log line, send it over. No code bug found; this determines if `null` is legitimate.
- **O5 (Event Format empty):** re-test on the fresh deploy; if still empty, send the raw response body.

### Product decisions needed (backend waiting on our yes/no)
1. **Judge shortlist notification** — judges currently get no notification when an application is shortlisted (gap backend found themselves). Build it?
2. **EVENT_MANAGER challenge access** — the role has write access everywhere *except* challenge/hackathon actions (judges, scoring, applications), which are CLIENT_ADMIN/ADMIN only. Extend it?

### Credentials/spec handoff — native Zoom SDK signature (blocks the mobile app embed)
Backend has **zero** Meeting SDK signature code and no SDK key/secret configured — the meeting-creation credentials (S2S OAuth) are a different pair. Two things to send them:
1. **Credentials:** a Meeting SDK app key/secret. Note: the admin frontend already holds a working pair (`ZOOM_SDK_KEY`/`ZOOM_SDK_SECRET` in its env — powers `/api/zoom/signature`). Sharing that same pair with backend is the fastest path.
2. **Spec:** both token shapes. Web (role-based): `{ appKey, sdkKey, mn, role, iat, exp, tokenExp }` HS256 — working reference implementation in `src/app/api/zoom/signature/route.ts`. Native (mobile): same signing, payload without `mn`/`role` — `{ appKey, iat, exp, tokenExp }`; meeting number/password go in the SDK join call instead. Verify the native shape against current Zoom docs when implementing.

### New FE work unblocked — F1/F2/F3 endpoints are live on staging
Backend built all three (client-admin CRUD + super-admin read-only + participant endpoints). **Ask backend to resend the full endpoint list doc.** Then build:
- **Polls tab** in Live Control Room — create form, live results via existing `/topic/live.{eventId}` websocket (`POLL_OPENED`/`POLL_RESULTS_UPDATED`/`POLL_CLOSED`), close button.
- **Press Kit tab** on Product Launch event detail — dropzone, embargo toggles, release/release-all, status chips.
- **Resources tab** on Innovation Challenge detail — add/upload form, category grouping, edit/delete.
- Also now possible: **cross-org register filter** on the Events page — `GET /admin/registers` exists, returns `{ registers: [{ id, name, registrarId }] }`.

### One new clarifying question for backend (minor)
`GET /votes/{eventId}/results` — confirmed `quorumPercentage` is the **configured threshold**. The FE has also been displaying that field as the **achieved** quorum % (big number on the vote page). Is there a separate achieved-attendance-percentage field, or only threshold + `quorumMet`? If only threshold, we'll relabel the UI.

---

## ✅ FIXED THIS ROUND (2026-07-15 backend response)

| Item | Fix |
|---|---|
| O1 `POST /zoom` rotation | Idempotent: same meeting + fresh ZAK; new `hostZak` response field; `?forceNew=true` escape hatch; `waiting_room` was always set at creation (never broken) |
| O2 `GET /client/registers/{id}` 500 | Null-guards for legacy rows missing date/status |
| O3 Registrar suspend | Route now accepts PATCH (was POST-only — method mismatch, not permissions) |
| F1 Live Polls | Built, on staging |
| F2 Press Kit | Built, on staging |
| F3 Resources | Built, on staging |

## ✅ CONFIRMED ALREADY CORRECT (answered asks — closed)

EVENT_MANAGER write access (events scope) · VIEWER server-side read-only · judge notifications (except shortlist gap → decision above) · `GET /admin/events/{id}/attendees` exists · `GET /admin/registers` exists · enroll accepts `address`/`website` · quorum field name (`quorumPercentage`) · `shareWeightedTalliesEnabled` · Post-AGM raw CSVs · O6/R1–R4 code paths (pending live re-test only).

**CSV schema (corrected — our guess was wrong):** required `fullName`, `chn`; optional `email`, `phone`, `units`, `status`. No separate xlsx schema. **FE validation + hint text fixed accordingly (2026-07-15).**

## ✅ EARLIER FIXED & CLOSED (unchanged ledger)

Revoke access · monthly trend 500 · shareholder phone + PATCH/DELETE · ADMIN role parity + notifications · analytics `?range=` · `qaResponses` rename (no polls feature existed) · client stats `change` fields · client engagement endpoint · `shortlistedTeams` field · registrar `registrationCount`/`registerId` · `createdAt` on admin events · Avg Watch closed-by-drop · challenge stub audit clean · quorum + share-weighted endpoints · analytics trio · Post-AGM suite.

## ⚪ PRESUMED CLOSED IN EARLIER CONSOLIDATION — reconfirm when convenient

- Live "Elapsed" time (`elapsedMinutes` on `GET /client/live/{eventId}`) — status unknown, FE still reads it.
- Document size (`sizeBytes`/`sizeLabel`) on vault endpoints — status unknown.
- `POST /expected-attendees/import` 500 — FE works around permanently; "fix or deprecate" never answered.
- Derived-field NPE null-guard sweep — never confirmed.

---

## Summary table

| ID | Item | Status | Next actor |
|---|---|---|---|
| O1 | Zoom idempotency (+ `hostZak`, `forceNew`) | ✅ Fixed | Us — re-test |
| O2 | Register detail 500 | ✅ Fixed | Us — re-test |
| O3 | Registrar suspend | ✅ Fixed | Us — re-test |
| O4 | Admin `*Change` null | 🔲 Open | Us — send diag log line |
| O5 | Event Format empty | 🔲 Open | Us — re-test fresh deploy, send raw body if still empty |
| O6 | Dashboard user counts | ✔️ Already correct | Us — re-test |
| R1–R4 | Registrar/challenge data items | ✔️ Already correct | Us — re-test |
| — | Judge shortlist notification | 🆕 Gap found | Us — decide |
| — | EVENT_MANAGER challenge access | 🆕 Gap found | Us — decide |
| — | Native Zoom SDK signature endpoint | 🔲 Blocked | Us — send SDK creds + token spec |
| — | Achieved-vs-threshold quorum field | ❓ Question | Backend — answer |
| F1–F3 | Polls / Press Kit / Resources | ✅ Built | Us — get endpoint doc, build UI |
