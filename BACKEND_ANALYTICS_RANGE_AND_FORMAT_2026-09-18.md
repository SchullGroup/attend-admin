# Backend request — analytics date ranges, and Event Format Distribution returns nothing (2026-09-18)

Two items on the client-admin **Analytics** page. The first is new work, the second looks like an
endpoint that is either unimplemented or filtering everything out.

---

## 1. Date-range breakdown — 7d / 30d / 90d / all time

### What exists today

Every client analytics endpoint returns **all-time** figures and takes no time parameter:

```
GET /api/v1/client/analytics/stats
GET /api/v1/client/analytics/by-type
GET /api/v1/client/analytics/monthly-trend
GET /api/v1/client/analytics/rsvps-by-event
GET /api/v1/client/analytics/fill-rate-overview
GET /api/v1/client/analytics/event-performance     ?page&size
GET /api/v1/client/analytics/check-in-overview
GET /api/v1/client/analytics/event-format
GET /api/v1/client/analytics/engagement
```

So a client admin cannot answer "how did last month go" — only "how has everything gone, ever". On an
account with 45 events that is already the wrong default, and it gets worse every quarter.

### What we need

A `range` parameter on each of the endpoints above:

```
GET /api/v1/client/analytics/stats?range=30d
```

| Value | Meaning |
|---|---|
| `7d` | last 7 days |
| `30d` | last 30 days |
| `90d` | last 90 days |
| `all` | all time — **the default when the parameter is absent** |

**Omitting it must behave exactly as today.** That keeps the current frontend working against a
deployed change, and lets us ship the selector separately.

### Two details that decide whether the numbers are trustworthy

1. **Which date does the window filter on?** We assume the **event date**, not the created-at date —
   an AGM created in January and held in September belongs to September. Please confirm, because the
   two give very different answers and the UI will state which it is.
2. **What the change percentage compares against.** The stat cards already render a delta (currently
   "↘25%" and "↘66.7%") from `changePercent`, but against an undefined period. With ranges it should
   be **the immediately preceding window of the same length** — `30d` compares against the 30 days
   before it. For `range=all` there is no previous window, so return `changePercent: null` and we will
   hide the arrow rather than draw a misleading one.

An empty window should return zeroes and empty arrays, not a 404 — a quiet fortnight is a valid answer.

---

## 2. 🔴 `GET /api/v1/client/analytics/event-format` returns nothing

The **Event Format Distribution** card renders *"No format data yet."* on an account with 45 events.

### Why that is not a frontend problem

- The **Events by Type** card on the same page, fed by `/analytics/by-type`, works: 10 AGM, 6 Launch,
  14 Innovation Challenge, 15 General — 45 events, so the org scope is clearly resolving.
- **Format is mandatory on every event-creation path.** `VIRTUAL | IN_PERSON | HYBRID` is required on
  the client create and on all four admin create endpoints — there is no way to have an event without
  one.
- We already read the response tolerantly, so a naming mismatch would not produce this:

```ts
const formats = raw?.formats ?? raw?.eventFormats ?? raw?.distribution ?? (Array.isArray(raw) ? raw : []);
```

All four shapes come back empty, which points at the endpoint itself rather than at what we call the
field.

### What we expect

```jsonc
{
  "formats": [
    { "format": "VIRTUAL",   "count": 21 },
    { "format": "HYBRID",    "count": 15 },
    { "format": "IN_PERSON", "count":  9 }
  ]
}
```

`format` upper-case matching the enum; `count` an integer. An optional `color` per row is read if
present, otherwise we apply our own palette. Formats with a zero count can be omitted or included —
either renders correctly.

**Please confirm one of:** the endpoint is not implemented and returns an empty stub; it is filtering
on something that excludes everything (a status or date condition); or it returns a shape we have not
anticipated — in which case send the raw JSON and we will read it.

This one should also honour the `range` parameter from §1.

---

## What the frontend does with both

- A **7d / 30d / 90d / All time** selector at the top of Analytics, driving every card on the page
  from one choice, with the active range named in the subheading so a screenshot is never ambiguous.
- Change arrows become meaningful, because the comparison window is defined rather than implied.
- The Event Format Distribution card starts showing bars instead of an empty state.

Nothing here is urgent in the way the TLS or CORS items are — but the empty format card is visible to
every client admin today and reads as a broken page, so it is worth a look even ahead of the ranges.
