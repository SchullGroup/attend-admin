# Backend — server-side search, a full audit (2026-09-22)

We went through every screen in the admin app, for every role, and listed each place a user can
type into a search box. Roughly half of them are not searches at all: the frontend has already
been handed a page of rows and filters that array in the browser.

That works today because the accounts are small. It stops working quietly, which is the problem.
**A client-side search over a paginated list does not return fewer results — it returns the wrong
ones.** A Meristem staffer looking for a shareholder who happens to sit on page 4 gets "no
results", which reads as *this person is not enrolled*, not *this person is not on the page you
are looking at*. On a registrar platform that is a data-integrity answer, not a UI annoyance.

This document is the full list, what each one needs, and the order we think it matters in.

**Summary: 11 endpoints need a `search` parameter. 2 have one that does not work. 3 need a
lookup/typeahead endpoint. 6 already work and are listed only so the audit is complete.**

---

## Legend

| Mark | Meaning |
|------|---------|
| ✅ | Works server-side today |
| ⚠️ | Parameter is sent but appears to be ignored |
| ❌ | No parameter exists — the frontend filters one page in the browser |

---

## 1. Needs a `search` parameter (❌)

These are the real gaps. Each row is a search box a user can type into today that only sees the
rows already on screen.

### 1.1 Challenge applications — **highest priority**

```
GET /api/v1/client/challenges/{challengeId}/applications
GET /api/v1/admin/challenges/{challengeId}/applications
GET /api/v1/judge/challenges/{challengeId}/applications
```

**Who uses it:** client admin, event manager, judge, super admin — the Applications screen, the
challenge detail Applications tab, the judging screens, and the event detail Applications tab.

**Why it is first:** this is the list that grows without a ceiling. A challenge that gets
1,200 team submissions is a success, not an edge case, and the whole review workflow runs through
this screen. We currently request `size=100` and filter in the browser, so application 101 onward
cannot be found at all.

**Match on:** `teamName`, `ideaTitle`, member name, member email.
**Keep working alongside:** the existing `status` and `track` filters, and `totalElements` must
reflect the filtered set.

### 1.2 KYC verification queue — **highest priority**

```
GET /api/v1/admin/participants/kyc/queue
```

**Who uses it:** KYC officer, super admin.

**Why it is first:** the box is labelled "Search by name, email or ID" and an officer uses it to
find one specific person — usually because that person is on the phone. It takes no `search`
parameter at all, so it searches the 20 rows on screen. This is the single most misleading search
in the product.

**Match on:** `fullName`, `email`, `displayId`, `participantId`.
**Keep working alongside:** the `status` filter (`PENDING` / `VERIFIED` / `REJECTED`).

### 1.3 Events list

```
GET /api/v1/client/events
GET /api/v1/admin/events
```

**Who uses it:** every role. It is the most-visited screen in the app.

**Why:** "Search events by title" filters the current page of 20. This account already has 49
events, so the box is misleading *today* — we have worked around it by requesting 100 rows when a
filter is active, which buys time and nothing more.

**Match on:** event `title`, and organiser / register name.
**Also needed as real parameters** (all four are filtered in the browser right now):
`registerId` / `organizerId`, `registrarId`, `eventType`.
**Keep working alongside:** the existing type tabs (`AGM` / `LAUNCH` / `INNOVATION` / `GENERAL`)
and `status`.

### 1.4 Registers directory

```
GET /api/v1/client/registers
```

**Who uses it:** client admin, admin, event manager, viewer.

**Why:** the All Registers screen currently **fetches every page of the directory in a loop** on
each visit and filters the result in the browser — see `useAllRegisters`. That is a workaround for
the missing parameter and it gets worse linearly: at 500 registers it is 5+ round trips and the
whole directory in memory before a single row renders.

**Match on:** `name`, `companyName`, `rcNumber`, `industry`, `email`, `phone`,
`representativeName`, `representativePhone` — these are exactly the fields the current local
filter covers, so this list is what users already expect to be able to search by.
**Keep working alongside:** the status tabs, and please make `status` filter server-side too so we
can stop fetching the whole directory.

### 1.5 Registrar list (super admin)

```
GET /api/v1/admin/registrars
```

**Who uses it:** super admin.

**Why:** there is no search box on this screen at all yet, precisely because there is nothing to
build it on. Platform-wide, this is the list that grows with the business.

**Match on:** `companyName`, `name`, `rcNumber`, `email`.

### 1.6 Client admins (super admin)

```
GET /api/v1/admin/client-admins
```

**Who uses it:** super admin.

**Why:** the box says "Search by name, email, or industry…" and filters the current 20 rows.

**Match on:** `name`, `email`, `industry`.
**Also needed:** `status` as a real parameter — it is filtered in the browser too.

### 1.7 Vote records list

```
GET /api/v1/client/votes
```

**Who uses it:** client admin, admin, viewer.

**Why:** covered in its own note (`BACKEND_VOTE_STATUS_2026-09-22.md`) — the `status` tabs use a
vocabulary the endpoint does not answer with. Please confirm at the same time whether `search` is
honoured here; we send it but have never been able to verify it, so we now also filter locally as
a safety net.

