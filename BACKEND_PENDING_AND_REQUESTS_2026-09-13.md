# Backend — pending items, a confirmed live blocker, and one new request (2026-09-13)

Reply to your status note of **2026-09-11** (`dave-back.md`). The admin/organiser frontend
side of §2, §3 and §4 is **built and merged into the working tree** of `attend-admin` — so
everything below is either waiting on you, waiting on a decision, or new.

One headline before the detail: **§2 is live on `attend-api.schulltech.com`**. Your note says
"nothing has been deployed", but `POST /api/v1/client/events/{id}/launch-media/upload-session`
answered us in production today with a signed URL. Please confirm what else went out with it —
we have been assuming §3 and the §4 handler are also live, and we would rather not find out
by testing against a mix.

---

## 0. What we built this side (so it is clear what is blocked on what)

| Item | Where | State |
|---|---|---|
| §2 media gallery — 3-step signed upload, gallery, delete | `src/api/client-launch-media.ts`, `EventLaunchMediaTab.tsx` (new "Media" tab on Launch events) | Built. **Upload blocked by §6.2** |
| §3 support email — org read/write, per-AGM override, `supportEmail` on both AGM create paths | `src/api/client-settings.ts`, Support Contact card on Settings | Built, untested against a live response |
| §4 413 — real 413 copy that distinguishes nginx from the app | `src/lib/api-error.ts` | Built |
| §4 client-side downscale (~1024px, JPEG 0.8) before `POST /api/v1/upload` | `src/lib/image-downscale.ts`, wired into org logo, registrar logo, event flyer | Built. Certificate artwork deliberately excluded — it is print-resolution and often a PDF |
| §5.2 `bannerUrl` | — | Confirmed absent from this codebase. Nothing to remove |
| §5.1 application statuses | `hackathons/*`, `client-challenges.ts` | Already `SUBMITTED → UNDER_REVIEW → SHORTLISTED → SELECTED / NOT_PROGRESSED`. No `ACCEPTED`/`REJECTED` anywhere |
| §1 NIN | — | Participant app, not this repo |

The one thing we did **not** build: the per-AGM support-email override has a hook but no UI
yet. Say if organisers should be able to set it per event from the dashboard and we will add
it to the event Settings tab.

---

## 1. 🔴 LIVE BLOCKER — §6.2 OBS CORS. The media PUT fails in the browser, confirmed today

Your note predicted this; this is the confirmation, with a repro.

**Repro (2026-09-13, production API):**

- Event `8bf1ea0c-6836-4038-9cfe-1962c67bd6fe` (Product Launch, status `ENDED`), Media tab
- File: `2x Cert.jpg`, `image/jpeg`, **1.1 MB** — well inside the 15 MB image cap
- Step 1 `POST …/launch-media/upload-session` → **200**, signed `uploadUrl` returned
- Step 2 `PUT <uploadUrl>` → **fails with no HTTP response at all** — the classic blocked
  preflight signature. Nothing reaches the bucket
- Step 3 never runs

Since the request never completes, there is no status code to quote: a cross-origin `PUT`
is preflighted, the bucket answers the `OPTIONS` without the right CORS headers, and the
browser drops the request before it is sent. `curl` and native clients are unaffected, which
is why this only shows up here.

**What the bucket rule needs** (this is the whole ask):

| Field | Value |
|---|---|
| `AllowedMethod` | `GET`, `HEAD`, **`PUT`** |
| `AllowedOrigin` | the deployed admin origin, the deployed participant origin, and **`http://localhost:3000`** for development |
| `AllowedHeader` | `*` (the preflight asks for `content-type`; the signature also depends on it) |
| `ExposeHeader` | `ETag` |
| `MaxAgeSeconds` | anything sane, e.g. `3600` — keeps the preflight from repeating per chunk |

Notes so the rule is not narrowed into uselessness:

- The `PUT` deliberately carries **no `Authorization` header** — the signature is in the
  query string, exactly as you specified. Do not require one.
