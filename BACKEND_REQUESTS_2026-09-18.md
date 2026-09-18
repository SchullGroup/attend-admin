# Backend requests — consolidated (2026-09-18)

Everything the frontend currently needs from the backend, in one file, grouped by type.

**Supersedes** — these three can be deleted, their contents are merged in below:
`BACKEND_BROADCAST_RECIPIENT_BREAKDOWN_2026-09-18.md`,
`BACKEND_ANALYTICS_RANGE_AND_FORMAT_2026-09-18.md`,
`BACKEND_KYC_BREAKDOWN_AND_ADMIN_FORMAT_2026-09-18.md`.

**Not superseded** — `BACKEND_TLS_CHAIN_PROD_2026-09-14.md` stands on its own: production TLS is
still served without its intermediate certificate, so no non-browser client can reach the prod API.
That is with whoever administers the Huawei WAF, not with you, but it blocks verifying any of this in
production.

---

# A. Bugs — things returning wrong or missing data

## A1. 🔴 Event Format Distribution is empty on both analytics pages

```
GET /api/v1/admin/analytics/event-format     → "No format data yet."
GET /api/v1/client/analytics/event-format    → "No format data yet."
```

Both render the empty state on a platform with **45 events**, every one of which has a mandatory
`VIRTUAL | IN_PERSON | HYBRID` format. Both hooks read the response tolerantly
(`formats` / `eventFormats` / `distribution` / bare array / first array found), so this is not a field
naming mismatch on either side. The registrar detail page proves the data exists — its events table
renders Format per row correctly (In Person, Hybrid, Virtual).

Expected:

```jsonc
{ "formats": [ { "format": "VIRTUAL", "count": 21 }, { "format": "HYBRID", "count": 15 }, { "format": "IN_PERSON", "count": 9 } ] }
```

Both failing identically suggests one shared query, so one fix probably covers both. Please confirm
whether these are implemented at all.

## A2. 🔴 KYC breakdown does not reconcile, and has no concept of NIN

Super-admin Analytics currently shows:

| Bucket | Count |
|---|---|
| `NO_KYC` | 31 |
| `BASIC_KYC` | 0 |
| `PENDING_REVIEW` | 0 |
| `FULL_KYC` | 10,002 |
| `REJECTED` | 0 |
| **Sum** | **10,033** |

The Users page on the same account reports **10,096 total users** — **63 users are in no bucket.**

**(a) State the denominator.** `GET /api/v1/admin/analytics/kyc-breakdown` and `GET /api/v1/admin/users`
are clearly counting different populations — the same `/admin/participants` (ATTENDEE-scoped) versus
`/admin/users` (everyone but super admins) split you flagged yourself. Either return it:

```jsonc
{ "totalConsidered": 10033, "scope": "ATTENDEE", "breakdown": [ … ] }
```

or make the buckets exhaustive over the population the Users page counts. Either is fine; the silent
mismatch is not.

**(b) NIN has no place in the model.** NIN verification shipped, but nothing in the breakdown reflects
it — a user who completed NIN and a user who has done nothing both land in `NO_KYC`. Our reading of
what the buckets should mean:

| Bucket | Means |
|---|---|
| `NO_KYC` | nothing verified |
| `BASIC_KYC` | BVN verified (AGM shareholder path, steps 1–2) |
| `FULL_KYC` | BVN + liveness/step 3 |
| `PENDING_REVIEW` / `REJECTED` | as today |

The open question is whether **NIN is its own bucket or a modifier** — a user could plausibly be
NIN-verified *and* `BASIC_KYC`, which a single-value enum cannot express. If that is possible, counts
per method serve better than a ladder:

```jsonc
{
  "totalConsidered": 10096,
  "byStatus": { "NO_KYC": 63, "BASIC_KYC": 0, "FULL_KYC": 10002, "PENDING_REVIEW": 0, "REJECTED": 0, "REVOKED": 31 },
  "byMethod": { "bvnVerified": 10002, "ninVerified": 412, "chnProvided": 8800 }
}
```

This is a modelling decision as much as a data one — tell us the shape and we will render it.

**(c) One vocabulary across three screens.** The same user reads differently depending where you
stand: Analytics says 10,002 `FULL_KYC`; All Users shows `No KYC` in the KYC column for every visible
row; the user detail shows `FULL_KYC`. The list may just be sorted newest-first with genuinely
unverified recent signups on top — but please confirm the list's per-user `kycStatus` is derived from
the same field the breakdown counts, because otherwise the two disagree by construction.

## A3. 🐛 `chn` returns the string "Not provided"

On the user detail, **CHN renders as `Not **** ded`.** That is the literal `"Not provided"` arriving
in the `chn` field and hitting our masking helper, which keeps the first and last three characters of
anything over six long.

Please return `null` (or omit the field) when there is no CHN. NIN already does this correctly — it
comes back empty and renders as "—". We are hardening `maskValue` too, but prose does not belong in a
field typed as an identity number.

