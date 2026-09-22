"use client";
import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { Vote, Radio, FileText, ChevronRight, Search, CalendarDays } from "lucide-react";
import { useUrlPageState, useUrlSearchState, useUrlState } from "@/lib/use-url-state";
import { useClientVoteList, useVoteStats } from "@/api/client-votes";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/Loader";
import { formatDate } from "@/lib/utils";

/**
 * The tabs did not filter anything, because their values were never the words
 * the API answers with. The list returns LIVE, PUBLISHED, ENDED and DRAFT;
 * "Upcoming" asked for UPCOMING and "Past" asked for PAST, so those two tabs
 * could only ever match nothing — a published AGM next month is "upcoming" to
 * a reader but PUBLISHED to the backend.
 *
 * So each tab now owns the set of statuses it covers and the filtering happens
 * here, on what came back, instead of being pushed to a parameter the two sides
 * disagree about. `match: null` means the tab filters nothing.
 */
const STATUS_FILTERS: { label: string; value: string; match: string[] | null }[] = [
  { label: "All",      value: "",         match: null },
  { label: "Live",     value: "LIVE",     match: ["LIVE", "ONGOING", "IN_PROGRESS"] },
  { label: "Upcoming", value: "UPCOMING", match: ["UPCOMING", "PUBLISHED", "SCHEDULED"] },
  { label: "Past",     value: "PAST",     match: ["PAST", "ENDED", "COMPLETED", "CLOSED", "CANCELLED"] },
  { label: "Draft",    value: "DRAFT",    match: ["DRAFT"] },
];

function statusStyle(s: string) {
  const u = s?.toUpperCase();
  // Each status gets its own color — DRAFT, ENDED, and CANCELLED used to
  // all fall through to the same amber default, making them impossible to
  // tell apart at a glance.
  if (u === "LIVE")      return { bg: "#dcfce7", color: "#16a34a" }; // green
  if (u === "UPCOMING")  return { bg: "#dbeafe", color: "#2563eb" }; // blue
  if (u === "PAST")      return { bg: "#f3f4f6", color: "#6b7280" }; // gray
  if (u === "ENDED")     return { bg: "#f3f4f6", color: "#6b7280" }; // gray (same family as PAST)
  if (u === "CANCELLED") return { bg: "#fee2e2", color: "#dc2626" }; // red
  if (u === "DRAFT")     return { bg: "#fef3c7", color: "#b45309" }; // amber
  return { bg: "#fef3c7", color: "#b45309" };
}

