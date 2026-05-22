"use client";
import { CalendarDays, Users, FileText, Vote, TrendingUp, Calendar } from "lucide-react";
import { useStore } from "@/lib/store";
import { StatCard } from "@/components/custom/stat-card";
import { Card } from "@/components/ui/card";
import { ModuleBadge } from "@/components/custom/module-badge";
import type { EventModule } from "@/lib/mock-data";

const MODULE_CONFIG = {
  AGM:       { color: "#1a6b3c", bg: "#edf7f2" },
  LAUNCH:    { color: "#ea6c00", bg: "#fff4eb" },
  HACKATHON: { color: "#7c22c9", bg: "#f8f0ff" },
  GENERAL:   { color: "#1d4ed8", bg: "#eff5ff" },
};

const ACTIVITY_LOG = [
  { action: "Event published", user: "Stanley Jacob", event: "Zenith Bank 2026 AGM", time: "2026-05-01T09:00:00Z" },
  { action: "KYC approved", user: "Stanley Jacob", event: "Ngozi Okafor verification", time: "2026-04-30T14:30:00Z" },
  { action: "Document uploaded", user: "Stanley Jacob", event: "GTCo EGM Rights Issue Circular", time: "2026-05-15T09:00:00Z" },
  { action: "Application shortlisted", user: "Stanley Jacob", event: "FinFlow — MeriHack 2026", time: "2026-07-01T11:00:00Z" },
  { action: "Voting opened", user: "Stanley Jacob", event: "Re-election of Directors", time: "2026-05-21T10:45:00Z" },
  { action: "Participant registered", user: "System", event: "Kola Adesanya joined platform", time: "2026-05-10T10:00:00Z" },
];

const KYC_ITEMS = [
  { label: "Full KYC", key: "full", color: "#16a34a" },
  { label: "Basic KYC", key: "basic", color: "#3b82f6" },
  { label: "Pending", key: "pending", color: "#f59e0b" },
  { label: "No KYC", key: "none", color: "#9ca3af" },
];

const FORMAT_COLORS: Record<string, string> = { virtual: "#2563eb", hybrid: "#9333ea", "in-person": "#1a6b3c" };

export default function AnalyticsPage() {
  const { events, participants, documents, liveVotes } = useStore();

  const totalRSVP = events.reduce((s, e) => s + e.rsvpCount, 0);
  const totalDownloads = documents.reduce((s, d) => s + d.downloadCount, 0);
  const totalVotes = liveVotes.reduce((s, v) => s + v.for + v.against + v.abstain, 0);

  const modules: EventModule[] = ["AGM", "LAUNCH", "HACKATHON", "GENERAL"];

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
          accent="#1a6b3c"
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

      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Recent Activity Log</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Action</th>
              <th className="px-5 py-3 text-left">Performed by</th>
              <th className="px-5 py-3 text-left">Event / Context</th>
              <th className="px-5 py-3 text-left">Timestamp</th>
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
                <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{log.user}</td>
                <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{log.event}</td>
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
