"use client";

import Link from "next/link";
import {
  Building2, Radio, ArrowRight,
  CalendarDays, QrCode, PlusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventRow, EventRowSkeleton } from "@/components/dashboard/event-row";
import { StatGrid } from "@/components/dashboard/stat-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import type { EventSummaryResponse } from "@/types/super-admin";
import type { RegisterItem } from "@/types/super-admin";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ClientViewProps {
  currentUser:    { fullName?: string } | null | undefined;
  allEvents:      EventSummaryResponse[];
  eventsLoading:  boolean;
  topRegisters:   RegisterItem[];
  liveEvents:     EventSummaryResponse[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ClientView({
  currentUser,
  allEvents,
  eventsLoading,
  topRegisters,
  liveEvents,
}: ClientViewProps) {
  const dateStr = new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const timeStr = new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
            Welcome back, {currentUser?.fullName ?? "Admin"}.
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            {dateStr} · {timeStr}
          </p>
        </div>
        {liveEvents.length > 0 && (
          <Link href="/events/live">
            <div className="flex items-center gap-2.5 bg-red-600 text-white rounded-xl px-4 py-2.5 cursor-pointer hover:bg-red-700 transition-colors">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              <div>
                <p className="text-xs font-semibold leading-none">{liveEvents[0]?.title?.split("—")[0]?.trim()}</p>
                <p className="text-xs text-red-200 mt-0.5">Live now</p>
              </div>
              <Radio className="h-4 w-4 ml-1 opacity-70" />
            </div>
          </Link>
        )}
      </div>

      {/* Stats — 3 cards (Pending KYC removed per spec) */}
      <StatGrid
        cols={3}
        bgOpacity="15"
        items={[
          { label: "Enrolled Registers", value: topRegisters.length, sub: "Active organisations",  icon: Building2,    color: "#374151" },
          { label: "Total Events",       value: allEvents.length,    sub: "Across all organisers", icon: CalendarDays, color: "#111827" },
          { label: "Live Now",           value: liveEvents.length,   sub: liveEvents.length > 0 ? "Active sessions" : "No active sessions", icon: Radio, color: "#dc2626" },
        ]}
      />

      {/* Quick Actions — 3 tiles */}
      <QuickActions
        cols={3}
        items={[
          { label: "Create Event", href: "/events/create",     icon: PlusCircle,   color: "#374151", bg: "#f3f4f6" },
          { label: "All Events",   href: "/events",            icon: CalendarDays, color: "#0f766e", bg: "#f0fdfa" },
          { label: "QR Check-In",  href: "/events/qr-checkin", icon: QrCode,       color: "#7c3aed", bg: "#faf5ff" },
        ]}
      />

      {/* Main grid */}
      <div className="grid grid-cols-5 gap-5">
        {/* Left: Events */}
        <div className="col-span-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border)/0.6)]">
            <div>
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Platform Events</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                {allEvents.length} event{allEvents.length !== 1 ? "s" : ""} across all organisers
              </p>
            </div>
            <Link href="/events">
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                See all <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div>
            {eventsLoading
              ? [...Array(5)].map((_, i) => <EventRowSkeleton key={i} />)
              : allEvents.length === 0
                ? <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-10">No upcoming events.</p>
                : allEvents.map((event) => <EventRow key={event.id} event={event} />)
            }
          </div>
        </div>

        {/* Right: Registers */}
        <div className="col-span-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[hsl(var(--border)/0.6)]">
            <h2 className="font-semibold text-[hsl(var(--foreground))] text-sm">Registers</h2>
            <Link href="/registers">
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-[hsl(var(--muted-foreground))] px-2">
                All <ArrowRight className="h-2.5 w-2.5" />
              </Button>
            </Link>
          </div>
          <div className="divide-y divide-[hsl(var(--border)/0.5)]">
            {topRegisters.map((reg) => {
              const name      = reg.name || reg.companyName || "—";
              const statusKey = (reg.status ?? "").toUpperCase();
              const dot       = statusKey === "ACTIVE" ? "#16a34a" : statusKey === "SUSPENDED" ? "#dc2626" : "#f59e0b";
              return (
                <div key={reg.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[hsl(var(--muted)/0.3)] transition-colors">
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(55,65,81,0.08)" }}>
                    <Building2 className="h-3.5 w-3.5" style={{ color: "#374151" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[hsl(var(--foreground))] truncate">{name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{reg.industry ?? "—"}</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className="text-xs font-semibold tabular-nums">{reg.eventCount ?? 0}</span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">events</span>
                  </div>
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: dot }} />
                </div>
              );
            })}
            {topRegisters.length === 0 && (
              <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-6">No registers yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
