# Backend Feature Request — Zoom Concurrency via Host Pool - 2026-08-25

We recently migrated our Zoom credentials onto a **Zoom Business** account, which currently gives us **2 concurrent meetings** (confirmed on staging — see §1). We need to scale beyond that. This doc specifies how to lift the ceiling **without new Zoom credentials** by spreading meeting creation across a pool of licensed host users. Product decisions below are settled (chosen with the organiser); the open questions in §6 are the only things still needing a backend answer.

---

## 1. Problem — concurrent Zoom meetings capped at ~2

Every event's Zoom meeting is created by the backend's **Server-to-Server (S2S) OAuth** app via:

```text
POST /api/v1/client/events/{id}/zoom            (optionally ?forceNew=true)
```

The frontend only proxies this (`src/app/api/zoom/refresh-meeting/route.ts`) and reads the returned `ZoomMeetingDto` (`startUrl` → host ZAK, `joinUrl` → attendee `streamUrl`). Nothing client-side chooses or knows the host.

The current ceiling is **2 concurrent**, confirmed on staging: two different events' meetings were launched at the same time (client-admin on one device, event-manager on another) and both ran. The 3rd concurrent live meeting is what we need to unlock. When the ceiling is hit, the frontend surfaces it as Zoom **SDK error 3000** ("Another meeting is still running", `src/components/zoom-embed.tsx`).

That 2-meeting cap almost certainly comes from **one host user** being used for every meeting (to be confirmed — §6.5), so the platform shares that single host's allowance — notably, this Business account gives that host 2 concurrent *without* the "simultaneous meetings" setting toggled. **Adding more licensed users only raises the ceiling if the backend creates meetings under those additional users** — that distribution is the core of this request.

---

## 2. Decision — shared dynamic host pool (no new credentials)

**The key clarification: no new Zoom credentials are required.**

- An **S2S OAuth app is account-level, not user-level.** With admin-level meeting scope (`meeting:write:admin`) it can already create a meeting on behalf of **any licensed user in the account** by targeting that user's email:

  ```text
  POST /users/{hostEmail}/meetings
  ```

  The create-meeting `start_url` it returns already carries that host's ZAK, so no separate per-user ZAK fetch is needed (if you ever do fetch ZAK, use the admin variant).
- So the moment an additional **licensed** user is added to the *same* Zoom account, the **existing** S2S app can host meetings as them. **No new S2S app**, and **no change** to the Meeting SDK app (`ZOOM_SDK_KEY`/`ZOOM_SDK_SECRET` used only for the join signature — it never encodes host identity).
- **Verify, don't create:** please confirm the existing S2S app carries the admin scopes needed to act on other users (`meeting:write:admin`, plus whatever it already uses for `start_url`/ZAK). If it was originally scoped to a single user only, broaden the scopes **on the same app** — still not new credentials.

**Chosen model:**
- **Shared dynamic pool** — a configured set of licensed host emails; each new meeting is assigned to *any* host that has a free slot. Scale simply by adding emails. (Not pinned-per-org or pinned-per-event.)
- **2 slots per user** — each licensed host counts as **2** concurrent meetings. Confirmed on this Business account for **both** the current host and the new seat `oladotunolorunyomi@meristemng.com` (each starts 2 concurrent on its own, **without** the "simultaneous meetings" setting). Any *future* seat must still be verified (§5.2) and recorded at its true per-host capacity; the §3(g) fallback handles a host that unexpectedly rejects its 2nd meeting.

---

## 3. Requested backend behavior

**(a) Host pool config.** Maintain a list of licensed host emails, each with a capacity (default `2`). It should be easy to add/remove hosts without a code deploy (env list or a small admin-config table — your call, see §6).

**(b) Assignment — sticky per event.** On `POST /events/{id}/zoom`:
- If the event already has a live meeting with an assigned host → return it unchanged (idempotent, same as the 2026-07-15 contract; just a fresh ZAK).
- Otherwise pick **any host with a free slot**, create the meeting as that host (`POST /users/{hostEmail}/meetings`), **persist `event → { hostEmail, meetingId }`**, and return the DTO exactly as today.
- Stickiness matters so the idempotent refresh keeps returning the same event's meeting under the same host.

