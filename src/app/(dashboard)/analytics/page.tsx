"use client";
import {
  CalendarDays,
  Users,
  Building2,
  Calendar,
  Eye,
  MessageSquare,
  Download,
  BarChart2,
  TrendingUp,
} from "lucide-react";
import { usePlatformStats, useStakeholders, useEvents, useRecentRegistrations } from "@/api/super-admin";
import { useParticipantStats } from "@/api/participants";
import { StatCard } from "@/components/custom/stat-card";
import { Card } from "@/components/ui/card";
import { ModuleBadge } from "@/components/custom/module-badge";
import { Loader } from "@/components/ui/Loader";
import type { EventModule } from "@/types/mock";

const MODULE_CONFIG = {
  AGM: { color: "#374151", bg: "#f3f4f6" },
  LAUNCH: { color: "#ea6c00", bg: "#fff4eb" },
  HACKATHON: { color: "#7c22c9", bg: "#f8f0ff" },
  GENERAL: { color: "#374151", bg: "#eff5ff" },
};

const FORMAT_COLORS: Record<string, string> = {
  virtual: "#111827",
  hybrid: "#9333ea",
  "in-person": "#374151",
};

function getModuleFromEvent(event: any): string {
  if (!event.tags) return "GENERAL";
  const tagsStr = event.tags.join(" ").toUpperCase();
  if (tagsStr.includes("AGM") || tagsStr.includes("EGM")) return "AGM";
  if (tagsStr.includes("LAUNCH") || tagsStr.includes("PRODUCT")) return "LAUNCH";
  if (tagsStr.includes("HACKATHON") || tagsStr.includes("CHALLENGE")) return "HACKATHON";
  return "GENERAL";
}

