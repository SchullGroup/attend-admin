# Zoom Integration — Context for Bug Fixing

Purpose: this is a briefing document for an agent (Fable 5) picking up Zoom-related bugs in `attend-admin` cold. It explains what's actually implemented today, how Zoom relates to YouTube in this codebase (they are **not** parallel integrations — see below), where the moving parts live, and where the likely failure points are.

---

## 1. The core architecture: one generic `streamUrl` field, not per-provider fields

There is no `zoomUrl` / `youtubeUrl` / `googleMeetUrl` split anywhere in the data model. Every virtual/hybrid event has exactly one field, **`streamUrl`** (on `Event`, `CreateEventRequest`, `UpdateEventRequest` in `src/api/client-events.ts`), and the frontend infers what to do with it by inspecting the URL string at render time.

Two ways `streamUrl` gets populated:

1. **Manual paste** — the organizer pastes any URL (YouTube, Zoom, Google Meet, or anything else) into a plain text input. Placeholder copy literally says "Paste YouTube, Zoom, or Google Meet URL…" (`StreamPreviewCard.tsx`) and "https://youtube.com/live/... or https://zoom.us/j/..." (`GeneralSteps.tsx` / `LaunchSteps.tsx`).
2. **Auto-populated from a real Zoom integration** — if the organizer toggles "Auto-Create Zoom Meeting" at event creation (only available on AGM and General event types — **not** Launch or Hackathon, an existing inconsistency), the backend actually creates a Zoom meeting via Server-to-Server OAuth, and the frontend overwrites the effective stream link with `zoomMeeting.joinUrl`.

**The takeaway:** Zoom is the only video provider with a real, dedicated backend integration (meeting creation, token refresh, SDK-embedded join). YouTube is not integrated at all in the "create a stream" sense — it's handled *purely client-side* as URL-pattern detection against whatever string happens to be sitting in `streamUrl`. There is no YouTube Live API call, no YouTube OAuth, nothing server-side. If a `streamUrl` happens to look like a YouTube link, the Live Control Room renders it differently (iframe embed) than it would a Zoom link (native SDK embed) — that's the entire relationship between the two.

