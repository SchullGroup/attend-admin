"use client";
import { CalendarDays, Users, FileText, Vote, TrendingUp, Calendar, Building2, Eye, MessageSquare, Download, BarChart2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { StatCard } from "@/components/custom/stat-card";
import { Card } from "@/components/ui/card";
import { ModuleBadge } from "@/components/custom/module-badge";
import { ACTIVITY_LOG } from "@/lib/mock-data";
import type { EventModule } from "@/lib/mock-data";

const MODULE_CONFIG = {
  AGM:       { color: "#374151", bg: "#f3f4f6" },
  LAUNCH:    { color: "#ea6c00", bg: "#fff4eb" },
  HACKATHON: { color: "#7c22c9", bg: "#f8f0ff" },
  GENERAL:   { color: "#1d4ed8", bg: "#eff5ff" },
};

const KYC_ITEMS = [
  { label: "Full KYC", key: "full", color: "#16a34a" },
  { label: "Basic KYC", key: "basic", color: "#3b82f6" },
  { label: "Pending", key: "pending", color: "#f59e0b" },
  { label: "No KYC", key: "none", color: "#9ca3af" },
];

const FORMAT_COLORS: Record<string, string> = { virtual: "#2563eb", hybrid: "#9333ea", "in-person": "#374151" };

export default function AnalyticsPage() {
  const { events, participants, documents, liveVotes, stakeholders } = useStore();

  const totalRSVP = events.reduce((s, e) => s + e.rsvpCount, 0);
  const totalDownloads = documents.reduce((s, d) => s + d.downloadCount, 0);
  const totalVotes = liveVotes.reduce((s, v) => s + v.for + v.against + v.abstain, 0);

  const modules: EventModule[] = ["AGM", "LAUNCH", "HACKATHON", "GENERAL"];

  const topStakeholders = [...stakeholders]
    .sort((a, b) => b.eventsCount - a.eventsCount)
    .slice(0, 3);
  const maxEvents = topStakeholders[0]?.eventsCount ?? 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Analytics & Reports</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Platform performance overview</p>
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
          value={events.length}
          subtitle="All time"
          icon={CalendarDays}
          accent="#374151"
        />
        <StatCard
          title="Docs Distributed"
          value={totalDownloads.toLocaleString()}
          subtitle="Total downloads"
          icon={FileText}
          accent="#9333ea"
          trend={{ value: "+8% vs last period", positive: true }}
        />
        <StatCard
          title="Votes Cast"
          value={totalVotes.toLocaleString()}
          subtitle="Across all resolutions"
          icon={Vote}
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
            const pct = maxEvents > 0 ? Math.round((stk.eventsCount / maxEvents) * 100) : 0;
            return (
              <div key={stk.id} className="flex items-center gap-4">
                <div className="w-36 shrink-0">
                  <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{stk.name}</p>
                </div>
                <div className="flex-1 h-2.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: "#374151" }}
                  />
                </div>
                <span className="text-sm font-semibold tabular-nums w-6 text-right text-[hsl(var(--foreground))]">
                  {stk.eventsCount}
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
              const modEvents = events.filter((e) => e.module === mod);
              const modRSVP = modEvents.reduce((s, e) => s + e.rsvpCount, 0);
              const cfg = MODULE_CONFIG[mod];
              return (
                <div
                  key={mod}
                  className="rounded-xl p-4 border border-[hsl(var(--border))]"
                  style={{ backgroundColor: cfg.bg }}
                >
                  <ModuleBadge module={mod} className="mb-3" />
                  <div className="text-2xl font-bold tabular-nums mt-2" style={{ color: cfg.color }}>
                    {modEvents.length}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: cfg.color + "aa" }}>Events</div>
                  <div className="text-sm font-semibold mt-2 tabular-nums" style={{ color: cfg.color }}>
                    {modRSVP.toLocaleString()}
                  </div>
                  <div className="text-xs" style={{ color: cfg.color + "aa" }}>Total RSVPs</div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="attend-card p-5">
          <div className="attend-section-title mb-4">KYC Verification Breakdown</div>
          <div className="flex flex-col gap-3">
            {KYC_ITEMS.map((item) => {
              const count = participants.filter((p) => p.kycStatus === item.key).length;
              const pct = participants.length > 0 ? Math.round((count / participants.length) * 100) : 0;
              return (
                <div key={item.key} className="flex items-center gap-3">
                  <span className="text-xs text-[hsl(var(--muted-foreground))] w-20 shrink-0">{item.label}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                  </div>
                  <span className="text-xs font-semibold tabular-nums w-6 text-right">{count}</span>
                  <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums w-10 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>

          <div className="mt-5 pt-4 border-t border-[hsl(var(--border))]">
            <div className="attend-section-title mb-3">Event Format Distribution</div>
            {(["virtual", "hybrid", "in-person"] as const).map((fmt) => {
              const count = events.filter((e) => e.format === fmt).length;
              const pct = events.length > 0 ? Math.round((count / events.length) * 100) : 0;
              return (
                <div key={fmt} className="flex items-center gap-3 mb-2">
                  <span className="text-xs text-[hsl(var(--muted-foreground))] w-20 capitalize shrink-0">{fmt}</span>
                  <div className="flex-1 h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: FORMAT_COLORS[fmt] }} />
                  </div>
                  <span className="text-xs font-semibold tabular-nums w-6 text-right">{count}</span>
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
            { label: "Avg Watch Time", value: "47 min", icon: Eye, accent: "#2563eb", subtitle: "per attendee" },
            { label: "Poll Response Rate", value: "68%", icon: BarChart2, accent: "#16a34a", subtitle: "of active polls" },
            { label: "Q&A Participation", value: "12%", icon: MessageSquare, accent: "#9333ea", subtitle: "of attendees" },
            { label: "Document Downloads", value: "2,341", icon: Download, accent: "#f97316", subtitle: "total downloads" },
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
              {[
                { event: events.find((e) => e.id === "evt_001"), attended: 1247, avgWatch: "83 min", pollResponses: 0 },
                { event: events.find((e) => e.id === "evt_006"), attended: 289, avgWatch: "135 min", pollResponses: 251 },
                { event: events.find((e) => e.id === "evt_018"), attended: 1042, avgWatch: "55 min", pollResponses: 0 },
                { event: events.find((e) => e.id === "evt_004"), attended: 1843, avgWatch: "18 min", pollResponses: 0 },
              ].map(({ event, attended, avgWatch, pollResponses }) => {
                if (!event) return null;
                const rate = event.rsvpCount > 0 ? Math.round((attended / event.rsvpCount) * 100) : 0;
                return (
                  <tr key={event.id} className="attend-table-row">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: event.color }} />
                        <span className="text-sm font-medium text-[hsl(var(--foreground))] max-w-[240px] truncate">{event.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums text-[hsl(var(--muted-foreground))]">{event.rsvpCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums font-medium">{attended.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: rate >= 80 ? "#16a34a18" : rate >= 50 ? "#2563eb18" : "#f9731618",
                          color: rate >= 80 ? "#16a34a" : rate >= 50 ? "#2563eb" : "#f97316",
                        }}
                      >
                        {rate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums text-[hsl(var(--muted-foreground))]">{avgWatch}</td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums text-[hsl(var(--muted-foreground))]">{pollResponses.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Recent Activity Log</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Action</th>
              <th className="px-5 py-3 text-left">By</th>
              <th className="px-5 py-3 text-left">Context</th>
              <th className="px-5 py-3 text-left">Time</th>
            </tr>
          </thead>
          <tbody>
            {ACTIVITY_LOG.map((log, i) => (
              <tr key={i} className="attend-table-row">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                    <span className="text-sm text-[hsl(var(--foreground))]">{log.action}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{log.actor}</td>
                <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{log.context}</td>
                <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                  {new Date(log.time).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
