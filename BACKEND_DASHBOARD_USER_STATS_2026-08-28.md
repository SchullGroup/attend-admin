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

- Total user count (1,079) is **not** affected — it is already a real aggregate.
- Numbers above are illustrative; the backend supplies the true values.
- No security implication; these are read-only aggregate counts already visible in summary
  form on this dashboard.
