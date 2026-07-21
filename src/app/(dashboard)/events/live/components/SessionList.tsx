"use client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { Radio, Vote, Users, ChevronRight } from "lucide-react";
import { useClientEvents } from "@/api/client-events";
import { eventColor, initials } from "./helpers";

export function SessionList({ onSelect }: { onSelect: (eventId: string) => void }) {
  const { data, isLoading } = useClientEvents("ALL", 0, 100);
  const sessions = (data?.events ?? []).filter((e) => e.status?.toLowerCase() === "live");

  if (isLoading) return <Loader variant="page" text="Loading live sessions…" />;

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Radio className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">No live sessions at the moment.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Live Control Room</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-600">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              {sessions.length} LIVE
            </span>
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Select an event to open its control room
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active Sessions", value: sessions.length,                                               icon: Radio,  color: "#dc2626" },
          { label: "AGM/EGM Events",  value: sessions.filter((s) => s.eventType?.includes("AGM")).length,  icon: Vote,   color: "#7c22c9" },
          { label: "Other Events",    value: sessions.filter((s) => !s.eventType?.includes("AGM")).length, icon: Users,  color: "#0891b2" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="attend-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}18` }}>
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <div>
              <p className="text-lg font-bold text-[hsl(var(--foreground))]">{value}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Live Events</h2>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{sessions.length} sessions running</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left">Event</th>
                <th className="px-5 py-3 text-left">Type</th>
                <th className="px-5 py-3 text-left">Format</th>
                <th className="px-5 py-3 text-right">RSVP</th>
                <th className="px-5 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((sess) => {
                // Register brand colour (F4), inherited live — falls back to
                // the module-based default when no custom colour is set.
                const color = sess.branding?.brandColor || eventColor(sess.eventType);
                return (
                  <tr key={sess.id} className="attend-table-row">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-9 w-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: color }}
                        >
                          {initials(sess.registerName ?? sess.title)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate max-w-[220px]">
                            {sess.title}
                          </p>
                          {sess.registerName && (
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">{sess.registerName}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: color }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                        {sess.eventType}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-[hsl(var(--foreground))] capitalize">
                        {sess.format?.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Users className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                        <span className="text-sm font-semibold tabular-nums">{sess.rsvpCount.toLocaleString()}</span>
                        {sess.capacity > 0 && (
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">/ {sess.capacity.toLocaleString()}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Button
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => onSelect(sess.id)}
                      >
                        Manage <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
