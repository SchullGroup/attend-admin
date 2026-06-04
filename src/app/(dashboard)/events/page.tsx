"use client";
import { useState } from "react";
import Link from "next/link";
import { Radio, Eye, MapPin, Monitor, Users2, Search } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModuleBadge } from "@/components/custom/module-badge";
import { StatusBadge } from "@/components/custom/status-badge";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { EventModule } from "@/lib/mock-data";

const TABS: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "AGM", value: "AGM" },
  { label: "Launch", value: "LAUNCH" },
  { label: "Innovation Challenge", value: "HACKATHON" },
  { label: "General", value: "GENERAL" },
];

const FORMAT_ICON = {
  virtual: Monitor,
  hybrid: Users2,
  "in-person": MapPin,
};

export default function EventsPage() {
  const { events } = useStore();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = (activeTab === "all" ? events : events.filter((e) => e.module === activeTab))
    .filter((e) => !searchQuery.trim() || e.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Events</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{events.length} total events across all modules</p>
        </div>
        <span className="text-sm text-[hsl(var(--muted-foreground))]">Events are created by enrolled stakeholders</span>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        <Input
          placeholder="Search events by title…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 max-w-sm"
        />
      </div>

      <div className="flex items-center gap-1 mb-4 bg-[hsl(var(--muted))] rounded-full p-1 w-full">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex-1 px-4 py-1.5 rounded-full text-sm font-medium transition-all text-center ${
              activeTab === tab.value
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
              <th className="px-5 py-3 text-left">Stakeholder</th>
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-left">Format</th>
              <th className="px-5 py-3 text-left">RSVP</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((event) => {
              const FormatIcon = FORMAT_ICON[event.format];
              return (
                <tr key={event.id} className="attend-table-row">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: event.color }} />
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <ModuleBadge module={event.module as EventModule} />
                        </div>
                        <div className="text-sm font-medium text-[hsl(var(--foreground))] max-w-[260px] truncate">{event.title}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{event.organiser}</td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                    {formatDate(event.date)}
                    <div className="text-xs">{event.startTime}–{event.endTime}</div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))]">
                      <FormatIcon className="h-3.5 w-3.5" />
                      <span className="capitalize">{event.format}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm font-medium tabular-nums">
                    {event.rsvpCount.toLocaleString()}
                    {event.capacity && (
                      <span className="text-[hsl(var(--muted-foreground))] font-normal text-xs block">
                        of {event.capacity.toLocaleString()}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3"><StatusBadge status={event.status} /></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/events/${event.id}`}>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                          <Eye className="h-3 w-3" />
                          View
                        </Button>
                      </Link>
                      {event.status === "live" && (
                        <Link href="/events/live">
                          <Button size="sm" className="h-7 text-xs gap-1">
                            <Radio className="h-3 w-3" />
                            Live
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
          <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">No events found for this filter.</div>
        )}
      </Card>
    </div>
  );
}
