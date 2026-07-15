# Participant Zoom Join — Implementation Context

**Audience:** the participant web team (Next.js — same stack as attend-admin) and the participant app team (Expo/React Native).
**Date:** 2026-07-14. Written after the admin-side embed was rebuilt and stabilized; the admin repo (`attend-admin`) is the working reference implementation.

## 1. What participants do, and what already exists

Participants join the event's Zoom meeting **as attendees (role 0)** from inside your platform. The host runs the meeting from the admin Live Control Room, which now has a fully working embedded Zoom client — including admitting people from the waiting room. Your side only needs to get participants *into* the meeting; everything host-side is handled.

What you already have available per event:

- `streamUrl` from the participant API — for Zoom events this is the meeting **joinUrl**, e.g. `https://zoom.us/j/82194621056?pwd=abc123`. This is your single source of Zoom data: parse the meeting number from the `/j/{number}` path segment and the password from the `pwd` query param. (Admin reference: `parseZoomUrl()` in `src/components/zoom-embed.tsx`.)
- ⚠️ **CORRECTION (2026-07-15): the backend does NOT yet have a signature endpoint** — backend confirmed zero Meeting SDK signature code exists on their side (an earlier version of this doc assumed otherwise). Until backend ships one, the **web** team can do what the admin app does: host the signature route in your own Next.js server (`src/app/api/zoom/signature/route.ts` in attend-admin is a working reference — ~50 lines, HS256 JWT) with the Meeting SDK key/secret in server env only. The **mobile** team has no server, so the app embed is **hard-blocked on the backend endpoint** (creds + spec handoff is in progress — tracked in `PENDING_BACKEND_FIXES.md`). Request **role 0** for participants. Never put the SDK secret in a web bundle or app binary.
- Participants do **not** need a ZAK token. ZAK is host-only; it's how the admin embed claims host rights. Attendee join = meeting number + password + role-0 signature + display name.

## 2. Shared behavior: fetch fresh, retry once

**Update 2026-07-15: the meeting-rotation bug is fixed** — the backend's `POST /zoom` is now idempotent (same meeting + fresh host token every call), so `streamUrl` no longer changes underneath attendees in normal operation. Still build both clients to:

1. Fetch `streamUrl` **immediately before** joining — never join from a long-cached value.
2. If the join fails with "meeting not found / invalid / ended", re-fetch `streamUrl` once and retry before showing an error.

It's cheap insurance: an admin can still deliberately replace a broken meeting (`?forceNew=true`), and the pattern makes that seamless for attendees too.

Waiting room: attendees may land in a waiting room rather than straight in the meeting. Both the Zoom web Client View and the native SDKs render the "waiting for the host to let you in" screen automatically — you don't build anything, but don't treat that state as a failure or timeout. The host sees and admits them from the admin embed.

## 3. Web platform (Next.js) — mirror the admin architecture

The admin implementation is the blueprint; lift it nearly wholesale. Three files matter:

| Piece | Admin reference file |
|---|---|
| Static iframe page hosting Zoom's **Client View** | `public/zoom-meeting.html` |
| React wrapper (iframe lifecycle + postMessage protocol) | `src/components/zoom-embed.tsx` |
| COOP/COEP headers (Next 16 middleware) | `src/proxy.ts` |

**Why this shape — learn from our scars:**

