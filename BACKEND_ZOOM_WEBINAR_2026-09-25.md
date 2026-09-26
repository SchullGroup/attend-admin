# Backend — Zoom Webinars alongside meetings, on one licence (2026-09-25)

We want organisers to choose, per event, between a **Zoom Meeting** and a **Zoom Webinar**. Two
buttons where there is one today.

The whole design is shaped by one fact: **we have exactly one webinar-licensed Zoom account, and it
can run one webinar at a time.** Everything below follows from that. A meeting can be allocated
when the host presses Launch, because the pool has several seats and spare capacity. A webinar
cannot — with a single slot, "find out at launch" means discovering during an AGM, with
shareholders already waiting, that the slot is held by another registrar.

So the central ask is: **the webinar slot is reserved when the event is scheduled, not when it
starts.**

**Summary: 1 new field on the host pool, 1 availability endpoint, 1 new param on the existing
create-zoom call, 1 panelist endpoint, and a `type` field on the meeting DTO.**

---

## 1. Split the host pool into two sections

The pool already models this well — hosts with capacity, added self-service by a super admin. We
want the same thing, sectioned by what each account can run:

```
GET /api/v1/admin/zoom-hosts
```

```jsonc
{
  "hosts": [
    { "id": "…", "email": "meetings1@…", "type": "MEETING", "capacity": 2, "activeCount": 1 },
    { "id": "…", "email": "webinar@…",   "type": "WEBINAR", "capacity": 1, "activeCount": 0 }
  ]
}
```

- `type: "MEETING" | "WEBINAR"` (or `capabilities: ["MEETING", "WEBINAR"]` if an account can do
  both — say which you prefer and we will read it either way).
- `POST /api/v1/admin/zoom-hosts` accepts `type` on create, so when a second webinar licence is
  bought a super admin just adds the email and capacity goes from 1 to 2. **No deploy, no dev
  involvement** — the same promise the meeting pool already makes.
- `PATCH`/`DELETE` unchanged.

Super admin then sees two sections on the Zoom Sessions screen: **Meeting hosts** and **Webinar
hosts**, each with its own capacity line. That is the whole super-admin story — they oversee and
provision, they do not gatekeep individual bookings.

---

## 2. Booking: reserve at scheduling time

Client admins create webinars themselves, as they do meetings today. No approval workflow.

### 2.1 Availability check

```
GET /api/v1/client/webinar-availability?date=2026-10-20&startTime=09:00&durationMinutes=180
```

```jsonc
{ "available": true }

{ "available": false,
  "conflict": { "date": "2026-10-20", "startTime": "08:00", "endsAt": "12:00", "sameOrganisation": false } }
```

We call this as the organiser fills the form, so the Webinar button can be disabled with a reason
*before* they commit — not after.

**One privacy note:** if the clashing event belongs to a different registrar, please do **not**
return its title or organisation name. A Meristem admin should learn "the slot is taken 08:00–12:00
that day", not which competitor is holding it. When `sameOrganisation` is true, feel free to
include the event title and id so we can link straight to it.

### 2.2 Creating it

Extend the call we already use rather than adding a second one:

```
POST /api/v1/client/events/{eventId}/zoom?type=WEBINAR&durationMinutes=180
```

`type` defaults to `MEETING`, so every existing caller keeps working untouched.

Response — the current `ZoomMeetingDto` plus two fields:

```jsonc
{
  "type": "WEBINAR",              // NEW — every consumer needs to know which it is
  "meetingId": 12345678901,       // the webinar id goes here; the SDK takes it in the same slot
  "webinarId": 12345678901,       // NEW — optional, but useful for support and logs
  "password": "…",
  "joinUrl": "…",
  "startUrl": "…",
  "hostZak": "…",
  "durationMinutes": 180
}
```

`type` matters more than it looks. Admin, web and mobile all branch on it: a webinar attendee has
no camera or microphone, so the join UI must not offer them.

