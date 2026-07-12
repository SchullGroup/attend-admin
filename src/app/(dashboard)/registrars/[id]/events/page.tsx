"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { useRegistrarDetail, useRegistrarEventsPaged, getRegistrarDisplayName } from "@/api/registrars";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { StatusBadge } from "@/components/custom/status-badge";
import { ModuleBadge } from "@/components/custom/module-badge";
import { formatDate } from "@/lib/utils";
import { getEventModule, MODULE_COLORS } from "@/lib/event-module";

const PAGE_SIZE = 20;

export default function RegistrarEventsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [page, setPage] = useState(0);

  const { data: registrar, isLoading: registrarLoading } = useRegistrarDetail(id);
  // The registrar-detail response already embeds the full events list (this is what the
  // main profile page uses) — GET /api/v1/admin/registrars/{id}/events as a separate
  // paginated call currently returns empty regardless of params, so it's only used as a
  // fallback when the embedded array isn't present.
  const embeddedEvents = registrar?.events ?? [];
  const { data: pagedData, isLoading: pagedLoading } = useRegistrarEventsPaged(id, page, PAGE_SIZE);

  const isLoading   = registrarLoading;
  const usingPaged  = embeddedEvents.length === 0 && (pagedData?.events?.length ?? 0) > 0;
  const allEvents   = usingPaged ? [] : embeddedEvents; // paged branch renders straight from pagedData below
  const totalCount  = usingPaged ? (pagedData?.totalCount ?? 0) : (registrar?.eventsCount ?? allEvents.length);
  const totalPages  = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const events      = usingPaged
    ? (pagedData?.events ?? [])
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
                        {(evt.registrationCount ?? 0).toLocaleString()}
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