- Plain `<img src>` / `<video src>` rendering of a signed URL is **not** affected and works
  today, so the gallery *displays* fine. It is only the upload `PUT`, and the JS reads
  (`fetch`, `canvas` pixel reads) behind the certificate preview and logo sampling, that are
  blocked. Those are the same rule.
- Please include `localhost:3000`. Without it we cannot test any of this before deploying,
  and the alternative is testing in production.

**Three questions that fall out of this repro:**

1. **Orphan rows.** Our failed attempt should have left an `AWAITING_UPLOAD` row on that
   event in production. The organiser list came back with 0 assets, but our list only
   refetches after a successful upload or on its refresh timer, so that may just be our
   stale view. Confirm the row exists — the tile that lets an organiser see and delete a
   failed upload depends on it. And if there is a sweeper for abandoned sessions, say what
   its window is; if there is not, that row is ours to clean up manually.
2. **`ENDED` events.** The session was created for an event whose status is `ENDED`. Should
   it have been? We would expect media to be editable after an event ends (galleries are
   often filled in afterwards), but if you intend to block it, block it at the session step
   rather than at `complete`, so we fail before the upload rather than after.
3. **Media on an event that is not `PRODUCT_LAUNCH`** returns 404 per your note — confirmed
   in our types, no action needed, just noting we rely on it (see §5 below, which would
   change that answer if you extend the flyer to challenges).

**Fallback we do not want but will take:** if the bucket rule is going to be weeks away, say
so and we will take the multipart-through-the-API path for images only. It needs §6.1 anyway
and it cannot carry video, so it is a stopgap, not a plan.

---

## 2. 🔴 §6.1 nginx `client_max_body_size` — still needed, still unapplied as far as we know

```nginx
# server block for attend-api.schulltech.com
client_max_body_size 26m;   # match spring.servlet.multipart.max-request-size
nginx -t && systemctl reload nginx
```

Everything through `POST /api/v1/upload` is capped at ~1 MB until this lands: profile
pictures, org and registrar logos, event flyers, AGM notices, press-kit files, challenge
resources, certificate artwork.

What we did in the meantime, so this is not the only thing standing between users and a
working upload:

- Images are downscaled in the browser before upload (~1024 px, JPEG 0.8; 1600 px for
  flyers; PNG stays PNG so logo transparency survives; SVG and GIF untouched). A phone photo
  now goes out at a few hundred KB, which slips under even the 1 MB default.
- A 413 with an HTML body is now reported as "the server rejected this before it reached the
  app", distinct from our own JSON 413. Your new handler's message comes through as-is.

Neither is a substitute for the config change — certificate artwork and AGM notice PDFs are
not downscalable. **Please confirm when it is applied**, and we will re-test the large-file
paths in one pass.

---

## 3. Still pending on your side, from your own note

Nothing here is a complaint — your note flagged all of it. This is the list we are tracking
so it does not quietly age out.

| # | Item | Your ref | What unblocks it |
|---|---|---|---|
| 1 | Dojah **sandbox** credentials — the app holds prod keys, so NIN has never made a live call | §7.2, "Not done" | Someone with dashboard access supplies a sandbox App ID + secret; then it is a config switch and two calls with test NIN `70123456789` |
| 2 | NIN two-step has no automated test proving the gate holds | "Not done" | Needs `DojahService` to stop building its own `RestTemplate` before the provider can be mocked |
| 3 | Support address is **not used in outbound email** — AGM notices and reminders still sign off with the platform address | §3, §7.4 | A decision from us (see §4 below), then a pass through the templates |
| 4 | Launch media not exposed on the **guest/microsite** path | §7.3, "Not done" | A decision from us on media + flyer together (see §4) |
| 5 | **No reorder endpoint** for gallery media | "Not done" | Low priority for us — `orderIndex` on upload is fine for now. Our UI sorts by it and says there is no drag-to-reorder yet |
| 6 | `EventItem` **Swagger schema collision** — four nested classes share the name | §5.3 | Renaming them apart. Swagger-only, no JSON impact. This is why our generated types keep drifting, so it is worth the deliberate pass |
| 7 | Deployment state of everything except §2 | Header of your note | See the note at the top — §2 is live in prod; tell us about §3 and §4 |

