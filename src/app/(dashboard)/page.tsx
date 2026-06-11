"use client";
import Link from "next/link";
import {
  CalendarDays, Radio, ShieldAlert, ArrowRight,
  Building2, Clock, CheckCircle2, UserCog, ClipboardList,
  QrCode, PlusCircle, TrendingUp,
} from "lucide-react";
import { useGetMe } from "@/api/auth/hooks";
import { useDashboardStats, useEvents, useRecentRegistrations } from "@/api/super-admin";
import { useClientEvents } from "@/api/client-events";
import { useClientDashboardStats } from "@/api/client-dashboard";
import { useRegisters } from "@/api/registers";
import { useRegistrars } from "@/api/registrars";
import { ModuleBadge } from "@/components/custom/module-badge";
import { StatusBadge } from "@/components/custom/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate, timeAgo } from "@/lib/utils";
import { getEventModule, getEventRegisterName, MODULE_COLORS } from "@/lib/event-module";
import { Loader } from "@/components/ui/Loader";
import type { EventSummaryResponse, RegistrationSummaryResponse } from "@/types/super-admin";

// ─── Roles ────────────────────────────────────────────────────────────────────
const ADMIN_ROLES = new Set(["super_admin", "event_manager", "kyc_officer", "judge"]);

function isSuperAdminRole(role?: string | null) {
  return (role ?? "").toLowerCase().replace(/[-\s]/g, "_") === "super_admin";
}

