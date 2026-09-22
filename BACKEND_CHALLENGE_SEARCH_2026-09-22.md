# Backend — `search` is ignored on the challenges list (2026-09-22)

`GET /api/v1/client/challenges?search=…` returns **the full unfiltered list** whatever the term is.

**Reproduce:** Innovation Challenges → type `James Ezepue` in the search box. Every challenge comes
back, none of which contain that string in the title or the organiser name.

```
GET /api/v1/client/challenges?search=James%20Ezepue&page=0&size=…
→ 200, every challenge on the account
```

The frontend is sending it (`params: { search, status, page, size }`) and has been all along. The
`status` parameter on the same endpoint **is** honoured — the Draft / Published / Live / Ended tabs
filter correctly — so this is the one parameter being dropped.

## Why it reads worse than "no results"

Because rows come back, the UI can't tell a miss from a hit. The user gets a full list that looks
like the answer to their search, rather than an empty state. A search that silently returns
everything is worse than one that errors: nothing on screen says the term was ignored.

## What we need

Filter on `search` across at least the challenge **title** and the **organiser name**, case
insensitive, partial match — and have `totalCount` reflect the filtered set so pagination stays
consistent.

Please also confirm the same parameter on:

- `GET /api/v1/admin/challenges` — the super-admin equivalent, used by the same screen and by the
  Applications and Judging challenge pickers.
- `GET /api/v1/judge/challenges` — the judge list.

## What we did meanwhile

The list now filters the page it was given client-side, so a term that matches nothing shows a
proper "No challenges match …" state instead of the whole list. Two limits worth knowing:

1. **It only sees the current page.** With server-side pagination, a challenge on page 3 that
   matches will not be found. The empty state says so explicitly.
2. It is a workaround, not a fix. Once the parameter is honoured every row already matches, the
   filter becomes a no-op, and we will remove it.
