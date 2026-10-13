"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/custom/user-avatar";
import { Users, Download, Loader2, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateCell } from "@/components/ui/date-cell";
import { useExportAttendees, useClientEventAttendees } from "@/api/client-events";
import { useEventAttendees } from "@/api/super-admin";
import { useGetMe } from "@/api/auth/hooks";
import { resolveRole, isSuperAdminRole } from "@/lib/utils";

// ─── KYC Status badge ─────────────────────────────────────────────────────────

function KycBadge({ status }: { status: string }) {
  const s = (status ?? "").toLowerCase();
  if (s === "full_kyc") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700">
        Full KYC
      </span>
    );
  }
  if (s === "pending_review") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-700">
        Pending Review
      </span>
    );
  }
  if (s === "basic_kyc") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700">
        Basic KYC
      </span>
    );
  }
  if (!s || s === "no_kyc") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
        No KYC
      </span>
    );
  }
  // Unknown status — render as-is with neutral chip
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
      {status}
    </span>
  );
}

// ─── Account Status badge ─────────────────────────────────────────────────────

function AccountStatusBadge({ status }: { status: string }) {
  const s = (status ?? "").toLowerCase();
  if (s === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
        Active
      </span>
    );
  }
  if (s === "suspended") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-50 text-red-600">
        Suspended
      </span>
    );
  }
  if (s === "pending") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-700">
        Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
      {status || "—"}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  participants: any[];
  /** @deprecated Actions column removed — prop kept for call-site compatibility */
  suspendUser?: { mutate: (args: any) => void; isPending: boolean };
  eventId:      string;
}

// ─── Component ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

function rowsOf(res: any): any[] {
  if (Array.isArray(res)) return res;
  return res?.attendees ?? res?.content ?? res?.participants ?? res?.data ?? [];
}

