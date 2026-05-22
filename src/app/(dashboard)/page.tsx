"use client";
import Link from "next/link";
import {
  CalendarDays, Users, Radio, ShieldAlert, ArrowRight,
  Building2, Rocket, Lightbulb, Globe, TrendingUp, Clock,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { ModuleBadge } from "@/components/custom/module-badge";
import { StatusBadge } from "@/components/custom/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate, timeAgo } from "@/lib/utils";
import { AttendEvent } from "@/lib/mock-data";

const MODULE_CONFIG = {
  AGM:       { label: "AGM / EGM",    icon: Building2, color: "#1a6b3c", bg: "#edf7f2" },
  LAUNCH:    { label: "Launches",     icon: Rocket,    color: "#ea6c00", bg: "#fff4eb" },
  HACKATHON: { label: "Hackathons",   icon: Lightbulb, color: "#7c22c9", bg: "#f8f0ff" },
  GENERAL:   { label: "General",      icon: Globe,     color: "#1d4ed8", bg: "#eff5ff" },
};

function EventRow({ event }: { event: AttendEvent }) {
  const isLive = event.status === "live";
  const fill = event.capacity ? Math.round((event.rsvpCount / event.capacity) * 100) : null;
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b last:border-0 border-[hsl(var(--border)/0.6)] hover:bg-[hsl(var(--muted)/0.4)] transition-colors group">
      {/* Color bar */}
      <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: event.color }} />

      {/* Title + module */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {isLive && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 rounded-full px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
          )}
          <ModuleBadge module={event.module} />
        </div>
        <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{event.title}</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{event.organiser}</p>
      </div>

      {/* Date */}
      <div className="hidden lg:flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] shrink-0">
        <Clock className="h-3 w-3" />
        {formatDate(event.date)}
      </div>

      {/* RSVP */}
      <div className="w-24 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium tabular-nums">{event.rsvpCount.toLocaleString()}</span>
          {fill !== null && <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{fill}%</span>}
        </div>
        {fill !== null && (
          <div className="h-1 rounded-full bg-[hsl(var(--border))]">
            <div className="h-1 rounded-full" style={{ width: `${Math.min(fill, 100)}%`, backgroundColor: event.color }} />
          </div>
        )}
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
  const { events, participants, liveAttendees } = useStore();

  const liveEvents = events.filter((e) => e.status === "live");
  const pendingKYC = participants.filter((p) => p.kycStatus === "pending").length;
  const upcoming = events.filter((e) => e.status === "published" || e.status === "live" || e.status === "draft");
  const recentParticipants = [...participants]
    .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())
    .slice(0, 6);

  const moduleCounts = (["AGM", "LAUNCH", "HACKATHON", "GENERAL"] as const).map((m) => ({
    ...MODULE_CONFIG[m],
    module: m,
    count: events.filter((e) => e.module === m).length,
    rsvp: events.filter((e) => e.module === m).reduce((s, e) => s + e.rsvpCount, 0),
  }));

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Welcome back, Stanley.</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{dateStr} · {timeStr}</p>
        </div>
        {liveEvents.length > 0 && (
          <Link href="/events/live">
            <div className="flex items-center gap-2.5 bg-red-600 text-white rounded-xl px-4 py-2.5 cursor-pointer hover:bg-red-700 transition-colors">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              <div>
                <p className="text-xs font-semibold leading-none">{liveEvents[0].title.split("—")[0].trim()}</p>
                <p className="text-[11px] text-red-200 mt-0.5">{liveAttendees.toLocaleString()} attendees online</p>
              </div>
              <Radio className="h-4 w-4 ml-1 opacity-70" />
            </div>
          </Link>
        )}
      </div>

      {/* ── Stats strip (single card, 4 inline stats) ── */}
      <div className="grid grid-cols-4 divide-x divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
        {[
          { label: "Total Events", value: events.length, sub: "Across all modules", icon: CalendarDays, color: "#1a6b3c" },
          { label: "Participants", value: participants.length, sub: "Registered platform users", icon: Users, color: "#2563eb" },
          { label: "Live Now", value: liveEvents.length, sub: liveEvents.length > 0 ? `${liveAttendees.toLocaleString()} online` : "No active sessions", icon: Radio, color: liveEvents.length > 0 ? "#dc2626" : "#9ca3af" },
          { label: "Pending KYC", value: pendingKYC, sub: "Awaiting verification", icon: ShieldAlert, color: pendingKYC > 0 ? "#f97316" : "#9ca3af" },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-4 px-6 py-5">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "15" }}>
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div>
              <p className="text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-0.5">{label}</p>
              <p className="text-2xl font-bold tabular-nums text-[hsl(var(--foreground))] leading-none">{value}</p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main content grid ── */}
      <div className="grid grid-cols-5 gap-5">

        {/* Left: Event feed */}
        <div className="col-span-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border)/0.6)]">
            <div>
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Events</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{upcoming.length} upcoming or active</p>
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
          </div>
        </div>

        {/* Right: Module tiles + recent users */}
        <div className="col-span-2 flex flex-col gap-5">

          {/* Module tiles 2x2 */}
          <div>
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3">Modules</h2>
            <div className="grid grid-cols-2 gap-3">
              {moduleCounts.map(({ module, label, icon: Icon, color, bg, count, rsvp }) => (
                <Link key={module} href="/events">
                  <div
                    className="rounded-xl p-4 cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: bg, border: `1px solid ${color}22` }}
                  >
                    <div
                      className="h-9 w-9 rounded-lg flex items-center justify-center mb-3"
                      style={{ backgroundColor: color + "20" }}
                    >
                      <Icon className="h-4 w-4" style={{ color }} />
                    </div>
                    <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{label}</p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
                      {count} event{count !== 1 ? "s" : ""} · {rsvp.toLocaleString()} RSVPs
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent registrations */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden flex-1">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[hsl(var(--border)/0.6)]">
              <h2 className="font-semibold text-[hsl(var(--foreground))] text-sm">Recent Registrations</h2>
              <Link href="/participants">
                <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 text-[hsl(var(--muted-foreground))] px-2">
                  All <ArrowRight className="h-2.5 w-2.5" />
                </Button>
              </Link>
            </div>
            <div className="divide-y divide-[hsl(var(--border)/0.5)]">
              {recentParticipants.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[hsl(var(--muted)/0.3)] transition-colors">
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{ backgroundColor: "hsl(var(--primary)/0.1)", color: "hsl(var(--primary))" }}
                  >
                    {p.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[hsl(var(--foreground))] truncate">{p.fullName}</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">{p.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusBadge status={p.kycStatus} />
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{timeAgo(p.registeredAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Quick actions footer bar ── */}
      <div className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-4">
        <TrendingUp className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0" />
        <p className="text-sm text-[hsl(var(--muted-foreground))] flex-1">Quick actions</p>
        <div className="flex items-center gap-2">
          <Link href="/events/create"><Button size="sm" className="h-8 text-xs">Create Event</Button></Link>
          <Link href="/participants/kyc">
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
              KYC Queue
              {pendingKYC > 0 && (
                <span className="h-4 min-w-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ backgroundColor: "#f97316", color: "white" }}>
                  {pendingKYC}
                </span>
              )}
            </Button>
          </Link>
          <Link href="/documents"><Button size="sm" variant="outline" className="h-8 text-xs">Documents</Button></Link>
          <Link href="/analytics"><Button size="sm" variant="outline" className="h-8 text-xs">Analytics</Button></Link>
        </div>
      </div>
    </div>
  );
}
