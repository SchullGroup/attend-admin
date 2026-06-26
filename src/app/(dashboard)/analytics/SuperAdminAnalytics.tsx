"use client";
import { useState } from "react";
import {
  TrendingUp, TrendingDown, CalendarDays, FileText, Vote,
  Users, Building2, ChevronLeft, ChevronRight, Activity,
  Clock, Eye, MessageSquare, Download,
} from "lucide-react";
import {
  useAdminSummaryStats,
  useAdminTopOrganisers,
  useAdminKycBreakdown,
  useAdminEventFormat,
  useAdminEngagement,
  useAdminAnalyticsByType,
  useAdminAnalyticsEventPerformance,
  useAdminAuditLogs,
} from "@/api/super-admin";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-NG", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
  } catch { return iso; }
}

const MODULE_LABELS: Record<string, string> = {
  AGM:                  "AGM",
  AGM_EGM:              "AGM / EGM",
  PRODUCT_LAUNCH:       "Launch",
  LAUNCH:               "Launch",
  INNOVATION_CHALLENGE: "Innovation Challenge",
  HACKATHON:            "Innovation Challenge",
  GENERAL:              "General",
  GENERAL_EVENT:        "General",
};

const MODULE_COLORS: Record<string, string> = {
  AGM:                  "#7c22c9",
  AGM_EGM:              "#7c22c9",
  PRODUCT_LAUNCH:       "#ea6c00",
  LAUNCH:               "#ea6c00",
  INNOVATION_CHALLENGE: "#0891b2",
  HACKATHON:            "#0891b2",
  GENERAL:              "#16a34a",
  GENERAL_EVENT:        "#16a34a",
};