// ─── Shared event row ─────────────────────────────────────────────────────────
function EventRow({ event }: { event: EventSummaryResponse }) {
  const isLive    = event.status === "live" || event.status === "LIVE";
  const mod       = getEventModule(event);
  const dotColor  = MODULE_COLORS[mod];
  const rsvpCount = event.registrationCount ?? 0;
  const fillPct   = event.registrationPercentage ?? null;
  const fill      = fillPct !== null ? Math.min(Math.round(fillPct), 100) : null;
  const regName   = getEventRegisterName(event);

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b last:border-0 border-[hsl(var(--border)/0.6)] hover:bg-[hsl(var(--muted)/0.4)] transition-colors group">
      <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <ModuleBadge module={mod} />
          {isLive && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 rounded-full px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{event.title}</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{regName || "—"}</p>
      </div>
      <div className="hidden lg:flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] shrink-0">
        <Clock className="h-3 w-3" />
        {formatDate(event.date)}
      </div>
      <div className="w-24 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium tabular-nums">{rsvpCount.toLocaleString()}</span>
          {fill !== null && <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums">{fill}%</span>}
        </div>
        <div className="h-1 rounded-full bg-[hsl(var(--border))]">
          {fill !== null && <div className="h-1 rounded-full" style={{ width: `${fill}%`, backgroundColor: dotColor }} />}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge status={event.status} />
        <Link href={isLive ? "/events/live" : `/events/${event.id}`}>
          <Button size="sm" variant={isLive ? "default" : "outline"}
            className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
            {isLive ? "Control Room" : "View"}
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ─── Super Admin Dashboard ────────────────────────────────────────────────────
function SuperAdminDashboard({
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
}: any) {
  const enrolledCount  = stats?.enrolledStakeholders?.count ?? 0;
  const publishedCount = publishedData?.totalElements ?? 0;
  const liveCount      = stats?.liveNow?.count        ?? 0;
  const onlineCount    = stats?.liveNow?.onlineCount   ?? 0;
  const pendingKYC     = stats?.pendingKYC?.count      ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
            Welcome back, {currentUser?.fullName ?? "Admin"}.
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            {new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {" · "}
            {new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
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

      {/* Stats strip — from /api/v1/admin/dashboard/stats */}
      <div className="grid grid-cols-4 divide-x divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
        {[
          { label: "Enrolled Organisers", value: enrolledCount,  sub: "Active organisations",    icon: Building2,    color: "#374151" },
          { label: "Published",           value: publishedCount, sub: "Open for registration",   icon: CheckCircle2, color: "#0f766e" },
          { label: "Live Now",            value: liveCount,      sub: onlineCount > 0 ? `${onlineCount.toLocaleString()} online` : "No active sessions", icon: Radio, color: "#dc2626" },
          { label: "Pending KYC",         value: pendingKYC,     sub: "Awaiting verification",   icon: ShieldAlert,  color: "#f97316" },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-4 px-6 py-5">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "18" }}>
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div>
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-0.5">{label}</p>
              {statsLoading
                ? <div className="h-7 w-12 rounded-lg bg-[hsl(var(--muted))] animate-pulse mt-0.5" />
                : <p className="text-2xl font-bold tabular-nums text-[hsl(var(--foreground))] leading-none">{value}</p>
              }
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "KYC Review",      href: "/participants/kyc",  icon: ShieldAlert,   color: "#f97316", bg: "#fff7ed" },
          { label: "All Registrars",  href: "/registrars",        icon: Building2,     color: "#374151", bg: "#f3f4f6" },
          { label: "Enrol Registrar", href: "/registrars/enrol",  icon: PlusCircle,    color: "#0f766e", bg: "#f0fdfa" },
          { label: "Live Control",    href: "/events/live",       icon: Radio,         color: "#dc2626", bg: "#fef2f2" },
        ].map(({ label, href, icon: Icon, color, bg }) => (
          <Link key={href} href={href}
            className="flex items-center gap-3 p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:shadow-sm hover:-translate-y-0.5 transition-all">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: bg }}>
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <span className="text-sm font-medium text-[hsl(var(--foreground))]">{label}</span>
          </Link>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-5 gap-5">
        {/* Left: Events */}
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
              ? [...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-[hsl(var(--border)/0.5)] last:border-0">
                    <div className="w-1 h-10 rounded-full bg-[hsl(var(--muted))] animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-24 rounded bg-[hsl(var(--muted))] animate-pulse" />
                      <div className="h-3.5 w-48 rounded bg-[hsl(var(--muted))] animate-pulse" />
                    </div>
                    <div className="h-5 w-16 rounded-full bg-[hsl(var(--muted))] animate-pulse" />
                  </div>
                ))
              : allEvents.length === 0
                ? <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-10">No events yet.</p>
                : allEvents.map((event: EventSummaryResponse) => <EventRow key={event.id} event={event} />)
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
          {regLoading
            ? [...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border)/0.4)] last:border-0">
                  <div className="h-7 w-7 rounded-lg bg-[hsl(var(--muted))] animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 rounded bg-[hsl(var(--muted))] animate-pulse" />
                    <div className="h-2.5 w-20 rounded bg-[hsl(var(--muted))] animate-pulse" />
                  </div>
                </div>
              ))
            : registrars.length === 0
              ? <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-8">No registrars enrolled.</p>
              : (
                <div className="divide-y divide-[hsl(var(--border)/0.5)]">
                  {registrars.map((reg: any) => {
                    const name     = reg.companyName || reg.name || "—";
                    const statusK  = (reg.status ?? "").toUpperCase();
                    const dot      = statusK === "ACTIVE" ? "#16a34a" : statusK === "SUSPENDED" ? "#dc2626" : "#f59e0b";
                    const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
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
              )
          }
        </div>
      </div>
    </div>
  );
}

// ─── Non-super-admin (Client / Event Manager / KYC Officer) Dashboard ─────────
function ClientDashboard({
  currentUser,
  isAdmin,
  stats,
  statsLoading,
  allEvents,
  eventsLoading,
  topRegisters,
  recentRegistrations,
  liveEvents,
}: any) {
  const pendingKYC = stats?.pendingKYC?.count ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
            Welcome back, {currentUser?.fullName ?? "Admin"}.
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            {new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {" · "}
            {new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
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

      {/* Stats strip */}
      <div className="grid grid-cols-4 divide-x divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
        {[
          { label: "Enrolled Registers", value: topRegisters.length,     sub: "Active organisations", icon: Building2,     color: "#374151" },
          { label: "Total Events",       value: allEvents.length,         sub: "Across all organisers", icon: CalendarDays,  color: "#111827" },
          { label: "Live Now",           value: liveEvents.length,        sub: liveEvents.length > 0 ? "Active sessions" : "No active sessions", icon: Radio, color: "#dc2626" },
          { label: "Pending KYC",        value: pendingKYC,               sub: "Awaiting verification", icon: ShieldAlert,  color: "#f97316" },
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

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Create Event",  href: "/events/create",     icon: PlusCircle,  color: "#374151", bg: "#f3f4f6" },
          { label: "All Events",    href: "/events",            icon: CalendarDays, color: "#0f766e", bg: "#f0fdfa" },
          { label: "QR Check-In",   href: "/events/qr-checkin", icon: QrCode,      color: "#7c3aed", bg: "#faf5ff" },
        ].map(({ label, href, icon: Icon, color, bg }) => (
          <Link key={href} href={href}
            className="flex items-center gap-3 p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:shadow-sm hover:-translate-y-0.5 transition-all">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: bg }}>
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <span className="text-sm font-medium text-[hsl(var(--foreground))]">{label}</span>
          </Link>
        ))}
      </div>

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
              ? [...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-[hsl(var(--border)/0.5)] last:border-0">
                    <div className="w-1 h-10 rounded-full bg-[hsl(var(--muted))] animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-24 rounded bg-[hsl(var(--muted))] animate-pulse" />
                      <div className="h-3.5 w-48 rounded bg-[hsl(var(--muted))] animate-pulse" />
                    </div>
                    <div className="h-5 w-16 rounded-full bg-[hsl(var(--muted))] animate-pulse" />
                  </div>
                ))
              : allEvents.length === 0
                ? <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-10">No upcoming events.</p>
                : allEvents.map((event: EventSummaryResponse) => <EventRow key={event.id} event={event} />)
            }
          </div>
        </div>

        {/* Right column */}
        <div className="col-span-2">
          {/* Registers */}
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
              {topRegisters.map((reg: any) => {
                const name      = reg.name || (reg as any).companyName || "—";
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
    </div>
  );
}

// ─── Root page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: userResponse, isLoading: userLoading } = useGetMe();
  const currentUser  = userResponse?.data;
  const isAdmin      = userLoading || !currentUser || ADMIN_ROLES.has(currentUser.role?.toLowerCase() ?? "");
  const isSuperAdmin = isSuperAdminRole(currentUser?.role);

  // All hooks called unconditionally (Rules of Hooks)
  const { data: dashStats,       isLoading: statsLoading    } = useDashboardStats();
  const { data: eventsData,      isLoading: eventsLoading   } = useEvents("", 0, 20);
  const { data: publishedData                               } = useEvents("PUBLISHED", 0, 1);
  const { data: registrarsData,  isLoading: regLoading      } = useRegistrars("", 0, 20);
  const { data: registersData                               } = useRegisters("ACTIVE", 0, 6);
  const { data: recentRegsData                              } = useRecentRegistrations(0, 6);
  const { data: clientEventsData, isLoading: clientLoading  } = useClientEvents("ALL", 0, 20);

  // Gate only on userLoading + the primary data fetch for the current role.
  // Stats loading is intentionally excluded so events show immediately even
  // if the stats endpoint is slow or errors; stats cards use individual
  // loading skeletons instead.
  const isLoading = userLoading || (isAdmin ? eventsLoading : clientLoading);

  if (isLoading) return <Loader variant="page" text="Loading Dashboard..." />;

  const stats = dashStats?.data ?? (dashStats as any);

  // Build events list
  const allEvents: EventSummaryResponse[] = isAdmin
    ? (eventsData?.content ?? [])
    : (clientEventsData?.events ?? []).map((e) => ({
        id: e.id, title: e.title, status: e.status, date: e.date, startTime: "",
        format: e.format as "VIRTUAL" | "IN_PERSON" | "HYBRID",
        live: e.status === "LIVE",
        registerName: e.registerName ?? "", organizerName: e.registerName ?? "",
        registrationCount: e.rsvpCount, registrationPercentage: e.fillRate,
        tags: [], eventType: e.eventType,
      }));

  const liveEvents = allEvents.filter((e) => e.status === "live" || e.status === "LIVE");
  const topRegisters = (registersData?.registers ?? []).slice(0, 5);
  const recentRegistrations: RegistrationSummaryResponse[] = (recentRegsData as any)?.data?.content ?? [];
  const registrars = registrarsData?.registrars ?? [];

  if (isSuperAdmin) {
    return (
      <SuperAdminDashboard
        currentUser={currentUser}
        stats={stats}
        statsLoading={statsLoading}
        allEvents={allEvents}
        eventsData={eventsData}
        eventsLoading={eventsLoading}
        registrars={registrars}
        registrarsData={registrarsData}
        regLoading={regLoading}
        liveEvents={liveEvents}
        publishedData={publishedData}
      />
    );
  }

  return (
    <ClientDashboard
      currentUser={currentUser}
      isAdmin={isAdmin}
      stats={stats}
      statsLoading={statsLoading}
      allEvents={allEvents}
      eventsLoading={eventsLoading}
      topRegisters={topRegisters}
      recentRegistrations={recentRegistrations}
      liveEvents={liveEvents}
    />
  );
}
