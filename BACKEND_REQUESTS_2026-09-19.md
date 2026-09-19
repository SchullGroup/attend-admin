# Backend — findings from testing the 2026-09-18 deploy (2026-09-19)

Tested against `https://attend-api.schulltech.com` from a local frontend, signed in as super admin
and as a client admin, across every value of the period selector. Where a single figure is quoted
below it is from the **Last 30 Days** view, but the failures are not specific to that window.

Most of the reply landed and is visible. Two endpoints did not, the reason they fail may be bigger
than the two screens they break, and a third problem turned up while testing: a document
uploaded since the deploy cannot be downloaded, while older ones still can.

The KYC breakdown was checked and is **correct** — `byStatus` and `byMethod` are both reporting the
real state of the data. Nothing needed there.

---

# A. Still broken

## A1. 🔴 `event-format` is not returning empty — it is failing. Both endpoints, every range.

Previously reported as "returns nothing". That was wrong, and the wrongness was ours: our card
rendered the same "No format data yet." sentence for an empty result and for a failed request, so a
failing endpoint looked like a platform with no events. That is fixed on our side now — the card
shows the error. With it showing, the picture is unambiguous:

```
GET /api/v1/admin/analytics/event-format?range=…       → failed
GET /api/v1/client/analytics/event-format?range=…      → failed
```

**Every range fails, on both the admin and the client endpoint.** 7d, 30d, 90d, 12m and all time
behave identically, so this is not a window that happens to match no events and not a date-filter
edge case — the handler itself never returns.

DevTools reports **`Response headers (0)`** and *"Provisional headers are shown"*. **No response
reached the browser at all.** A 500 with a body would still carry response headers; this carries
none.

Everything else on the same page, same host, same bearer token, in the same page load, succeeded:

| Endpoint | Result |
|---|---|
| `analytics/summary?range=30d` | ✅ 200 |
| `analytics/by-type?range=30d` | ✅ 200 |
| `analytics/top-organisers?limit=5&range=30d` | ✅ 200 |
| `analytics/kyc-breakdown?range=30d` | ✅ 200 |
| `admin/audit-logs?page=0&size=10` | ✅ 200 |
| **`analytics/event-format`** (admin **and** client, every range) | ❌ failed, no response |
| **`admin/stakeholders/pending?page=0&size=1`** | ❌ failed, no response |

So this is not auth, not the WAF, not the connection, and not CORS on the happy path — it is those
handlers specifically.

### A1c. The part worth more attention than the card

A browser shows exactly this — request failed, zero response headers — when the response **arrives
without its CORS headers**. Spring's CORS filter commonly does not run on responses produced by an
exception handler outside the filter chain, so a handler that throws returns a 500 the browser is
obliged to discard without ever exposing the status or body to us.

If that is what is happening, **every server error on the platform is invisible in the browser**,
and only ever legible in Postman. That would explain a long tail of "it works in Postman" on this
project, and it is worth confirming independently of this endpoint.

**Please send:**

1. The server log for `GET /api/v1/admin/analytics/event-format?range=30d` — we expect a stack trace.
2. Whether error responses (4xx/5xx) carry `Access-Control-Allow-Origin`. If they do not, that is a
   separate and more valuable fix than this card.
3. The log for `GET /api/v1/admin/stakeholders/pending?page=0&size=1` — see below.

The lowercase-enum fix may well be correct and something else in the handler is throwing. A null
`format` on one event, or the zero-fill, would both do it. Whatever it is, it is in a code path both
the admin and client copies share, since both fail.

## A1b. 🔴 `admin/stakeholders/pending` is failing the same way — and it is silent

```
GET /api/v1/admin/stakeholders/pending?page=0&size=1     → failed, no response headers
```

This one is easy to miss because nothing on screen says so. The super-admin sidebar calls it on every
page load to put a count badge on **Enrol Registrar** — the number of registrar enrolments waiting for
approval. When the call fails the badge simply does not render, which is indistinguishable from "there
are none pending".

**So a super admin currently has no way to learn that registrar enrolments are waiting.** That is a
worse failure than the format card, because the format card at least looks wrong.

It fails identically to `event-format` — no response headers — which points at one shared cause rather
than two coincidences.

## A3. 🟠 One document returns `AccessDenied` — its `fileUrl` differs from the ones that work

**Not every document is affected — most download fine.** One row does not:

```
BPN AGM Order of Proceedings 2020 final for Chairman   ·  uploaded 18 Sept 2026  ·  0 downloads
```

```
https://attend-assets-prod.obs.af-south-1.myhuaweicloud.com/attend%2Fagm-notices%2F229f8f60-77e4-4eee-9207-d6fabd6f80e5.pdf
```

```xml
<Error><Code>AccessDenied</Code><Message>Access Denied</Message>
<RequestId>000001A0B9C37B2A828ADAEFF79095DB</RequestId></Error>
```

### It is not the frontend

The Download button assigns `doc.fileUrl` to an anchor and clicks it. We do not build the URL, encode
it, append to it, or alter it in any way — what is above is exactly what
`GET /api/v1/admin/documents` returned for that row.

### Two things about that URL look wrong, and both come from your side

1. **The object key is percent-encoded in the path.** `attend%2Fagm-notices%2F229f8f60-…` rather than
   `attend/agm-notices/229f8f60-…`. Encoded that way, the key is a single path segment containing
   literal `/` characters rather than a prefixed path — a different object name from the one that was
   uploaded. A private bucket answers a key that does not exist with `AccessDenied`, not `NoSuchKey`,
   which is exactly what came back.
2. **There is no query string.** No `AccessKeyId`/`Expires`/`Signature`, no `X-Amz-Signature`. If the
   working documents' URLs *are* signed, then this one lost its signature as well.

We cannot tell which of these is decisive without seeing a URL from a document that works — please
compare one against this.

### The timing points at the 18 Sept deploy

The download counts make the boundary visible. Every older document has been downloaded successfully
— 16 Sept rows show 1 each, 8 Sept shows 3, 26 Aug shows 15. **This document, uploaded on 18 Sept,
shows 0 and has never successfully downloaded.**

So this is unlikely to be the read path breaking for everything, and much more likely to be **how the
key or URL is written at upload time, changed on or around the 18 Sept deploy.** Anything uploaded
since would carry the same defect.

**Please check:** whether `fileUrl` construction or the object key changed in that deploy, and whether
documents uploaded after it are all affected. If they are, existing rows need their stored key or URL
repaired, not just new uploads fixed.

One aside: the bucket is **`attend-assets-prod`** while this request came from the staging API. If
staging reads and writes production objects, that is worth knowing on its own.

---

# B. Confirmed working

- **`?range=` on client analytics (C1)** — accepted on all nine endpoints; `all` behaves as before.
- **Per-channel broadcast counts (C2)** — integrated; the composer now names the channel-specific
  figure and the skip count before sending.
- **`chn` returning `"Not provided"`** — fixed; the user detail renders "—" for absent values.
- **KYC breakdown (A2)** — `totalConsidered`, `scope`, `byStatus` and `byMethod` all present,
  reconciling, and verified correct against the data. Closed.

Not yet verifiable: `registerName` on registrar events (A4), and the format distribution itself,
which is blocked on A1.

---

# C. Outstanding, not code

1. **Run the migration.** `migrations/2026-09-18-shareholder-chn-nullable-and-kyc-status-backfill.sql`
   has not run on staging — a shareholder without a CHN still fails at the database, and the NULL
   `kyc_status` rows are still NULL. A deploy does not do this on its own.
2. **The Huawei WAF certificate.** `BACKEND_TLS_CHAIN_PROD_2026-09-14.md` still stands. Production is
   still served without its intermediate, so nothing here can be verified in prod by any non-browser
   client.

---

# Summary

| # | Item | State |
|---|---|---|
| A1 | `event-format` fails with no response — both admin and client, every range | 🔴 open |
| A1b | `stakeholders/pending` fails identically; the Enrol Registrar badge silently shows nothing | 🔴 open |
| A1c | Do error responses carry CORS headers? If not, all server errors are invisible to the browser | 🔴 needs an answer |
| A3 | One document's `fileUrl` returns `AccessDenied` — encoded key, no signature, uploaded 18 Sept | 🟠 open |
| A2 | KYC breakdown — denominator, `byStatus`, `byMethod` | ✅ correct, closed |
| C1/C2 | ranges, per-channel counts, `chn` null | ✅ working |
| — | Migration not run; prod TLS chain still incomplete | ⏳ waiting |

A1c is the one to look at first. A broken card is a card; error responses the browser cannot read
is every future bug taking a day longer than it should.
