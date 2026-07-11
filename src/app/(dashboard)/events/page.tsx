"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Radio, Eye, MapPin, Monitor, Users2, Search, ChevronDown, Building2, Check,
} from "lucide-react";
import { useEvents } from "@/api/super-admin";
import { useClientEvents, type ClientEventTypeFilter } from "@/api/client-events";
import { useGetMe } from "@/api/auth/hooks";
import { useRegistrars } from "@/api/registrars";
import { useRegisters } from "@/api/registers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/custom/status-badge";
import { ModuleBadge } from "@/components/custom/module-badge";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { formatDate } from "@/lib/utils";
import { getEventModule, getEventRegisterName, MODULE_COLORS } from "@/lib/event-module";
import type { EventSummaryResponse } from "@/types/super-admin";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Only super_admin uses the platform-level admin API.
// All org-scoped roles (client_admin, event_manager, viewer, kyc_officer, etc.) use the client API.
const ADMIN_ROLES = new Set(["super_admin"]);

const ADMIN_STATUS_TABS = [
  { label: "All",       value: ""          },
  { label: "Live",      value: "LIVE"      },
  { label: "Published", value: "PUBLISHED" },
  { label: "Draft",     value: "DRAFT"     },
  { label: "Ended",     value: "ENDED"     },
];

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
// Simple dropdown component
// ---------------------------------------------------------------------------