## A4. 🐛 Registrar detail — events carry no register name

`GET /api/v1/admin/registrars/{id}/events`

On the super-admin registrar detail, the Events table shows a **"—" under every event title** where
the owning register's name should be. We read `evt.registerName`; nothing arrives.

This matters because a registrar operates multiple registers, and the whole point of that column is
to say which register each event belongs to. Please include on each row:

```jsonc
{ "registerName": "Zenith Bank Plc", "registerId": "…" }
```

`registerId` as well, so the name can be a link rather than dead text.

---

# B. Behaviour — confirm or change

## B1. Is `chn` optional when adding a shareholder?

`POST /api/v1/client/registers/{id}/shareholders`

Our form has always treated CHN as optional — the field is labelled "(optional)", the CSV import
documents it as optional, and we send `chn: undefined` when it is blank. But adding a shareholder
without a CHN returns an error.

**Have you already fixed this?** If not, please make `chn` nullable on that endpoint. Note the CSV
bulk path (`/shareholders/bulk`) already accepts rows without one, so the single-add path is the
inconsistent half.

If CHN is deliberately required for single adds — presumably because it is the upsert dedup key —
say so and we will mark it required in the UI instead. Either answer is workable; the two paths
disagreeing is not.

---

# C. New capability

## C1. Analytics date ranges — 7d / 30d / 90d / all time

Every **client** analytics endpoint returns all-time figures and takes no time parameter:

```
/client/analytics/stats · by-type · monthly-trend · rsvps-by-event · fill-rate-overview
/client/analytics/event-performance · check-in-overview · event-format · engagement
```

A client admin cannot ask "how did last month go" — only "how has everything gone, ever".

**The admin analytics endpoints already accept `?range=`, and our admin hooks already pass it.**
Mirroring that on the client endpoints is the whole request:

| Value | Meaning |
|---|---|
| `7d` / `30d` / `90d` | trailing window |
| `all` | all time — **the default when the parameter is absent**, so current behaviour is unchanged |

Two details that decide whether the numbers are trustworthy:

1. **Which date does the window filter on?** We assume **event date**, not created-at — an AGM created
   in January and held in September belongs to September. Please confirm; the UI will state it.
2. **What `changePercent` compares against.** The stat cards already render a delta ("↘25%") against
   an undefined period. With ranges it should be the **immediately preceding window of equal length**;
   for `range=all` return `null` and we will hide the arrow rather than draw a misleading one.

An empty window should return zeroes and empty arrays, not a 404.

## C2. Per-channel recipient counts before a broadcast

`GET /api/v1/client/events/{eventId}/broadcast/recipients` returns one channel-agnostic number:

```jsonc
{ "data": { "recipientCount": 149877 } }
```

The compose screen offers **SMS, Email, Push, In-app, All Channels** and shows that same figure for
all five — true for at most one of them. On a register this size, some fraction has no phone number,
some has no email, and push/in-app only reach people with an Attend account. The organiser sees
149,877, picks SMS, and learns the real number afterwards from the history card. **At that volume it
is a cost and blast-radius question, not a cosmetic one.**

```jsonc
{
  "recipientCount": 149877,   // unchanged — we read this today
  "emailCount":     149204,
  "smsCount":       138902,
  "pushCount":       12044,
  "inAppCount":      12044
}
```

Skip reasons would be a bonus, and you already have the vocabulary — `failureReason` appears on the
history rows:

```jsonc
{ "unreachable": { "noEmail": 673, "noPhone": 10975, "unsubscribed": 412, "noAccount": 137833 } }
```

Three notes: keep `recipientCount` exactly as it is so nothing breaks in the gap between deploys; it
must be `COUNT(*)` with the relevant `WHERE`s rather than fetch-and-tally at ~150k rows, ideally with
a 30–60s cache; and we cannot do this client-side — it would mean paging every attendee row to count
who has a phone, the same trap as the platform user counts.

Once it lands: the button reads "Send to 138,902 via SMS", and a warning says "10,975 attendees have
no phone number and will be skipped" **before** the send rather than after.

---

# Summary

| # | Type | Item |
|---|---|---|
| A1 | Bug | `event-format` returns nothing on both admin and client |
| A2 | Bug | KYC breakdown: 63 users unaccounted, no NIN concept, three screens disagree |
| A3 | Bug | `chn` returns the string "Not provided" instead of null |
| A4 | Bug | Registrar events carry no `registerName` |
| B1 | Confirm | Is `chn` optional on single shareholder add? Bulk already allows it |
| C1 | New | `?range=` on client analytics, mirroring admin |
| C2 | New | Per-channel recipient counts before a broadcast |

A2 is the one worth thinking about rather than patching — NIN changed what "verified" means and the
data model has not caught up. A4 and B1 are small. C2 is the one with money attached.