**(c) Capacity accounting.** Track active meetings per host in the backend DB as the source of truth. A host is "free" when `activeCount < capacity`.

**(d) Slot release** — free a host's slot when its meeting ends. This is what keeps the pool honest; a leaked slot shows up as false "at capacity".
- **Recommended:** subscribe to the Zoom **`meeting.ended`** webhook (and `meeting.started` for reconciliation) and decrement on `ended`.
- **Fallback / belt-and-braces:** periodic reconcile via per-host `GET /users/{hostId}/meetings?type=live` (portable on all plans) or the Dashboard `GET /metrics/meetings?type=live` (if enabled on our plan), plus a TTL so a missed webhook can't strand a slot forever.

**(e) Saturation → stable error.** When no host has a free slot, **do not create a meeting**. Return a stable, machine-readable error so the admin UI can show a clean message rather than letting the SDK fail with error 3000 downstream. Proposed:

```text
HTTP 503
{ "errorCode": "NO_HOST_CAPACITY",
  "message": "All live-meeting hosts are currently in use. Please try again shortly." }
```

**(f) forceNew.** `?forceNew=true` should end the event's existing meeting (**releasing its slot**) and re-assign a free host. If none is free after the release, return the same `NO_HOST_CAPACITY`.

**(g) Defensive fallback (because we chose 2 slots/user).** Zoom's "2 simultaneous meetings per host" has edge cases (the two can't be started from the same device/session, and Zoom occasionally rejects a host's 2nd concurrent start). So even with capacity=2 configured, if creating/starting a 2nd meeting on a chosen host fails with a concurrency error, **fall through to the next free host** instead of failing the request. Only return `NO_HOST_CAPACITY` when *every* host is genuinely saturated.

---

## 4. Contract notes (unchanged except the new error)

- `POST /events/{id}/zoom` stays **idempotent** (same meeting + fresh ZAK per call). The only additions are (i) the host it's created under is chosen from the pool and pinned to the event, and (ii) the new `NO_HOST_CAPACITY` failure mode.
- Response DTO shape is **unchanged** — FE still reads `data.startUrl` (ZAK) and `data.joinUrl` (`streamUrl`). No schema migration on the client beyond handling the new error code.

---

## 5. Zoom account setup (ops / admin console — no code)

1. **Add the additional licensed user(s)** to the **same** Zoom account that owns the current S2S + Meeting SDK apps. They must be **Licensed** (not Basic) to be reliable hosts.
   - Additional host to add to the pool: **`oladotunolorunyomi@meristemng.com`** — verified it runs 2 concurrent meetings on its own, so it enters the pool at capacity 2.
   - Current licensed-user count on the account: `<optional, for records — confirm in Zoom admin console>` (no longer blocking: the new seat independently delivers 2, so per-host capacity = 2 is confirmed).
2. **Verify each new seat also delivers 2 concurrent** before trusting it at capacity 2. `oladotunolorunyomi@meristemng.com` is **confirmed** (starts 2 on its own, no "simultaneous meetings" toggle needed). For any *future* seat, repeat the test; if one only yields 1, either enable the per-host *"Allow host to start up to 2 meetings simultaneously"* setting (`PATCH /users/{id}/settings`) or record that host as capacity **1**. Pool accounting must use **per-host capacity**, not a blanket ×2 (§3c).
3. **Confirm S2S app scopes** cover acting on other users (§2). No new app.
4. **(If using webhooks for §3d)** enable Event Subscriptions for `meeting.ended` / `meeting.started` and store the webhook secret token. This is config — *not* new OAuth credentials.

---

## 6. Open questions for backend

