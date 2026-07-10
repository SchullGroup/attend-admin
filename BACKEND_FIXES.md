# Backend Fixes & Additions — attend-admin

Frontend: Next.js admin dashboard. Base URL: `NEXT_PUBLIC_API_URL` (Spring Boot).
All responses are expected in the envelope: `{ status, message, data, error }`.

---

## 1. Live event "elapsed time" does not display

**Status: existing endpoint, field not populating correctly**

- **Endpoint:** `GET /api/v1/client/live/{eventId}`
- **Broken field:** `data.elapsedMinutes` (number)
- **Expected behavior:** minutes elapsed since the event's live session started (i.e. `now - event.liveStartedAt`, in whole minutes). Frontend formats it client-side as `Xh Ym` / `Ym`.
- **Current behavior:** field is missing, `null`, or always `0`, so the "Elapsed" stat on the Live Control Room never advances.
- **Fix needed:** compute `elapsedMinutes` server-side on every poll using the event's actual live-start timestamp (not event creation time). The frontend polls this endpoint every 4 seconds, so it must be cheap to compute (no need to cache).

---

## 2. ~~No endpoint to set/update quorum requirement~~ — SHIPPED, integrated

**Status: done.** Backend added `PATCH /api/v1/client/votes/{eventId}/config/quorum` (`{ "quorumPercentage": 0–100 }`, 409 if voting has started). Frontend now calls this from an editable Quorum card on the vote results page (`useSetQuorum` in `client-votes.ts`), locked in the UI once any resolution is OPEN/CLOSED, with a 409 toast if the backend rejects it anyway.

One thing to confirm: the success response currently matches the generic placeholder schema (`{ data: { additionalProp1: "string", ... } }`). Frontend re-fetches `GET .../results` after a successful PATCH rather than trusting the PATCH response body directly — please confirm `GET .../results` reflects the new `quorumPercentage`/`quorumMet` immediately after the PATCH, and ideally also returns the configured threshold itself (frontend reads `requiredQuorumPercentage` / `quorumRequiredPercentage` / `quorumThreshold` — whichever alias is easiest on your side).

---

## 3. ~~Share-weighted tallies must be per-resolution~~ — SHIPPED, integrated