---

## 4. The decisions you asked us for

**§7.6 — BVN `step1` sets `bvnVerified` without a selfie.** Our part of the answer first:
**`bvnVerified` appears zero times in `attend-admin`.** Every gate in this app reads
`kycStatus` or the role, so there is no exposure from the organiser dashboard. The
participant web app and `attend-mobile` still need the same grep before this can be called
closed. On the fix itself: our preference is making `selfieImage` mandatory on `step1`,
because "the flag exists but does not mean what it says" is the kind of thing that gets
picked up and gated on later by someone who did not read this thread — but AGM is live, so
this is your call on timing.

**§7.4 — AGM email address scope.** Two things you asked. On the mechanics there is no
choice: `From` has to stay a Postmark-verified sender, so the organiser address can only be
`Reply-To` — please implement it that way. On scope (all AGM mail vs. some), that is a
product call and we will come back to you; our instinct is all attendee-facing AGM mail
(notices, reminders, proxy confirmations) and nothing transactional.

**§7.5 / §5.3 — count on list items.** For the **admin dashboard we do not need it**: our
client and admin list responses already carry `rsvpCount`, and it is populated. The gap is
the participant Home cards only, so the batched grouped count is a participant-app decision,
not ours. Do not build it on our account.

**§7.7 — is NIN mandatory for Innovation/Launch RSVP?** Participant app decision, still open
our side. Noting your ordering point, which we agree with: do not switch on a server-side
gate before there is a working NIN flow in production, or it locks people out of both event
types.

**§7.3 — guest/microsite media.** Your point that doing media without the flyer would be
odd is right, so treat them as one item. Our leaning is both on the guest path — the same
`READY`-only, freshly-signed list, plus `flyerUrl` on the guest event responses — since a
microsite with no imagery at all is the weaker half of the trade. **Hold for a confirmation
from us before building it**; we will come back on this together with the §7.4 scope answer.

---

## 5. 🚧 NEW REQUEST — optional flyer for Innovation Challenge events

Small one, and it mirrors something you already have.

`flyerUrl` today lives only on `productLaunchConfig` and is null everywhere else (your §5.2
confirmed that). We want the same optional field on **Innovation Challenge / Hackathon**
events: organisers are creating challenges with no visual at all, while a launch event beside
it gets a hero image.

**What we need:**

| Where | Change |
|---|---|
| `POST /api/v1/client/events` | optional `innovationChallengeConfig.flyerUrl` |
| `POST /api/v1/admin/events/innovation` | optional `flyerUrl` (top-level, matching how the other admin create payloads are shaped) |
| `PATCH` event update | accept `flyerUrl` for challenge events, so it can be added or replaced after creation |
| Event detail — client, admin, participant, guest | echo `innovationChallengeConfig.flyerUrl` |

**Notes:**

- Same semantics as the launch flyer: **optional**, a plain URL string, uploaded by us
  through `POST /api/v1/upload` first (so it inherits §6.1 — one more reason that config
  change matters), stored as returned.
- Not the §2 signed-upload flow. A single flyer does not need a media session, and we would
  rather not have two upload shapes for one image. If you would rather it went through
  storage the §2 way, say so and we will follow, but then it needs §6.2 first.
- No validation beyond "is a URL" is expected. Size/type is enforced our side and by the
  upload endpoint.
- Frontend work waiting on this: the flyer control already exists (`ImageUrlUpload`, used in
  the launch wizard and the event Settings tab) and is gated to Product Launch. Once the
  field is accepted we drop the gate for challenges — perhaps an hour of work.
- Scope check: **flyer only**, not the full §2 gallery, for challenges. If you think the
  gallery should generalise to all event types eventually, that is worth designing once
  rather than twice — but it is not what we are asking for here.