**Match on:** event `title`, organiser / register name.

### 1.8 Dashboard — judge's assigned challenges

```
GET /api/v1/judge/events
```

**Who uses it:** judge.

**Why:** the judge's home screen has a search box over their assigned challenges, filtered in the
browser. Lower volume than the others — a judge is assigned tens, not thousands — but it is the
same class of bug.

**Match on:** challenge `title`, `organiserName`.

---

## 2. Parameter exists but does not appear to work (⚠️)

### 2.1 Challenges list — `search` is ignored

```
GET /api/v1/client/challenges?search=…
GET /api/v1/admin/challenges?search=…
GET /api/v1/judge/challenges?search=…
```

Already raised in `BACKEND_CHALLENGE_SEARCH_2026-09-22.md`. The full list comes back whatever the
term is, while `status` on the same endpoint filters correctly. We have a local filter in place as
a stop-gap so a miss shows an empty state instead of the whole list.

### 2.2 Vote records — `search` unverified

See 1.7. We send it; we do not know that it does anything.

---

## 3. Needs a lookup / typeahead endpoint (❌)

These are dropdowns, not tables, but they fail the same way — worse, actually, because a dropdown
that silently omits an option gives no hint that anything is missing.

Each one loads a fixed-size page and filters it in the browser:

| Picker | Loaded as | Where |
|---|---|---|
| Organiser / Register picker | `GET /api/v1/client/registers?status=ACTIVE&size=200` | Create Event, Events filter bar |
| Registrar picker | `GET /api/v1/admin/registrars?size=100` | Events and Documents filter bars (super admin) |
| Event picker | `GET /api/v1/client/events/dropdown` (no size param — unknown cap) | Document upload, Documents filter |
| Judge picker | `GET /api/v1/client/organisation/team?size=100` | Challenge judge assignment |

**What we need:** either a `search` parameter on each of these so we can query as the user types,
or a documented guarantee that the list is complete and bounded. If `/client/events/dropdown`
already returns everything unpaginated, please say so — we will stop worrying about it.

Past the cap, the option simply is not in the list and the user has no way to know. On the Create
Event screen that means an organiser cannot be selected, which blocks the whole flow.

---

## 4. Already working — listed for completeness (✅)

No action needed on these. They are the model we would like the rest to follow.

| Endpoint | Searches | Note |
|---|---|---|
| `GET /api/v1/admin/users` | name, email, phone | Confirmed working since your 2026-09-14 note |
| `GET /api/v1/client/documents` | document title | `search` + `registerId` + `eventId` + `type` |
| `GET /api/v1/admin/documents` | document title | |
| `GET /api/v1/client/audit-logs`, `/admin/audit-logs` | actor, action, resource, details | Plus `userEmail`, `entityId`, date range |
| `GET /api/v1/admin/registers/{id}/shareholders` | name, email, phone, CHN | The best one in the codebase — please use it as the template |
| `GET /api/v1/client/organisation/team` | name, email | Minimum 2 characters |
| `GET /api/v1/client/events/{id}/invites` | invitee name/email | |
| `GET /api/v1/client/events/{id}/proxies` | proxy, grantor, email | |
| `GET /api/v1/admin/search`, `/client/search` | global omnisearch | Powers the header search |

---

## What we are asking for, concretely

For each endpoint in sections 1 and 3:

1. A **`search`** query parameter (we will use that exact name — several endpoints already do).
2. **Case-insensitive partial match** across the fields named above. Trimmed. We will not send
   terms shorter than 2 characters if you would rather not match on 1.
3. **`totalCount` / `totalElements` reflecting the filtered set**, so pagination stays honest.
4. It must **compose with the existing filters** on that endpoint (status, type, track, date) —
   every one of these screens has tabs next to the search box.
5. Where we have flagged a filter as browser-side (`registerId`, `registrarId`, `eventType`,
   `status` on registers and client-admins), a real parameter for it as well.

## Suggested order

| Priority | Endpoints | Why |
|---|---|---|
| **1 — now** | Challenge applications (1.1), KYC queue (1.2) | Unbounded growth, and both are used to find one specific record. Wrong answers here have consequences. |
| **2 — soon** | Events (1.3), Registers (1.4), Challenges `search` fix (2.1) | Highest-traffic screens; the registers workaround also costs a full-directory fetch per visit. |
| **3 — next** | Registrars (1.5), Client admins (1.6), Votes (1.7), Dropdowns (3) | Smaller lists today, but the dropdown caps are a silent failure mode. |
| **4 — later** | Judge dashboard (1.8) | Naturally bounded by how many challenges one judge is assigned. |

## What we will do on our side

As each one lands we will send `search` to the endpoint, delete the local filter, and restore
normal pagination on that screen. Nothing needs to be coordinated — the frontend already sends
`search` in several of these places and simply ignores the fact that it does nothing, so turning
the parameter on cannot break us.

If any of these lists is capped server-side in a way we have not noticed, or if there is an
existing search endpoint we have missed, tell us and we will use it rather than asking for a new
one.
