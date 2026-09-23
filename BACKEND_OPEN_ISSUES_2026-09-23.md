# Backend — two open items (2026-09-23)

Two unrelated things in one note so there is a single thing to pick up.

---

# 1. 🔴 `event-format` still fails — reported 2026-09-19, unchanged

This is the same bug as **A1** in `BACKEND_REQUESTS_2026-09-19.md` and the retest in
`BACKEND_REPLY_2026-09-19.md`. Four days on, nothing has changed on either endpoint:

```
GET /api/v1/admin/analytics/event-format?range=…    → failed, no response
GET /api/v1/client/analytics/event-format?range=…   → failed, no response
```

Everything established last time still holds, and is worth repeating so it is not re-diagnosed:

- **Both endpoints**, admin and client.
- **Every range** — 7d, 30d, 90d, 12m, all time — behave identically, so this is not a date window
  that happens to match no events.
- **No response reaches the browser at all.** DevTools shows `Response headers (0)` and
  "Provisional headers are shown". A 500 with a body would still carry response headers.
- Every other analytics call on the same page, same host, same token, in the same page load,
  returns 200: `summary`, `by-type`, `top-organisers`, `kyc-breakdown`.

So it is not auth, not the connection, and not the date filter. The handler itself never returns.

**What would settle it in one step:** the server log for
`GET /api/v1/admin/analytics/event-format?range=30d`. We expect a stack trace at the point the
handler dies. We have everything we can see from our side already; the next fact has to come from
yours.

**Impact:** the Event Format Distribution card is empty for every user on both the client and the
super-admin Analytics screens. It is the only card on either page that has never worked.

**On our side:** the card distinguishes a failed request from an empty result, so it shows an error
rather than "No format data yet" — the earlier report of "returns nothing" was our bug and is
fixed. Nothing else is pending from us.

---

# 2. Search matches one field at a time, so two words find nothing

`GET /api/v1/admin/users?search=chinedu` returns Chinedu Ogbulachi, Chinedu Stephen Ogbulachi and
Chinedu Stephen. Adding the second word returns **nothing**:

```
GET /api/v1/admin/users?search=chinedu            → 3 users
GET /api/v1/admin/users?search=chinedu%20stephen  → 0 users
```

Chinedu Stephen is in that first result set. Searching for his full name loses him.

## What we think is happening

The term is matched whole against each field in turn — `firstName LIKE %term%` OR
`lastName LIKE %term%` OR `email LIKE %term%`. No single field contains `"chinedu stephen"`,
because the first name is in one column and the rest in another, so every branch fails.

## What we need

Split on whitespace and require **every word to match somewhere on the record**, rather than the
whole string to match one field:

```
for each word W in split(search):
    AND ( firstName ILIKE %W% OR lastName ILIKE %W% OR email ILIKE %W% OR phone ILIKE %W% )
```

That makes "chinedu stephen" and "stephen chinedu" both find the same person, and lets a word
matching the name combine with a word matching the email.

Please apply it to every endpoint taking `search`, since they will all have it:

- `GET /api/v1/admin/users`
- `GET /api/v1/admin/registers/{id}/shareholders` — worst case: a staffer looking up "John Okafor"
  while the shareholder is on the phone
- `GET /api/v1/client/organisation/team`
- `GET /api/v1/client/documents`, `GET /api/v1/admin/documents`
- `GET /api/v1/client/audit-logs`, `GET /api/v1/admin/audit-logs`
- `GET /api/v1/client/events/{id}/invites`, `.../proxies`

## What we did meanwhile

On the Users screen only: we send the **longest single word** to the API — the one least likely to
match half the table — and require the remaining words to match in the browser, across name, email
and phone. A one-word search is unchanged.

Two limits: it only narrows one page (a multi-word search asks for 100 rows and filters those, so
the pager is hidden — past 100 matches on the word we send, a person will not be found), and it is
one screen. Everything in the list above still fails on two words.

---

## Still open from earlier notes

| Ref | Item | Status |
|---|---|---|
| `BACKEND_REQUESTS_2026-09-19.md` A1 | `event-format` fails, both endpoints, every range | 🔴 open — §1 above |
| `BACKEND_CHALLENGE_SEARCH_2026-09-22.md` | `search` ignored on the challenges list | open |
| `BACKEND_VOTE_STATUS_2026-09-22.md` | `status` on the votes list uses words the list never returns | open |
| `BACKEND_SEARCH_ENDPOINTS_2026-09-22.md` | 11 endpoints with no `search` at all | open |
