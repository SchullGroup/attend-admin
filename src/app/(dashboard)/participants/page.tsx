"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Search, Users, ShieldCheck, Shield, ShieldOff, CheckCircle2, UserMinus,
} from "lucide-react";
// CheckCircle2 kept for verified count stat only
import { useUsers, useSuspendUser, useActivateUser } from "@/api/super-admin";
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

function useDebounce<T>(value: T, ms = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function ParticipantsPage() {
  // Filter state lives in the URL, not just in component state — opening a row and
  // coming back remounts this component, and local state would be gone. The query
  // string survives browser back and a reload.
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const [searchInput,    setSearchInput]    = useState(() => searchParams.get("q") ?? "");
  const [activeStatus,   setActiveStatus]   = useState(
    () => (STATUS_FILTERS.some((f) => f.value && f.value === searchParams.get("status"))
      ? searchParams.get("status")!
      : "")
  );
  const [confirmId,      setConfirmId]      = useState<string | null>(null);
  const [page,           setPage]           = useState(() => {
    const p = Number(searchParams.get("page"));
    return Number.isInteger(p) && p > 0 ? p : 0;
  });
  const LIMIT = 20;

  const debouncedSearch = useDebounce(searchInput, 400);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (searchInput)  params.set("q", searchInput);       else params.delete("q");
    if (activeStatus) params.set("status", activeStatus); else params.delete("status");
    if (page > 0)     params.set("page", String(page));   else params.delete("page");
    const next = params.toString();
    if (next !== searchParams.toString()) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }, [searchInput, activeStatus, page, pathname, router, searchParams]);

  // GET /api/v1/admin/users — status and search are server-side as of the backend's
  // 2026-09-14 note, so the tabs and the search box now filter all 10k+ users rather than
  // the 20 rows already on screen.
  const { data, isLoading } = useUsers("", page, LIMIT, true, {
    status: activeStatus,
    search: debouncedSearch,
  });
  const suspendMutation  = useSuspendUser();
  const activateMutation = useActivateUser();

  if (isLoading) return <Loader variant="page" text="Loading Users…" />;

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

  const searchedUsers = debouncedSearch.trim().length >= 2
    ? users.filter((u) => {
        const name = `${u.firstName} ${u.lastName}`.toLowerCase();
        const s = debouncedSearch.toLowerCase();
        return name.includes(s) || u.email.toLowerCase().includes(s) || (u.phone ?? "").includes(s);
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
            onChange={(e) => { setSearchInput(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1 overflow-x-auto max-w-full">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setActiveStatus(f.value); setPage(0); }}
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
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">User</th>
              <th className="px-5 py-3 text-left">Phone</th>
              <th className="px-5 py-3 text-left">Roles</th>
              <th className="px-5 py-3 text-left">KYC</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Joined</th>
              <th className="px-5 py-3 text-left">Actions</th>
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
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]">
                        {initials}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[hsl(var(--foreground))]">{fullName}</div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))]">{u.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* Phone */}
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                    {u.phone ?? "—"}
                  </td>

                  {/* Roles */}
                  <td className="px-5 py-3">
                    {roles.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {roles.map((r) => (
                          <span
                            key={r}
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]"
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
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                    {u.createdAt ? formatDate(u.createdAt) : "—"}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3">
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
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