function VotesPageInner() {
  const router = useRouter();

  // Search, status tab and page number all live in the query string, so a
  // reload or the back button returns to this view rather than the unfiltered
  // first page. A new search or a new tab drops back to page 1 — page 4 of the
  // old result set means nothing for the new one.
  const [status, setStatus] = useUrlState("status");
  const [page,   setPage]   = useUrlPageState();
  const [searchDraft, setSearchDraft, search] = useUrlSearchState("q", 500, { page: null });

  const activeTab = STATUS_FILTERS.find((f) => f.value === status) ?? STATUS_FILTERS[0];
  const filtering = activeTab.match !== null;

  // `status` is deliberately NOT sent: the API would filter on a word it does
  // not use and hand back an empty list, leaving nothing here to work with. On
  // a filtered tab we ask for a larger single page instead and narrow it below,
  // which is honest as long as the page covers the account — the note in
  // BACKEND_VOTE_STATUS_2026-09-22.md asks for real server-side filtering.
  // A narrowed view (a status tab, a search term, or both) is filtered here, so
  // it asks for one large page rather than paging through the server's slices —
  // otherwise a match sitting on server page 3 would simply never be found.
  const narrowed = filtering || Boolean(search.trim());
  const size     = narrowed ? 100 : 20;

  const { data: stats,  isLoading: statsLoading  } = useVoteStats();
  const { data: list,   isLoading: listLoading    } = useClientVoteList(search, "", narrowed ? 0 : page, size);

  if (statsLoading && listLoading) return <Loader variant="page" text="Loading Votes…" />;

  const rawEvents = list?.records ?? list?.events ?? [];
  // The term is applied here too, over the two columns the row actually shows.
  // If the API honours `search` this is a no-op; if it ignores it — the way the
  // challenges list did — the user gets a real result instead of the full list
  // dressed up as an answer.
  const term = search.trim().toLowerCase();
  const events = rawEvents.filter((ev: any) => {
    if (activeTab.match && !activeTab.match.includes((ev.status ?? "").toUpperCase())) return false;
    if (term && ![ev.title, ev.registerName].some((v: any) => (v ?? "").toLowerCase().includes(term))) return false;
    return true;
  });

  // Pagination only means anything on the unfiltered tab — a filtered tab is
  // showing everything it found, so a pager would promise pages that aren't there.
  const totalCount = narrowed ? events.length : (list?.totalCount ?? 0);
  const totalPages = narrowed ? 1 : Math.ceil(totalCount / size);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Votes & Resolutions</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          AGM/EGM voting records, resolution results, and offline vote entry
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Live AGMs",         value: stats?.liveAgms        ?? 0, icon: Radio,       color: "#16a34a" },
          { label: "With Vote Records", value: stats?.withVoteRecords ?? 0, icon: Vote,        color: "#2563eb" },
          { label: "Upcoming / Draft",  value: stats?.upcomingOrDraft ?? 0, icon: CalendarDays, color: "#f59e0b" },
        ].map((s) => (
          <Card key={s.label} className="attend-card p-5">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center mb-3"
              style={{ backgroundColor: s.color + "18" }}
            >
              <s.icon className="h-4 w-4" style={{ color: s.color }} />
            </div>
            <div className="text-2xl font-bold tabular-nums text-[hsl(var(--foreground))]">{s.value}</div>
            <div className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <Input
            placeholder="Search AGMs…"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatus(f.value); setPage(0); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                status === f.value
                  ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="attend-card overflow-hidden">
        {listLoading ? (
          <div className="py-12 flex items-center justify-center">
            <Loader variant="inline" text="Loading…" />
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="attend-table-header">
                  <th className="px-5 py-3 text-left">Event</th>
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-right">Resolutions</th>
                  <th className="px-5 py-3 text-right">Total Votes</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => {
                  const ss = statusStyle(ev.status);
                  return (
                    <tr
                      key={ev.id ?? ev.eventId}
                      className="attend-table-row cursor-pointer"
                      onClick={() => router.push(`/votes/${ev.id ?? ev.eventId}`)}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: "#2563eb18" }}
                          >
                            <Vote className="h-4 w-4" style={{ color: "#2563eb" }} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate max-w-[240px]">
                              {ev.title}
                            </p>
                            {ev.registerName && (
                              <p className="text-xs text-[hsl(var(--muted-foreground))]">{ev.registerName}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-[hsl(var(--muted-foreground))]">
                        {ev.dateLabel ?? formatDate(ev.date)}
                      </td>
                      <td className="px-5 py-4 text-sm text-right font-semibold tabular-nums">
                        {ev.totalResolutions ?? ev.resolutionCount ?? 0}
                        {ev.closedResolutions != null && (
                          <span className="text-xs text-[hsl(var(--muted-foreground))] font-normal ml-1">
                            ({ev.closedResolutions} closed)
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-right tabular-nums text-[hsl(var(--muted-foreground))]">
                        {(ev.votesCast ?? ev.totalVotesCast ?? 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: ss.bg, color: ss.color }}
                        >
                          {ev.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/votes/${ev.id ?? ev.eventId}`);
                          }}
                        >
                          View <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {events.length === 0 && (
              <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
                {search.trim()
                  ? `No AGMs match “${search.trim()}”.`
                  : filtering
                    ? `No ${activeTab.label.toLowerCase()} AGMs.`
                    : "No AGM/EGM vote records found."}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-[hsl(var(--border))] flex items-center justify-between">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  Page {page + 1} of {totalPages} · {totalCount} events
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
                    Prev
                  </Button>
                  <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

/**
 * useSearchParams needs a Suspense boundary above it — without one the whole
 * route opts out of static rendering and Next.js errors at build time.
 */
export default function VotesPage() {
  return (
    <Suspense fallback={<Loader variant="page" text="Loading Votes…" />}>
      <VotesPageInner />
    </Suspense>
  );
}
