"use client";
import Link from "next/link";
import {
  CalendarDays, Radio, ShieldAlert, ArrowRight,
  Building2, Clock, TrendingUp,
} from "lucide-react";
import { useGetMe } from "@/api/auth/hooks";
import { useDashboardStats, useEvents, useRecentRegistrations } from "@/api/super-admin";
import { useClientEvents } from "@/api/client-events";
import { useClientDashboardStats } from "@/api/client-dashboard";
import { useRegisters } from "@/api/registers";
import { ModuleBadge } from "@/components/custom/module-badge";
import { StatusBadge } from "@/components/custom/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate, timeAgo } from "@/lib/utils";
import { getEventModule, getEventRegisterName, MODULE_COLORS } from "@/lib/event-module";
import { Loader } from "@/components/ui/Loader";
import type { EventSummaryResponse, RegistrationSummaryResponse } from "@/types/super-admin";

// MODULE_COLORS is now imported from @/lib/event-module — keeping the local
// Record shape here for legacy inline use within this file only.
const _UNUSED_COLORS: Record<string, string> = {
  AGM: "#374151",
  HACKATHON: "#7c3aed",
  LAUNCH: "#ea6c00",
  GENERAL: "#111827",
};

function EventRow({ event }: { event: EventSummaryResponse }) {
  const isLive   = event.status === "live" || event.status === "LIVE";
  const mod      = getEventModule(event);
  const dotColor = MODULE_COLORS[mod];

  const rsvpCount = event.registrationCount ?? 0;
  const fillPct   = event.registrationPercentage ?? null;
  const capacity  = fillPct && fillPct > 0 && rsvpCount > 0
    ? Math.round(rsvpCount / (fillPct / 100))
    : null;
  const fill = fillPct !== null ? Math.min(Math.round(fillPct), 100) : null;

  // Organizer = event.registerName (primary per API spec), falling back to stakeholderName/organizerName.
  const registerName = getEventRegisterName(event);

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b last:border-0 border-[hsl(var(--border)/0.6)] hover:bg-[hsl(var(--muted)/0.4)] transition-colors group">

      {/* Horizontal colour bar (event type indicator) */}
      <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />

      {/* Type badge + title + organizer — same order as /events table */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <ModuleBadge module={mod} />
          {isLive && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 rounded-full px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{event.title}</p>
        {/* Organizer — the register/organisation that owns this event */}
        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{registerName || "—"}</p>
      </div>

      {/* Date */}
      <div className="hidden lg:flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] shrink-0">
        <Clock className="h-3 w-3" />
        {formatDate(event.date)}
      </div>

      {/* RSVP bar */}
      <div className="w-28 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium tabular-nums">{rsvpCount.toLocaleString()}</span>
          {fill !== null && (
            <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums">{fill}%</span>
          )}
        </div>
        <div className="h-1 rounded-full bg-[hsl(var(--border))]">
          {fill !== null && (
            <div className="h-1 rounded-full transition-all" style={{ width: `${fill}%`, backgroundColor: dotColor }} />
          )}
        </div>
      </div>

      {/* Status + action */}
      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge status={event.status} />
        <Link href={isLive ? "/events/live" : `/events/${event.id}`}>
          <Button size="sm" variant={isLive ? "default" : "outline"} className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
            {isLive ? "Control Room" : "View"}
          </Button>
        </Link>
      </div>
    </div>
  );
}

// Roles that belong to the super-admin side; everything else is a client/stakeholder user.
const ADMIN_ROLES = new Set(["super_admin", "event_manager", "kyc_officer", "judge"]);

export default function DashboardPage() {
  const { data: userResponse, isLoading: userLoading } = useGetMe();
  const currentUser = userResponse?.data;
  const isAdmin = userLoading || !currentUser || ADMIN_ROLES.has(currentUser.role?.toLowerCase() ?? "");

  // Both hook sets are always called (Rules of Hooks); we pick results by role below.
  const { data: dashStats,       isLoading: statsLoading    } = useDashboardStats();
  const { data: eventsData,      isLoading: eventsLoading   } = useEvents("", 0, 20);
  const { data: registersData,   isLoading: regsLoading     } = useRegisters("ACTIVE", 0, 6);
  const { data: recentRegsData,  isLoading: recentsLoading  } = useRecentRegistrations(0, 6);
  const { data: clientEventsData, isLoading: clientEventsLoading } = useClientEvents("ALL", 0, 20);
  const { data: clientStatsData,  isLoading: clientStatsLoading  } = useClientDashboardStats();

  const isLoading = userLoading || (
    isAdmin
      ? (statsLoading || eventsLoading || regsLoading || recentsLoading)
      : (clientEventsLoading || clientStatsLoading)
  );

  if (isLoading) {
    return <Loader variant="page" text="Loading Dashboard..." />;
  }

  const stats = isAdmin ? dashStats?.data : null;

  // Build a unified EventSummaryResponse[] regardless of which API was used.
  // Per API spec: the "Organizer" UI field maps to event.registerName from the client list response.
  const allEvents: EventSummaryResponse[] = isAdmin
    ? (eventsData?.content ?? [])
    : (clientEventsData?.events ?? []).map((e) => ({
        id:                     e.id,
        title:                  e.title,
        status:                 e.status,
        date:                   e.date,
        startTime:              "",
        format:                 e.format as "VIRTUAL" | "IN_PERSON" | "HYBRID",
        live:                   e.status === "LIVE",
        registerName:           e.registerName ?? "",          // primary organizer field
        organizerName:          e.registerName ?? "",          // alias for admin-path consumers
        registrationCount:      e.rsvpCount,
        registrationPercentage: e.fillRate,
        tags:                   [],
        eventType:              e.eventType,
      }));

  // Registers directory — fetched from GET /api/v1/client/registers?status=ACTIVE
  const topRegisters = (registersData?.registers ?? []).slice(0, 5);
  const recentRegistrations: RegistrationSummaryResponse[] = recentRegsData?.data?.content ?? [];

  const liveEvents = allEvents.filter((e) => e.status === "live" || e.status === "LIVE");
  // Admin sees every event on the platform; client sees all of their own events.
  const upcoming = allEvents;

  const topStakeholders = topRegisters; // alias kept so the JSX below compiles unchanged
  const pendingKYC = stats?.pendingKYC?.count ?? 0;

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
            Welcome back, {currentUser?.fullName ?? "Admin"}.
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{dateStr} · {timeStr}</p>
        </div>
        {(stats?.liveBanner?.live || liveEvents.length > 0) && (
          <Link href="/events/live">
            <div className="flex items-center gap-2.5 bg-red-600 text-white rounded-xl px-4 py-2.5 cursor-pointer hover:bg-red-700 transition-colors">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              <div>
                <p className="text-xs font-semibold leading-none">
                  {stats?.liveBanner?.organizerName ?? liveEvents[0]?.title.split("—")[0].trim()}
                </p>
                <p className="text-xs text-red-200 mt-0.5">
                  {stats?.liveBanner?.onlineCount != null
                    ? `${stats.liveBanner.onlineCount.toLocaleString()} online`
                    : "Live now"}
                </p>
              </div>
              <Radio className="h-4 w-4 ml-1 opacity-70" />
            </div>
          </Link>
        )}
      </div>

      {/* ── Stats strip (single card, 4 inline stats) ── */}
      <div className="grid grid-cols-4 divide-x divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
        {[
          { label: "Enrolled Registers", value: stats?.enrolledStakeholders?.count ?? (registersData?.totalCount ?? topRegisters.length), sub: "Active organisations", icon: Building2, color: "#374151" },
          { label: "Total Events", value: allEvents.length, sub: "Across all organisers", icon: CalendarDays, color: "#111827" },
          { label: "Live Now", value: stats?.liveNow?.count ?? liveEvents.length, sub: stats?.liveNow?.label ?? (liveEvents.length > 0 ? "Active sessions" : "No active sessions"), icon: Radio, color: "#dc2626" },
          { label: "Pending KYC", value: pendingKYC, sub: "Awaiting verification", icon: ShieldAlert, color: "#f97316" },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-4 px-6 py-5">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "15" }}>
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div>
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-0.5">{label}</p>
              <p className="text-2xl font-bold tabular-nums text-[hsl(var(--foreground))] leading-none">{value}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main content grid ── */}
      <div className="grid grid-cols-5 gap-5">

        {/* Left: Platform Events feed */}
        <div className="col-span-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border)/0.6)]">
            <div>
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Platform Events</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{upcoming.length} event{upcoming.length !== 1 ? "s" : ""} across all organisers</p>
            </div>
            <Link href="/events">
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                See all <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div>
            {upcoming.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
            {upcoming.length === 0 && (
              <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-10">No upcoming events.</p>
            )}
          </div>
        </div>

        {/* Right: Registers card + recent registrations */}
        <div className="col-span-2 flex flex-col gap-5">

          {/* Registers card */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[hsl(var(--border)/0.6)]">
              <h2 className="font-semibold text-[hsl(var(--foreground))] text-sm">Registers</h2>
              <Link href="/registers">
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-[hsl(var(--muted-foreground))] px-2">
                  All <ArrowRight className="h-2.5 w-2.5" />
                </Button>
              </Link>
            </div>
            <div className="divide-y divide-[hsl(var(--border)/0.5)]">
              {topStakeholders.map((reg) => {
                const displayName = reg.name || (reg as any).companyName || "—";
                const statusKey   = (reg.status ?? "").toUpperCase();
                const dotColor    = statusKey === "ACTIVE" ? "#16a34a" : statusKey === "SUSPENDED" ? "#dc2626" : "#f59e0b";
                return (
                  <div key={reg.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[hsl(var(--muted)/0.3)] transition-colors">
                    <div
                      className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "rgba(55,65,81,0.08)" }}
                    >
                      <Building2 className="h-3.5 w-3.5" style={{ color: "#374151" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[hsl(var(--foreground))] truncate">{displayName}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                        {reg.industry ?? <i>—</i>}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span className="text-xs font-semibold tabular-nums text-[hsl(var(--foreground))]">{reg.eventCount ?? 0}</span>
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">events</span>
                    </div>
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                  </div>
                );
              })}
              {topStakeholders.length === 0 && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-6">No registers yet.</p>
              )}
            </div>
          </div>

          {/* Recent registrations */}
          <div className="rounded-xl border border-[hsl(var(--card))] bg-[hsl(var(--card))] overflow-hidden flex-1">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[hsl(var(--border)/0.6)]">
              <h2 className="font-semibold text-[hsl(var(--foreground))] text-sm">Recent Registrations</h2>
              <Link href="/participants">
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-[hsl(var(--muted-foreground))] px-2">
                  All <ArrowRight className="h-2.5 w-2.5" />
                </Button>
              </Link>
            </div>
            <div className="divide-y divide-[hsl(var(--border)/0.5)]">
              {recentRegistrations.map((reg) => (
                <div key={reg.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[hsl(var(--muted)/0.3)] transition-colors">
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ backgroundColor: "hsl(var(--primary)/0.1)", color: "hsl(var(--primary))" }}
                  >
                    {reg.participantName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[hsl(var(--foreground))] truncate">{reg.participantName}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{reg.participantEmail}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusBadge status={reg.kycStatus ?? reg.status ?? ""} />
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{reg.registeredAgo ?? timeAgo(reg.registeredAt)}</span>
                  </div>
                </div>
              ))}
              {recentRegistrations.length === 0 && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-6">No recent registrations.</p>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Quick actions footer bar ── */}
      <div className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-4">
        <TrendingUp className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0" />
        <p className="text-sm text-[hsl(var(--muted-foreground))] flex-1">Quick actions</p>
        <div className="flex items-center gap-2">
          <Link href="/participants/kyc">
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
              KYC Queue
              {pendingKYC > 0 && (
                <span className="h-4 min-w-4 px-1 rounded-full text-xs font-bold flex items-center justify-center" style={{ backgroundColor: "#f97316", color: "white" }}>
                  {pendingKYC}
                </span>
              )}
            </Button>
          </Link>
          <Link href="/registers/enrol"><Button size="sm" variant="outline" className="h-8 text-xs">Enrol Register</Button></Link>
          <Link href="/documents"><Button size="sm" variant="outline" className="h-8 text-xs">Documents</Button></Link>
          <Link href="/analytics"><Button size="sm" variant="outline" className="h-8 text-xs">Analytics</Button></Link>
        </div>
      </div>
    </div>
  );
}
