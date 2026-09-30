# Backend — one field to make webinars startable: `hostEmail` (2026-09-29)

Good news first: **the webinar licence and scopes are working.** Creating a webinar now succeeds.
The failure has moved one step later, to the host starting it.

```
Failed to join meeting
Please use host/alternative email to start the webinar. (code 3624)
```

**This was our bug and it is now fixed on our side — except for one field only you can supply.**

---

## What 3624 means

A webinar join is not a meeting join. Zoom's Meeting SDK docs are explicit: for webinars you must
also pass `userEmail`, and to **start** one, that address must be the webinar's own host account.
The ZAK alone is not enough — Zoom checks both, and answers 3624 when the email is missing or
belongs to someone else.

Our embed never sent `userEmail` at all; it was written for meetings, where the field is optional.
That is fixed: the SDK page, the embed component and the Live Control Room now pass it through.

## What we need

**`hostEmail` on the `zoomMeeting` object** — the address of the pooled Zoom account that owns the
session.

```jsonc
{
  "type": "WEBINAR",
  "meetingId": 12345678901,
  "webinarId": 12345678901,
  "hostEmail": "itprogrammers@meristemng.com",   // ← this
  "password": "…", "joinUrl": "…", "startUrl": "…", "hostZak": "…", "durationMinutes": 120
}
```

**This is not a per-event input.** You already choose the pooled host when the session is created,
and you already expose exactly this value to super admins as `pooledAccount` on
`GET /api/v1/admin/zoom-sessions`. It is the same value on a different response — nobody has to
type it, and nothing changes about how a webinar is created.

### Three places, because the live page does not read the create response

| Endpoint | Why |
|---|---|
| `POST /api/v1/client/events/{id}/zoom` | The create/refresh response |
| `GET /api/v1/client/live/{eventId}` | **What the Live Control Room actually reads** — the host starts the webinar from here |
| `GET /api/v1/client/events/{id}` | The fallback when the live room has not loaded |

The second one is the one that matters most. Our Zoom card reads `room.zoomMeeting` and falls back
to the event detail; it never sees the create response again after the session exists.

### Please return it for meetings too

Not required — a meeting host start works without it — but returning it unconditionally means one
rule rather than two, and lets us show an organiser which pooled account their session is on when
something goes wrong.

### On refresh

We adopt the refreshed identity wholesale, so if `forceNew` or a refresh moves the session to a
different pooled host, please return that host's `hostEmail` with it. We already handle that:
the email is adopted alongside the ZAK, so a rotated host works without another change here.

---

## What happens until then

The organiser gets the 3624 message with a plain-language explanation that retrying will not help
and that the backend needs to return `hostEmail`. Nothing is broken beyond the host start — the
webinar exists, attendees can join by URL, panelists can be managed.

---

## Second item: one question about the panelist list

Not a bug — we checked. `GET /api/v1/client/events/{eventId}/zoom/panelists` answers correctly:

```jsonc
{ "data": [], "message": "Panelists retrieved.", "status": true }
```

The list is genuinely empty because nobody has been added yet, and the card now says so rather
than implying a failure.

**The question we do have:** does that endpoint return only panelists added **through Attend**, or
does it read the live list from Zoom?

If it is our own table, a panelist added directly in the Zoom portal will never appear in Attend,
and the two lists can drift apart without anyone noticing. On the day that matters, an organiser
who added a board member in the wrong place sees an empty list here, assumes it did not take, and
either adds them twice or leaves them as a view-only attendee. If it is our table by design, say
so and we will put that in the UI — "panelists added here", not "the panelists".

Response shape we read, for reference (we also accept `{ "panelists": [...] }`):

```jsonc
[{ "id": "…", "email": "…", "name": "…", "addedAt": "…" }]
```

---

## Still ours after this

Web and mobile joining: mandatory `userEmail` for attendees and panelists, `role: 0` for both, and
view-only controls driven by `zoomType`. Unchanged from the last note — and the same `userEmail`
rule that caused 3624 applies there, so it is worth doing directly after this.
