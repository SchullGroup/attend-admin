"use client";
import { useState } from "react";
import {
  TrendingUp, TrendingDown, CalendarDays, FileText, Vote,
  Users, Building2,
} from "lucide-react";
import {
  useAdminSummaryStats,
  useAdminTopOrganisers,
  useAdminKycBreakdown,
  useAdminAnalyticsByType,
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

// Maps the dropdown's display label to the query param sent to the backend.
// Backend support for this param is unconfirmed — see BACKEND_BUGS item 13.
const PERIOD_RANGE: Record<string, string> = {
  "Last 30 Days":   "30d",
  "Last 90 Days":   "90d",
  "Last 12 Months": "12m",
  "All Time":       "all",
};

// ── Main component ────────────────────────────────────────────────────────────

export function SuperAdminAnalytics() {
  const [period,     setPeriod]     = useState("Last 30 Days");
  const range = PERIOD_RANGE[period];

  // Hooks — all scoped to the selected date range (see PERIOD_RANGE above).
  const { data: summary,     isLoading: summaryLoading   } = useAdminSummaryStats(range);
  const { data: topOrgs = [], isLoading: topOrgsLoading  } = useAdminTopOrganisers(5, range);
  const { data: byType = [],  isLoading: byTypeLoading   } = useAdminAnalyticsByType(range);
  const { data: kycData = [], isLoading: kycLoading      } = useAdminKycBreakdown(range);
  const { data: auditData,    isLoading: auditLoading    } = useAdminAuditLogs({ page: 0, size: 10 }, true);

  const auditLogs  = auditData?.logs   ?? [];

  if (summaryLoading) return <Loader variant="page" text="Loading analytics…" />;

  // ── Compute max for bar scaling ──────────────────────────────────────────
  const maxOrg    = Math.max(...topOrgs.map(o => o.eventCount), 1);
  const kycTotal  = kycData.reduce((s, i) => s + i.count, 0);

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
          change={summary?.eventsHostedChange}
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
          change={summary?.votesCastChange}
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
            byType.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-8">No data yet.</p>
            ) : (
              <div className="p-5 grid grid-cols-2 gap-3">
                {byType.map((item) => {
                  const color = item.color ?? MODULE_COLORS[item.type] ?? "#374151";
                  const label = MODULE_LABELS[item.type] ?? item.type;
                  return (
                    <div
                      key={item.type}
                      className="rounded-xl p-4 border border-[hsl(var(--border))]"
                      style={{ backgroundColor: color + "0d" }}
                    >
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold mb-3"
                        style={{ backgroundColor: color + "1a", color }}
                      >
                        {label}
                      </span>
                      <div className="text-2xl font-bold tabular-nums" style={{ color }}>
                        {item.eventCount}
                      </div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Events</div>
                      <div className="text-lg font-bold tabular-nums text-[hsl(var(--foreground))] mt-3">
                        {item.totalRsvps.toLocaleString()}
                      </div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Total RSVPs</div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </Card>
      </div>

      {/* ── Row 3: KYC Breakdown ─────────────────────────────────────────── */}
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
