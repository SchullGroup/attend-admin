# Frontend integration of Dave's 2026-09-18 reply — status (2026-09-19)

All seven items were answered. Four needed frontend work; it is done and committed. **None of it has
been exercised against a running backend** — the deploy has not happened, and prod is still
unreachable to non-browser clients (`BACKEND_TLS_CHAIN_PROD_2026-09-14.md`). Everything below reads
the new fields defensively, so each screen degrades to its current behaviour against an older API and
lights up on its own when the deploy lands. `npx tsc --noEmit` has not been run — please run it.

---

## Integrated

### C1 — `?range=` on client analytics · `src/api/client-analytics.ts`, `analytics/page.tsx`
`AnalyticsRange = "7d" | "30d" | "90d" | "12m" | "all"`, threaded through all nine hooks and into the
query keys, so switching range refetches rather than serving a cached window. `all` sends no
parameter at all — identical to today's requests — so this is safe to ship before the deploy.

A pill selector drives every card from one choice, and the subheading states that the window filters
on **event date, not created-at**, which Dave confirmed. Changing range resets the
event-performance page to 1.

`12m` is included because the monthly-trend endpoint is documented as a rolling 6-month view; worth
checking what it actually returns at `12m` once it is up.

### C2 — per-channel recipient counts · `src/api/client-events.ts`, `EventBroadcastTab.tsx`
`useBroadcastRecipients` now returns the whole object instead of one number. The composer picks the
count for the selected channel, so the button reads "Send to 138,902 via SMS" and a line above it
names how many will be skipped and why — **before** the send. `recipientCount` is still the fallback,
so an older API just shows the old single figure everywhere as it does now.

`unsubscribed` is not read: Dave confirmed there is no unsubscribe concept anywhere in the product,
and rendering a hard zero would read as "we checked".

### A2 / A3 — KYC · `src/api/super-admin.ts`, `SuperAdminAnalytics.tsx`, `participants/[id]/page.tsx`
The breakdown hook returns an envelope rather than a bare array: `items` plus `totalConsidered`,
`scope`, `byStatus`, `byMethod`. The card now states its denominator in the header — "10,096 users —
everyone except super admins" — so the old silent mismatch against the Users page cannot recur.

`byMethod` renders as three tiles under the bars, with a line saying in plain words that they do not
add up to the bars and are not meant to: NIN is verified at RSVP time and never moves a user along
the BVN ladder, and one user can be counted in all three. The tiles are hidden entirely when the
field is absent.

On the user detail, `maskValue` no longer masks anything that is not shaped like an identity number
(so a stray `"Not provided"` renders as itself rather than `Not **** ded`), and BVN / NIN carry their
own "Verified" pills off `bvnVerified` / `ninVerified`.

Checked for the `RegistrationSummaryResponse` casing change Dave flagged — nothing string-matches the
old spaced `"FULL KYC"` form anywhere in the codebase. `StatusBadge` normalises underscores itself.

### B1 — shareholder single-add · `src/api/registers.ts`
Two things, both because that endpoint returns **200 with `skipped`**, not a 4xx:

1. A skipped row is now converted into an error, so the form stays open with the typed values instead
   of clearing on a phantom success. The bulk/CSV path already handled this; single-add did not.
2. A constraint failure mentioning `chn` gets a specific message — that the column has not been
   relaxed yet and the pending migration needs to run — rather than an opaque 500.

CHN stays optional in the UI, which Dave confirmed was the right reading all along.

---

## Not touched, deliberately

**A1 (event-format lowercase)** — both renderers already resolve colours case-insensitively and
lowercase the label for display, so the fix lands with no change at our end. Worth a look after
deploy to confirm the card fills.

**A4 (`registerName` on registrar events)** — we already read `evt.registerName`. It will populate
itself. Making it a link needs `registerId`, which is in Dave's payload; left for when the data is
visible.

---

## Blocking, not ours

1. **Run the migration** — `migrations/2026-09-18-shareholder-chn-nullable-and-kyc-status-backfill.sql`.
   Without it: shareholders without a CHN still fail at the database, and NULL `kyc_status` rows can
   500 the participants list. A deploy alone does not fix either.
2. **The Huawei WAF certificate** — still serving the chain without its intermediate. Until that is
   uploaded, none of the above can be verified anywhere but local.
