"use client";

import Link from "next/link";
import {
  Building2, Radio, ArrowRight,
  CheckCircle2, PlusCircle, Users, CalendarDays,
  UserCheck, UserX, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EventRow, EventRowSkeleton } from "@/components/dashboard/event-row";
import { StatGrid } from "@/components/dashboard/stat-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { StatusBadge } from "@/components/custom/status-badge";
import type { EventSummaryResponse, UserSummaryResponse } from "@/types/super-admin";
import type { RegistrarsListResponse } from "@/api/registrars";
import type { PagedResponse } from "@/types/super-admin";
import { formatDate } from "@/lib/utils";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface SuperAdminViewProps {
  currentUser:    { fullName?: string } | null | undefined;
  stats:          Record<string, any> | null | undefined;
  statsLoading:   boolean;
  adminDashboard?: Record<string, any> | null;
  usersData?:     PagedResponse<UserSummaryResponse> | null;
  usersLoading?:  boolean;
  allEvents:      EventSummaryResponse[];
  eventsData:     PagedResponse<EventSummaryResponse> | undefined;
  eventsLoading:  boolean;
  registrars:     Array<{ id: string; companyName?: string; name?: string; logoUrl?: string; industry?: string | null; status?: string; eventCount?: number }>;
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
  adminDashboard,
  usersData,
  usersLoading,
  allEvents,
  eventsData,
  eventsLoading,
  registrars,
  registrarsData,
  regLoading,
  liveEvents,
  publishedData,
}: SuperAdminViewProps) {

  const enrolledCount  = stats?.enrolledStakeholders?.count
    ?? adminDashboard?.enrolledStakeholders?.count
    ?? adminDashboard?.totalRegistrars
    ?? 0;
  const publishedCount = publishedData?.totalElements
    ?? adminDashboard?.publishedEvents
    ?? 0;
  const liveCount      = stats?.liveNow?.count
    ?? adminDashboard?.liveEvents
    ?? 0;
  const onlineCount    = stats?.liveNow?.onlineCount
    ?? adminDashboard?.onlineParticipants
    ?? 0;
  const totalUsers     = adminDashboard?.totalUsers ?? usersData?.totalElements ?? 0;
  const totalEvents    = adminDashboard?.totalEvents ?? eventsData?.totalElements ?? allEvents.length;
  const activeUsers    = adminDashboard?.activeUsers ?? 0;
  const suspendedUsers = adminDashboard?.suspendedUsers ?? 0;
  const kycApproved    = adminDashboard?.kycSummary?.approved ?? adminDashboard?.approvedKyc ?? 0;
  const recentActivity = adminDashboard?.recentActivity ?? adminDashboard?.activityFeed ?? [];

  const users: UserSummaryResponse[] =
    Array.isArray((usersData as any)?.content) ? (usersData as any).content :
    Array.isArray((usersData as any)?.users)   ? (usersData as any).users   :
    Array.isArray(usersData)                    ? usersData as any           :
    [];

  // Live events first, then the rest
  const sortedEvents = [
    ...allEvents.filter((e) => e.status === "LIVE" || e.status === "live"),
    ...allEvents.filter((e) => e.status !== "LIVE" && e.status !== "live"),
  ];

  const dateStr = new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const timeStr = new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
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
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-semibold text-red-700">{liveEvents.length} event{liveEvents.length !== 1 ? "s" : ""} live now</span>
          </div>
        )}
      </div>

      {/* ── Primary stats ── */}
      <StatGrid
        cols={4}
        loading={statsLoading}
        items={[
          { label: "Enrolled Registrars", value: enrolledCount,  sub: "Active organisations",  icon: Building2,    color: "#374151" },
          { label: "Published Events",    value: publishedCount, sub: "Open for registration", icon: CheckCircle2, color: "#0f766e" },
          { label: "Live Now",            value: liveCount,      sub: onlineCount > 0 ? `${onlineCount.toLocaleString()} online` : "No active sessions", icon: Radio, color: "#dc2626" },
          { label: "Platform Users",      value: totalUsers,     sub: `${activeUsers} active · ${suspendedUsers} suspended`, icon: Users, color: "#0891b2" },
        ]}
      />

      {/* ── Secondary stats ── */}
      {adminDashboard && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Events",   value: totalEvents,   icon: CalendarDays, color: "#374151" },
            { label: "Active Users",   value: activeUsers,   icon: UserCheck,    color: "#16a34a" },
            { label: "Suspended",      value: suspendedUsers,icon: UserX,        color: "#dc2626" },
            { label: "KYC Approved",   value: kycApproved,   icon: CheckCircle2, color: "#0f766e" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="attend-card flex items-center gap-3 p-4">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: color + "18" }}>
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
              <div>
                <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">{label}</p>
                <p className="text-xl font-bold tabular-nums text-[hsl(var(--foreground))] leading-none mt-0.5">
                  {(value ?? 0).toLocaleString()}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Quick Actions — no KYC Review ── */}
      <QuickActions
        cols={2}
        items={[
          { label: "All Registrars",  href: "/registrars",       icon: Building2,  color: "#374151", bg: "#f3f4f6" },
          { label: "Enrol Registrar", href: "/registrars/enrol", icon: PlusCircle, color: "#0f766e", bg: "#f0fdfa" },
        ]}
      />

      {/* ── Main grid: Events (left) + Registrars + Users (right) ── */}
      <div className="grid grid-cols-5 gap-5">

        {/* Events — live first */}
        <div className="col-span-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border)/0.6)]">
            <div>
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Platform Events</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                {totalEvents} total · live events shown first
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
              : sortedEvents.length === 0
                ? <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-10">No events yet.</p>
                : sortedEvents.map((event) => <EventRow key={event.id} event={event} />)
            }
          </div>
        </div>

        {/* Right column: Registrars stacked above Platform Users */}
        <div className="col-span-2 flex flex-col gap-4">

          {/* Registrars */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
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
              [...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border)/0.4)] last:border-0">
                  <div className="h-7 w-7 rounded-lg bg-[hsl(var(--muted))] animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-28 rounded bg-[hsl(var(--muted))] animate-pulse" />
                    <div className="h-2.5 w-16 rounded bg-[hsl(var(--muted))] animate-pulse" />
                  </div>
                </div>
              ))
            ) : registrars.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-6">No registrars enrolled.</p>
            ) : (
              <div className="divide-y divide-[hsl(var(--border)/0.5)]">
                {registrars.slice(0, 5).map((reg) => {
                  const name    = reg.companyName || reg.name || "—";
                  const statusK = (reg.status ?? "").toUpperCase();
                  const dot     = statusK === "ACTIVE" ? "#16a34a" : statusK === "SUSPENDED" ? "#dc2626" : "#f59e0b";
                  const ini     = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <Link key={reg.id} href={`/registrars/${reg.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-[hsl(var(--muted)/0.3)] transition-colors">
                      <div className="h-8 w-8 rounded-lg overflow-hidden bg-[hsl(var(--primary)/0.08)] flex items-center justify-center text-xs font-bold text-[hsl(var(--primary))] shrink-0">
                        {reg.logoUrl
                          ? <img src={reg.logoUrl} alt={name} className="h-full w-full object-contain" />
                          : ini
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[hsl(var(--foreground))] truncate">{name}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{reg.industry ?? "—"}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dot }} />
                        <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums">{reg.eventCount ?? 0} events</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Platform Users — compact: name + status only */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[hsl(var(--border)/0.6)]">
              <div>
                <h2 className="font-semibold text-[hsl(var(--foreground))] text-sm">Platform Users</h2>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Recent accounts</p>
              </div>
              <Link href="/participants">
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-[hsl(var(--muted-foreground))] px-2">
                  All <ArrowRight className="h-2.5 w-2.5" />
                </Button>
              </Link>
            </div>

            {usersLoading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-[hsl(var(--border)/0.4)] last:border-0">
                  <div className="h-7 w-7 rounded-full bg-[hsl(var(--muted))] animate-pulse shrink-0" />
                  <div className="flex-1 h-3 w-24 rounded bg-[hsl(var(--muted))] animate-pulse" />
                  <div className="h-4 w-14 rounded-full bg-[hsl(var(--muted))] animate-pulse" />
                </div>
              ))
            ) : users.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-6">No users found.</p>
            ) : (
              <div className="divide-y divide-[hsl(var(--border)/0.5)]">
                {users.slice(0, 6).map((u) => {
                  const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
                  const ini      = fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <div key={u.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="h-7 w-7 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-[10px] font-bold text-[hsl(var(--primary))] shrink-0">
                        {ini}
                      </div>
                      <p className="text-xs font-medium text-[hsl(var(--foreground))] flex-1 truncate">{fullName}</p>
                      <StatusBadge status={(u.status ?? "").toLowerCase()} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Recent activity ── */}
      {recentActivity.length > 0 && (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(var(--border)/0.6)]">
            <h2 className="font-semibold text-[hsl(var(--foreground))]">Recent Activity</h2>
          </div>
          <div className="divide-y divide-[hsl(var(--border)/0.4)]">
            {(recentActivity as any[]).slice(0, 8).map((a: any, i: number) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3">
                <div className="h-7 w-7 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[hsl(var(--foreground))] leading-snug">
                    {a.description ?? a.message ?? a.action ?? JSON.stringify(a)}
                  </p>
                  {(a.timestamp ?? a.createdAt) && (
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                      {formatDate(a.timestamp ?? a.createdAt)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
