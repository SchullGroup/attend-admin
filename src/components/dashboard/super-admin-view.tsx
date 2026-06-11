"use client";

import Link from "next/link";
import {
  Building2, Radio, ShieldAlert, ArrowRight,
  CheckCircle2, PlusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventRow, EventRowSkeleton } from "@/components/dashboard/event-row";
import { StatGrid } from "@/components/dashboard/stat-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import type { EventSummaryResponse } from "@/types/super-admin";
import type { RegistrarsListResponse } from "@/api/registrars";
import type { PagedResponse } from "@/types/super-admin";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface SuperAdminViewProps {
  currentUser:    { fullName?: string } | null | undefined;
  stats:          Record<string, any> | null | undefined;
  statsLoading:   boolean;
  allEvents:      EventSummaryResponse[];
  eventsData:     PagedResponse<EventSummaryResponse> | undefined;
  eventsLoading:  boolean;
  registrars:     Array<{ id: string; companyName?: string; name?: string; industry?: string | null; status?: string; eventsCount?: number }>;
  registrarsData: RegistrarsListResponse | undefined;
  regLoading:     boolean;
  liveEvents:     EventSummaryResponse[];
  publishedData:  PagedResponse<EventSummaryResponse> | undefined;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SuperAdminView({
  currentUser,
  stats,
  statsLoading,
  allEvents,
  eventsData,
  eventsLoading,
  registrars,
  registrarsData,
  regLoading,
  liveEvents,
  publishedData,
}: SuperAdminViewProps) {

  const enrolledCount  = stats?.enrolledStakeholders?.count ?? 0;
  const publishedCount = publishedData?.totalElements        ?? 0;
  const liveCount      = stats?.liveNow?.count              ?? 0;
  const onlineCount    = stats?.liveNow?.onlineCount         ?? 0;
  const pendingKYC     = stats?.pendingKYC?.count            ?? 0;

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
        {(stats?.liveBanner?.live || liveEvents.length > 0) && (
          <Link href="/events/live">
            <div className="flex items-center gap-2.5 bg-red-600 text-white rounded-xl px-4 py-2.5 cursor-pointer hover:bg-red-700 transition-colors">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              <div>
                <p className="text-xs font-semibold leading-none">
                  {stats?.liveBanner?.organizerName ?? liveEvents[0]?.title?.split("—")[0]?.trim()}
                </p>
                <p className="text-xs text-red-200 mt-0.5">
                  {onlineCount > 0 ? `${onlineCount.toLocaleString()} online` : "Live now"}
                </p>
              </div>
              <Radio className="h-4 w-4 ml-1 opacity-70" />
            </div>
          </Link>
        )}
      </div>

      {/* Stats — 4 cards from /api/v1/admin/dashboard/stats */}
      <StatGrid
        cols={4}
        loading={statsLoading}
        items={[
          { label: "Enrolled Organisers", value: enrolledCount,  sub: "Active organisations",  icon: Building2,    color: "#374151" },
          { label: "Published",           value: publishedCount, sub: "Open for registration", icon: CheckCircle2, color: "#0f766e" },
          { label: "Live Now",            value: liveCount,      sub: onlineCount > 0 ? `${onlineCount.toLocaleString()} online` : "No active sessions", icon: Radio, color: "#dc2626" },
          { label: "Pending KYC",         value: pendingKYC,     sub: "Awaiting verification", icon: ShieldAlert,  color: "#f97316" },
        ]}
      />

      {/* Quick Actions — 3 tiles (Live Control removed per spec) */}
      <QuickActions
        cols={3}
        items={[
          { label: "KYC Review",      href: "/participants/kyc", icon: ShieldAlert, color: "#f97316", bg: "#fff7ed" },
          { label: "All Registrars",  href: "/registrars",       icon: Building2,   color: "#374151", bg: "#f3f4f6" },
          { label: "Enrol Registrar", href: "/registrars/enrol", icon: PlusCircle,  color: "#0f766e", bg: "#f0fdfa" },
        ]}
      />

      {/* Main grid */}
      <div className="grid grid-cols-5 gap-5">
        {/* Left: Platform Events */}
        <div className="col-span-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border)/0.6)]">
            <div>
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Platform Events</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                {eventsData?.totalElements ?? allEvents.length} total events across all modules
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
                ? <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-10">No events yet.</p>
                : allEvents.map((event) => <EventRow key={event.id} event={event} />)
            }
          </div>
        </div>

        {/* Right: Registrars */}
        <div className="col-span-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[hsl(var(--border)/0.6)]">
            <div>
              <h2 className="font-semibold text-[hsl(var(--foreground))] text-sm">Registrars</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                {registrarsData?.totalCount ?? registrars.length} total
              </p>
            </div>
            <Link href="/registrars">
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-[hsl(var(--muted-foreground))] px-2">
                All <ArrowRight className="h-2.5 w-2.5" />
              </Button>
            </Link>
          </div>

          {regLoading ? (
            [...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border)/0.4)] last:border-0">
                <div className="h-7 w-7 rounded-lg bg-[hsl(var(--muted))] animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 rounded bg-[hsl(var(--muted))] animate-pulse" />
                  <div className="h-2.5 w-20 rounded bg-[hsl(var(--muted))] animate-pulse" />
                </div>
              </div>
            ))
          ) : registrars.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-8">No registrars enrolled.</p>
          ) : (
            <div className="divide-y divide-[hsl(var(--border)/0.5)]">
              {registrars.map((reg) => {
                const name     = reg.companyName || reg.name || "—";
                const statusK  = (reg.status ?? "").toUpperCase();
                const dot      = statusK === "ACTIVE" ? "#16a34a" : statusK === "SUSPENDED" ? "#dc2626" : "#f59e0b";
                const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <Link key={reg.id} href={`/registrars/${reg.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[hsl(var(--muted)/0.3)] transition-colors">
                    <div className="h-8 w-8 rounded-lg bg-[hsl(var(--primary)/0.08)] flex items-center justify-center text-xs font-bold text-[hsl(var(--primary))] shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[hsl(var(--foreground))] truncate">{name}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{reg.industry ?? "—"}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dot }} />
                      <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums">{reg.eventsCount ?? 0} events</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
