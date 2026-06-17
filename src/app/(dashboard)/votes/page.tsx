"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Vote, Radio, FileText, ChevronRight, Search, CalendarDays } from "lucide-react";
import { useClientVoteList, useVoteStats } from "@/api/client-votes";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/Loader";
import { formatDate } from "@/lib/utils";

const STATUS_FILTERS = [
  { label: "All",      value: "" },
  { label: "Live",     value: "LIVE" },
  { label: "Upcoming", value: "UPCOMING" },
  { label: "Past",     value: "PAST" },
  { label: "Draft",    value: "DRAFT" },
];

function statusStyle(s: string) {
  const u = s?.toUpperCase();
  if (u === "LIVE")     return { bg: "#dcfce7", color: "#16a34a" };
  if (u === "UPCOMING") return { bg: "#dbeafe", color: "#2563eb" };
  if (u === "PAST")     return { bg: "#f3f4f6", color: "#6b7280" };
  return { bg: "#fef3c7", color: "#b45309" };
}

export default function VotesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page,   setPage]   = useState(0);
  const size = 20;

  const { data: stats,  isLoading: statsLoading  } = useVoteStats();
  const { data: list,   isLoading: listLoading    } = useClientVoteList(search, status, page, size);

  if (statsLoading && listLoading) return <Loader variant="page" text="Loading Votes…" />;

  const events     = list?.records ?? list?.events ?? [];
  const totalCount = list?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / size);

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
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
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
                No AGM/EGM vote records found.
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-[hsl(var(--border))] flex items-center justify-between">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  Page {page + 1} of {totalPages} · {totalCount} events
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    Prev
                  </Button>
                  <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
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
