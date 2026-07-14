"use client";
import { use, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { useRegistrarDetail, useRegistrarEventsPaged, useRegistrarRegisters, getRegistrarDisplayName } from "@/api/registrars";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { StatusBadge } from "@/components/custom/status-badge";
import { ModuleBadge } from "@/components/custom/module-badge";
import { formatDate } from "@/lib/utils";
import { getEventModule, MODULE_COLORS } from "@/lib/event-module";

const PAGE_SIZE = 20;

const EVENT_TYPE_OPTIONS = [
  { id: "AGM_EGM",              name: "AGM / EGM"             },
  { id: "PRODUCT_LAUNCH",       name: "Product Launch"        },
  { id: "HACKATHON",            name: "Innovation Challenge"  },
  { id: "GENERAL_EVENT",        name: "General"               },
];

export default function RegistrarEventsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [registerFilter, setRegisterFilter] = useState("");
  const [typeFilter,     setTypeFilter]     = useState("");

  const { data: registrar, isLoading: registrarLoading } = useRegistrarDetail(id);
  const { data: registersData } = useRegistrarRegisters(id);
  // The registrar-detail response already embeds the full events list (this is what the
  // main profile page uses) — GET /api/v1/admin/registrars/{id}/events as a separate
  // paginated call currently returns empty regardless of params, so it's only used as a
  // fallback when the embedded array isn't present.
  const embeddedEvents = registrar?.events ?? [];
  const { data: pagedData, isLoading: pagedLoading } = useRegistrarEventsPaged(id, page, PAGE_SIZE);

  const isLoading   = registrarLoading;
  const usingPaged  = embeddedEvents.length === 0 && (pagedData?.events?.length ?? 0) > 0;
  const rawEvents   = usingPaged ? (pagedData?.events ?? []) : embeddedEvents;

  const registerOptions = (registersData ?? []).map((r) => ({ id: r.id, name: r.name }));

  // Filter by register + event type, then sort by creation time (newest first) —
  // falls back to `date` when `createdAt` isn't present on a given event object.
  const filteredEvents = useMemo(() => {
    let list = rawEvents as any[];
    if (registerFilter) list = list.filter((e) => e.registerId === registerFilter);
    if (typeFilter)     list = list.filter((e) => (e.eventType ?? "").toUpperCase() === typeFilter);
    return [...list].sort((a, b) => {
      const at = new Date(a.createdAt ?? a.date ?? 0).getTime();
      const bt = new Date(b.createdAt ?? b.date ?? 0).getTime();
      return bt - at;
    });
  }, [rawEvents, registerFilter, typeFilter]);

  // When using the (unfiltered) paged branch, keep server pagination; once a
  // client-side filter is active, or we're on the embedded-array fallback,
  // paginate the filtered list locally instead.
  const isFiltering = !!registerFilter || !!typeFilter;
  const allEvents   = (usingPaged && !isFiltering) ? [] : filteredEvents;
  const totalCount  = (usingPaged && !isFiltering) ? (pagedData?.totalCount ?? 0) : allEvents.length;
  const totalPages  = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const events      = (usingPaged && !isFiltering)
    ? filteredEvents
    : allEvents.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const displayName = registrar ? getRegistrarDisplayName(registrar) : "Registrar";

  return (
    <div className="flex flex-col gap-6">
      <button onClick={() => router.push(`/registrars/${id}`)}
        className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors w-fit">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to {displayName}
      </button>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">All Events</h1>
        <span className="text-sm text-[hsl(var(--muted-foreground))]">{totalCount} total</span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={registerFilter}
          onChange={(e) => { setRegisterFilter(e.target.value); setPage(0); }}
          className="h-9 pl-3 pr-8 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
        >
          <option value="">All Registers</option>
          {registerOptions.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
          className="h-9 pl-3 pr-8 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
        >
          <option value="">All Event Types</option>
          {EVENT_TYPE_OPTIONS.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {(registerFilter || typeFilter) && (
          <button
            onClick={() => { setRegisterFilter(""); setTypeFilter(""); setPage(0); }}
            className="text-xs font-medium text-[hsl(var(--primary))] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <Card className="attend-card overflow-hidden">
        {isLoading ? (
          <Loader variant="page" text="Loading events…" />
        ) : events.length === 0 ? (
          <div className="py-16 text-center">
            <CalendarDays className="h-8 w-8 mx-auto mb-2 text-[hsl(var(--muted-foreground))] opacity-30" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No events created yet</p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="attend-table-header">
                  <th className="px-5 py-3 text-left">Event</th>
                  <th className="px-5 py-3 text-left">Format</th>
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">RSVPs</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left"></th>
                </tr>
              </thead>
              <tbody>
                {events.map((evt: any) => {
                  const mod      = getEventModule({ eventType: evt.eventType });
                  const dotColor = MODULE_COLORS[mod];
                  return (
                    <tr key={evt.id} className="attend-table-row">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: dotColor }} />
                          <div>
                            <ModuleBadge module={mod} />
                            <p className="text-sm font-medium text-[hsl(var(--foreground))] mt-0.5 truncate max-w-[240px]">
                              {evt.title}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                        {evt.format
                          ? <span className="capitalize text-xs">{evt.format.toLowerCase().replace(/_/g, " ")}</span>
                          : "—"
                        }
                      </td>
                      <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                        {formatDate(evt.date)}
                      </td>
                      <td className="px-5 py-3 text-sm font-medium tabular-nums">
                        {(evt.registrationCount ?? evt.rsvpCount ?? evt.registrationsCount ?? evt.totalRsvps ?? evt.rsvps ?? 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={(evt.status ?? "").toLowerCase()} />
                      </td>
                      <td className="px-5 py-3">
                        <Link href={`/events/${evt.id}`}>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                            <Eye className="h-3 w-3" /> View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-[hsl(var(--border)/0.6)]">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  Page {page + 1} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-7 gap-1 text-xs"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}>
                    <ChevronLeft className="h-3.5 w-3.5" /> Prev
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 gap-1 text-xs"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>
                    Next <ChevronRight className="h-3.5 w-3.5" />
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
