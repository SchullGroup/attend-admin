# Frontend — Zoom webinars wired up, and one blocker (2026-09-26)

Reply to "Zoom Webinars alongside meetings, on one licence (2026-09-26)". **The admin frontend is
built against the contract as written and compiles clean.** Every shape you flagged as *Differs* was
taken as yours, not ours.

| # | Item | Status |
|---|------|--------|
| 1 | Host pool `type`, list in `data`, `bookedCount` | ✅ Wired |
| 2 | Availability endpoint, always 200, answer in `data` | ✅ Wired, incl. the 30-minute buffer |
| 3 | `POST …/zoom?type=WEBINAR`, `type` + `webinarId` on the DTO | ✅ Wired |
| 4 | `409` conflict object **in `data`** | ✅ Read from `data`, not top level |
| 5 | Panelist endpoints | ✅ Wired — picker over team and attendees |
| 6 | Webinar calendar from `sessions[]` | ✅ Wired, filtered to `type === "WEBINAR"` |
| 7 | Pool totals are meetings-only | ✅ Host-pool totals now match |
| ❗ | **Creating a webinar returns `ZOOM_WEBINAR_FAILED`** | **Blocked — see below** |

---

## The blocker

```jsonc
{ "code": "ZOOM_WEBINAR_FAILED",
  "error": "Zoom webinar failed",
  "message": "The webinar slot is free but Zoom refused to create the webinar…",
  "referenceId": "3abd2f75-d6d0-4403-8ba5-a5447603bfbf",
  "requestTime": "2026-09-26 19:03:56" }
```

Your error handling is doing exactly what it should — this is not reported to the organiser as a
date clash, and our UI says so too. But it tells us something useful about where setup stands.

**A webinar host row exists.** The availability check returned `available: true`, not
`NO_WEBINAR_HOST`, so step 3 of [Before this works](#) is done — a `type: "WEBINAR"` host is in the
pool and the booking window was free. Zoom itself then refused.

That leaves steps 1 and 2: either the Zoom user behind that host row **does not actually hold the
webinar licence**, or the Server-to-Server OAuth app is **missing `webinar:write:admin`**. From our
side those two are indistinguishable, which is the problem below.

### Ask 1 — put Zoom's own reason in the message

The message we get is generic. Zoom's API returns a specific code and reason on refusal (a missing
plan, a missing scope, and a user who is not licensed all come back differently). You already do
this for `ZOOM_REJECTED_PANELIST`, where the message carries Zoom's wording — please do the same
here. Right now a super admin cannot tell "buy the licence" from "add the scope" without reading
server logs, and those are the two most likely causes of the only error they will ever see.

`referenceId` is in the response, so if it is easier to keep Zoom's raw reason out of a client-facing
message, tell us where to look it up and we will show the reference to the super admin instead.

### Ask 2 — a way to check a webinar host is actually usable

Adding a host to the pool currently succeeds whether or not the account behind it can run webinars.
The first time anyone finds out is when an organiser tries to create one, which on our timeline
could be the day of an AGM.

Could `POST /api/v1/admin/zoom-hosts` with `type: "WEBINAR"` validate against Zoom before accepting —
or, failing that, give us a `GET /api/v1/admin/zoom-hosts/{id}/check` that reports back whether the
licence and scope are both present? A green tick on the host row in Zoom Sessions is worth a lot
more than an error at booking time.

### Ask 3 — confirm where setup actually stands

Which of the four steps are done on the Zoom account right now? We are assuming 3 is done and 1 or 2
is not, but you can see that directly and we cannot.

---

## What the admin app does now

**Event → Settings** shows two cards where there was one button: **Create Zoom Meeting** and
**Create Webinar**, each stating the practical difference rather than Zoom's vocabulary.

- The webinar button is disabled, with the reason shown, when there is no saved date/start time,
  when `NO_WEBINAR_HOST` comes back, or while the check is in flight.
- On `WEBINAR_SLOT_TAKEN` we show the booked window, whether it is the organiser's own event (linked)
  or another organisation's (window only, no name — your privacy rule), and the buffer applied:
  *"the licence is free again from 12:30"*. Then the three ways forward: move the event, contact a
  super admin, or create a standard meeting.
- `type` is **omitted** on a plain refresh, so refreshing a webinar's ZAK cannot trip
  `ZOOM_TYPE_MISMATCH`.
- Switching between meeting and webinar is a separate, confirm-guarded action that spells out what
  changes in each direction — panelists cleared one way, attendees losing their microphones the other.

**Panelists** are managed entirely inside Attend. Details below, since it also answers a question we
had internally.

**Zoom Sessions** splits into *Meeting hosts* and *Webinar licences — one webinar at a time each*,
with the type fixed at creation and capacity pinned to 1 for webinars. Under it, **Webinar bookings**
— the upcoming schedule grouped by day, built from `sessions[]`, showing the free-from time after
each booking.

---

## Panelists: where they are managed

Worth stating plainly because it shaped the UI. **Panelists are added and viewed in Attend, not in
the Zoom portal.** The card lists the current panelists and offers a search over the organisation's
team and the event's registered attendees; choosing a person sends the exact email on their Attend
account, so the match Zoom needs is right by construction rather than by careful typing. Free text
stays for an external speaker with no Attend account, with a warning that they must join with that
exact address.

One consequence of the API shape, not a complaint: **the panelist list only exists once the webinar
does**, because Zoom's panelist endpoints are keyed on a webinar id. So the card appears after the
webinar is created, not while the organiser is still choosing between meeting and webinar. If you
ever wanted panelists selectable *before* creation, that would mean holding them on the event and
pushing them to Zoom at create time — not asking for it, just flagging that today the order is fixed.

We also kept your note visible in the UI: adding a panelist while the webinar is live does not
promote them, so the card points the host at the in-client Participants panel for that.

---

## Still ours to do

Web and mobile joining: mandatory `userEmail`, `role: 0` for attendees **and** panelists, and
view-only controls driven by `zoomType`. Not started — it is next once the admin side can actually
produce a webinar to join.
