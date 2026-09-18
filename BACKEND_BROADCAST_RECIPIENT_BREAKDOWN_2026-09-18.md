# Backend request — per-channel recipient counts before sending a broadcast (2026-09-18)

Small ask, and the data already exists on your side after the fact. We need it *before* the send.

---

## What the endpoint returns today

`GET /api/v1/client/events/{eventId}/broadcast/recipients`

```jsonc
{
  "data": { "recipientCount": 149877 },
  "message": "Recipient count retrieved.",
  "status": true
}
```

One number, channel-agnostic.

## Why that is not enough

The compose screen lets an organiser pick **SMS, Email, Push, In-app or All Channels**, and then shows
the same figure regardless: *"Send to 149,877 attendees."*

That sentence is only true for one of those channels at a time. On an AGM register of this size:

- some fraction has **no phone number** → every one of those is a silently skipped SMS;
- some fraction has **no email**;
- push and in-app only reach people with an Attend account, which is a much smaller set again.

So the organiser is shown 149,877, picks SMS, and finds out afterwards — from the history card —
that it actually went to far fewer. **At this volume that is a cost and blast-radius question, not a
cosmetic one.** An SMS send to a six-figure list is expensive, irreversible, and worth confirming
before rather than explaining after.

## What we are asking for

Extend the same endpoint with per-channel **reachable** counts — how many recipients could actually
receive on each channel (has a usable address/number, not unsubscribed, account exists where the
channel needs one):

```jsonc
{
  "recipientCount": 149877,   // unchanged — keep it, we read it today
  "emailCount":     149204,
  "smsCount":       138902,
  "pushCount":       12044,
  "inAppCount":      12044
}
```

If the skip reasons are cheap to include, they are what we would surface as a warning — and you
already have this vocabulary, since `failureReason` appears on the history rows:

```jsonc
{
  "unreachable": { "noEmail": 673, "noPhone": 10975, "unsubscribed": 412, "noAccount": 137833 }
}
```

Optional, not a blocker. The four counts are the ask.

## Three notes on implementation

1. **Keep `recipientCount` exactly as it is.** It is what the UI reads now; the new fields are
   additive so nothing breaks in the gap between your deploy and ours.
2. **Aggregate counts, not row loads.** At ~150k recipients this must be `COUNT(*)` with the relevant
   `WHERE`s, not a fetch-and-tally. A short cache (30–60s) would be welcome — the screen re-reads this
   on every visit and the number does not move quickly.
3. **Field names.** We will read the spellings above first and fall back tolerantly
   (`emailRecipients`, `email_count`, …), so near-misses will still light up. Matching the above
   exactly is simplest.

## Why we cannot do it client-side

The only way for the frontend to work these out is to page through all 149,877 attendee rows and
count who has a phone number. That is the same trap as the platform user counts — a per-page sample
that silently lies, or a very large number of requests. It has to be a server-side aggregate.

## What the UI does once it lands

- The button becomes channel-aware: *"Send to 138,902 via SMS"* rather than the global total.
- A warning line under the channel picker: *"10,975 attendees have no phone number and will be
  skipped."* Shown before the send, not discovered after it.
- **All Channels** shows the per-channel split rather than one misleading total.

Until then the screen keeps showing the plain total, which is wrong for every channel except email.
