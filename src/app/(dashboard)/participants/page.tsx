"use client";
import { useState, useRef, Suspense } from "react";
import { UserAvatar } from "@/components/custom/user-avatar";
import Link from "next/link";
import {
  Search, Users, ShieldCheck, Shield, ShieldOff, CheckCircle2, UserMinus,
} from "lucide-react";
// CheckCircle2 kept for verified count stat only
import { useUsers, useSuspendUser, useActivateUser } from "@/api/super-admin";
import { useUrlEnumState, useUrlPageState, useUrlParamWriter, useUrlSearchState } from "@/lib/use-url-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/custom/status-badge";
import { Loader } from "@/components/ui/Loader";
import { formatDate } from "@/lib/utils";
import type { UserSummaryResponse } from "@/types/super-admin";

// The full UserStatus enum (backend note 2026-09-14 §3.3) — six values, not three.
// INACTIVE ("registered but never verified") is the default for every new signup, so
// leaving it out meant the largest group of users matched no tab at all.
const STATUS_FILTERS = [
  { label: "All",       value: "" },
  { label: "Active",    value: "ACTIVE" },
  { label: "Inactive",  value: "INACTIVE" },
  { label: "Pending",   value: "PENDING" },
  { label: "Suspended", value: "SUSPENDED" },
  { label: "Rejected",  value: "REJECTED" },
  { label: "Revoked",   value: "REVOKED" },
];