const FORMAT_COLORS: Record<string, string> = {
  virtual:    "#2563eb",
  hybrid:     "#7c22c9",
  "in-person":"#16a34a",
  VIRTUAL:    "#2563eb",
  HYBRID:     "#7c22c9",
  IN_PERSON:  "#16a34a",
};

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, subtitle, icon: Icon, accent, change,
}: {
  label:    string;
  value:    string | number;
  subtitle: string;
  icon:     any;
  accent:   string;
  change?:  number;
}) {
  return (
    <Card className="attend-card p-5">
      <div className="flex items-start justify-between mb-3">
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: accent + "18" }}
        >
          <Icon className="h-4 w-4" style={{ color: accent }} />
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-0.5 text-xs font-semibold ${change >= 0 ? "text-green-600" : "text-red-500"}`}>
            {change >= 0
              ? <TrendingUp className="h-3 w-3" />
              : <TrendingDown className="h-3 w-3" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <div className="text-2xl font-bold tabular-nums text-[hsl(var(--foreground))] mb-0.5">
        {typeof value === "number" ? fmtNum(value) : value}
      </div>
      <div className="text-sm font-medium text-[hsl(var(--foreground))]">{label}</div>
      <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{subtitle}</div>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SuperAdminAnalytics() {
  const [perfPage,   setPerfPage]   = useState(0);
  const [period,     setPeriod]     = useState("Last 30 Days");

  // Hooks
  const { data: summary,     isLoading: summaryLoading   } = useAdminSummaryStats();
  const { data: topOrgs = [], isLoading: topOrgsLoading  } = useAdminTopOrganisers(5);
  const { data: byType = [],  isLoading: byTypeLoading   } = useAdminAnalyticsByType();
  const { data: kycData = [], isLoading: kycLoading      } = useAdminKycBreakdown();
  const { data: formats = [], isLoading: formatLoading   } = useAdminEventFormat();
  const { data: engagement,   isLoading: engageLoading   } = useAdminEngagement();
  const { data: perfData,     isLoading: perfLoading     } = useAdminAnalyticsEventPerformance("", "", perfPage, 10);
  const { data: auditData,    isLoading: auditLoading    } = useAdminAuditLogs({ page: 0, size: 10 }, true);

  const perfEvents = perfData?.events  ?? [];
  const perfTotal  = perfData?.totalCount ?? 0;
  const perfPages  = Math.max(1, Math.ceil(perfTotal / 10));
  const auditLogs  = auditData?.logs   ?? [];

  if (summaryLoading) return <Loader variant="page" text="Loading analytics…" />;

  // ── Compute max for bar scaling ──────────────────────────────────────────
  const maxOrg    = Math.max(...topOrgs.map(o => o.eventCount), 1);
  const maxModule = Math.max(...byType.map(m => m.eventCount), 1);
  const kycTotal  = kycData.reduce((s, i) => s + i.count, 0);
  const maxFormat = Math.max(...formats.map(f => f.count), 1);

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Analytics &amp; Reports</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Platform performance overview</p>
        </div>
        <select
          value={period}
          onChange={e => setPeriod(e.target.value)}
          className="h-8 pl-3 pr-8 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
        >
          <option>Last 30 Days</option>
          <option>Last 90 Days</option>
          <option>Last 12 Months</option>
          <option>All Time</option>
        </select>
      </div>

      {/* ── Row 1: Stat cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Registrations"
          value={summary?.totalRegistrations ?? 0}
          subtitle={period}
          icon={Users}
          accent="#2563eb"
          change={summary?.registrationsChange}
        />
        <StatCard
          label="Events Hosted"
          value={summary?.eventsHosted ?? 0}
          subtitle="All time"
          icon={CalendarDays}
          accent="#7c22c9"
        />
        <StatCard
          label="Docs Distributed"
          value={summary?.docsDistributed ?? 0}
          subtitle={period}
          icon={FileText}
          accent="#d97706"
          change={summary?.docsChange}
        />
        <StatCard
          label="Votes Cast"
          value={summary?.votesCast ?? 0}
          subtitle="Across all resolutions"
          icon={Vote}
          accent="#16a34a"
        />
      </div>

      {/* ── Row 2: Top Organisers + Events by Module ─────────────────────── */}
      <div className="grid grid-cols-2 gap-5">

        {/* Top Organisers */}
        <Card className="attend-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
            <h2 className="font-semibold text-[hsl(var(--foreground))]">Top Organisers by Events</h2>
          </div>
          {topOrgsLoading ? <Loader variant="inline" /> : (
            <div className="px-5 py-4 flex flex-col gap-3">
              {topOrgs.length === 0 && (
                <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">No data yet.</p>
              )}
              {topOrgs.map((org, i) => {
                const pct = maxOrg > 0 ? Math.round((org.eventCount / maxOrg) * 100) : 0;
                const color = org.color ?? "#374151";
                return (
                  <div key={org.stakeholderName + i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: color + "18" }}>
                          <Building2 className="h-3.5 w-3.5" style={{ color }} />
                        </div>
                        <span className="text-sm font-medium text-[hsl(var(--foreground))] truncate">
                          {org.stakeholderName}
                        </span>
                      </div>
                      <span className="text-sm font-bold tabular-nums ml-3 shrink-0" style={{ color }}>
                        {org.eventCount}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden ml-9">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Events by Module */}
        <Card className="attend-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
            <h2 className="font-semibold text-[hsl(var(--foreground))]">Events by Module</h2>
          </div>
          {byTypeLoading ? <Loader variant="inline" /> : (
            <div className="px-5 py-4 flex flex-col gap-3">
              {byType.length === 0 && (
                <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">No data yet.</p>
              )}
              {byType.map((item) => {
                const color = item.color ?? MODULE_COLORS[item.type] ?? "#374151";
                const label = MODULE_LABELS[item.type] ?? item.type;
                const pct   = maxModule > 0 ? Math.round((item.eventCount / maxModule) * 100) : 0;
                return (
                  <div key={item.type}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: color + "1a", color }}
                        >
                          {label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                        <span><strong className="text-[hsl(var(--foreground))] font-bold" style={{ color }}>{item.eventCount}</strong> Events</span>
                        <span>{item.totalRsvps.toLocaleString()} Total RSVPs</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ── Row 3: KYC Breakdown + Event Format ──────────────────────────── */}
      <div className="grid grid-cols-2 gap-5">

        {/* KYC Verification Breakdown */}
        <Card className="attend-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
            <h2 className="font-semibold text-[hsl(var(--foreground))]">KYC Verification Breakdown</h2>
          </div>
          {kycLoading ? <Loader variant="inline" /> : (
            <div className="px-5 py-4 flex flex-col gap-3">
              {kycData.length === 0 && (
                <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">No KYC data yet.</p>
              )}
              {kycData.map((item) => {
                const pct = item.percentage > 0
                  ? item.percentage
                  : kycTotal > 0 ? Math.round((item.count / kycTotal) * 100) : 0;
                const color = item.color ?? "#374151";
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-[hsl(var(--foreground))]">{item.label}</span>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="tabular-nums font-semibold" style={{ color }}>{item.count}</span>
                        <span className="text-xs text-[hsl(var(--muted-foreground))] w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Event Format Distribution */}
        <Card className="attend-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
            <h2 className="font-semibold text-[hsl(var(--foreground))]">Event Format Distribution</h2>
          </div>
          {formatLoading ? <Loader variant="inline" /> : (
            <div className="px-5 py-4">
              {formats.length === 0 && (
                <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">No format data yet.</p>
              )}
              <div className="flex flex-col gap-4">
                {formats.map((item) => {
                  const color = item.color ?? FORMAT_COLORS[item.format] ?? FORMAT_COLORS[item.format.toUpperCase()] ?? "#374151";
                  const pct   = maxFormat > 0 ? Math.round((item.count / maxFormat) * 100) : 0;
                  return (
                    <div key={item.format}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-sm font-medium text-[hsl(var(--foreground))] capitalize">
                            {item.format.toLowerCase().replace("_", "-")}
                          </span>
                        </div>
                        <span className="text-sm font-bold tabular-nums" style={{ color }}>{item.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── Row 4: Engagement Metrics ────────────────────────────────────── */}
      <Card className="attend-card p-5">
        <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4">Engagement Metrics</h2>
        {engageLoading ? <Loader variant="inline" /> : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[
              {
                label:    "Avg Watch Time",
                value:    `${engagement?.avgWatchTimeMinutes ?? 0} min`,
                sub:      "per attendee",
                icon:     Eye,
                color:    "#2563eb",
              },
              {
                label:    "Poll Response Rate",
                value:    `${engagement?.pollResponseRate ?? 0}%`,
                sub:      "of active polls",
                icon:     Activity,
                color:    "#7c22c9",
              },
              {
                label:    "Q&A Participation",
                value:    `${engagement?.qaParticipationRate ?? 0}%`,
                sub:      "of attendees",
                icon:     MessageSquare,
                color:    "#0891b2",
              },
              {
                label:    "Document Downloads",
                value:    (engagement?.documentDownloads ?? 0).toLocaleString(),
                sub:      "total downloads",
                icon:     Download,
                color:    "#d97706",
              },
            ].map(({ label, value, sub, icon: Icon, color }) => (
              <div key={label} className="rounded-xl p-4 border border-[hsl(var(--border))]" style={{ backgroundColor: color + "08" }}>
                <div className="h-8 w-8 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: color + "18" }}>
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <div className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</div>
                <div className="text-xs font-medium text-[hsl(var(--foreground))] mt-0.5">{label}</div>
                <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">{sub}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Row 5: Per-Event Breakdown ───────────────────────────────────── */}
      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Per-Event Breakdown</h2>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{perfTotal.toLocaleString()} events</span>
        </div>
        {perfLoading ? <Loader variant="inline" /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="attend-table-header">
                    <th className="px-5 py-3 text-left">Event</th>
                    <th className="px-5 py-3 text-right">RSVPs</th>
                    <th className="px-5 py-3 text-right">Attended</th>
                    <th className="px-5 py-3 text-right">Attendance Rate</th>
                    <th className="px-5 py-3 text-right">Avg Watch</th>
                    <th className="px-5 py-3 text-right">Poll Responses</th>
                  </tr>
                </thead>
                <tbody>
                  {perfEvents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
                        No events yet.
                      </td>
                    </tr>
                  )}
                  {perfEvents.map((ev) => {
                    const attendRate = ev.checkInRate != null
                      ? Math.round(ev.checkInRate > 1 ? ev.checkInRate : ev.checkInRate * 100)
                      : ev.rsvpCount > 0 ? Math.round((ev.checkedInCount / ev.rsvpCount) * 100) : 0;
                    return (
                      <tr key={ev.id} className="attend-table-row">
                        <td className="px-5 py-3">
                          <p className="text-sm font-medium text-[hsl(var(--foreground))] max-w-[280px] truncate">
                            {ev.stakeholderName ? `${ev.stakeholderName} — ${ev.title}` : ev.title}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-sm tabular-nums text-right text-[hsl(var(--muted-foreground))]">
                          {ev.rsvpCount.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-sm tabular-nums text-right text-[hsl(var(--muted-foreground))]">
                          {ev.checkedInCount.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={`text-sm font-semibold tabular-nums ${
                            attendRate >= 70 ? "text-green-600" : attendRate >= 40 ? "text-amber-600" : "text-red-500"
                          }`}>{attendRate}%</span>
                        </td>
                        <td className="px-5 py-3 text-sm tabular-nums text-right text-[hsl(var(--muted-foreground))]">
                          {ev.avgWatchMinutes != null ? `${ev.avgWatchMinutes} min` : "—"}
                        </td>
                        <td className="px-5 py-3 text-sm tabular-nums text-right text-[hsl(var(--muted-foreground))]">
                          {ev.pollResponses != null ? ev.pollResponses.toLocaleString() : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {perfPages > 1 && (
              <div className="px-5 py-3 border-t border-[hsl(var(--border))] flex items-center justify-between">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  Page {perfPage + 1} of {perfPages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={perfPage === 0}
                    onClick={() => setPerfPage(p => p - 1)}
                    className="h-7 w-7 rounded-lg border border-[hsl(var(--border))] flex items-center justify-center disabled:opacity-40 hover:bg-[hsl(var(--muted))]"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    disabled={perfPage >= perfPages - 1}
                    onClick={() => setPerfPage(p => p + 1)}
                    className="h-7 w-7 rounded-lg border border-[hsl(var(--border))] flex items-center justify-center disabled:opacity-40 hover:bg-[hsl(var(--muted))]"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* ── Row 6: Recent Activity Log ───────────────────────────────────── */}
      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Recent Activity Log</h2>
        </div>
        {auditLoading ? <Loader variant="inline" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="attend-table-header">
                  <th className="px-5 py-3 text-left">Action</th>
                  <th className="px-5 py-3 text-left">By</th>
                  <th className="px-5 py-3 text-left">Context</th>
                  <th className="px-5 py-3 text-left">Time</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
                      No recent activity.
                    </td>
                  </tr>
                )}
                {auditLogs.map((entry) => (
                  <tr key={entry.id} className="attend-table-row">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 max-w-[200px]">
                        <TrendingUp className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--foreground))]" />
                        <span className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{entry.action}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] max-w-[160px] truncate">
                      {entry.stakeholderName || entry.actorEmail || "—"}
                    </td>
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] max-w-[220px] truncate">
                      {entry.resourceName || entry.details || "—"}
                    </td>
                    <td className="px-5 py-3 text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap font-mono">
                      {fmtDate(entry.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </div>
  );
}
