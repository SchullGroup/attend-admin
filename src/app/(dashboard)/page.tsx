"use client";
import Link from "next/link";
import {
  CalendarDays, Radio, ShieldAlert, ArrowRight,
  Building2, Clock, TrendingUp,
} from "lucide-react";
import { useGetMe } from "@/api/auth/hooks";
import { useDashboardStats, useEvents, useStakeholders, useRecentRegistrations } from "@/api/super-admin";
import { ModuleBadge } from "@/components/custom/module-badge";
import { StatusBadge } from "@/components/custom/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate, timeAgo } from "@/lib/utils";
import { Loader } from "@/components/ui/Loader";
import type { EventSummaryResponse, StakeholderSummaryResponse, RegistrationSummaryResponse } from "@/types/super-admin";

const MODULE_COLORS: Record<string, string> = {
  AGM: "#374151",
  HACKATHON: "#7c3aed",
  LAUNCH: "#ea6c00",
  GENERAL: "#111827",
};

function getModuleFromEvent(event: EventSummaryResponse): string {
  if (!(event as any).tags) return "GENERAL";
  const tagsStr = ((event as any).tags as string[]).join(" ").toUpperCase();
  if (tagsStr.includes("AGM") || tagsStr.includes("EGM")) return "AGM";
  if (tagsStr.includes("LAUNCH") || tagsStr.includes("PRODUCT")) return "LAUNCH";
  if (tagsStr.includes("HACKATHON") || tagsStr.includes("CHALLENGE")) return "HACKATHON";
  return "GENERAL";
}

function EventRow({ event }: { event: EventSummaryResponse }) {
  const isLive = event.status === "live" || event.status === "LIVE";
  const module = getModuleFromEvent(event);
  const color = MODULE_COLORS[module] ?? "#111827";
  const rsvpCount = (event as any).rsvpCount;
  const capacity = (event as any).capacity;
  const fill = capacity && rsvpCount != null ? Math.round((rsvpCount / capacity) * 100) : null;

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b last:border-0 border-[hsl(var(--border)/0.6)] hover:bg-[hsl(var(--muted)/0.4)] transition-colors group">
      {/* Color bar */}
      <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: color }} />

      {/* Title + module */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {isLive && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 rounded-full px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
          )}
          <ModuleBadge module={module as any} />
        </div>
        <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{event.title}</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{(event as any).organiser ?? (event as any).organizerName ?? ""}</p>
      </div>

      {/* Date */}
      <div className="hidden lg:flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] shrink-0">
        <Clock className="h-3 w-3" />
        {formatDate(event.date)}
      </div>

      {/* Users / RSVP */}
      <div className="w-24 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium tabular-nums">{(rsvpCount ?? 0).toLocaleString()}</span>
          {fill !== null && <span className="text-xs text-[hsl(var(--muted-foreground))]">{fill}%</span>}
        </div>
        <div className="h-1 rounded-full bg-[hsl(var(--border))]">
          {fill !== null && (
            <div className="h-1 rounded-full" style={{ width: `${Math.min(fill, 100)}%`, backgroundColor: color }} />
          )}
        </div>
      </div>

      {/* Status + action */}
      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge status={event.status} />
        <Link href={isLive ? "/events/live" : "/events"}>
          <Button size="sm" variant={isLive ? "default" : "outline"} className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
            {isLive ? "Control Room" : "View"}
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: userResponse } = useGetMe();
  const currentUser = userResponse?.data;

  const { data: dashStats, isLoading: statsLoading } = useDashboardStats();
  const { data: eventsData, isLoading: eventsLoading } = useEvents("", 0, 20);
  const { data: stakeholdersData, isLoading: stkLoading } = useStakeholders(0, 10);
  const { data: recentRegsData, isLoading: regsLoading } = useRecentRegistrations(0, 6);

  if (statsLoading || eventsLoading || stkLoading || regsLoading) {
    return <Loader variant="page" text="Loading Dashboard..." />;
  }

  const stats = dashStats?.data;
  const allEvents: EventSummaryResponse[] = eventsData?.data?.content ?? [];
  const stakeholders: StakeholderSummaryResponse[] = stakeholdersData?.data?.content ?? [];
  const recentRegistrations: RegistrationSummaryResponse[] = recentRegsData?.data?.content ?? [];

  const liveEvents = allEvents.filter((e) => e.status === "live" || e.status === "LIVE");
  const upcoming = allEvents.filter((e) => {
    const s = e.status?.toLowerCase();
    return s === "published" || s === "live" || s === "draft";
  });

  const topStakeholders = [...stakeholders].slice(0, 4);
  const pendingKYC = stats?.pendingEnrollments ?? 0;

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
            Welcome back, {currentUser?.fullName?.split(" ")[0] ?? "Admin"}.
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{dateStr} · {timeStr}</p>
        </div>
        {liveEvents.length > 0 && (
          <Link href="/events/live">
            <div className="flex items-center gap-2.5 bg-red-600 text-white rounded-xl px-4 py-2.5 cursor-pointer hover:bg-red-700 transition-colors">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              <div>
                <p className="text-xs font-semibold leading-none">{liveEvents[0].title.split("—")[0].trim()}</p>
                <p className="text-xs text-red-200 mt-0.5">Live now</p>
              </div>
              <Radio className="h-4 w-4 ml-1 opacity-70" />
            </div>
          </Link>
        )}
      </div>

      {/* ── Stats strip (single card, 4 inline stats) ── */}
      <div className="grid grid-cols-4 divide-x divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
        {[
          { label: "Enrolled Organisers", value: stats?.activeStakeholders ?? stakeholders.length, sub: "Active organisations", icon: Building2, color: "#374151" },
          { label: "Total Events", value: allEvents.length, sub: "Across all organisers", icon: CalendarDays, color: "#111827" },
          { label: "Live Now", value: liveEvents.length, sub: liveEvents.length > 0 ? "Active sessions" : "No active sessions", icon: Radio, color: "#dc2626" },
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
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{upcoming.length} active or upcoming across all organisers</p>
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
              {topStakeholders.map((stk) => (
                <div key={stk.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[hsl(var(--muted)/0.3)] transition-colors">
                  <div
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ backgroundColor: "rgba(55,65,81,0.08)", color: "#374151" }}
                  >
                    <Building2 className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[hsl(var(--foreground))] truncate">{stk.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{stk.industry}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs font-semibold tabular-nums text-[hsl(var(--foreground))]">{stk.eventCount ?? 0}</span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">events</span>
                  </div>
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: "#16a34a" }} />
                </div>
              ))}
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