`StreamPreviewCard.tsx` (`src/app/(dashboard)/events/live/components/`) is the branch point: it inspects `streamUrl` and picks a rendering strategy:
- Zoom link → native `ZoomEmbed` SDK component (the real integration, described below)
- Standard YouTube link → raw `<iframe>` using `youtube.com/embed/{id}` (helpers in `stream-helpers.ts`: `isYoutubeUrl`, `parseStreamUrl`)
- YouTube channel "/live" or "/@handle/live" vanity URLs → **not embeddable** (YouTube's CSP blocks iframing these) — `isUnembeddableYoutubeUrl` catches this and falls back to an "Open in YouTube" external-link card instead of a broken iframe
- Google Meet or anything else → generic external-link card or raw iframe fallback

So: if you're asked to fix a "YouTube isn't working" bug, the fix is almost certainly in `stream-helpers.ts`'s URL parsing/detection logic or `StreamPreviewCard.tsx`'s branching — there's no YouTube API integration to debug. If you're asked to fix a "Zoom isn't working" bug, the surface area is much bigger (see below) because Zoom is a real integration with real moving parts: OAuth, tokens, SDK, signatures.

---

## 2. Zoom integration — full surface area

### Backend-facing API (`src/api/client-events.ts`)
- `POST /api/v1/client/events/{id}/zoom?durationMinutes=N` — single endpoint that serves **both** "create" and "refresh" (same call either way). Backend requires Zoom Server-to-Server OAuth configured on its side. Only valid for VIRTUAL/HYBRID events. Wired via `useCreateEventZoomMeeting()`.
- Returns `ZoomMeetingDto`: `{ meetingId, password, joinUrl, startUrl, durationMinutes }`.
- `CreateEventRequest` carries `enableZoomMeeting?: boolean` and `zoomDurationMinutes?: number` (default 120) at event-creation time.
- `src/api/client-live.ts`: `LiveRoomDetail.zoomMeeting?: ZoomMeetingDto` — comment notes this is "returned by some backend versions alongside the live snapshot," implying inconsistent backend behavior across environments/versions. Worth checking first if a Zoom bug looks environment-specific.

### Event creation wizard
- `state-hooks.ts`: `enableZoomMeeting` / `zoomDurationMinutes` state exists **twice**, once each in the AGM and General step-state hooks — duplicated, not shared.
- `AgmSteps.tsx` / `GeneralSteps.tsx`: toggle "Auto-Create Zoom Meeting"; when on, the manual `streamUrl` input is hidden with a note that it'll be set automatically post-creation.
- `LaunchSteps.tsx`: only has a raw `streamUrl` text field — **no Zoom auto-create toggle at all**. If Product Launch events are supposed to support native Zoom creation and don't, this is why.
- `HackathonSteps.tsx`: no Zoom reference whatsoever.

### Live Control Room (`src/app/(dashboard)/events/live/components/`)
- `SessionDetail.tsx`: prefers `zoomMeeting` from the live-room snapshot; falls back to a separate event-detail query (only enabled when the room snapshot lacks Zoom data — two possible sources of truth for the same data, can drift). Extracts the `zak` token from `zoomMeeting.startUrl`'s query params client-side (not returned as its own field).
- `ZoomMeetingCard.tsx`: renders the actual `ZoomEmbed`, plus host controls, an "Open in Zoom" external link, and floating Q&A toasts injected directly into the Zoom in-meeting chat via `zoomEmbedRef.sendChat`.
- `EventSettingsTab.tsx`: `effectiveStreamUrl = zoomMeeting?.joinUrl || streamUrl` — Zoom's own join URL always wins over whatever's in `streamUrl` when a Zoom meeting exists. Has "Create/Refresh Zoom Meeting" buttons hitting the same `useCreateEventZoomMeeting` hook.

### Zoom SDK embed (`src/components/zoom-embed.tsx`)
This is the trickiest piece. It does **not** use `@zoom/meetingsdk/embedded` directly in the main React tree — that library crashes against React 18 internals (there's a documented React 16/17-vs-18 conflict). Instead:
- Loads the Zoom SDK inside a **same-origin iframe** pointed at a static `/zoom-meeting.html` page, sidestepping the React version conflict entirely.
- Talks to that iframe via `postMessage` with a custom protocol: `ZOOM_JOIN`, `ZOOM_LEAVE`, `ZOOM_READY`, `ZOOM_JOINED`, `ZOOM_ERROR`.
- Fetches a fresh ZAK via `/api/zoom/refresh-meeting` and a join signature via `/api/zoom/signature` before joining.
- Auto-retries once on Zoom SDK error code **200** (expired ZAK) — refreshes and rejoins automatically.
- Surfaces manual guidance for error code **3000** (a stale/already-running meeting session) with a link telling the host to go end it manually at zoom.us/meeting.

### Next.js server-side Zoom routes (`src/app/api/zoom/*`)
All use `ZOOM_SDK_KEY` / `ZOOM_SDK_SECRET` env vars:
- `POST /api/zoom/refresh-meeting` — proxies to the backend's `POST /api/v1/client/events/{eventId}/zoom`, authenticated with the user's own `accessToken` cookie. Returns a fresh `ZoomMeetingDto`.
- `POST /api/zoom/signature` — generates an HS256 JWT Meeting SDK signature for a given `meetingNumber`/`role`, used to authorize the embedded SDK join.
- `GET /api/zoom/zak` — fetches a ZAK by calling Zoom's own API directly (`GET https://api.zoom.us/v2/users/me/token?type=zak`) using a self-signed JWT. **Comment in code notes this assumes a JWT App / account-level credentials — not the Server-to-Server OAuth the backend integration uses.**
- `POST /api/zoom/end-active` — lists all currently live meetings on the account and force-ends them; meant to auto-run before a retry on SDK error 3000.
- `POST /api/zoom/enable-waiting-room` — `PATCH`es the meeting to turn on the waiting room.

**⚠️ Likely root cause worth checking first:** `zak/route.ts`, `end-active/route.ts`, and `enable-waiting-room/route.ts` all authenticate to Zoom directly using `ZOOM_SDK_KEY`/`ZOOM_SDK_SECRET` as a **JWT App**, while `refresh-meeting`/`useCreateEventZoomMeeting` go through the **backend's Server-to-Server OAuth** Zoom app instead. If these are two different Zoom apps/sets of credentials (very possible, given they were clearly built at different times), that mismatch could explain ZAK failures, 401s, or "works sometimes" flakiness. This is the single most promising lead if the bug reports involve intermittent join failures or token errors.

---

## 3. Known/logged Zoom issues (from existing docs)

Only `BACKEND_BUGS_2026-07-11.md` mentions Zoom, and only in the context of permissions, not functionality:
- `EVENT_MANAGER` role currently lacks write access to "Refresh Zoom Meeting Token" (should have it — logged as a backend permission ask, not a Zoom-functionality bug).
- `VIEWER` role's Zoom refresh endpoint needs server-side `403` enforcement (currently only hidden client-side).

**No join failures, SDK crashes, ZAK races, or embed bugs are formally logged anywhere** — those only exist as defensive comments/retry logic already built into `zoom-embed.tsx` (error 200 auto-retry, error 3000 manual-guidance). If you're being handed a fresh bug report now, it's new territory, not a re-tread of something already documented.

---

## 4. Quick file map

| Concern | File |
|---|---|
| Zoom create/refresh API hook | `src/api/client-events.ts` (`useCreateEventZoomMeeting`, `ZoomMeetingDto`) |
| Zoom data on live room snapshot | `src/api/client-live.ts` |
| Wizard toggle (AGM/General only) | `state-hooks.ts`, `AgmSteps.tsx`, `GeneralSteps.tsx` (missing from `LaunchSteps.tsx`, `HackathonSteps.tsx`) |
| Live Control Room Zoom card | `events/live/components/ZoomMeetingCard.tsx`, `SessionDetail.tsx` |
| Stream provider branching (Zoom vs YouTube vs other) | `events/live/components/StreamPreviewCard.tsx`, `stream-helpers.ts` |
| Actual Zoom SDK embed (iframe + postMessage) | `src/components/zoom-embed.tsx`, `public/zoom-meeting.html` |
| Server-side Zoom token/signature routes | `src/app/api/zoom/{refresh-meeting,signature,zak,end-active,enable-waiting-room}/route.ts` |
| "Effective" stream URL resolution | `events/[id]/components/EventSettingsTab.tsx` (`effectiveStreamUrl`) |

---

## 5. Suggested starting point

Before diving into any specific reported symptom, it's worth confirming: **which Zoom app/credentials is actually configured server-side** — the backend's Server-to-Server OAuth app, or the `ZOOM_SDK_KEY`/`ZOOM_SDK_SECRET` JWT App used by the four routes under `/api/zoom/*`. If those are two different Zoom accounts/apps, most "flaky" or "sometimes works" Zoom bugs likely trace back to that split rather than anything in the embed/UI logic.
