"use client";

/**
 * WebinarCalendarCard — what the single webinar licence is committed to.
 *
 * With one licence running one webinar at a time, "can we run an AGM on the
 * 20th?" becomes a question a super admin gets asked regularly and cannot
 * answer from the meeting pool's capacity numbers, which count something else
 * entirely. This is that answer.
 *
 * There is no calendar endpoint. A webinar booking *is* a Zoom session row, so
 * this is the sessions list filtered to `type === "WEBINAR"`, grouped by day.
 * Super admins see event and organisation names here — the anonymity rule
 * applies to organisers checking availability, not to the people who administer
 * the licence.
 */

import { useMemo } from "react";
import Link from "next/link";
import { CalendarClock, Radio } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { ZoomSessionRow } from "@/api/admin-zoom-sessions";

/** Minutes of breathing room Zoom bookings need either side. */
const BUFFER_MINUTES = 30;

function addMinutes(hhmm: string | undefined, mins: number): string | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const total = ((h * 60 + m + mins) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** "2026-10-20" → "Tue 20 Oct 2026". Falls back to the raw string. */
function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/** The clock time out of "2026-10-20T12:00:00" or "12:00". */
function timeOf(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const m = /(\d{2}:\d{2})/.exec(value);
  return m ? m[1] : undefined;
}

export function WebinarCalendarCard({
  sessions,
  hasWebinarLicence,
}: {
  sessions: ZoomSessionRow[];
  hasWebinarLicence: boolean;
}) {
  const days = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const rows = sessions
      .filter((s) => s.type === "WEBINAR")
      // An ended or cancelled booking no longer holds the licence.
      .filter((s) => !s.stranded && !["ENDED", "CANCELLED"].includes((s.eventStatus ?? "").toUpperCase()))
      .filter((s) => !s.eventDate || s.eventDate >= today)
      .sort((a, b) =>
        `${a.eventDate ?? ""}${a.eventStartTime ?? ""}`.localeCompare(`${b.eventDate ?? ""}${b.eventStartTime ?? ""}`),
      );

    const grouped = new Map<string, ZoomSessionRow[]>();
    for (const row of rows) {
      const key = row.eventDate ?? "Unscheduled";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }
    return [...grouped.entries()];
  }, [sessions]);

  return (
    <Card className="attend-card p-5">
      <h2 className="font-semibold text-[hsl(var(--foreground))] flex items-center gap-2 mb-1">
        <CalendarClock className="h-4 w-4 text-[#7c22c9]" />
        Webinar bookings
      </h2>
      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">
        One webinar runs at a time per licence, booked against the event&apos;s own date and start
        time. Bookings need {BUFFER_MINUTES} minutes between them, so the licence frees up
        {" "}{BUFFER_MINUTES} minutes after each one ends.
      </p>

      {!hasWebinarLicence ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          No webinar licence in the pool yet. Add a webinar-capable Zoom account above and
          organisers will be able to create webinars.
        </p>
      ) : days.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Nothing booked. The webinar licence is free for any upcoming event.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {days.map(([date, rows]) => (
            <div key={date}>
              <p className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2">
                {date === "Unscheduled" ? "Unscheduled" : dayLabel(date)}
              </p>
              <div className="rounded-xl border border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))]">
                {rows.map((row) => {
                  const start = row.eventStartTime;
                  const end   = timeOf(row.endsAt);
                  const free  = addMinutes(end, BUFFER_MINUTES);
                  return (
                    <div key={`${row.eventId}-${start ?? ""}`} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="w-28 shrink-0">
                        <span className="text-sm font-semibold tabular-nums text-[hsl(var(--foreground))]">
                          {start ?? "—"}{end ? `–${end}` : ""}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/events/${row.eventId}`}
                          className="text-sm font-medium text-[hsl(var(--foreground))] truncate hover:underline block"
                          title={row.eventTitle}
                        >
                          {row.eventTitle}
                        </Link>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                          {row.orgName ?? row.registrarName ?? "—"}
                          {free ? ` · licence free from ${free}` : ""}
                        </p>
                      </div>
                      {row.live && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-600 shrink-0">
                          <Radio className="h-3 w-3 animate-pulse" /> Live
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default WebinarCalendarCard;