---

## 6. 🔴 Zoom Sessions — the host pool and the overview cards contradict each other

On `/admin/zoom-sessions` today, the four cards at the top say **Total capacity 4 · Slots in
use 2 · Slots free 2 · Stranded 0**, while the host pool table underneath shows:

| Host account | Capacity | In use |
|---|---|---|
| `itprogrammers@meristemng.com` | 2 | **0 / 2** |
| `oladotunolorunyomi@meristemng.com` | 2 | **0 / 2** |

`0 + 0 ≠ 2`. Two slots are held and neither host admits to holding one.

**Why:** the two halves of that page read two different endpoints, and only one of them
reports usage.

- `GET /api/v1/admin/zoom-hosts` returns capacity per host but **no usage field at all**
  (`activeCount` / `inUse` / `used` — none present), so every row rendered a hard-coded `0`.
- `GET /api/v1/admin/zoom-sessions` is where "Slots in use 2" comes from — either from its
  totals object or, when that is absent, from us counting non-stranded session rows.

So this is a payload gap, not a Zoom problem — but it reads to an operator as "the page is
broken", which on a capacity screen is worse than a blank.

**What we changed today** (so the screen is not actively misleading while you look at it):
per-host usage is now attributed from the sessions list by matching each held slot's
`zoomHostEmail` to a pool row, marked **est.**, with a footnote saying it is derived. If a
held slot names an account that is not in the pool — or names no account — the card now says
how many slots could not be attributed instead of silently swallowing the difference.

**What we need from you:**

1. **Per-host usage on `GET /api/v1/admin/zoom-hosts`.** `activeCount` is the name we read
   first (also accepted: `active_count`, `activeMeetings`, `inUse`, `used`, `usedSlots`,
   `slotsInUse`). It must be computed from the same source as the sessions view, or the two
   will still disagree — just less obviously.
2. **An explicit totals object on `GET /api/v1/admin/zoom-sessions`**: `totalCapacity`,
   `slotsInUse`, `slotsFree`, `strandedSlots`. We derive all four when they are missing, and
   two independent derivations of the same quantity is exactly how a page ends up arguing
   with itself.
3. **Which source wins** when they disagree, so we stop guessing.
4. **Can a slot be held by an account that is not in the pool?** If yes — legacy events, the
   S2S `users/me` account, anything assigned before the pool existed — say so, because then
   "Total capacity" summed from the pool is not the real ceiling and the whole card is
   understating the platform.
5. **Definition check:** we treat "in use" as *held and not stranded*, whether or not the
   meeting has actually started. If your count means "live right now", the two will differ
   by every assigned-but-not-started meeting, and we should align on one meaning.

---

## 7. Platform user counts — the dashed lines, and the filters behind them

### 7.1 The counts (escalating `BACKEND_DASHBOARD_USER_STATS_2026-08-28.md`)

That note asked for platform-wide `activeUsers` / `suspendedUsers`. It has not landed, and
the gap now shows in two places: the super-admin dashboard card, and **All Users**
(`/participants`), where the header reads **10,092 Total Users** next to **Active —**,
**Suspended —**, **Email Verified —**.

The dashes are deliberate on our side: `GET /api/v1/admin/users` returns one page (20 rows)
with no breakdown, so counting the page would report "17 active" out of 10,092. We would
rather show nothing than a number that is wrong by three orders of magnitude — but nothing
is still not what the page is for.

**What to add** — either on the `GET /api/v1/admin/users` paged response (which is what this
screen reads, so it costs no extra request) or on the dashboard overview, ideally both:

```jsonc
{
  "content": [ /* … the page … */ ],
  "totalElements": 10092,
  "activeUsers":        9871,   // ← add
  "suspendedUsers":       84,   // ← add
  "emailVerifiedUsers": 7310    // ← add
}
```

We already read these tolerantly, so **populating any one spelling of each makes the numbers
appear with no frontend change**:

