# Backend — dashboard "Platform Users" active/suspended split is capped at 100 — 2026-08-28

## Symptom

On the Super Admin dashboard, the **Platform Users** stat card shows a correct grand
total (e.g. **1,079**) but the sub-line reads **"100 active · 0 suspended"** no matter how
many users actually exist. The "active" figure is always exactly the page size (100), and
"suspended" is always 0.

## Root cause — frontend can only see one page

The dashboard has **no endpoint that returns a platform-wide active/suspended user count**,
so the frontend was reduced to counting statuses across the single page of users it loads
for the "recent accounts" list:

- `GET /api/v1/admin/users?page=0&limit=100` → the FE counts `status === "ACTIVE"` /
  `"SUSPENDED"` in that 100-row page — see [page.tsx:209](src/app/(dashboard)/page.tsx#L209)
  and [super-admin-view.tsx](src/components/dashboard/super-admin-view.tsx).
- `totalUsers` (the big number, 1,079) is correct — it comes from `totalElements` on that
  same paged response, which is a true aggregate.
- But the active/suspended tally is a **sample of one page**, so it saturates at the page
  size. With 1,079 users and a 100-row page where all 100 happen to be ACTIVE, the FE
  computes "100 active · 0 suspended".

Neither endpoint that *could* carry the real split does:

- `GET /api/v1/admin/dashboard/stats` (`DashboardStatsResponse`) — returns
  `enrolledStakeholders`, `totalEvents`, `liveNow`, `pendingKYC`, `liveBanner`. **No user
  status counts.**
- `GET /api/v1/admin/stats` (`PlatformStatsResponse`) — returns `totalStakeholders`,
  `totalUsers`, `totalEvents`, `totalRsvps`. **Only a grand total, no split.**
- `GET /api/v1/admin/users` — accepts `page`, `limit`, and `kycStatus`. **No account-status
  (`ACTIVE`/`SUSPENDED`) filter**, so the FE can't even fetch `totalElements` per status.

## Frontend mitigation already shipped (2026-08-28)

The FE no longer presents the capped page count as if it were a platform total. It now
shows the exact "N active · M suspended" **only** when the number is trustworthy — i.e. the
overview endpoint supplies it, or the loaded page genuinely covers every user
(`users.length >= totalUsers`). Otherwise the sub-line falls back to the neutral
**"Registered accounts"**, and the secondary "Active Users" / "Suspended" cards render
**"—"** instead of a wrong figure. The grand total (`totalUsers`) is unaffected and stays
correct. See the `userSplitIsExact` guard in
[super-admin-view.tsx](src/components/dashboard/super-admin-view.tsx).

This is display-only: it stops the FE from lying, but it **cannot compute** the real split
without backend support. To actually show "N active · M suspended" again, the backend must
provide one of the options below.

## Requested backend change (pick one)

**Option A (preferred) — add the aggregate to the dashboard overview.**
Have `GET /api/v1/admin/dashboard` (the overview the FE already reads via
`useAdminDashboard`) include platform-wide counts:

```jsonc
{
  "totalUsers":     1079,
  "activeUsers":    1063,   // ← add
  "suspendedUsers":   16,   // ← add
  // …existing fields
}
```

The FE already prefers `adminDashboard.activeUsers` / `adminDashboard.suspendedUsers` when
present, so **populating these two fields makes the correct numbers appear with zero further
frontend changes.**

**Option B — add a status filter to the users list.**
Let `GET /api/v1/admin/users` accept `status=ACTIVE|SUSPENDED` and return an accurate
`totalElements`. The FE could then read the count from two cheap `limit=1` calls. (Heavier:
two extra requests per dashboard load, vs. Option A's zero.)

## Notes

- Total user count (e.g. 1,079) is **not** affected — it is already a real aggregate.
- Numbers above are illustrative; the backend supplies the true values.
- No security implication; these are read-only aggregate counts already visible in summary
  form on this dashboard.

## FE status (2026-09-11)

The frontend is **field-name tolerant** on both surfaces — it checks every variant listed
above via `??` chains, so populating *any one* of the name variants on either endpoint makes
the correct number appear automatically with **zero further FE changes**:

- **Dashboard** (`super-admin-view.tsx`): reads `adminDashboard.activeUsers` /
  `activeCount` / `totalActive` and `suspendedUsers` / `suspendedCount` / `totalSuspended`.
  The `hasAggregateSplit` guard detects any of those (not just the Option A names) to decide
  whether the breakdown is trustworthy.

- **All Users page** (`participants/page.tsx`): identical `??` chains on the keyed response
  object for all three metrics (`activeUsers`/`activeCount`/`totalActive`,
  `suspendedUsers`/`suspendedCount`/`totalSuspended`,
  `emailVerifiedUsers`/`emailVerifiedCount`/`verifiedEmailCount`).

- Types (`src/types/super-admin.ts`): `UserPagedResponse` and
  `AdminDashboardOverview` both declare all variants. `useUsers` returns `UserPagedResponse`;
  `useAdminDashboard` returns `AdminDashboardOverview`.

When no aggregate is present, both surfaces fall back to a `pageCoversAllUsers` guard (single
loaded page covers every user) before showing counts; otherwise they render "—" rather than a
misleading one-page estimate.

---

## Update 2026-09-07 — same gap hits the "All Users" (`/participants`) page too

The Super Admin **All Users** page (`GET /api/v1/admin/users`, super-admin view) shows the
same four figures and had the **same page-count-masquerading-as-total** bug — reported live
as *"the active and verified count isn't correct"*: with **10,086** total users it displayed
**"Active 17 · Email Verified 17"**, which was just 17 of the 20 rows on page 1. `Total Users`
(10,086) was correct (`totalElements`). See [participants/page.tsx](src/app/(dashboard)/participants/page.tsx).

**FE mitigation shipped (2026-09-07):** the page now applies the same `pageCoversAllUsers`
guard as the dashboard — it shows Active/Suspended/Email-Verified only from a real aggregate
(field-name-tolerant) or when the single loaded page covers every user; otherwise it renders
**"—"** (with a tooltip) instead of a wrong number. Display-only; it stops the FE lying but
**cannot compute** the real figures without backend support.

**Additional field needed beyond Option A/B above:** this page also has an **Email Verified**
tile, which needs a platform-wide **email-verified** count — a *different* metric from the
KYC-`verified` count already returned by `GET /api/v1/admin/participants/stats`. Do **not**
reuse KYC-verified for it.

Preferred backend fix for this surface — add the aggregates to the `GET /api/v1/admin/users`
paged response (the FE already reads these names tolerantly, so populating any one set makes
the numbers appear with **zero** further FE changes):

```jsonc
{
  "content": [ /* … page rows … */ ],
  "totalElements": 10086,       // already present + correct
  "activeUsers":        9910,   // ← add (a.k.a. activeCount / totalActive)
  "suspendedUsers":       12,   // ← add (a.k.a. suspendedCount / totalSuspended)
  "emailVerifiedUsers":  8123   // ← add (a.k.a. emailVerifiedCount / verifiedEmailCount)
}
```

(Equivalently, add `active` / `suspended` / `emailVerified` to `/api/v1/admin/participants/stats`
if that endpoint covers the same population as `/admin/users`.) Note the users list has more
statuses than `ACTIVE`/`SUSPENDED` (an `inactive` state is visible in the UI), so **Active
cannot be derived** as `total − suspended` on the FE — it must come from the backend.
