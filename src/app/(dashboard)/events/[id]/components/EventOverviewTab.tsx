"use client";
import { FileText, Calendar, Clock, MapPin, Users, Users2, Radio, Monitor } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { EventShim, LocalAgendaItem } from "./types";

const FORMAT_ICON = { virtual: Monitor, hybrid: Users2, "in-person": MapPin };

interface Props {
  event:        EventShim;
  fill:         number | null;
  eventDocs:    any[];
  agendaItems:  LocalAgendaItem[];
  isAGM:        boolean;
  onNavigate:   (tab: string) => void;
}

export function EventOverviewTab({ event, fill, eventDocs, agendaItems, isAGM, onNavigate }: Props) {
  const FormatIcon = FORMAT_ICON[event.format] ?? Monitor;

  return (
    <div className="grid grid-cols-3 gap-5">
      {/* ── Left column ── */}
      <div className="col-span-2 flex flex-col gap-5">

        {/* RSVP / Capacity / Fill rate strip */}
        <div className="grid grid-cols-3 divide-x divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
          {[
            { label: "RSVPs",     value: event.rsvpCount.toLocaleString(), icon: Users,  color: "#111827" },
            { label: "Capacity",  value: event.capacity ? event.capacity.toLocaleString() : "Unlimited", icon: Users2, color: "#1a6b3c" },
            { label: "Fill Rate", value: fill !== null ? `${fill}%` : "—", icon: Radio,  color: fill !== null && fill >= 80 ? "#dc2626" : "#f97316" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="flex items-center gap-3 px-5 py-4">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "15" }}>
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
              <div>
                <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">{label}</p>
                <p className="text-xl font-bold tabular-nums text-[hsl(var(--foreground))]">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Event details */}
        <Card className="attend-card p-5">
          <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4">Event Details</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Calendar, label: "Date",   value: formatDate(event.date) },
              { icon: Clock,    label: "Time",   value: `${event.startTime} – ${event.endTime || "TBC"}` },
              { icon: FormatIcon, label: "Format", value: event.format.charAt(0).toUpperCase() + event.format.slice(1) },
              { icon: MapPin,   label: "Venue",  value: event.venue || "Virtual (no physical venue)" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-[hsl(var(--muted)/0.4)]">
                <div className="h-8 w-8 rounded-lg bg-[hsl(var(--primary)/0.1)] flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="h-4 w-4 text-[hsl(var(--primary))]" />
                </div>
                <div>
                  <p className="attend-section-title">{label}</p>
                  <p className="text-sm font-medium text-[hsl(var(--foreground))] mt-0.5">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Registration fill bar */}
        {fill !== null && (
          <Card className="attend-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Registration</h2>
              <span className="text-sm font-semibold" style={{ color: event.color }}>{fill}% full</span>
            </div>
            <div className="h-3 w-full rounded-full bg-[hsl(var(--muted))]">
              <div className="h-3 rounded-full transition-all" style={{ width: `${Math.min(fill, 100)}%`, backgroundColor: event.color }} />
            </div>
            <div className="flex justify-between mt-2 text-xs text-[hsl(var(--muted-foreground))]">
              <span>{event.rsvpCount.toLocaleString()} registered</span>
              <span>{event.capacity?.toLocaleString()} capacity</span>
            </div>
          </Card>
        )}

        {/* Agenda / Resolutions preview (AGM only, when items exist) */}
        {isAGM && agendaItems.length > 0 && (
          <Card className="attend-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Resolutions</h2>
              <button onClick={() => onNavigate("Resolutions")} className="text-xs text-[hsl(var(--primary))] hover:underline">Edit →</button>
            </div>
            <div className="flex flex-col divide-y divide-[hsl(var(--border))]">
              {agendaItems.slice(0, 4).map((item) => (
                <div key={item.id} className="flex items-start gap-3 py-2.5">
                  <span className="text-xs font-mono font-semibold text-[hsl(var(--primary))] w-16 shrink-0 pt-0.5">{item.time}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{item.title}</p>
                    {item.speaker && <p className="text-xs text-[hsl(var(--muted-foreground))]">{item.speaker}</p>}
                  </div>
                </div>
              ))}
              {agendaItems.length > 4 && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] pt-2.5">+{agendaItems.length - 4} more items</p>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* ── Right column ── */}
      <div className="flex flex-col gap-4">

        {/* Organiser card */}
        <Card className="attend-card p-5">
          <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3">Organiser</h2>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-[hsl(var(--primary))] font-bold text-sm shrink-0">
              {event.organiser.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
            </div>
            <div>
              <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{event.organiser}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Event organiser</p>
            </div>
          </div>
        </Card>

        {/* Documents mini-list */}
        <Card className="attend-card p-5">
          <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3">Documents</h2>
          {eventDocs.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">No documents uploaded yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {eventDocs.map((d) => (
                <div key={d.id} className="flex items-center gap-2 text-sm">
                  <FileText className="h-3.5 w-3.5 text-[hsl(var(--primary))] shrink-0" />
                  <span className="truncate text-[hsl(var(--foreground))]">{d.title}</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => onNavigate("Documents")} className="mt-3 text-xs text-[hsl(var(--primary))] hover:underline">
            View all →
          </button>
        </Card>
      </div>
    </div>
  );
}