| Stat | Field names we accept, in order |
|---|---|
| Active | `activeUsers`, `activeCount`, `totalActive` |
| Suspended | `suspendedUsers`, `suspendedCount`, `totalSuspended` |
| Email verified | `emailVerifiedUsers`, `emailVerifiedCount`, `verifiedEmailCount` |

### 7.2 The filters — arguably the bigger problem

`GET /api/v1/admin/users` accepts only `page`, `limit` and `kycStatus`. No account-status
filter, no search. So on a table of **10,092 users**:

- the **All / Active / Suspended / Pending** tabs filter the **20 rows already loaded**, client-side;
- the **search box** searches those same 20 rows — looking up a user by email returns
  "nothing found" unless they happen to be on the page you are standing on.

That is not a cosmetic gap; it makes the admin user table unusable for its main job. Please add:

- `status=ACTIVE|SUSPENDED|…` — with an accurate `totalElements` per status (which also gives
  you a cheap way to satisfy 7.1: two `limit=1` calls);
- `search=` matching name, email and phone, server-side.

### 7.3 Status vocabulary — we are reading values that do not exist in the contract

The rows on that page come back with **`inactive`** (lower-case) in the status field, next to
`Active`. Our type says the field is `"ACTIVE" | "SUSPENDED" | "PENDING"`, which came from
the spec. Two consequences: the **Pending** tab matches nothing, and every `inactive` row
falls outside all four tabs.

Please confirm the canonical enum and casing — and if `INACTIVE` is a real state, say what
distinguishes it from `SUSPENDED` and from `PENDING`, because the UI currently implies three
states while the API is emitting a fourth.

---

## 8. Reminder — the QA stress test

Our QA team ran a stress test against the platform and raised a set of findings. We have not
seen a written status on any of them since, and there is no record of the outcomes on our
side — so before the next round of testing:

1. **Which findings have been actioned?** A line per finding is enough: fixed / in progress /
   won't fix / needs a decision from us.
2. **What changed functionally as a result?** Anything that altered an endpoint's behaviour,
   limits, timeouts, pagination, or error shapes needs to reach us — the frontend hard-codes
   assumptions about all four, and a silent change surfaces as a bug in the UI.
3. **What limits did the test actually establish?** Concurrent users, concurrent live
   meetings, import size and rate, request timeouts. `BACKEND_INVITE_DIRECTORY_PRODUCTION_FIXES_2026-08-20.md`
   asked for these to be published from a load test rather than guessed, and they still are
   not documented anywhere we can read.
4. **Is the environment that was tested the one now serving production?** Several items in
   this note turn on that (the §2 endpoints answering in prod, the nginx limit, the Zoom host
   pool sizing).

If the findings live in a document on your side, send it over and we will track them
alongside this file rather than in parallel.

---

## 9. Summary of what we are waiting on

1. **OBS bucket CORS** (§6.2) — GET/HEAD/PUT + `ETag` + `localhost:3000`. Blocks all media upload and every JS read of a stored asset. **Highest priority: a finished feature is sitting behind it.**
2. **nginx `client_max_body_size 26m`** (§6.1) — blocks every upload over ~1 MB.
3. **Confirmation of what is deployed** beyond §2.
4. Whether the failed-upload `AWAITING_UPLOAD` row exists (and any sweeper window).
5. Dojah sandbox credentials, so NIN can be exercised before anything gates on it.
6. `Reply-To` for AGM mail using the resolved support address.
7. Guest path: launch media + `flyerUrl`.
8. New: optional `flyerUrl` for Innovation Challenge events.
9. Per-host usage on `/admin/zoom-hosts` + an explicit totals object on `/admin/zoom-sessions`, so the capacity screen stops contradicting itself.
10. Platform-wide user aggregates, plus `status` and `search` params on `/admin/users` — the tabs and search on a 10,092-row table currently only filter the 20 loaded rows.
11. Confirmation of the user-status enum (`inactive` is being returned and is not in the contract).
12. A status line per QA stress-test finding, and the limits that test established.