1. **Pool storage/ownership** — env list vs. a small admin-config table (and eventually a UI)? We're fine with env to start; a table is nicer for adding hosts without a deploy.
2. **Slot-release mechanism** — webhook (`meeting.ended`) vs. poll/TTL reconcile? This determines how quickly a freed slot becomes reusable, which tells the FE how aggressively to offer "try again."
3. **Capacity error shape** — confirm `NO_HOST_CAPACITY` + HTTP 503 (or your preferred code), and that it's returned by `POST /events/{id}/zoom` so it flows through `/api/zoom/refresh-meeting` to the client.
4. **Reservations** — is assignment always purely global (any event → any free host), or will we ever need to guarantee a slot for a specific (e.g. flagship) event? Current decision is a fully global dynamic pool; flagging in case that changes the data model.
5. **Current host usage** — does the backend today create *every* meeting under one fixed host user, or does it already rotate across users? This determines whether this is net-new pool work or extending an existing rotation, and confirms that today's 2-concurrent is one host running 2 (which is what "2 slots per user" assumes).

---

## 7. Frontend behavior (planned)

- Today the FE only reacts to the concurrency ceiling *after* the fact, via Zoom **SDK error 3000** in `zoom-embed.tsx` ("Another meeting is still running"). That path stays as a per-host safety net.
- Once the backend returns **`NO_HOST_CAPACITY`** at creation time, the FE will map that response (surfaced through `src/app/api/zoom/refresh-meeting/route.ts`) to a clear **"all live-meeting slots are in use — try again shortly"** state on the Launch / Live Control Room flow, distinct from the raw 3000 message.
- No other FE changes are needed — host identity is entirely opaque to the client. We'll align to the exact error code/shape once confirmed (item 6.3) and add a dated "frontend aligned" note here.

---

## 8. Frontend aligned — 2026-08-26 ✅

Backend confirmed (mvp.md item 75) the pool is built and the saturation contract is **exactly as proposed in §3(e)**: `HTTP 503` with a stable machine code. One field-name reconciliation: our §3(e) draft wrote `errorCode`, but the backend's error envelope auto-derives the field as **`code: "NO_HOST_CAPACITY"`** (with the human string in `message` / `error`). The FE keys off `code` and treats a 503 whose message matches capacity wording as a fallback, so both spellings are covered.

Shipped on the frontend:

- **`src/app/api/zoom/refresh-meeting/route.ts`** — the proxy now forwards the backend `code` (and prefers `message ?? error`) on failure, instead of collapsing everything to a generic `error` string. Without this the client could never see `NO_HOST_CAPACITY`.
- **`src/components/zoom-embed.tsx`** — the meeting-refresh failure path detects `code === "NO_HOST_CAPACITY"` (or a capacity-worded 503) and raises a dedicated state. The error card now renders **"All live-meeting slots are in use"** with a transient "wait a moment and press Try again" explanation, visually distinct from the per-host SDK **error 3000** card (which stays as the after-the-fact safety net). **Try again** on a capacity error force-refreshes so the backend re-attempts host-pool assignment immediately (a slot may have freed up), rather than dropping back to idle.

Still **ops-owned, not FE** (blocks the feature from actually delivering >2 concurrent):

- The host pool **starts empty** — until ops registers licensed host emails (at minimum `oladotunolorunyomi@meristemng.com`, §5), *every* launch returns `NO_HOST_CAPACITY`. The FE will surface that cleanly, but concurrency won't rise until hosts are registered and S2S admin scopes are confirmed (§5.3).

---

## 9. Frontend follow-up — settings polish, super-admin ops page, create-event decoupling — 2026-08-30

This pass integrated the Zoom items from the `certificate.md` handoff (§7f/§7c/§7a). Nothing here breaks today's contract; the new admin surfaces **degrade gracefully** and light up automatically once the endpoints below ship.

### 9.1 Shipped now (back-compatible against today's backend)

