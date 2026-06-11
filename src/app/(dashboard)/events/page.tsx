"use client";
import { useState } from "react";
import Link from "next/link";
import { Radio, Eye, MapPin, Monitor, Users2, Search } from "lucide-react";
import { useEvents } from "@/api/super-admin";
import { useClientEvents, type ClientEventTypeFilter } from "@/api/client-events";
import { useGetMe } from "@/api/auth/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/custom/status-badge";
import { ModuleBadge } from "@/components/custom/module-badge";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { formatDate } from "@/lib/utils";
import { getEventModule, getEventRegisterName, MODULE_COLORS } from "@/lib/event-module";
import type { EventSummaryResponse } from "@/types/super-admin";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ADMIN_ROLES = new Set(["super_admin", "event_manager", "kyc_officer", "judge"]);

/** Status tabs for admin view */
const ADMIN_STATUS_TABS = [
  { label: "All",       value: ""          },
  { label: "Live",      value: "LIVE"      },
  { label: "Published", value: "PUBLISHED" },
  { label: "Draft",     value: "DRAFT"     },
  { label: "Ended",     value: "ENDED"     },
];

/**
 * Type tabs for client view.
 * Values are the exact `type` query param values accepted by GET /api/v1/client/events.
 */
const CLIENT_TYPE_TABS: Array<{ label: string; value: ClientEventTypeFilter }> = [
  { label: "All Events",  value: "ALL"        },
  { label: "AGM",         value: "AGM"        },
  { label: "Launch",      value: "LAUNCH"     },
  { label: "Innovation",  value: "INNOVATION" },
  { label: "Hackathon",   value: "HACKATHON"  },
  { label: "General",     value: "GENERAL"    },
];

const FORMAT_ICON: Record<string, React.ElementType> = {
  VIRTUAL:   Monitor,
  HYBRID:    Users2,
  IN_PERSON: MapPin,
};

function formatLabel(fmt: string) {
  if (!fmt) return "—";
  return fmt === "IN_PERSON" ? "In-Person" : fmt.charAt(0) + fmt.slice(1).toLowerCase();
}

// ---------------------------------------------------------------------------
// Shared event row (same layout for both admin and client data)
// ---------------------------------------------------------------------------

function EventTableRow({ event }: { event: EventSummaryResponse }) {
  const isLive      = event.status?.toUpperCase() === "LIVE" || event.live;
  const mod         = getEventModule(event);
  const dotColor    = MODULE_COLORS[mod];
  const FormatIcon  = FORMAT_ICON[event.format] ?? Monitor;
  // Organizer = event.registerName per API spec; fall back to admin aliases.
  const registerName = getEventRegisterName(event);

  return (
    <tr className="attend-table-row">
      {/* Event-type colour dot */}
      <td className="pl-4 pr-1 py-3">
        <span
          className="block h-3 w-3 rounded-full shrink-0 mx-auto"
          style={{ backgroundColor: dotColor }}
          title={mod}
        />
      </td>

      {/* Type badge + title + organizer */}
      <td className="px-5 py-3">
        <div className="flex items-center gap-2 mb-0.5">
          <ModuleBadge module={mod} />
          {isLive && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 rounded-full px-1.5 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-[hsl(var(--foreground))] max-w-[260px] truncate">
          {event.title}
        </p>
        {/* Organizer — sourced from event.registerName */}
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 max-w-[260px] truncate">
          {registerName || "—"}
        </p>
      </td>

      {/* Date */}
      <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] whitespace-nowrap">
        {formatDate(event.date)}
        {event.startTime && <div className="text-xs">{event.startTime}</div>}
      </td>

      {/* Format */}
      <td className="px-5 py-3">
        <div className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))]">
          <FormatIcon className="h-3.5 w-3.5" />
          <span>{formatLabel(event.format)}</span>
        </div>
      </td>

      {/* RSVP */}
      <td className="px-5 py-3 text-sm font-medium tabular-nums">
        {(() => {
          const count = event.registrationCount ?? 0;
          const pct   = event.registrationPercentage;
          const cap   = pct && pct > 0 && count > 0 ? Math.round(count / (pct / 100)) : null;
          return cap
            ? <>{count.toLocaleString()} / {cap.toLocaleString()}</>
            : <>{count.toLocaleString()}</>;
        })()}
      </td>

      {/* Status */}
      <td className="px-5 py-3">
        <StatusBadge status={event.status?.toLowerCase()} />
      </td>

      {/* Actions */}
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
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const LIMIT = 20;