function ParticipantsPageInner() {
  // Filter state lives in the URL, not just in component state — opening a row and
  // coming back remounts this component, and local state would be gone. The query
  // string survives browser back and a reload.
  const writeParams = useUrlParamWriter();

  const [activeStatus] = useUrlEnumState("status", STATUS_FILTERS.map((f) => f.value), "");
  const [page, setPage] = useUrlPageState();
  // The box binds to `searchInput` so typing stays instant; `debouncedSearch`
  // (and the URL) only follow once typing settles, so one request goes out per
  // search rather than one per keystroke.
  const [searchInput, setSearchInput, debouncedSearch] = useUrlSearchState("q", 400, { page: null });
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const LIMIT = 20;

  // GET /api/v1/admin/users — status and search are both server-side. Search
  // splits the term and requires every word to match somewhere on the record
  // (backend note 2026-09-23 §2), so the whole term goes straight through and
  // pagination and counts are the server's again.
  const { data, isLoading } = useUsers("", page, LIMIT, true, {
    status: activeStatus,
    search: debouncedSearch,
  });

  const suspendMutation  = useSuspendUser();
  const activateMutation = useActivateUser();

  // Only take over the whole page on the FIRST load. Every filter change makes a
  // new query key, so React Query reports isLoading again — and swapping the page
  // for a loader unmounts the search box mid-word, dropping the cursor.
  const hasLoaded = useRef(false);
  if (data) hasLoaded.current = true;
  if (isLoading && !hasLoaded.current) return <Loader variant="page" text="Loading Users…" />;

  const raw = data as any;
  const allUsers: UserSummaryResponse[] =
    Array.isArray(raw?.content) ? raw.content :
    Array.isArray(raw)          ? raw          : [];

  // Belt and braces: the same filters applied again client-side. Against an API that has
  // picked up the new params this is a no-op (every row already matches). Against one that
  // has not — those commits are not deployed yet — it preserves the old behaviour of
  // narrowing the loaded page instead of silently showing an unfiltered list under a
  // "Suspended" tab. Delete once the filtered API is live everywhere.
  const users = activeStatus
    ? allUsers.filter((u) => (u.status ?? "").toUpperCase() === activeStatus)
    : allUsers;

  // Belt and braces, matching the server's rule: every word must appear
  // somewhere on the row. Against the fixed API this is a no-op; it only does
  // anything if a deploy is mid-flight.
  const searchTerms = debouncedSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const searchedUsers = debouncedSearch.trim().length >= 2
    ? users.filter((u) => {
        const haystack = `${u.firstName ?? ""} ${u.lastName ?? ""} ${u.email ?? ""} ${u.phone ?? ""}`.toLowerCase();
        return searchTerms.every((t) => haystack.includes(t));
      })
    : users;

  const totalElements = raw?.totalElements ?? raw?.totalCount ?? allUsers.length;
  const totalPages    = raw?.totalPages    ?? Math.ceil(totalElements / LIMIT);

  // Active / Suspended / Email-verified are PLATFORM-WIDE aggregates, but GET /admin/users
  // returns only one page (LIMIT rows) with no status/verified breakdown — so counting the
  // loaded page saturates at the page size and lies (e.g. "17 active" out of 10,086, which is
  // just 17 of the 20 rows on this page). Mirror the dashboard's guard (super-admin-view.tsx +
  // BACKEND_DASHBOARD_USER_STATS_2026-08-28.md): use a real aggregate when the response carries
  // one, else the page count ONLY when the single page genuinely covers every user; otherwise
  // show "—" rather than a wrong number. Field-name-tolerant so the true figures appear
  // automatically once the backend adds the aggregates.
  const pageCoversAllUsers = allUsers.length > 0 && totalElements > 0 && allUsers.length >= totalElements;

  const aggActive    = raw?.activeUsers        ?? raw?.activeCount        ?? raw?.totalActive        ?? null;
  const aggInactive  = raw?.inactiveUsers      ?? raw?.inactiveCount      ?? raw?.totalInactive      ?? null;
  const aggSuspended = raw?.suspendedUsers     ?? raw?.suspendedCount     ?? raw?.totalSuspended     ?? null;
  const aggVerified  = raw?.emailVerifiedUsers ?? raw?.emailVerifiedCount ?? raw?.verifiedEmailCount ?? null;

  const pageActive    = allUsers.filter((u) => u.status?.toUpperCase() === "ACTIVE").length;
  const pageInactive  = allUsers.filter((u) => u.status?.toUpperCase() === "INACTIVE").length;
  const pageSuspended = allUsers.filter((u) => u.status?.toUpperCase() === "SUSPENDED").length;
  const pageVerified  = allUsers.filter((u) => u.emailVerified).length;

  // number | null — null renders as "—" (unknown, not zero).
  const activeCount:    number | null = aggActive    ?? (pageCoversAllUsers ? pageActive    : null);
  const inactiveCount:  number | null = aggInactive  ?? (pageCoversAllUsers ? pageInactive  : null);
  const suspendedCount: number | null = aggSuspended ?? (pageCoversAllUsers ? pageSuspended : null);
  const verifiedCount:  number | null = aggVerified  ?? (pageCoversAllUsers ? pageVerified  : null);
  const unknownAggregateTitle = "Platform-wide count isn't available from the API yet — showing “—” instead of a misleading one-page estimate.";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Users</h1>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-bold tabular-nums text-[hsl(var(--foreground))]">{totalElements}</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Total Users</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-green-50 flex items-center justify-center">
              <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
            </div>
            <div>
              <div className="text-sm font-bold tabular-nums text-[hsl(var(--foreground))]" title={activeCount === null ? unknownAggregateTitle : undefined}>{activeCount ?? "—"}</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Active</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gray-100 flex items-center justify-center">
              <UserMinus className="h-3.5 w-3.5 text-gray-500" />
            </div>
            <div>
              <div className="text-sm font-bold tabular-nums text-[hsl(var(--foreground))]" title={inactiveCount === null ? unknownAggregateTitle : "Registered but never verified — the default state for a new signup."}>{inactiveCount ?? "—"}</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Inactive</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-yellow-50 flex items-center justify-center">
              <Shield className="h-3.5 w-3.5 text-yellow-600" />
            </div>
            <div>
              <div className="text-sm font-bold tabular-nums text-[hsl(var(--foreground))]" title={suspendedCount === null ? unknownAggregateTitle : undefined}>{suspendedCount ?? "—"}</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Suspended</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-purple-50 flex items-center justify-center">
              <CheckCircle2 className="h-3.5 w-3.5 text-purple-600" />
            </div>
            <div>
              <div className="text-sm font-bold tabular-nums text-[hsl(var(--foreground))]" title={verifiedCount === null ? unknownAggregateTitle : undefined}>{verifiedCount ?? "—"}</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Email Verified</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search + status filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))] pointer-events-none" />
          <Input
            placeholder="Search by name, email, or phone…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1 overflow-x-auto max-w-full">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => writeParams({ status: f.value, page: null })}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeStatus === f.value
                  ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="attend-card overflow-hidden">
        {/* Scroll rather than clip. Truncation above keeps this from being
            needed in normal use, but a narrow laptop with every column shown
            should still be able to reach the Actions column. */}
        <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">User</th>
              <th className="px-5 py-3 text-left whitespace-nowrap">Phone</th>
              <th className="px-5 py-3 text-left">Roles</th>
              <th className="px-5 py-3 text-left whitespace-nowrap">KYC</th>
              <th className="px-5 py-3 text-left whitespace-nowrap">Status</th>
              <th className="px-5 py-3 text-left whitespace-nowrap">Joined</th>
              <th className="px-5 py-3 text-left whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {searchedUsers.map((u) => {
              const fullName   = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email;
              const initials   = `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase() || u.email[0].toUpperCase();
              const isSuspended = u.status?.toUpperCase() === "SUSPENDED";
              const isConfirm   = confirmId === u.id;

              const roles: string[] =
                Array.isArray(u.roles) && u.roles.length > 0
                  ? u.roles
                  : u.role
                  ? [u.role]
                  : [];

              return (
                <tr key={u.id} className="attend-table-row">
                  {/* User */}
                  {/* Capped and truncated: these are user-supplied and some are
                      very long. Without a cap one pasted name stretches the
                      column and pushes the rest of the table off screen — the
                      `min-w-0` is what actually lets the flex child shrink, and
                      `title` keeps the full value one hover away. */}
                  <td className="px-5 py-3 w-full max-w-[280px]">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar src={u.avatarUrl} initials={initials} size={32} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[hsl(var(--foreground))] truncate" title={fullName}>{fullName}</div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))] truncate" title={u.email}>{u.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* Phone */}
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                    {u.phone ?? "—"}
                  </td>

                  {/* Roles */}
                  <td className="px-5 py-3">
                    {roles.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {roles.map((r) => (
                          <span
                            key={r}
                            className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]"
                          >
                            {r.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-[hsl(var(--muted-foreground))]">—</span>
                    )}
                  </td>

                  {/* KYC */}
                  <td className="px-5 py-3">
                    {u.kycStatus
                      ? <StatusBadge status={u.kycStatus.toLowerCase()} />
                      : <span className="text-sm text-[hsl(var(--muted-foreground))]">—</span>
                    }
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3">
                    <StatusBadge status={u.status?.toLowerCase()} />
                  </td>

                  {/* Joined */}
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                    {u.createdAt ? formatDate(u.createdAt) : "—"}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/participants/${u.id}`}>
                        <Button size="sm" variant="outline" className="h-7 text-xs">View</Button>
                      </Link>
                      {isSuspended ? (
                        <Button
                          size="sm" variant="outline"
                          className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
                          disabled={activateMutation.isPending}
                          onClick={() => activateMutation.mutate(u.id)}
                        >
                          Restore
                        </Button>
                      ) : isConfirm ? (
                        <Button
                          size="sm" variant="outline"
                          className="h-7 text-xs text-red-600 border-red-400 bg-red-50"
                          disabled={suspendMutation.isPending}
                          onClick={() => { suspendMutation.mutate(u.id); setConfirmId(null); }}
                        >
                          Confirm?
                        </Button>
                      ) : (
                        <Button
                          size="sm" variant="outline"
                          className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => setConfirmId(u.id)}
                        >
                          <ShieldOff className="h-3 w-3 mr-1" /> Suspend
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>

        {searchedUsers.length === 0 && (
          <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
            {debouncedSearch.trim().length >= 2
              ? `No users matching "${debouncedSearch}".`
              : "No users in this category."}
          </div>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Page {page + 1} of {totalPages}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * useSearchParams needs a Suspense boundary above it — without one the whole
 * route opts out of static rendering and Next.js errors at build time.
 */
export default function ParticipantsPage() {
  return (
    <Suspense fallback={<Loader variant="page" text="Loading Users…" />}>
      <ParticipantsPageInner />
    </Suspense>
  );
}
