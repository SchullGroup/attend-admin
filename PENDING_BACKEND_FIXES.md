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
