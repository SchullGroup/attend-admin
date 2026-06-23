"use client";
import { useState } from "react";
import {
  CalendarDays,
  Users,
  FileText,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  BarChart2,
  UserCheck,
  Download,
} from "lucide-react";
import {
  useAnalyticsStats,
  useAnalyticsByType,
  useAnalyticsRsvpsByEvent,
  useAnalyticsFillRateOverview,
  useAnalyticsEventPerformance,
  useAnalyticsCheckInOverview,
  useAnalyticsMonthlyTrend,
  useExportRegistrations,
  extractStat,
} from "@/api/client-analytics";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/Loader";
import { formatDate } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_FALLBACK_COLORS: Record<string, string> = {
  AGM:       "#374151",
  LAUNCH:    "#ea6c00",
  HACKATHON: "#7c22c9",
  GENERAL:   "#2563eb",
};

function typeColor(item: { eventType?: string; type?: string; color?: string }): string {
  if (item.color) return item.color;
  const t = (item.eventType ?? item.type ?? "").toUpperCase();
  return TYPE_FALLBACK_COLORS[t] ?? "#374151";
}

function typeBg(color: string): string {
  return color + "1a"; // 10% opacity
}

function statusBadge(status: string, dotColor?: string) {
  const s = status?.toUpperCase();
  let bg = "#e5e7eb", color = "#374151";
  if (s === "LIVE" || s === "ACTIVE")   { bg = "#dcfce7"; color = "#16a34a"; }
  if (s === "UPCOMING")                  { bg = "#dbeafe"; color = "#2563eb"; }
  if (s === "PAST" || s === "ENDED")    { bg = "#f3f4f6"; color = "#6b7280"; }
  if (s === "DRAFT")                    { bg = "#fef3c7"; color = "#b45309"; }
  const dot = dotColor ?? color;
  return { bg, color, dot };
}