export default function EventsPage() {
  const { data: userResponse } = useGetMe();
  const currentUser = userResponse?.data;
  const isAdmin = !currentUser || ADMIN_ROLES.has(currentUser.role?.toLowerCase() ?? "");

  // Admin state — status filter
  const [activeStatus, setActiveStatus] = useState("");
  // Client state — type filter (defaults to ALL per spec)
  const [activeType,   setActiveType]   = useState<ClientEventTypeFilter>("ALL");

  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);

  // Both hooks called unconditionally (Rules of Hooks); role selects which data to use.
  const { data: adminData,  isLoading: adminLoading  } = useEvents(activeStatus, page, LIMIT);
  const { data: clientData, isLoading: clientLoading } = useClientEvents(activeType, page, LIMIT);

  const isLoading = isAdmin ? adminLoading : clientLoading;

  // Build unified row data
  const adminEvents: EventSummaryResponse[] = adminData?.content ?? [];

  const clientEvents: EventSummaryResponse[] = (clientData?.events ?? []).map((e) => ({
    id:                     e.id,
    title:                  e.title,
    status:                 e.status,
    date:                   e.date,
    startTime:              "",
    format:                 e.format as "VIRTUAL" | "IN_PERSON" | "HYBRID",
    live:                   e.status === "LIVE",
    registerName:           e.registerName ?? "",   // primary organizer field per spec
    organizerName:          e.registerName ?? "",
    registrationCount:      e.rsvpCount,
    registrationPercentage: e.fillRate,
    tags:                   [],
    eventType:              e.eventType,
    registerId:             e.registerId,
    rsvpEnabled:            e.rsvpEnabled,
  }));

  const events    = isAdmin ? adminEvents : clientEvents;
  const totalPages = isAdmin
    ? (adminData?.totalPages  ?? 1)
    : Math.ceil((clientData?.totalCount ?? 0) / LIMIT) || 1;
  const totalCount = isAdmin
    ? (adminData?.totalElements ?? adminEvents.length)
    : (clientData?.totalCount   ?? clientEvents.length);

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
            {totalCount} total event{totalCount !== 1 ? "s" : ""}
            {isAdmin ? " across all registers" : " in your organisation"}
          </p>
        </div>
        {!isAdmin && (
          <Link href="/events/create">
            <Button size="sm" className="gap-1.5">Create Event</Button>
          </Link>
        )}
      </div>

      {/* Search */}
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

      {/* ── Admin: status filter tabs ── */}
      {isAdmin && (
        <div className="flex items-center gap-1 mb-4 bg-[hsl(var(--muted))] rounded-full p-1 w-full">
          {ADMIN_STATUS_TABS.map((tab) => (
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
      )}

      {/* ── Client: event-type filter tabs (type=ALL by default per spec) ── */}
      {!isAdmin && (
        <div className="flex items-center gap-1 mb-4 bg-[hsl(var(--muted))] rounded-full p-1 w-full">
          {CLIENT_TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setActiveType(tab.value); setPage(0); }}
              className={`flex-1 px-4 py-1.5 rounded-full text-sm font-medium transition-all text-center ${
                activeType === tab.value
                  ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <Card className="attend-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="pl-4 pr-1 py-3 w-8" />
              <th className="px-5 py-3 text-left">Event</th>
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-left">Format</th>
              <th className="px-5 py-3 text-left">RSVP</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((event) => (
              <EventTableRow key={event.id} event={event} />
            ))}
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
            <Button size="sm" variant="outline" className="h-7 text-xs"
              disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs"
              disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
