# Backend — `status` on the votes list uses words the list never returns (2026-09-22)

`GET /api/v1/client/votes` returns records whose `status` is one of **LIVE**, **PUBLISHED**,
**ENDED**, **DRAFT**.

The Votes & Resolutions screen offers four filter tabs: Live, Upcoming, Past, Draft. Two of those
have no counterpart in the data:

| Tab      | Sent as              | Statuses actually returned |
|----------|----------------------|----------------------------|
| Live     | `status=LIVE`        | `LIVE` ✅                  |
| Upcoming | `status=UPCOMING`    | — (these are `PUBLISHED`)  |
| Past     | `status=PAST`        | — (these are `ENDED`)      |
| Draft    | `status=DRAFT`       | `DRAFT` ✅                 |

So "Upcoming" and "Past" could never match anything, whatever the endpoint does with the
parameter. From the user's side the tabs simply do nothing.

## What we need

Either of these works for us — the first is less work for you:

1. **Accept the reader's vocabulary** on `status`, mapping it server-side:
   `UPCOMING` → published events dated in the future, `PAST` → ended/closed events,
   `LIVE` → live, `DRAFT` → draft. `totalCount` should reflect the filtered set.
2. Or tell us the exact status vocabulary and we will relabel the tabs to match it.

Please also confirm whether **`search`** is honoured on this endpoint. We are not certain it is,
and a search parameter that is silently ignored returns the full list looking like an answer —
the same problem we hit on `GET /api/v1/client/challenges` (see
`BACKEND_CHALLENGE_SEARCH_2026-09-22.md`).

## What we did meanwhile

The frontend no longer sends `status`. Each tab owns the set of statuses it covers
(Upcoming = `UPCOMING | PUBLISHED | SCHEDULED`, Past = `PAST | ENDED | COMPLETED | CLOSED |
CANCELLED`) and filters the rows it was given. The same is done for the search term, across the
title and organiser name.

Two limits worth knowing:

1. **It only sees one page.** A filtered or searched view requests `size=100, page=0` and narrows
   that locally, so the pager is hidden. Past ~100 vote records an older AGM will stop being
   found.
2. It is a workaround. Once `status` and `search` are honoured server-side we will send them
   again and delete the local filtering.