**Status: done.** Backend added `PATCH /api/v1/client/votes/{eventId}/resolutions/{resolutionId}/config/share-weighted-tallies` (`{ "enabled": boolean }`, 409 if that resolution's voting is OPEN). Frontend now renders this as a per-resolution toggle (default OFF) inside each resolution card on the vote results page, disabled with a lock icon while `status === "OPEN"`, and shows a 409-specific toast if the backend rejects a change mid-vote. The old event-level endpoint/button has been removed from the frontend.

**Still needed on the backend side:** the per-resolution field in `GET /api/v1/client/votes/{eventId}/results` → `resolutions[]`. Frontend currently normalizes from `shareWeightedTalliesEnabled` / `shareWeightedTallies` / `weightedTalliesEnabled` (defaults to `false` if none present) — please confirm which one the results payload actually returns per resolution, or add `shareWeightedTalliesEnabled: boolean` if it's not there yet, so the "Share-Weighted" badge and share totals row on the event's Vote Results tab reflect real state instead of always defaulting to off.

---

## 4. Document size not showing

**Status: existing endpoints, field not populating**

- **Endpoints affected:**
  - `GET /api/v1/client/documents` (global vault — powers `/documents` page and the register detail page's Documents section)
  - `GET /api/v1/client/documents/{documentId}`
- **Broken fields:** `data.documents[].sizeLabel` (string, e.g. `"1.2 MB"`) and/or `data.documents[].sizeBytes` (number, raw byte count — frontend formats it if `sizeLabel` isn't present).
- **Current behavior:** both fields come back empty/`0`/`null` for uploaded documents, so the Size column always shows "—".
- **Fix needed:** populate the actual uploaded file size (in bytes, plus optionally a pre-formatted label) at upload time and persist it, or compute it from the stored file (e.g. Cloudinary `bytes` field from the upload response) on read.

---

## 5. ~~Revoking a team member's access doesn't actually block login~~ — SHIPPED, needs live verification

**Status: backend confirms this is fixed.** `DELETE /api/v1/client/organisation/team/{id}/revoke` is now documented as "Deactivates a team member. They lose access immediately... Requires CLIENT_ADMIN role. Accepts both DELETE and POST." This matches the existing frontend call in `useRevokeTeamMember` (`client-organisation.ts`) exactly — no frontend change needed.

**One thing worth testing live** before calling this fully closed: "lose access immediately" could mean either (a) enforced per-request — an already-open browser tab gets kicked out on its very next API call, or (b) only blocks *new* logins while an already-open tab keeps working until its access token naturally expires (up to ~1 day per the JS cookie TTL). Recommend testing both: revoke a test account, then check (1) a fresh login attempt is rejected, and (2) an already-logged-in tab in another browser gets logged out on its next action, not just its next full page reload.

---

## 6. ~~Analytics: monthly RSVP trend, event performance table, export registrations~~ — SHIPPED, integrated

**Status: done.** All three endpoints now match the frontend's existing contracts exactly (`client-analytics.ts`, no changes needed):

- `GET /api/v1/client/analytics/monthly-trend` → `{ data: { trend: [{ month, registrations }] } }`
- `GET /api/v1/client/analytics/event-performance?page=&size=` → `{ data: { totalCount, page, size, events: [{ id, title, eventType, dotColor, date, status, rsvpCount, capacity, fillRate, checkedInCount, checkInRate }] } }` — note `fillRate` is returned as a 0–1 fraction (e.g. `0.1` = 10%); frontend already detects and multiplies by 100.
- `GET /api/v1/client/analytics/export/registrations?eventId=&from=&to=` → `{ data: { eventId, eventTitle, eventDate, exportedAt, total, registrations: [{ fullName, email, phone, registeredAt, checkedIn, checkedInAt }] } }`

These should now render correctly on the Analytics page (Monthly RSVP Trend chart, Event Performance table with pagination, and the CSV export button) — no code changes required on the frontend side.

---

## 7. Post-AGM endpoints — SHIPPED, integrated (new since original list)

**Status: done.** The full Post-AGM suite is now live and wired up on the Post-AGM tab of the event detail page (new `src/api/client-post-agm.ts`):

- `GET .../post-agm/summary` — drives the summary strip (resolutions passed, votes cast, attendees present, minutes status).
- `GET .../post-agm/minutes` + `PUT .../post-agm/minutes` (save draft) + `POST .../post-agm/minutes/finalise` — Draft Minutes editor. Textarea locks and shows a "Finalised" badge once `status === "FINALISED"`; a 409 on save/finalise shows the appropriate toast ("already finalised" / "no draft exists").
- `GET .../post-agm/certificates/eligibility` + `POST .../post-agm/certificates/send` — Certificates card now shows real eligible/sent/pending counts and queues sending for real.
- `GET .../post-agm/export/attendance` and `GET .../post-agm/export/vote-audit` — both documented as raw CSV text bodies (not the JSON envelope). Frontend fetches with `responseType: "text"` and downloads directly. **Please confirm these truly return a raw CSV string** and not `{ status, data: "...", error }` — if they're wrapped, the frontend will download a malformed CSV containing JSON. If the vote-audit CSV route 404s, frontend falls back to the older `GET /votes/{eventId}/export/resolutions` (structured JSON) and builds the CSV client-side, so nothing is broken either way — just flag if that fallback is firing.
- `GET .../post-agm/statutory-return` — Swagger only documents this as a generic object (`{ additionalProp1: "string", ... }`). Frontend downloads whatever comes back as a `.json` file for now ("Export Data" button) since there's nothing to build a formatted PDF from yet. **Please send the real field names/shape** once finalized (attendance counts, quorum, per-resolution totals) so this can become an actual formatted statutory filing document instead of a raw JSON dump.

---

## 8. `POST /expected-attendees/import` returns 500

**Status: broken, currently worked around on the frontend**

- **Endpoint:** `POST /api/v1/client/events/{eventId}/expected-attendees/import` (`{ registerId }`)
- **Observed:** consistently returns HTTP 500 (no useful body) when called — both from the auto-import-on-AGM-creation flow and the "Import from Register" button on the event's Expected Attendees tab.
- **Current workaround:** the frontend no longer calls this endpoint. Instead it fetches the register's shareholders via `GET /api/v1/client/registers/{registerId}/shareholders?status=ACTIVE&page=&size=` (paginated) and submits them through the already-working `POST /api/v1/client/events/{eventId}/expected-attendees` (bulk upload, `{ attendees: [...] }`) endpoint. Shareholders with no email on file are skipped client-side since that endpoint requires one.
- **Fix needed:** either fix the 500 on the import endpoint (nice to have — the client-side workaround is functional), or confirm this endpoint should be deprecated in favor of the shareholders-list + bulk-upload combination, in which case it can be removed from Swagger.

---

## Summary table

| # | Issue | Endpoint status | Action needed |
|---|-------|-----------------|----------------|
| 1 | Live elapsed time | Exists | Fix `elapsedMinutes` calculation |
| 2 | Set quorum | **Shipped** ✅ | Confirm `GET .../results` reflects new threshold + returns it |
| 3 | Per-resolution share-weighted tallies | **Shipped** ✅ | Confirm/add `shareWeightedTalliesEnabled` field per resolution in `GET .../results` |
| 4 | Document size | Exists | Populate `sizeBytes`/`sizeLabel` on upload |
| 5 | Revoke access | **Shipped** ✅ | Live-test that an already-open tab is also kicked, not just new logins |
| 6 | Analytics (trend, performance, export) | **Shipped** ✅ | None — contracts match, should just work |
| 7 | Post-AGM (minutes, certificates, exports, statutory return) | **Shipped** ✅ | Confirm CSV exports are raw text, not JSON-wrapped; send real statutory-return field shape |
| 8 | Expected-attendees import 500 | Broken | Fix or deprecate — frontend now works around it via shareholders-list + bulk-upload |