### 2.3 When the slot is taken

```
409 Conflict
{ "status": false, "error": "WEBINAR_SLOT_TAKEN",
  "message": "The webinar host is booked from 08:00 to 12:00 on 20 Oct 2026.",
  "conflict": { "date": "2026-10-20", "startTime": "08:00", "endsAt": "12:00", "sameOrganisation": false } }
```

We show the organiser the window, and three ways forward: **wait and try another time**, **contact
a super admin** (about buying another licence), or **create a standard Zoom meeting instead**. We
will *not* silently downgrade to a meeting — in a live AGM the difference is whether 400
shareholders can unmute themselves, and that is not a decision to make on someone's behalf.

Please use `409` with a distinct code rather than the pool's existing `503 NO_HOST_CAPACITY`. They
mean different things: 503 is "try again in a minute", this is "that date is taken".

### 2.4 Releasing the slot

The reservation should be freed when the event is **cancelled**, **ended**, or its **date or time
is changed** (in which case re-check availability and reject the date change with the same 409 if
the new window clashes). The meeting pool already has a stranded-slot problem where ended events
keep holding capacity — with one webinar slot, the same drift means the licence is permanently
unusable. Worth being strict here.

---

## 3. Panelists and registration

**James's question: does registration affect how panelists join, assuming they sign up to Attend
with their normal email?**

Short answer: the identifying key is the **email**, either way. Zoom decides panelist vs attendee
by matching the `userEmail` passed at join against the webinar's panelist list — Zoom's own staff
put it plainly: *"To have panelists join pass in role 0 to the signature, and the panelist email as
the userEmail value"*, and the email must already be on the webinar's panelist list.

So:

- A panelist whose Attend email is on the Zoom panelist list joins as a panelist.
- The same person with a different email joins as a view-only attendee.
- **Panelists use `role: 0`, not `role: 1`.** Only the host starting the webinar uses `role: 1`
  with the ZAK. This surprised us and is worth stating for anyone touching the SDK.
- `userEmail` is **mandatory for every webinar join**, panelist or attendee — unlike meetings,
  where it is optional.

**Our recommendation: leave registration OFF.** Since identification is by email regardless,
registration buys us Zoom-side reporting we already have in Attend, and costs a registrant token
(`tk`) minted per attendee — which is the single largest chunk of work on mobile and web. If you
disagree, say so before we build the join flow.

### 3.1 Panelist endpoint

```
POST   /api/v1/client/events/{eventId}/zoom/panelists   { "email": "…", "name": "…" }
GET    /api/v1/client/events/{eventId}/zoom/panelists
DELETE /api/v1/client/events/{eventId}/zoom/panelists/{panelistId}
```

