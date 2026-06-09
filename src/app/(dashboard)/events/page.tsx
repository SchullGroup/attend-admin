"use client";
import { useState } from "react";
import Link from "next/link";
import { Radio, Eye, MapPin, Monitor, Users2, Search } from "lucide-react";
import { useEvents } from "@/api/super-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/custom/status-badge";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { formatDate } from "@/lib/utils";
import type { EventSummaryResponse } from "@/types/super-admin";

const STATUS_TABS = [
  { label: "All",    value: "" },
  { label: "Live",   value: "LIVE" },
  { label: "Published", value: "PUBLISHED" },
  { label: "Draft",  value: "DRAFT" },
  { label: "Ended",  value: "ENDED" },
];

const FORMAT_ICON: Record<string, React.ElementType> = {
  VIRTUAL:   Monitor,
  HYBRID:    Users2,
  IN_PERSON: MapPin,
};

function formatLabel(fmt: string) {
  return fmt === "IN_PERSON" ? "In-Person" : fmt.charAt(0) + fmt.slice(1).toLowerCase();
}

export default function EventsPage() {
  const [activeStatus, setActiveStatus] = useState("");
  const [searchQuery, setSearchQuery]   = useState("");
  const [page, setPage] = useState(0);
  const LIMIT = 20;

  const { data, isLoading } = useEvents(activeStatus, page, LIMIT);

  // Rule 2: unwrap .content with || [] fallback
  const events: EventSummaryResponse[] = data?.content || [];
  const totalPages = data?.totalPages ?? 1;

  const filtered = searchQuery.trim()
    ? events.filter((e) => e.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : events;

  if (isLoading) return <Loader variant="page" text="Loading Events…" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Events</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            {data?.totalElements ?? events.length} total events across all organisers
          </p>
        </div>
      </div>

      {/* Search + status tabs */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <Input
            placeholder="Search events by title…"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 mb-4 bg-[hsl(var(--muted))] rounded-full p-1 w-full">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setActiveStatus(tab.value); setPage(0); }}
            className={`flex-1 px-4 py-1.5 rounded-full text-sm font-medium transition-all text-center ${
              activeStatus === tab.value
                ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card className="attend-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Event</th>
              <th className="px-5 py-3 text-left">Organiser</th>
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-left">Format</th>
              <th className="px-5 py-3 text-left">Registrations</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((event) => {
              const isLive = event.status?.toUpperCase() === "LIVE" || event.live;
              const FormatIcon = FORMAT_ICON[event.format] ?? Monitor;
              return (
                <tr key={event.id} className="attend-table-row">
                  <td className="px-5 py-3">
                    <div className="text-sm font-medium text-[hsl(var(--foreground))] max-w-[260px] truncate">
                      {isLive && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 rounded-full px-1.5 py-0.5 mr-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                          LIVE
                        </span>
                      )}
                      {event.title}
                    </div>
                    {event.tags?.length > 0 && (
                      <div className="flex gap-1 mt-0.5 flex-wrap">
                        {event.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="text-xs text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] rounded px-1.5 py-0.5">{tag}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                    {event.organizerName}
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                    {formatDate(event.date)}
                    {event.startTime && <div className="text-xs">{event.startTime}</div>}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))]">
                      <FormatIcon className="h-3.5 w-3.5" />
                      <span>{formatLabel(event.format)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm font-medium tabular-nums">
                    {(event.registrationCount ?? 0).toLocaleString()}
                    {event.registrationPercentage > 0 && (
                      <span className="text-[hsl(var(--muted-foreground))] font-normal text-xs block">
                        {Math.round(event.registrationPercentage)}% filled
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={event.status?.toLowerCase()} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/events/${event.id}`}>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                          <Eye className="h-3 w-3" /> View
                        </Button>
                      </Link>
                      {isLive && (
                        <Link href="/events/live">
                          <Button size="sm" className="h-7 text-xs gap-1">
                            <Radio className="h-3 w-3" /> Live
                          </Button>
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No events found.
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
