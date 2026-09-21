# Reply to the 2026-09-19 addendum

Three answers, three outcomes: one was ours and is fixed, one was a theory of ours that your test
disproved, and one is still open with new evidence that narrows it considerably.

---

## A1b — ours. Fixed.

`/admin/stakeholders/pending` → `/admin/registrars/pending`, one string, done.

Worth recording why it survived: the correct path was already in our codebase. `registrars.ts` has
`usePendingRegistrars` pointing at `/admin/registrars/pending` with the right unwrapping. The sidebar
was calling a *second*, older hook in `super-admin.ts` that had the wrong URL — so the repo held both
the bug and its fix, and nothing reconciled them, because a 404 here produces a missing badge and a
missing badge looks exactly like "nothing pending".

We kept the `super-admin.ts` hook rather than switching to the other one: only it takes an `enabled`
flag, which is what stops a non-super-admin firing an admin-only request on every page load. It now
points at the right URL and reads the count tolerantly (`totalCount` / `totalElements` / array
length).

## A1c — ours, and wrong. Thank you for testing it rather than accepting it.

You are right, and the way you established it is better than the way we raised it. We inferred CORS
from a symptom — `Response headers (0)` with a bearer token that worked on five sibling calls in the
same page load — and inference is exactly what should not have gone into a bug report addressed to
someone else's codebase.

Keeping `ErrorResponseCorsTest` is the right call even though the fix was dropped. The property was
untested, it is now pinned, and it will not need rediscovering.

Two things follow for us: `Response headers (0)` has some other cause, and the "works in Postman"
tail needs a real explanation rather than a plausible one. On A1b it is now explained — a 404 whose
body we never looked at. On A1 it is not.

## A1 — retested on the current build. Still failing, and the shape has changed.

Retested against `3c774eb` / `60e99f5`. `event-format` still does not render, on both the admin and
client pages, at every range.

What is different from the last report — and it matters — is that **the failure is no longer what we
described.** With our own error state now distinguishing a failed request from an empty result, the
card reports an error rather than an empty state, so the request is reaching a conclusion the browser
can see. That is not the `Response headers (0)` picture from yesterday.

Your three checks are conclusive on everything they cover: the route resolves, nginx passes it, the
column holds 164 valid enum values. We are not disputing any of it. So the remaining candidates are
things your checks could not have reached from the server side:

- the request as authenticated by a **real super-admin token** rather than the `401` your checks
  returned (a `401` proves the route is mapped, not that the handler completes — the handler never
  ran);
- something between the app and our browser that neither `localhost:8080` nor a curl against the
  public hostname exercises.

We are gathering exactly what you asked for and will send it as a unit:

1. the full URL as the browser sends it,
2. the `Authorization` header's decoded role,
3. the response status, headers and body as the browser sees it,
4. **the same URL in Postman with the same token** — this is the one that splits it: if Postman
   returns 200 for a request the browser cannot complete, the problem is not in your handler; if
   Postman fails too, it is, and you will have a reproduction that does not need us.

Nothing for you to do on A1 until that arrives.

---

## Everything else from the 2026-09-18 reply

Integrated and committed. The KYC breakdown in particular we have since verified against the data and
it is correct — `byStatus` and `byMethod` are both reporting the real state, and our earlier note
questioning `bvnVerified: 1` against `FULL_KYC: 10,001` is withdrawn.

Two notes back:

**`7d` on admin.** Caught in your C1 answer — thank you, this one was invisible from our side by
construction. Our admin analytics selector offers 30d / 90d / 12m / all and does not send `7d`, so no
admin screen has been silently showing all-time data as a week. Now that `7d` is supported we can
offer it; the client selector already does.

**The 400 on an unrecognised client range is the right choice.** Agreed on the reasoning: a wrong
range that quietly answers a different question is worse than an error, because the number looks
right and nothing says otherwise. Our client hooks send only the five documented values and omit the
parameter entirely for `all`.

---

## One new item — a document that will not download

Uploaded **18 Sept 2026**, `0` downloads. Older documents still download normally — 16 Sept rows show
1 each, 26 Aug shows 15 — so this is not the read path failing for everything.

```
https://attend-assets-prod.obs.af-south-1.myhuaweicloud.com/attend%2Fagm-notices%2F229f8f60-77e4-4eee-9207-d6fabd6f80e5.pdf
→ <Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>
```

The frontend assigns `fileUrl` to an anchor and clicks it — we do not construct, encode or alter the
URL, so this is verbatim what `GET /admin/documents` returned for that row.

Two things about it look wrong:

1. **The object key is percent-encoded in the path** — `attend%2Fagm-notices%2F…` rather than
   `attend/agm-notices/…`. That makes it a single path segment containing literal `/` characters
   rather than a prefixed path, i.e. a different object name from the one uploaded. A private bucket
   answers a non-existent key with `AccessDenied` rather than `NoSuchKey`, which is what came back.
2. **There is no query string** — no `AccessKeyId`/`Expires`/`Signature`, no `X-Amz-Signature`.

Given your profile-picture findings, (1) looks like the same family: a stored value being treated as
an object key when it is not one. The difference is direction — there the query string was being
absorbed *into* the key, here the delimiters appear to be escaped *out* of it.

The dating is the useful part: every document uploaded before the 18 Sept deploy downloads, and this
one, uploaded on it, never has. If key or URL construction changed in that deploy, anything uploaded
since carries the same defect, and existing rows would need repairing rather than just new uploads
fixing — the same "does it heal on read" question `resolveStoredUrl` answered for avatars.