For an AGM the panelists are the chairman, the board, and the registrar's own staff — people we
already know in the event. Only valid for events whose Zoom entity is a `WEBINAR`; return `400` on
a meeting. These map onto Zoom's own panelist API (`POST`/`GET`/`DELETE
/webinars/{webinarId}/panelists`), which takes nothing but a name and an email.

### 3.2 Panelists are ordinary Attend accounts — no Zoom account needed

This is the part that makes the feature ours rather than a trip to the Zoom portal. Zoom's panelist
list is just names and email addresses: **a panelist needs no Zoom account and no licence.** So any
Attend-registered user can be made a panelist by pushing the email already on their Attend profile.

Which means the admin UI should not be a box you type emails into. It should be a picker over
people the event already knows — the organisation's team, the event's speakers, its registered
attendees — where selecting someone sends their Attend email to Zoom. The organiser picks *Chinedu
Stephen*, not `ogbulachistephen@gmail.com`, and the email match Zoom needs is then correct by
construction instead of by careful typing. Keep a free-text email field as the escape hatch for an
external guest speaker with no Attend account.

Two things for the picker. Zoom caps panelists per webinar (100 on most webinar plans — worth
confirming against our tier; the published docs do not state it cleanly). And since identification
is purely by email, **a panelist who later changes their Attend email silently demotes to a
view-only attendee** — so the panelist list should be re-synced when a panelist's email changes,
which the backend is far better placed to notice than we are.

### 3.3 The one thing the API cannot do: promote mid-webinar

Adding someone to the panelist list while the webinar is live **does not promote them**. Zoom staff
are explicit: the add-panelist API *"won't disconnect a user from the webinar, but you can use it
to add someone who is attending a webinar as a panelist. They would then have to leave and rejoin
the webinar to be a panelist."* There is no SDK call for seamless promotion either.

For an AGM that matters — a shareholder is recognised from the floor and needs to speak, and
"please leave and rejoin" is a poor answer with 400 people watching.

The good news is the escape hatch already exists and costs nothing. Our Zoom embed uses the
**client view** — the full Zoom web client — so the host has the native Participants panel inside
our page, and in-meeting promotion through that panel is seamless. So: the API manages the panelist
list set up before the event, and the host's own panel handles promoting someone on the day.
Nothing for the backend to build for the live case; it just needs saying out loud so nobody specs
an API Zoom does not offer.

### 3.4 A risk worth testing early

There are long-standing reports of panelists landing in the **view-only attendee view** on first
join despite a correct role and matching email, with a leave-and-rejoin as the workaround. Zoom
opened an internal ticket on it. It may be long fixed — but please let us test a real panelist join
on the licensed account before anyone promises a client a board member can speak. If it reproduces,
we would rather know now than during a rehearsal.

---

## 4. What changes on each surface

### Admin dashboard (attend-admin)

- **Event → Settings**: the single "Generate Zoom Meeting" becomes two buttons, **Create Zoom
  Meeting** and **Create Webinar**, with the availability check disabling the second one and saying
  why.
- **Zoom Sessions (super admin)**: the host pool table splits into Meeting hosts and Webinar hosts;
  add a webinar-licensed email the same way meeting hosts are added today.
- **A webinar calendar** so a super admin can see the single slot's bookings and answer "can we run
  an AGM on the 20th?" without guessing. This is the piece that makes one licence manageable.
- Event header gets a **Webinar** badge, and the Live page drops the "attendees can unmute" copy.
- **Panelist picker** on the event — choose from the organisation's team, the event's speakers
  and its registered attendees, with a free-text email fallback for external guests.

### Participant web

- Join must pass `userEmail` — mandatory for webinars.
- View-only UI for attendees: no camera or mic controls, Q&A instead of chat.
- Branch on `type` from the DTO.

### attend-mobile

- Same three: mandatory `userEmail`, `role: 0`, view-only controls driven by `type`.
- No new SDK. The Meeting SDK already in the app handles webinars — same package, same join call.

**Nothing needs a second Zoom app or new SDK credentials.** The Meeting SDK supports webinars
natively, so `ZOOM_SDK_KEY` / `ZOOM_SDK_SECRET` and the signature route are unchanged. The only new
Zoom-side requirement is the webinar licence itself and the `webinar:write:admin` scope on the
Server-to-Server OAuth app. Note that the webinar scopes do not appear in the Marketplace console
until the account actually holds a webinar licence — so if they are missing, that is why.

---

## 5. What we need from you

1. Agreement on **reserve-at-scheduling** rather than allocate-at-launch. Everything else follows.
2. `type` on the host pool, and on the create call and its response.
3. The availability endpoint, with the cross-organisation privacy rule.
4. `409 WEBINAR_SLOT_TAKEN` with the window, distinct from the pool's `503`.
5. The panelist endpoints, plus re-sync when a panelist's Attend email changes (§3.2).
6. Confirmation on registration off — and a real panelist join tested on the licensed account.

Question back to you: **does the licensed account also count against the meeting pool?** If it can
run meetings as well as webinars, we would rather it stayed reserved for webinars only, so a
routine meeting never occupies the one slot an AGM needs.