function fillRateColor(rate: number): string {
  if (rate >= 80) return "#16a34a";
  if (rate >= 50) return "#f59e0b";
  return "#ef4444";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  title, value, subtitle, icon: Icon, accent,
}: {
  title: string; value: string | number; subtitle: string; icon: any; accent: string;
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
      </div>
      <div className="text-2xl font-bold tabular-nums text-[hsl(var(--foreground))] mb-0.5">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className="text-sm font-medium text-[hsl(var(--foreground))]">{title}</div>
      <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{subtitle}</div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Export Registrations inline panel
// ---------------------------------------------------------------------------
function ExportRegistrationsPanel({ events }: { events: { id: string; eventId?: string; title: string; eventTitle?: string }[] }) {
  const [selectedId, setSelectedId] = useState("");
  const [from,       setFrom]       = useState("");
  const [to,         setTo]         = useState("");
  const [exporting,  setExporting]  = useState(false);

  const { refetch } = useExportRegistrations(selectedId, from || undefined, to || undefined);

  function downloadCsv(filename: string, rows: string[][]) {
    const csv  = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleExport() {
    if (!selectedId) return;
    setExporting(true);
    try {
      const result = await refetch();
      const exp    = result.data;
      if (!exp) return;
      const header = ["Full Name", "Email", "Phone", "Registered At", "Checked In", "Checked In At"];
      const rows   = exp.registrations.map((r) => [
        r.fullName, r.email, r.phone ?? "", r.registeredAt,
        r.checkedIn ? "Yes" : "No", r.checkedInAt ?? "",
      ]);
      downloadCsv(`${exp.eventTitle ?? selectedId}-registrations.csv`, [header, ...rows]);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card className="attend-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Download className="h-4 w-4 text-[hsl(var(--primary))]" />
        <span className="attend-section-title">Export Registrations</span>
      </div>
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">Event</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full h-9 rounded-md border border-[hsl(var(--border))] bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          >
            <option value="">Select an event…</option>
            {events.map((ev) => (
              <option key={ev.id ?? ev.eventId} value={ev.id ?? ev.eventId ?? ""}>
                {ev.title ?? ev.eventTitle}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-36 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-36 text-sm" />
        </div>
        <Button size="sm" disabled={!selectedId || exporting} onClick={handleExport}>
          <Download className="h-3.5 w-3.5 mr-1.5" />
          {exporting ? "Exporting…" : "Export CSV"}
        </Button>
      </div>
      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
        Includes name, email, phone, registration time, and check-in status. Leave date fields blank for all time.
      </p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const [perfPage, setPerfPage] = useState(0);
  const perfSize = 10;

  const { data: stats,        isLoading: statsLoading  } = useAnalyticsStats();
  const { data: byType,       isLoading: byTypeLoading  } = useAnalyticsByType();
  const { data: rsvps,        isLoading: rsvpsLoading   } = useAnalyticsRsvpsByEvent();
  const { data: fillRate,     isLoading: fillLoading     } = useAnalyticsFillRateOverview();
  const { data: performance,  isLoading: perfLoading     } = useAnalyticsEventPerformance(perfPage, perfSize);
  const { data: checkInData,  isLoading: checkInLoading  } = useAnalyticsCheckInOverview();
  const { data: trendData,    isLoading: trendLoading    } = useAnalyticsMonthlyTrend();

  const loading = statsLoading || byTypeLoading || rsvpsLoading || fillLoading || perfLoading || trendLoading;
  if (loading) return <Loader variant="page" text="Loading Analytics…" />;

  // --- By Type --- exclude HACKATHON (covered by Innovation Challenges)
  const byTypeItems = (byType?.byType ?? []).filter(
    (item) => (item.type ?? "").toUpperCase() !== "HACKATHON"
  );

  // --- RSVPs by event ---
  const rsvpEvents  = rsvps?.rsvpsByEvent ?? [];

  // --- Event Performance ---
  const perfEvents  = performance?.events ?? [];
  const totalPerf   = performance?.totalCount ?? 0;
  const totalPages  = Math.ceil(totalPerf / perfSize);

  // --- Fill rate — per-event array from API ---
  const fillEvents  = fillRate?.fillRateOverview ?? [];

  // --- Stats ---
  const evStat  = extractStat(stats?.totalEvents);
  const attStat = extractStat(stats?.totalAttendees);
  const frRaw   = extractStat(stats?.avgFillRate);
  const docStat = extractStat(stats?.documentsPublished);
  const avgFillRate = frRaw.value ?? 0;

  const statCards = [
    {
      title:    "Total Events",
      value:    evStat.value,
      subtitle: "All events on the platform",
      icon:     CalendarDays,
      accent:   evStat.color ?? "#374151",
    },
    {
      title:    "Total Attendees",
      value:    attStat.value,
      subtitle: "Across all events",
      icon:     Users,
      accent:   attStat.color ?? "#2563eb",
    },
    {
      title:    "Avg Fill Rate",
      value:    `${Math.round(avgFillRate)}%`,
      subtitle: "Average capacity utilisation",
      icon:     TrendingUp,
      accent:   frRaw.color ?? "#16a34a",
    },
    {
      title:    "Documents Published",
      value:    docStat.value,
      subtitle: "Files shared across events",
      icon:     FileText,
      accent:   docStat.color ?? "#9333ea",
    },
  ];

  // RSVPs bar chart — max for scaling
  const maxRsvp = Math.max(...rsvpEvents.map((e) => e.rsvpCount ?? 0), 1);

  // Check-In Overview
  const checkInEvents      = checkInData?.events ?? [];
  const totalRegistrations = checkInData?.totalRegistrations ?? 0;
  const totalCheckedIn     = checkInData?.totalCheckedIn     ?? 0;
  const overallCheckInRate = checkInData?.overallCheckInRate ?? 0;

  // Monthly Trend
  const trendMonths = trendData?.trend ?? [];
  const maxTrend    = Math.max(...trendMonths.map((m) => m.registrations), 1);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Analytics</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Platform performance overview
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      {/* Events by type + RSVPs by event */}
      <div className="grid grid-cols-2 gap-5">
        {/* Events by type */}
        <Card className="attend-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="h-4 w-4 text-[hsl(var(--primary))]" />
            <span className="attend-section-title">Events by Type</span>
          </div>
          {byTypeItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No data available.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {byTypeItems.map((item) => {
                const label = item.type ?? "Unknown";
                const count = item.eventCount ?? 0;
                const color = item.color ?? typeColor({ type: item.type });
                const bg    = typeBg(color);
                return (
                  <div
                    key={label}
                    className="rounded-xl p-4 border border-[hsl(var(--border))]"
                    style={{ backgroundColor: bg }}
                  >
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold mb-3"
                      style={{ backgroundColor: color + "22", color }}
                    >
                      {label}
                    </span>
                    <div className="text-2xl font-bold tabular-nums" style={{ color }}>
                      {count}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: color + "aa" }}>
                      Events
                    </div>
                    {item.totalRsvps != null && (
                      <>
                        <div className="text-sm font-semibold mt-2 tabular-nums" style={{ color }}>
                          {item.totalRsvps.toLocaleString()}
                        </div>
                        <div className="text-xs" style={{ color: color + "aa" }}>Total RSVPs</div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* RSVPs by event bar chart */}
        <Card className="attend-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-[hsl(var(--primary))]" />
            <span className="attend-section-title">RSVPs by Event</span>
          </div>
          {rsvpEvents.length === 0 ? (
            <div className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No RSVP data available.
            </div>
          ) : (
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[320px] pr-1">
              {rsvpEvents.map((ev) => {
                const count    = ev.rsvpCount ?? 0;
                const cap      = ev.capacity  ?? 0;
                // Fill %: prefer rsvpCount/capacity when capacity > 0,
                // fall back to fillRate (which may be 0–1 or 0–100), else scale to max.
                let barPct: number;
                if (cap > 0) {
                  barPct = Math.min(Math.round((count / cap) * 100), 100);
                } else if (ev.fillRate != null) {
                  barPct = Math.min(Math.round(ev.fillRate > 1 ? ev.fillRate : ev.fillRate * 100), 100);
                } else {
                  barPct = maxRsvp > 0 ? Math.min(Math.round((count / maxRsvp) * 100), 100) : 0;
                }
                const barColor = ev.barColor ?? "#2563eb";
                return (
                  <div key={ev.eventId}>
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="text-xs text-[hsl(var(--foreground))] font-medium truncate max-w-[60%]"
                        title={ev.eventTitle}
                      >
                        {ev.eventTitle}
                      </span>
                      <span className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
                        {count.toLocaleString()}{cap > 0 ? ` / ${cap.toLocaleString()}` : ""} · {barPct}%
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${barPct}%`, backgroundColor: barColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Fill Rate Overview */}
      <Card className="attend-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[hsl(var(--primary))]" />
            <span className="attend-section-title">Fill Rate Overview</span>
          </div>
          <span className="text-sm font-semibold text-[hsl(var(--muted-foreground))]">
            Avg: {Math.round(avgFillRate)}%
          </span>
        </div>

        {fillEvents.length > 0 ? (
          /* Per-event fill rate bars */
          <div className="flex flex-col gap-3 overflow-y-auto max-h-[280px]">
            {fillEvents.map((ev) => {
              const pct   = Math.min(Math.round(ev.fillRate ?? 0), 100);
              const color = ev.barColor ?? fillRateColor(pct);
              return (
                <div key={ev.eventId}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[hsl(var(--foreground))] truncate max-w-[65%]">
                      {ev.eventTitle}
                    </span>
                    <span className="text-xs tabular-nums font-semibold" style={{ color }}>
                      {pct}%
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No fill rate data available.
          </div>
        )}
      </Card>

      {/* Check-In Overview + Monthly Trend */}
      <div className="grid grid-cols-2 gap-5">

        {/* Check-In Overview */}
        <Card className="attend-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserCheck className="h-4 w-4 text-[hsl(var(--primary))]" />
            <span className="attend-section-title">Check-In Overview</span>
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Registrations", value: totalRegistrations, color: "#2563eb" },
              { label: "Checked In",    value: totalCheckedIn,     color: "#16a34a" },
              { label: "Check-In Rate", value: `${Math.round(overallCheckInRate)}%`, color: "#f59e0b" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl p-3 border border-[hsl(var(--border))] text-center">
                <div className="text-xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Per-event breakdown */}
          {checkInEvents.length > 0 ? (
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[240px]">
              {checkInEvents.map((ev) => {
                const pct = Math.min(Math.round(ev.checkInRate ?? 0), 100);
                const color = fillRateColor(pct);
                return (
                  <div key={ev.eventId}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-[hsl(var(--foreground))] truncate max-w-[60%]">{ev.eventTitle}</span>
                      <span className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
                        {ev.checkedIn}/{ev.totalRsvps} · {pct}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">No check-in data yet.</div>
          )}
        </Card>

        {/* Monthly RSVP Trend */}
        <Card className="attend-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-[hsl(var(--primary))]" />
            <span className="attend-section-title">Monthly RSVP Trend</span>
          </div>
          {trendMonths.length === 0 ? (
            <div className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">No trend data available.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {trendMonths.map((m) => {
                const pct = maxTrend > 0 ? Math.round((m.registrations / maxTrend) * 100) : 0;
                return (
                  <div key={m.month}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-[hsl(var(--foreground))]">{m.month}</span>
                      <span className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
                        {m.registrations.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: "#2563eb" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Event Performance Table */}
      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-[hsl(var(--primary))]" />
            <span className="font-semibold text-[hsl(var(--foreground))]">Event Performance</span>
          </div>
          {totalPerf > 0 && (
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {totalPerf} event{totalPerf !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Event</th>
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-right">RSVPs</th>
              <th className="px-5 py-3 text-right">Capacity</th>
              <th className="px-5 py-3 text-right">Fill Rate</th>
              <th className="px-5 py-3 text-right">Checked In</th>
              <th className="px-5 py-3 text-right">Check-In Rate</th>
              <th className="px-5 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {perfEvents.map((ev) => {
              const title  = ev.eventTitle ?? ev.title ?? "—";
              const evId   = ev.eventId   ?? ev.id;
              const rate   = Math.round((ev.fillRate ?? 0) * (ev.fillRate != null && ev.fillRate <= 1 ? 100 : 1));
              const bs     = statusBadge(ev.status, ev.dotColor);
              return (
                <tr key={evId} className="attend-table-row">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: bs.dot }} />
                      <span className="text-sm font-medium text-[hsl(var(--foreground))] max-w-[200px] truncate">
                        {title}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                    {ev.date ? formatDate(ev.date) : "—"}
                  </td>
                  <td className="px-5 py-3 text-sm text-right tabular-nums text-[hsl(var(--muted-foreground))]">
                    {(ev.rsvpCount ?? 0).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-sm text-right tabular-nums text-[hsl(var(--muted-foreground))]">
                    {(ev.capacity ?? 0).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(rate, 100)}%`, backgroundColor: fillRateColor(rate) }}
                        />
                      </div>
                      <span className="text-xs font-semibold tabular-nums w-9 text-right" style={{ color: fillRateColor(rate) }}>
                        {rate}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-right tabular-nums text-[hsl(var(--muted-foreground))]">
                    {(ev.checkedInCount ?? 0).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {(() => {
                      const ciRate = Math.round(ev.checkInRate ?? 0);
                      return (
                        <span className="text-xs font-semibold tabular-nums" style={{ color: fillRateColor(ciRate) }}>
                          {ciRate}%
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: bs.bg, color: bs.color }}
                    >
                      {ev.status}
                    </span>
                  </td>
                </tr>
              );
            })}
            {perfEvents.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
                  No event performance data available.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-[hsl(var(--border))] flex items-center justify-between">
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              Page {perfPage + 1} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPerfPage((p) => Math.max(0, p - 1))}
                disabled={perfPage === 0}
                className="h-7 w-7 rounded-md border border-[hsl(var(--border))] flex items-center justify-center disabled:opacity-40 hover:bg-[hsl(var(--muted))] transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setPerfPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={perfPage >= totalPages - 1}
                className="h-7 w-7 rounded-md border border-[hsl(var(--border))] flex items-center justify-center disabled:opacity-40 hover:bg-[hsl(var(--muted))] transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </Card>
      {/* Export Registrations */}
      <ExportRegistrationsPanel events={perfEvents} />
    </div>
  );
}