export function EventAttendeesTab({ participants: firstPage, eventId }: Props) {
  const exportMutation = useExportAttendees();
  // The participant profile page (/participants/{id}) is a super-admin surface.
  // Client admins / event managers / viewers see the attendee as plain text —
  // no link into platform-wide user records.
  const { data: meData, isLoading: meLoading } = useGetMe();
  const isSuperAdmin = isSuperAdminRole(resolveRole(meData?.data));

  // Paged list: the API returns PAGE_SIZE rows per page, so the tab fetches the
  // page it shows instead of only ever rendering the first one.
  const [page, setPage] = useState(0);
  // Server-side search (name / email), debounced; back to page 1 on a new term.
  const [searchInput, setSearchInput] = useState("");
  const debounced = useDebouncedValue(searchInput.trim(), 350);
  const search = debounced.length >= 2 ? debounced : "";
  useEffect(() => { setPage(0); }, [search]);
  const adminQ  = useEventAttendees(eventId, page, PAGE_SIZE, "", { enabled: !meLoading && isSuperAdmin, search });
  const clientQ = useClientEventAttendees(eventId, "", page, PAGE_SIZE, { enabled: !meLoading && !isSuperAdmin, search });
  const q = isSuperAdmin ? adminQ : clientQ;
  const res: any = q.data;
  const participants: any[] = res ? rowsOf(res) : (page === 0 && !search ? firstPage : []);
  const total: number = res?.totalCount ?? res?.totalElements ?? participants.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE + participants.length);

  return (
    <Card className="attend-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Registered Participants</h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            {search
              ? <>{total.toLocaleString()} matching “{search}”</>
              : <>{total.toLocaleString()} participant{total !== 1 ? "s" : ""} registered</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
        <div className="relative w-56 sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name or email…"
            autoComplete="off"
            name="attendee-search"
            className="pl-8 pr-8 h-8 text-xs"
            aria-label="Search attendees"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {/* Export uses the client-scoped endpoint — not available to super admin. */}
        {!isSuperAdmin && (
        <Button
          size="sm" variant="outline" className="gap-1.5"
          disabled={exportMutation.isPending}
          onClick={() => exportMutation.mutate(eventId)}
        >
          {exportMutation.isPending
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Exporting…</>
            : <><Download className="h-3.5 w-3.5" /> Export CSV</>
          }
        </Button>
        )}
        </div>
      </div>

      {/* Empty state */}
      {q.isLoading && !participants.length ? (
        <div className="py-14 flex justify-center text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : participants.length === 0 ? (
        <div className="py-14 text-center text-sm text-[hsl(var(--muted-foreground))]">
          <Users className="h-8 w-8 mx-auto mb-3 opacity-25" />
          {search ? (
            <>
              <p className="font-medium text-[hsl(var(--foreground))]">No attendee matches “{search}”</p>
              <p className="mt-1">Check the spelling, or search by email instead.</p>
            </>
          ) : (
            <>
              <p className="font-medium text-[hsl(var(--foreground))]">No attendees yet</p>
              <p className="mt-1">Participants who register will appear here.</p>
            </>
          )}
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Participant</th>
              <th className="px-5 py-3 text-left">Phone</th>
              <th className="px-5 py-3 text-left">KYC Status</th>
              <th className="px-5 py-3 text-left">Account Status</th>
              <th className="px-5 py-3 text-left">Date Registered</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p, idx) => {
              const pid          = p.id ?? p.participantId ?? p.userId ?? String(idx);
              const fullName     = p.fullName ?? ([p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "—");
              const initials     = p.initials
                || fullName.split(" ").filter(Boolean).map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                || "?";
              const kycStatus    = p.kycStatus || p.kycLevel || p.kyc?.status || "NO_KYC";
              const acctStatus   = p.status || p.accountStatus || "ACTIVE";
              const registeredAt = p.registeredAt || p.rsvpDate || p.joinedAt || p.createdAt;

              return (
                <tr key={pid} className="attend-table-row">

                  {/* Participant — avatar + name + email with overflow protection.
                      Linked to the profile for super admin only; plain text otherwise. */}
                  <td className="px-5 py-3 max-w-[220px]">
                    {(() => {
                      const inner = (
                        <>
                          <UserAvatar src={p.avatarUrl} initials={initials} color={p.avatarColor} size={28} />
                          <div className="min-w-0">
                            <p className={`text-sm font-medium text-[hsl(var(--foreground))] truncate${isSuperAdmin ? " group-hover:underline" : ""}`}>
                              {fullName}
                            </p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{p.email ?? "—"}</p>
                          </div>
                        </>
                      );
                      return isSuperAdmin ? (
                        <Link href={`/participants/${pid}`} className="flex items-center gap-2.5 group">
                          {inner}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-2.5">{inner}</div>
                      );
                    })()}
                  </td>

                  {/* Phone */}
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                    {p.phone ?? "—"}
                  </td>

                  {/* KYC Status */}
                  <td className="px-5 py-3">
                    <KycBadge status={kycStatus} />
                  </td>

                  {/* Account Status */}
                  <td className="px-5 py-3">
                    <AccountStatusBadge status={acctStatus} />
                  </td>

                  {/* Date Registered */}
                  <td className="px-5 py-3">
                    <DateCell value={registeredAt} payload={p} />
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="px-5 py-3 border-t border-[hsl(var(--border))] flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums">
            Showing <span className="font-semibold text-[hsl(var(--foreground))]">{from.toLocaleString()}–{to.toLocaleString()}</span> of{" "}
            <span className="font-semibold text-[hsl(var(--foreground))]">{total.toLocaleString()}</span>
            {q.isFetching && <Loader2 className="inline h-3 w-3 ml-2 animate-spin" />}
          </p>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" className="h-8 gap-1" disabled={page === 0 || q.isFetching} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </Button>
            <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums px-2">
              Page {page + 1} of {totalPages}
            </span>
            <Button size="sm" variant="outline" className="h-8 gap-1" disabled={page + 1 >= totalPages || q.isFetching} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
