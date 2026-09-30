# Backend — panelists added in Attend aren't reaching Zoom (2026-09-30)

Webinars are working end to end now — host start, attendee join, polls, Q&A. The one thing left:
**a panelist added in Attend does not become a functional panelist in the live webinar.** The
organiser has to promote them from the Zoom Participants panel instead.

The frontend is doing its part: it `POST`s `{ email, name }` to
`/api/v1/client/events/{eventId}/zoom/panelists`, the call returns 2xx, and the person appears in
the list. So the add reaches Attend's table. What isn't happening is the push to **Zoom's** panelist
list.

Two things are visible in the same screenshot, and they may be independent — please check both.

---

## 1. "Zoom couldn't be reached" — the merge read is failing

The panelist card is showing our `onZoom: null` state:

> Zoom couldn't be reached, so this list is Attend's record only — it hasn't been checked against
> Zoom's own panelist list.

That is the banner we render when every entry comes back `onZoom: null`, which per your contract
means the merge couldn't reach Zoom. If the **read** can't reach Zoom, the **write** on add almost
certainly can't either — which would mean the panelist was written to Attend's table and never
pushed to the webinar. That matches exactly what the organiser sees: present in Attend, absent as a
real panelist.

**What would help:** the add for Ekezie Chinoyerem (`westworld476@gmail.com`) returned a
`referenceId` — could you check the server log for that panelist `POST` and the subsequent merge
`GET`, and confirm whether the Zoom call is erroring, and with what? The likely candidates are the
same family as before: a missing scope on the panelist API, or a token/host mismatch. If the add
succeeded on Attend but the Zoom `POST /webinars/{id}/panelists` failed, that failure is currently
silent to us — the add still returns 200.

**One request either way:** if the Zoom push fails, please don't return the add as a plain success.
A distinct signal (an error, or the returned panelist carrying `onZoom: false`) lets us tell the
organiser "saved, but not yet on Zoom — retry" instead of showing a confident "Panelist added."

---

## 2. Adding while the webinar is already live never promotes — this part is expected

The screenshot is of a **live** webinar (the Zoom toolbar and an open poll are visible). Zoom does
not promote a panelist added through the API mid-session — they stay a view-only attendee until they
leave and rejoin. This is Zoom's own limitation, it is documented on our panelist card, and it is
**not** a bug on either side.

So if the test was "start the webinar, then add a panelist, expect them to be able to speak," the
Participants-panel promotion is the correct path and always will be. The API path is for panelists
added **before** the webinar starts.

**Worth confirming which case this was:** if Ekezie was added before the webinar went live and still
didn't get panelist rights on join, that points at #1. If added after, #2 explains it and only the
"Zoom couldn't be reached" banner needs chasing.

---

## What we'll do on our side once #1 is resolved

Nothing further is needed from us for the happy path — the card already surfaces `onZoom: false` as
a warning and points to the Participants panel for mid-live promotion. If you add the
"push failed" signal in #1, we'll wire the add to show a retry state rather than a false success.

## How to tell it's fixed

Add a panelist in Attend to a webinar that is **not yet live**, then reload the card: the entry
should come back `source: "ATTEND"`, `onZoom: true`, and no "Zoom couldn't be reached" banner. Then
starting the webinar and joining as that person should land them as a panelist.
