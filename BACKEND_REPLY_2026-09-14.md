# FE reply — to your Backend Status of 2026-09-14

Short one. Everything in your note that needed frontend work is built and typechecks; three
things need you.

---

## 1. ⚠️ §7.3 contradicts §5.1, in the same document

This is the one that matters before deploy.

- **§5.1** — *"`launch-media` is now a historical name, not a restriction. It works on AGMs,
  challenges and general events too… Dropping the type guard was the entire change."*
- **§7.3** — *"404 on non-`PRODUCT_LAUNCH` confirmed — and §5 does not change it, since the
  challenge flyer is a config field, not the gallery."*

Both cannot be true. §7.3's reasoning is also stale on its own terms: §5.2 moved the flyer
off the config tables onto the event, so "the challenge flyer is a config field" no longer
describes anything.

**We have built to §5.1** — the Media tab is now offered on every event type. If §7.3 is
actually the live behaviour, that tab 404s on four of the five types the moment it deploys.
Please confirm which is right; it is a one-line answer and it decides whether we ship or
re-gate.

## 2. §3.3 — the lower-case `inactive` was ours. Closed.

You asked for the raw JSON. No need: we found it. Our users table rendered
`<StatusBadge status={u.status?.toLowerCase()} />`, and the badge component had no entry for
`inactive`, so it fell through to a fallback that echoed back the string we had just
lower-cased. Your endpoints were serialising `INACTIVE` correctly the whole time.

Fixed our side: the six `UserStatus` values are all handled, and the unknown-value fallback
now title-cases rather than echoing raw, so a seventh value would render as "Under Appeal"
rather than `under_appeal`. Nothing needed from you.

## 3. ⚠️ `migrations/2026-09-14-event-flyer-url.sql` fails silently if missed

Flagging it because it is the dangerous kind. The NIN migration announces itself — the table
500s and someone notices within minutes. The flyer backfill does not: `ddl-auto` creates the
nullable column happily, the deploy looks clean, and **every event that already has a flyer
just quietly loses it.** Nobody finds out until an organiser asks where their artwork went.

Please make sure it runs with the deploy rather than after it, and on every database serving
this API — which still depends on your own open question about whether staging and production
are the same environment.

---

## What we built against this note

| Your § | Frontend change |
|---|---|
| §5.1 gallery on all types | Media tab ungated from Product Launch; copy no longer says "launch page". Endpoints and component name left as `launch-media`, same reasoning you gave |
| §5.2 flyer top-level | Reads prefer `event.flyerUrl`, config echoes are fallback only; writes go top-level on the client create and all four admin creates; flyer upload added to the AGM and General wizards, ungated in the event Settings tab; Overview renders it for any event type |
| §2.1 Zoom fields | `strandedCount`, `freeSlots`, `ledgerActiveCount`, `ledgerDrift` per host; `slotsHeldOutsidePool` and `ledgerSlotsInUse` on the totals. When slots are held outside the pool the page now states that total capacity is not the real ceiling, rather than letting "in use" exceed it and look like a bug |
| §3.1/§3.2 users | `status` and `search` sent server-side, four aggregate tiles including `inactiveUsers`, six-value status tabs. Client-side filtering kept underneath until those commits deploy — a no-op against the new API, and it stops today's API showing an unfiltered list under a "Suspended" tab |
| §3.3 status enum | `UserStatus` widened to all six; see §2 above |
| §7.1 orphan rows | We were invalidating the media query only on success, so a failed upload never re-read the list and its `AWAITING_UPLOAD` tile stayed invisible. Now invalidated on settle — your `saveAndFlush` answer is what made this findable |

Your derivation now wins over ours everywhere it exists; our local fallback stays only until
those nine commits are actually deployed.

## Still with us, not you

- **`bvnVerified` grep** in the participant web app and `attend-mobile` — your §8 gate. Not done.
- **QA stress-test findings** — being chased; you are right that you have never been sent them.
- **Microsite decisions (§6)** — we are not doing the microsite for now, so both questions
  (countdown teaser on an embargoed slug, flyers on the minimal public list) are parked
  rather than answered. Nothing to build there.

## One from us you have not seen

`BACKEND_TLS_CHAIN_PROD_2026-09-14.md` in this repo. **The production API serves an incomplete
TLS certificate chain**, so no non-browser client can connect to it — our admin portal cannot
reach prod at all. It is not your code and not nginx: the hostname resolves to Huawei Cloud
WAF, which terminates TLS and presents a wildcard certificate uploaded without its
intermediate. Independently confirmed by SSL Labs and SSL Shopper. It is with whoever
administers that WAF.

It also bears on your open staging-vs-production question: `attend-api.schulltech.com` answers
from nginx directly with a complete chain, `attend-backend-prod.experienceattend.com` answers
from the WAF fleet with a broken one. Whatever is true of the databases, those two hostnames
are not the same front door.
