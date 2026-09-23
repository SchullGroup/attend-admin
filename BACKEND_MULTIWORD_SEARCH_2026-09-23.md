# Backend — search matches one field at a time, so two words find nothing (2026-09-23)

`GET /api/v1/admin/users?search=chinedu` returns Chinedu Ogbulachi, Chinedu Stephen Ogbulachi and
Chinedu Stephen. Adding the second word returns **nothing**:

```
GET /api/v1/admin/users?search=chinedu            → 3 users
GET /api/v1/admin/users?search=chinedu%20stephen  → 0 users
```

Chinedu Stephen is in that first result set. Searching for his full name loses him.

## What we think is happening

The term is being matched whole against each field in turn — `firstName LIKE %term%` OR
`lastName LIKE %term%` OR `email LIKE %term%`. No single field contains `"chinedu stephen"`,
because the first name is in one column and the rest in another, so every branch fails.

## What we need

Split the search term on whitespace and require **every word to match somewhere on the record**,
rather than requiring the whole string to match one field. Roughly:

```
for each word W in split(search):
    AND ( firstName ILIKE %W% OR lastName ILIKE %W% OR email ILIKE %W% OR phone ILIKE %W% )
```

That makes "chinedu stephen" and "stephen chinedu" both find the same person, and lets a word
matching the name combine with a word matching the email.

Please apply the same to every endpoint that takes `search`, since they will all have it:

- `GET /api/v1/admin/users`
- `GET /api/v1/admin/registers/{id}/shareholders` — worst case here: a registrar staffer looking
  up "John Okafor" while the shareholder is on the phone
- `GET /api/v1/client/organisation/team`
- `GET /api/v1/client/documents`, `GET /api/v1/admin/documents`
- `GET /api/v1/client/audit-logs`, `GET /api/v1/admin/audit-logs`
- `GET /api/v1/client/events/{id}/invites`, `.../proxies`

## What we did meanwhile

On the Users screen only: we send the **longest single word** to the API — the one least likely to
match half the table — and require the remaining words to match in the browser, across name, email
and phone. A one-word search is unchanged.

Limits worth knowing:

1. **It only narrows one page.** A multi-word search asks for 100 rows and filters those, so the
   pager is hidden. If the single word we send has more than 100 matches, a person past that point
   will not be found.
2. It is a workaround, and it is on one screen. Everything in the list above still fails on two
   words. Once the term is split server-side we will send the full term again and delete this.