- **Event Settings → Zoom (`EventSettingsTab.tsx`, `client-events.ts`).**
  - **`forceNew` is now wired.** The existing *Refresh* action calls `forceNew=false` (idempotent — fresh ZAK, no re-assignment). A new, **confirm-guarded** *Regenerate meeting* action calls `forceNew=true` (per §3f it ends + re-assigns, **stranding connected users** — hence the confirm).
  - **503 → clean copy.** `useCreateEventZoomMeeting` now special-cases a `503` on create to show *"No Zoom host capacity — all shared hosts are in use…"* instead of the generic failure toast (mirrors the §8 launch-flow treatment, now on the settings surface too).
  - **`ZoomMeetingDto.hostZak`** is read as a tolerant passthrough if present; treated as short-lived (never cached), alongside the existing `startUrl`. A distinct **"Start as Host"** link (`startUrl`) is shown separately from the attendee `joinUrl`.

### 9.2 New super-admin page — **needs backend endpoints to activate**

Built `/(dashboard)/admin/zoom-sessions` (super-admin-gated; new sidebar item under **Operations**). It shows pool totals, every held slot, per-row **Release**, and a manual **Assign** control. **It calls the endpoints below.** They **do not exist yet** — the page detects `404/501` and renders a friendly *"activates once the backend Zoom capacity endpoints are deployed"* state, so shipping these lights it up with **zero further FE changes** (the parser is field-name tolerant / snake_case-friendly).

> This realises the "eventually a UI" half of **§6.1**. Please confirm the paths/shapes or tell us your preferred contract and we'll align.

**(a) `GET /api/v1/admin/zoom-sessions`** — current pool state. Expected envelope (`{ data: … }` or bare):
```jsonc
{
  "sessions": [
    {
      "eventId": "…", "eventTitle": "…",
      "orgName": "…", "registrarName": "…",
      "pooledAccount": "host@meristemng.com",   // the assigned host email/label
      "meetingId": 123456789,
      "joinUrl": "https://…", "startUrl": "https://…",   // startUrl optional
      "durationMinutes": 120,
      "eventStatus": "LIVE",
      "live": true,        // meeting currently in progress
      "stranded": false,   // slot still held by an ended/cancelled event (capacity leak)
      "assignedAt": "…", "expiresAt": "…"   // optional
    }
  ],
  "totals": { "totalCapacity": 4, "slotsInUse": 1, "slotsFree": 3, "strandedSlots": 0 }
}
```
The FE derives `slotsInUse`/`strandedSlots`/`slotsFree` from the rows if `totals` is omitted, so a bare `sessions` array (or `{ content: [...] }`) also works — but returning `totals` (esp. `totalCapacity`) is preferred so the summary shows the real ceiling. The `stranded` flag is the key operational signal (it's exactly the leaked-slot condition §3d guards against).

**(b) `DELETE /api/v1/admin/zoom-sessions/{eventId}`** — release the slot that event holds (frees the host; same effect as an admin-initiated slot release from §3d). Confirm-guarded on the FE.

**(c) `POST /api/v1/admin/zoom-sessions/{eventId}/assign?durationMinutes=120`** — manually assign a pooled host to an event. Should return the same **`503 NO_HOST_CAPACITY`** as §3e when saturated; the FE already renders the capacity message for a 503 here.

### 9.3 Deferred FE cleanup — create-event decoupling (§7a), gated on your confirmation

Today the create flow still sends **`enableZoomMeeting` + `zoomDurationMinutes`** (and a placeholder `streamUrl` for virtual/hybrid Zoom events) in `events/create/page.tsx`, because that's what makes *today's* backend auto-provision the meeting. We are **intentionally not removing this yet** — dropping it before the host-pool create-path is live would 400 VIRTUAL/HYBRID creation.

**Ask:** once the pool is deployed, does create-event still need `enableZoomMeeting`/`zoomDurationMinutes`, or does the backend provision (or lazily assign on first launch) on its own? When you confirm it's no longer required, the FE will drop those fields from the create payload and make `streamUrl` optional. Until then, no change.

### 9.4 Verified, no change (§7g)

Every Join/preview surface already guards a null/empty `streamUrl` (`StreamPreviewCard` renders a placeholder state; `EventOverviewTab` gates the stream block on `event.streamUrl`). No work needed.