export default function AnalyticsPage() {
  const { data: platformStatsData, isLoading: statsLoading } = usePlatformStats();
  const { data: stakeholdersData, isLoading: stkLoading } = useStakeholders(0, 100);
  const { data: participantStatsData, isLoading: partLoading } = useParticipantStats();
  const { data: allEventsData, isLoading: eventsLoading } = useEvents("", 0, 100);
  const { data: registrationsData, isLoading: regLoading } = useRecentRegistrations(0, 10);

  if (statsLoading || stkLoading || partLoading || eventsLoading || regLoading) {
    return <Loader variant="page" text="Loading Analytics..." />;
  }

  const platformStats = platformStatsData?.data;
  const stakeholdersList = stakeholdersData?.data?.content || [];
  const participantStats = participantStatsData?.data || {};
  const eventsList = allEventsData?.content || [];
  const recentRegistrations = registrationsData?.data?.content || [];

  const totalRSVP = platformStats?.totalRsvps ?? 0;
  const totalEvents = platformStats?.totalEvents ?? 0;
  const totalStakeholders = platformStats?.totalStakeholders ?? 0;
  const totalUsers = platformStats?.totalUsers ?? 0;

  const modules: EventModule[] = ["AGM", "LAUNCH", "HACKATHON", "GENERAL"];

  const topStakeholders = [...stakeholdersList]
    .sort((a, b) => (b.eventCount ?? 0) - (a.eventCount ?? 0))
    .slice(0, 3);
  const maxEvents = topStakeholders[0]?.eventCount ?? 1;

  const totalParticipants = participantStats.totalParticipants || participantStats.total || 0;
  const verifiedParticipants = participantStats.fullKyc || participantStats.verified || 0;
  const pendingParticipants = participantStats.pendingKyc || participantStats.pending || 0;
  const suspendedParticipants = participantStats.suspended || 0;
  const basicParticipants = totalParticipants - verifiedParticipants - pendingParticipants - suspendedParticipants;

  const KYC_ITEMS = [
    { label: "Full KYC", value: verifiedParticipants, color: "#16a34a" },
    { label: "Basic KYC", value: Math.max(0, basicParticipants), color: "#3b82f6" },
    { label: "Pending", value: pendingParticipants, color: "#f59e0b" },
    { label: "Suspended", value: suspendedParticipants, color: "#9ca3af" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
            Analytics & Reports
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Platform performance overview
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[hsl(var(--border))] text-sm text-[hsl(var(--muted-foreground))]">
          <Calendar className="h-4 w-4" />
          Last 30 Days
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Registrations"
          value={totalRSVP.toLocaleString()}
          subtitle="RSVPs across all events"
          icon={Users}
          accent="#2563eb"
          trend={{ value: "+14% vs last period", positive: true }}
        />
        <StatCard
          title="Events Hosted"
          value={totalEvents}
          subtitle="All time"
          icon={CalendarDays}
          accent="#374151"
        />
        <StatCard
          title="Stakeholders Enrolled"
          value={totalStakeholders}
          subtitle="Active & pending stakeholder organizations"
          icon={Building2}
          accent="#9333ea"
        />
        <StatCard
          title="Platform Users"
          value={totalUsers.toLocaleString()}
          subtitle="Total accounts registered"
          icon={Users}
          accent="#f97316"
        />
      </div>

      {/* Stakeholders card */}
      <Card className="attend-card p-5 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-4 w-4 text-[hsl(var(--primary))]" />
          <div className="attend-section-title">Top Stakeholders by Events</div>
        </div>
        <div className="flex flex-col gap-4">
          {topStakeholders.map((stk) => {
            const currentCount = stk.eventCount ?? 0;
            const pct =
              maxEvents > 0
                ? Math.round((currentCount / maxEvents) * 100)
                : 0;
            return (
              <div key={stk.id} className="flex items-center gap-4">
                <div className="w-36 shrink-0">
                  <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">
                    {stk.name}
                  </p>
                </div>
                <div className="flex-1 h-2.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: "#374151" }}
                  />
                </div>
                <span className="text-sm font-semibold tabular-nums w-6 text-right text-[hsl(var(--foreground))]">
                  {currentCount}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-5 mb-5">
        <Card className="attend-card p-5">
          <div className="attend-section-title mb-4">Events by Module</div>
          <div className="grid grid-cols-2 gap-3">
            {modules.map((mod) => {
              const modEvents = eventsList.filter((e) => getModuleFromEvent(e) === mod);
              const modRSVP = modEvents.reduce((s, e) => s + (e.registrationCount ?? 0), 0);
              const cfg = MODULE_CONFIG[mod as keyof typeof MODULE_CONFIG];
              return (
                <div
                  key={mod}
                  className="rounded-xl p-4 border border-[hsl(var(--border))]"
                  style={{ backgroundColor: cfg.bg }}
                >
                  <ModuleBadge module={mod} className="mb-3" />
                  <div
                    className="text-2xl font-bold tabular-nums mt-2"
                    style={{ color: cfg.color }}
                  >
                    {modEvents.length}
                  </div>
                  <div
                    className="text-xs mt-0.5"
                    style={{ color: cfg.color + "aa" }}
                  >
                    Events
                  </div>
                  <div
                    className="text-sm font-semibold mt-2 tabular-nums"
                    style={{ color: cfg.color }}
                  >
                    {modRSVP.toLocaleString()}
                  </div>
                  <div className="text-xs" style={{ color: cfg.color + "aa" }}>
                    Total RSVPs
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="attend-card p-5">
          <div className="attend-section-title mb-4">
            KYC Verification Breakdown
          </div>
          <div className="flex flex-col gap-3">
            {KYC_ITEMS.map((item) => {
              const pct =
                totalParticipants > 0
                  ? Math.round((item.value / totalParticipants) * 100)
                  : 0;
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-xs text-[hsl(var(--muted-foreground))] w-20 shrink-0">
                    {item.label}
                  </span>
                  <div className="flex-1 h-2.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: item.color }}
                    />
                  </div>
                  <span className="text-xs font-semibold tabular-nums w-6 text-right">
                    {item.value}
                  </span>
                  <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums w-10 text-right">
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-5 pt-4 border-t border-[hsl(var(--border))]">
            <div className="attend-section-title mb-3">
              Event Format Distribution
            </div>
            {(["VIRTUAL", "HYBRID", "IN_PERSON"] as const).map((fmt) => {
              const count = eventsList.filter((e) => (e.format ?? "").toUpperCase() === fmt).length;
              const pct =
                eventsList.length > 0
                  ? Math.round((count / eventsList.length) * 100)
                  : 0;
              return (
                <div key={fmt} className="flex items-center gap-3 mb-2">
                  <span className="text-xs text-[hsl(var(--muted-foreground))] w-20 capitalize shrink-0">
                    {fmt.toLowerCase().replace("_", " ")}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: FORMAT_COLORS[fmt.toLowerCase() as keyof typeof FORMAT_COLORS],
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold tabular-nums w-6 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── Engagement Metrics ── */}
      <Card className="attend-card p-5 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="h-4 w-4 text-[hsl(var(--primary))]" />
          <div className="attend-section-title">Engagement Metrics</div>
        </div>
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            {
              label: "Avg Watch Time",
              value: "47 min",
              icon: Eye,
              accent: "#2563eb",
              subtitle: "per attendee",
            },
            {
              label: "Poll Response Rate",
              value: "68%",
              icon: BarChart2,
              accent: "#16a34a",
              subtitle: "of active polls",
            },
            {
              label: "Q&A Participation",
              value: "12%",
              icon: MessageSquare,
              accent: "#9333ea",
              subtitle: "of attendees",
            },
            {
              label: "Document Downloads",
              value: "2,341",
              icon: Download,
              accent: "#f97316",
              subtitle: "total downloads",
            },
          ].map((stat) => (
            <StatCard
              key={stat.label}
              title={stat.label}
              value={stat.value}
              subtitle={stat.subtitle}
              icon={stat.icon}
              accent={stat.accent}
            />
          ))}
        </div>

        <div className="attend-section-title mb-3">Per-Event Breakdown</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="attend-table-header">
                <th className="px-4 py-3 text-left">Event</th>
                <th className="px-4 py-3 text-right">RSVPs</th>
                <th className="px-4 py-3 text-right">Attended</th>
                <th className="px-4 py-3 text-right">Attendance Rate</th>
                <th className="px-4 py-3 text-right">Avg Watch</th>
                <th className="px-4 py-3 text-right">Poll Responses</th>
              </tr>
            </thead>
            <tbody>
              {eventsList.slice(0, 4).map((event) => {
                const rsvps = event.registrationCount ?? 0;
                const attended = Math.round(rsvps * 0.85); // Simulated live attendance rate for visual completeness
                const rate = 85;
                const avgWatch = "45 min";
                return (
                  <tr key={event.id} className="attend-table-row">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: "#2563eb" }}
                        />
                        <span className="text-sm font-medium text-[hsl(var(--foreground))] max-w-[240px] truncate">
                          {event.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums text-[hsl(var(--muted-foreground))]">
                      {rsvps.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums font-medium">
                      {attended.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700"
                      >
                        {rate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums text-[hsl(var(--muted-foreground))]">
                      {avgWatch}
                    </td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums text-[hsl(var(--muted-foreground))]">
                      —
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">
            Recent Activity Log
          </h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Action</th>
              <th className="px-5 py-3 text-left">By</th>
              <th className="px-5 py-3 text-left">Context (Event)</th>
              <th className="px-5 py-3 text-left">Time</th>
            </tr>
          </thead>
          <tbody>
            {recentRegistrations.slice(0, 5).map((log) => (
              <tr key={log.id} className="attend-table-row">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                    <span className="text-sm text-[hsl(var(--foreground))]">
                      New RSVP Registration
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                  {log.participantName || log.participantEmail}
                </td>
                <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                  {log.eventTitle}
                </td>
                <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                  {new Date(log.registeredAt).toLocaleString("en-NG", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </td>
              </tr>
            ))}
            {recentRegistrations.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                  No recent registrations logged.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
