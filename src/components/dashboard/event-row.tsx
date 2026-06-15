"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import { ModuleBadge } from "@/components/custom/module-badge";
import { StatusBadge } from "@/components/custom/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { getEventModule, getEventRegisterName, MODULE_COLORS } from "@/lib/event-module";
import type { EventSummaryResponse } from "@/types/super-admin";

interface EventRowProps {
  event: EventSummaryResponse;
}

export function EventRow({ event }: EventRowProps) {
  const mod           = getEventModule(event);
  const isAGM         = mod === "AGM";
  const isLaunch      = mod === "LAUNCH";
  const useStakeholders = isAGM || isLaunch;
  const dotColor      = MODULE_COLORS[mod];
  const rsvpCount     = event.registrationCount ?? 0;
  const fillPct       = event.registrationPercentage ?? null;
  const fill          = fillPct !== null ? Math.min(Math.round(fillPct), 100) : null;
  const regName       = getEventRegisterName(event);

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b last:border-0 border-[hsl(var(--border)/0.6)] hover:bg-[hsl(var(--muted)/0.4)] transition-colors group">
      <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <ModuleBadge module={mod} />
        </div>
        <p className="text-sm font-medium text-[hsl(var(--foreground))] max-w-[220px] truncate" title={event.title}>{event.title}</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-[160px] truncate" title={regName || "—"}>{regName || "—"}</p>
      </div>

      <div className="hidden lg:flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] shrink-0">
        <Clock className="h-3 w-3" />
        {formatDate(event.date)}
      </div>

      <div className="w-28 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium tabular-nums">{rsvpCount.toLocaleString()}</span>
          {fill !== null && !useStakeholders && (
            <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums">{fill}%</span>
          )}
        </div>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-none mb-1">
          {useStakeholders ? "stakeholders" : "RSVPs"}
        </p>
        <div className="h-1 rounded-full bg-[hsl(var(--border))]">
          {fill !== null && (
            <div className="h-1 rounded-full" style={{ width: `${fill}%`, backgroundColor: dotColor }} />
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge status={event.status} />
        <Link href={`/events/${event.id}`}>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          >
            View
          </Button>
        </Link>
      </div>
    </div>
  );
}

/** Skeleton row shown while events are loading */
export function EventRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-[hsl(var(--border)/0.5)] last:border-0">
      <div className="w-1 h-10 rounded-full bg-[hsl(var(--muted))] animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-24 rounded bg-[hsl(var(--muted))] animate-pulse" />
        <div className="h-3.5 w-48 rounded bg-[hsl(var(--muted))] animate-pulse" />
      </div>
      <div className="h-5 w-16 rounded-full bg-[hsl(var(--muted))] animate-pulse" />
    </div>
  );
}