- **Use the Client View (`ZoomMtg`), not the Component View (`ZoomMtgEmbedded`).** We shipped the Component View first: it needs constant manual sizing, defaults to ribbon view, and its participants/settings popovers were effectively unusable. The Client View is the full Zoom web client (real toolbar, panels, self-sizing) and made all of that disappear.
- **Host it in a dedicated same-origin iframe** (a static HTML page, not a React route). Two reasons: the Client View "takes over the page" by design, and the iframe scopes that takeover to your embed card; and the SDK bundles its own React that conflicts with React 18+ if loaded in your app tree.
- **Set COOP/COEP on both the iframe page AND the parent page** — `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: credentialless`, scoped in middleware to just those routes. Headers on the iframe alone do nothing; without both, `crossOriginIsolated` stays false and gallery view silently degrades. Any other cross-origin iframes on the same page (e.g. YouTube) need the `credentialless` iframe attribute or they'll be blocked. The admin page prints `crossOriginIsolated: true/false` on screen during load — copy that debug line, it saves hours.
- **Patch `focus()` to `preventScroll` inside the iframe page, before the SDK loads.** Zoom's menus move focus when they open, and the browser scrolls the parent page to reveal the focused element — the page visibly jumps on every menu click. See the patch at the top of `zoom-meeting.html`.
- **Handle leave via `leaveUrl`.** The Client View navigates the iframe to `leaveUrl` after any leave (yours or Zoom's own button). Point it at the same page with `?left=1`, postMessage the parent, reset your UI. Also cache-bust the iframe src (`?t=Date.now()`) on every launch so relaunches get a fresh page.

**Differences from the admin embed (all simplifications):** signature comes from the backend participant endpoint with `role: 0` (admin generates it locally with server env secrets — don't copy that part); no ZAK anywhere; no meeting-refresh path (that's host-only — your recovery is the fetch-fresh-and-retry pattern from §2); display name from the participant's profile.

The postMessage protocol worth keeping (parent ↔ iframe): `ZOOM_JOIN` (join params in), `ZOOM_READY`, `ZOOM_JOINED`, `ZOOM_ERROR`, `ZOOM_LEFT` (state out).

## 4. Expo app — native Meeting SDK embed

You chose in-app embedding, which means the **native Zoom Meeting SDK** (iOS `MobileRTC` / Android `mobilertc`), not the web SDK. Do **not** attempt the web Client View inside a WebView — Zoom doesn't support it and mic/camera/isolation are broken enough in WebViews (especially iOS) that it's a dead end.

What this implies for an Expo project:

- **Custom dev client / EAS builds, not Expo Go.** The SDK is a native module: `npx expo prebuild` (or a config plugin) to add the iOS/Android SDKs, plus camera/microphone permission entries (`NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, Android runtime permissions). Budget for meaningful binary-size increase and native build debugging.
- **Bridge or wrapper:** Zoom's first-party React Native package targets their *Video* SDK (different product — raw video rooms, no Zoom meeting UI). For the *Meeting* SDK you'll either write a thin native module around the iOS/Android SDKs or use a community wrapper — evaluate carefully; this is the riskiest part of the build. The native SDKs give you Zoom's complete native meeting UI (toolbar, waiting room, participants) for free once join works.
- **⚠️ Auth JWT shape differs from web.** The web signature includes `mn` (meeting number) and `role` claims; the **native** SDK auth JWT does not — it's `{ appKey, iat, exp, tokenExp }` signed with the same SDK secret, and meeting number/password go into the join call instead. Verify against current Zoom docs, then check whether the existing backend signature endpoint can issue this variant (e.g. a `platform=native` param). This is the first integration blocker to clear — do it before writing any native code.
- **Join call:** meeting number + password (parsed from `streamUrl`, same as web) + display name + the native auth JWT. Role is implicit (attendee) when no host credentials are supplied.
- **Interim/fallback path:** `Linking.openURL(streamUrl)` deep-links into the installed Zoom app. Works today, works in Expo Go, and is a sane fallback if the native SDK fails at runtime or the build isn't ready. Recommended to ship behind the embed as a "having trouble? open in Zoom" escape hatch even after the native embed works.

## 5. Zoom account/app facts you inherit

- All meetings are created by the backend via a **Server-to-Server OAuth** Zoom app; the Meeting SDK signature uses a **Meeting SDK app's** credentials (`ZOOM_SDK_KEY`/`ZOOM_SDK_SECRET` server-side). You never talk to Zoom's REST API from clients — everything you need arrives via `streamUrl` + the signature endpoint.
- Web SDK version currently pinned at **6.2.0** (CDN). Zoom enforces minimum SDK versions **quarterly** (web and native) — check the current floor when you start, and expect to bump versions on a schedule, not "when it breaks".
- Zoom killed JWT apps in 2023. If you find sample code authenticating to `api.zoom.us` with a self-signed JWT (old tutorials are full of it), it cannot work — that's what the signature endpoint and backend exist for.

## 6. Test checklist before shipping

1. Attendee joins → lands in waiting room → host admits from the admin Live Control Room → attendee enters. (The end-to-end that used to be broken — test it first.)
2. Join with a deliberately stale `streamUrl` (have the admin regenerate the meeting first) → your retry logic recovers without user-visible error.
3. Web: debug line shows `crossOriginIsolated: true`; gallery view offers multiple tiles with 3+ participants.
4. Web: open every toolbar menu — page must not scroll-jump; leave via Zoom's own Leave button — your UI must reset.
5. Leave → rejoin twice in a row (catches zombie-session and stale-iframe bugs we hit on admin).
6. App: mic/camera permission prompts appear at the right moment; join works on physical iOS and Android devices (simulators lie about media).
7. Reload/kill the app or tab mid-meeting and rejoin — expect your previous session to linger as a ghost participant for a minute or two; make sure rejoin still works.

## 7. Backend dependencies — status as of 2026-07-15

1. **`POST /events/{id}/zoom` idempotency** — ✅ FIXED. Same meeting + fresh ZAK on every call; rotation only via explicit `?forceNew=true`.
2. **Waiting room at creation** — ✅ was never broken; `settings.waiting_room: true` is set by the backend at creation.
3. **Signature endpoint (web role-0 + native JWT variant)** — 🔲 OPEN, and bigger than previously thought: no signature endpoint exists at all backend-side. Mobile embed is hard-blocked on it; web can self-host in the interim (see §1 correction). Backend needs a Meeting SDK app key/secret plus the token-shape spec — handoff tracked in attend-admin's `PENDING_BACKEND_FIXES.md`.