function FilterDropdown({
  label,
  value,
  options,
  onSelect,
  icon: Icon,
}: {
  label: string;
  value: string;
  options: { id: string; name: string }[];
  onSelect: (id: string) => void;
  icon?: React.ElementType;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={cn(
          "flex items-center gap-2 h-9 rounded-lg border px-3 text-sm transition-colors",
          value
            ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)] text-[hsl(var(--foreground))]"
            : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--ring)/0.3)]"
        )}
      >
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
        <span className="max-w-[140px] truncate">{selected ? selected.name : label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 top-[calc(100%+4px)] left-0 min-w-[200px] max-w-[260px] rounded-xl border border-[hsl(var(--border))] bg-white shadow-lg overflow-hidden">
          {/* Clear option */}
          <button
            type="button"
            onClick={() => { onSelect(""); setOpen(false); }}
            className={cn(
              "w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-[hsl(var(--muted))] transition-colors",
              !value && "bg-[hsl(var(--muted)/0.5)] font-medium"
            )}
          >
            <span className="w-3.5 shrink-0">{!value && <Check className="h-3.5 w-3.5" />}</span>
            All {label}s
          </button>
          <div className="border-t border-[hsl(var(--border)/0.5)]" />
          <div className="max-h-52 overflow-y-auto">
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => { onSelect(o.id); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-[hsl(var(--muted))] transition-colors text-left",
                  value === o.id && "bg-[hsl(var(--primary)/0.05)] text-[hsl(var(--primary))] font-medium"
                )}
              >
                <span className="w-3.5 shrink-0 flex items-center">
                  {value === o.id && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className="truncate">{o.name}</span>
              </button>
            ))}
            {options.length === 0 && (
              <p className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">No options</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event table row
// ---------------------------------------------------------------------------

function EventTableRow({ event, isSuperAdmin, isViewer }: { event: EventSummaryResponse; isSuperAdmin: boolean; isViewer?: boolean }) {
  const isLive      = event.status?.toUpperCase() === "LIVE" || event.live;
  const mod         = getEventModule(event);
  const isAGM       = mod === "AGM";
  const dotColor    = MODULE_COLORS[mod];
  const FormatIcon  = FORMAT_ICON[event.format] ?? Monitor;
  const registerName = getEventRegisterName(event);

  return (
    <tr className="attend-table-row">
      <td className="pl-4 pr-1 py-3">
        <span className="block h-3 w-3 rounded-full shrink-0 mx-auto" style={{ backgroundColor: dotColor }} />
      </td>
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
        <p className="text-sm font-medium text-[hsl(var(--foreground))] max-w-[240px] truncate" title={event.title}>{event.title}</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 max-w-[160px] truncate" title={registerName || "—"}>{registerName || "—"}</p>
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
      <td className="px-5 py-3 text-sm tabular-nums">
        {(() => {
          const count = event.registrationCount ?? 0;
          const cap   = (event.maximumCapacity != null && event.maximumCapacity > 0) ? event.maximumCapacity : null;
          return (
            <div>
              <span className="font-medium">{count.toLocaleString()}</span>
              {!isAGM && cap != null && (
                <span className="text-[hsl(var(--muted-foreground))] font-normal"> of {cap.toLocaleString()}</span>
              )}
              <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                {isAGM ? "expected" : "RSVPs"}
              </div>
            </div>
          );
        })()}
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
          {(event.status?.toUpperCase() === "LIVE") && !isSuperAdmin && !isViewer && (
            <Link href="/events/live">
              <Button size="sm" className="h-7 text-xs gap-1 bg-red-600 hover:bg-red-700 text-white">
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

  // ⚡ FIXED: Sanitize the role variant once to cleanly capture hyphens and spaces
  const normalizedRole = (currentUser?.role ?? "").toLowerCase().replace(/[-\s]/g, "_");
  
  const isSuperAdmin = normalizedRole === "super_admin";
  const isAdmin      = !currentUser || ADMIN_ROLES.has(normalizedRole);
  const isViewer     = normalizedRole === "viewer";

  const [activeStatus,     setActiveStatus]     = useState("");
  const [activeType,       setActiveType]       = useState<ClientEventTypeFilter>("ALL");
  const [searchQuery,      setSearchQuery]      = useState("");
  const [page,             setPage]             = useState(0);
  const [registrarFilter,  setRegistrarFilter]  = useState("");
  const [organizerFilter,  setOrganizerFilter]  = useState("");

  // These two hit super-admin-only backend endpoints — must stay gated behind
  // isSuperAdmin, or a Client Admin gets a 403 firing on every page load.
  const { data: adminData,    isLoading: adminLoading  } = useEvents(activeStatus, page, LIMIT, isSuperAdmin);
  const { data: clientData,   isLoading: clientLoading } = useClientEvents(activeType, page, LIMIT);
  const { data: registrarsData                         } = useRegistrars("", 0, 100, isSuperAdmin);
  const { data: registersData                          } = useRegisters("ACTIVE", 0, 200);

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
    registerName:           e.registerName ?? "",
    organizerName:          e.registerName ?? "",
    registrationCount:      e.rsvpCount,
    registrationPercentage: e.fillRate,
    tags:                   [],
    eventType:              e.eventType,
    registerId:             e.registerId,
  }));

  const events     = isAdmin ? adminEvents : clientEvents;
  const totalPages = isAdmin
    ? (adminData?.totalPages  ?? 1)
    : Math.ceil((clientData?.totalCount ?? 0) / LIMIT) || 1;
  const totalCount = isAdmin
    ? (adminData?.totalElements ?? adminEvents.length)
    : (clientData?.totalCount   ?? clientEvents.length);

  // Dropdown options
  const registrarOptions = (registrarsData?.registrars ?? []).map((r) => ({
    id:   r.id,
    name: r.companyName || r.name || r.id,
  }));
  const organizerOptions = (registersData?.registers ?? []).map((r) => ({
    id:   r.id,
    name: r.name || (r as any).companyName || r.id,
  }));

  // Client-side filtering by search + registrar + organizer
  const filtered = events.filter((e) => {
    if (searchQuery.trim() && !e.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (organizerFilter && (e as any).registerId !== organizerFilter) return false;
    if (registrarFilter) {
      const reg = registrarOptions.find((r) => r.id === registrarFilter);
      if (reg && !(e.organizerName ?? e.registerName ?? "").toLowerCase().includes(reg.name.toLowerCase())) return false;
    }
    return true;
  });

  if (isLoading) return <Loader variant="page" text="Loading Events…" />;

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Events</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            {isSuperAdmin
              ? `${totalCount} total event${totalCount !== 1 ? "s" : ""} across all modules`
              : `${totalCount} total event${totalCount !== 1 ? "s" : ""} in your organisation`}
          </p>
        </div>
        {!isSuperAdmin && (
          <Link href="/events/create">
            <Button size="sm" className="gap-1.5">Create Event</Button>
          </Link>
        )}
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <Input
            placeholder="Search events by title…"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
            className="pl-9 h-9"
          />
        </div>

        {/* Registrars + Organizers dropdowns — super admin only */}
        {isSuperAdmin && (
          <>
            <FilterDropdown
              label="Registrar"
              value={registrarFilter}
              options={registrarOptions}
              onSelect={(id) => { setRegistrarFilter(id); setPage(0); }}
              icon={Building2}
            />
            <FilterDropdown
              label="Organizer"
              value={organizerFilter}
              options={organizerOptions}
              onSelect={(id) => { setOrganizerFilter(id); setPage(0); }}
              icon={Building2}
            />
          </>
        )}

        {(searchQuery || (isSuperAdmin && (registrarFilter || organizerFilter))) && (
          <button
            type="button"
            onClick={() => { setRegistrarFilter(""); setOrganizerFilter(""); setSearchQuery(""); setPage(0); }}
            className="text-xs text-[hsl(var(--primary))] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Admin status tabs ── */}
      {isAdmin && (
        <div className="flex items-center gap-1 mb-4 bg-[hsl(var(--muted))] rounded-full p-1 w-full">
          {ADMIN_STATUS_TABS.map((tab) => (
            <button key={tab.value}
              onClick={() => { setActiveStatus(tab.value); setPage(0); }}
              className={`flex-1 px-4 py-1.5 rounded-full text-sm font-medium transition-all text-center ${
                activeStatus === tab.value
                  ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Client type tabs ── */}
      {!isAdmin && (
        <div className="flex items-center gap-1 mb-4 bg-[hsl(var(--muted))] rounded-full p-1 w-full">
          {CLIENT_TYPE_TABS.map((tab) => (
            <button key={tab.value}
              onClick={() => { setActiveType(tab.value); setPage(0); }}
              className={`flex-1 px-4 py-1.5 rounded-full text-sm font-medium transition-all text-center ${
                activeType === tab.value
                  ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Table ── */}
      <Card className="attend-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="pl-4 pr-1 py-3 w-8" />
              <th className="px-5 py-3 text-left">Event</th>
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-left">Format</th>
              <th className="px-5 py-3 text-left">RSVP / Expected</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((event) => (
              <EventTableRow key={event.id} event={event} isSuperAdmin={isSuperAdmin} isViewer={isViewer} />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No events found.
          </div>
        )}
      </Card>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Page {page + 1} of {totalPages} · {totalCount} total
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