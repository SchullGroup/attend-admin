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
  Eye,
  MessageSquare,
} from "lucide-react";
import {
  useAnalyticsStats,
  useAnalyticsByType,
  useAnalyticsRsvpsByEvent,
  useAnalyticsFillRateOverview,
  useAnalyticsEventPerformance,
  useAnalyticsCheckInOverview,
  useAnalyticsMonthlyTrend,
  useAnalyticsEventFormat,
  useAnalyticsEngagement,
  useExportRegistrations,
  extractStat,
} from "@/api/client-analytics";
import { useGetMe } from "@/api/auth/hooks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/Loader";
import { formatDate, resolveRole, isSuperAdminRole } from "@/lib/utils";
import { SuperAdminAnalytics } from "./SuperAdminAnalytics";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_FALLBACK_COLORS: Record<string, string> = {
  AGM:       "#374151",
  LAUNCH:    "#ea6c00",
  HACKATHON: "#7c22c9",
  GENERAL:   "#2563eb",
};

const FORMAT_COLORS: Record<string, string> = {
  virtual:    "#2563eb",
  hybrid:     "#7c22c9",
  "in-person":"#16a34a",
  VIRTUAL:    "#2563eb",
  HYBRID:     "#7c22c9",
  IN_PERSON:  "#16a34a",
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
// Client Admin Analytics (extracted so hooks are never called after early return)
// ---------------------------------------------------------------------------

function ClientAnalytics() {
  const [perfPage, setPerfPage] = useState(0);
  const perfSize = 10;

  const { data: stats,        isLoading: statsLoading  } = useAnalyticsStats();
  const { data: byType,       isLoading: byTypeLoading  } = useAnalyticsByType();
  const { data: rsvps,        isLoading: rsvpsLoading   } = useAnalyticsRsvpsByEvent();
  const { data: fillRate,     isLoading: fillLoading     } = useAnalyticsFillRateOverview();
  const { data: performance,  isLoading: perfLoading,  isError: perfError,  error: perfErrorObj  } = useAnalyticsEventPerformance(perfPage, perfSize);
  const { data: checkInData,  isLoading: checkInLoading  } = useAnalyticsCheckInOverview();
  const { data: trendData,    isLoading: trendLoading, isError: trendError, error: trendErrorObj } = useAnalyticsMonthlyTrend();
  const { data: formatData,   isLoading: formatLoading   } = useAnalyticsEventFormat();
  const { data: engagement,   isLoading: engageLoading   } = useAnalyticsEngagement();

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

  // --- Event Format Distribution ---
  const formats    = formatData?.formats ?? [];
  const maxFormat  = Math.max(...formats.map((f) => f.count), 1);

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
                // Backend's check-in-overview endpoint doesn't always send
                // totalRsvps/checkInRate under those exact names — fall back
                // to common aliases seen on other analytics endpoints, then
                // 0, so we never render a blank "0/ · 0%" row.
                const evAny       = ev as any;
                const checkedIn   = ev.checkedIn  ?? evAny.checkedInCount ?? 0;
                const totalRsvps  = ev.totalRsvps ?? evAny.rsvpCount ?? evAny.registrations ?? evAny.totalRegistrations ?? 0;
                const rate        = ev.checkInRate ?? (totalRsvps > 0 ? (checkedIn / totalRsvps) * 100 : 0);
                const pct = Math.min(Math.round(rate), 100);
                const color = fillRateColor(pct);
                return (
                  <div key={ev.eventId}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-[hsl(var(--foreground))] truncate max-w-[60%]">{ev.eventTitle}</span>
                      <span className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
                        {checkedIn}/{totalRsvps} · {pct}%
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
          {trendError ? (
            <div className="py-8 text-center text-sm text-red-600">
              Failed to load trend data
              <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                {(trendErrorObj as any)?.response?.status ?? ""} {(trendErrorObj as any)?.response?.data?.message ?? (trendErrorObj as any)?.message ?? "Unknown error"}
              </div>
            </div>
          ) : trendMonths.length === 0 ? (
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
            {perfError && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-sm text-red-600">
                  Failed to load event performance data
                  <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                    {(perfErrorObj as any)?.response?.status ?? ""} {(perfErrorObj as any)?.response?.data?.message ?? (perfErrorObj as any)?.message ?? "Unknown error"}
                  </div>
                </td>
              </tr>
            )}
            {!perfError && perfEvents.length === 0 && (
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

      {/* Engagement Metrics */}
      {/* Note: no "Poll Response Rate" card here — backend confirmed there is no
          polling feature anywhere in the product (no Poll entity, no response
          tracking of any kind). Q&A is the only live-session engagement feature. */}
      <Card className="attend-card p-5">
        <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4">Engagement Metrics</h2>
        {engageLoading ? <Loader variant="inline" /> : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              {
                label:    "Avg Watch Time",
                value:    `${engagement?.avgWatchTimeMinutes ?? 0} min`,
                sub:      "per attendee",
                icon:     Eye,
                color:    "#2563eb",
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

      {/* Per-Event Breakdown */}
      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Per-Event Breakdown</h2>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{totalPerf.toLocaleString()} events</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left">Event</th>
                <th className="px-5 py-3 text-right">RSVPs</th>
                <th className="px-5 py-3 text-right">Attended</th>
                <th className="px-5 py-3 text-right">Attendance Rate</th>
                <th className="px-5 py-3 text-right">Avg Watch</th>
                <th className="px-5 py-3 text-right">Q&amp;A Responses</th>
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
                const title = ev.eventTitle ?? ev.title ?? "—";
                const evId  = ev.eventId ?? ev.id;
                const rsvpCount = ev.rsvpCount ?? 0;
                const checkedIn = ev.checkedInCount ?? 0;
                const attendRate = ev.checkInRate != null
                  ? Math.round(ev.checkInRate > 1 ? ev.checkInRate : ev.checkInRate * 100)
                  : rsvpCount > 0 ? Math.round((checkedIn / rsvpCount) * 100) : 0;
                return (
                  <tr key={evId} className="attend-table-row">
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-[hsl(var(--foreground))] max-w-[280px] truncate">
                        {title}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-sm tabular-nums text-right text-[hsl(var(--muted-foreground))]">
                      {rsvpCount.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-sm tabular-nums text-right text-[hsl(var(--muted-foreground))]">
                      {checkedIn.toLocaleString()}
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
                      {(ev.qaResponses ?? ev.pollResponses) != null ? (ev.qaResponses ?? ev.pollResponses)!.toLocaleString() : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-[hsl(var(--border))] flex items-center justify-between">
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              Page {perfPage + 1} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={perfPage === 0}
                onClick={() => setPerfPage((p) => p - 1)}
                className="h-7 w-7 rounded-lg border border-[hsl(var(--border))] flex items-center justify-center disabled:opacity-40 hover:bg-[hsl(var(--muted))]"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                disabled={perfPage >= totalPages - 1}
                onClick={() => setPerfPage((p) => p + 1)}
                className="h-7 w-7 rounded-lg border border-[hsl(var(--border))] flex items-center justify-center disabled:opacity-40 hover:bg-[hsl(var(--muted))]"
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

// ---------------------------------------------------------------------------
// Page — role gate
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const { data: userResponse, isLoading: userLoading } = useGetMe();
  const isSuperAdmin = isSuperAdminRole(resolveRole(userResponse?.data));

  // Wait for role before mounting either analytics component to avoid
  // briefly rendering <ClientAnalytics /> (which fires client API calls
  // that 403 for super-admin users) while useGetMe is in-flight.
  if (userLoading) return <Loader variant="page" text="Loading Analytics…" />;

  // SuperAdminAnalytics renders its own header; ClientAnalytics needs the page header
  if (isSuperAdmin) return <SuperAdminAnalytics />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Analytics</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Platform performance overview</p>
      </div>
      <ClientAnalytics />
    </div>
  );
}
