"use client";
import { useState } from "react";
import {
  Building2, CalendarDays, Users, FileText, TrendingUp,
  ChevronLeft, ChevronRight, BarChart2, UserCheck, Clock,
} from "lucide-react";
import {
  useAdminAnalyticsStats,
  useAdminAnalyticsByType,
  useAdminAnalyticsMonthlyTrend,
  useAdminAnalyticsStakeholderGrowth,
  useAdminAnalyticsEventPerformance,
  useAdminRecentRegistrations,
} from "@/api/super-admin";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { formatDate } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  AGM_EGM:              "AGM / EGM",
  PRODUCT_LAUNCH:       "Product Launch",
  INNOVATION_CHALLENGE: "Innovation Challenge",
  GENERAL_EVENT:        "General Event",
};

const TYPE_COLORS: Record<string, string> = {
  AGM_EGM:              "#7c22c9",
  PRODUCT_LAUNCH:       "#ea6c00",
  INNOVATION_CHALLENGE: "#0891b2",
  GENERAL_EVENT:        "#16a34a",
};

function fillRateColor(rate: number) {
  if (rate >= 80) return "#16a34a";
  if (rate >= 50) return "#f59e0b";
  return "#ef4444";
}

function StatCard({ title, value, subtitle, icon: Icon, accent }: {
  title: string; value: string | number; subtitle: string; icon: any; accent: string;
}) {
  return (
    <Card className="attend-card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: accent + "18" }}>
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

// ── Main component ────────────────────────────────────────────────────────────

export function SuperAdminAnalytics() {
  const [perfPage, setPerfPage] = useState(0);
  const [regPage,  setRegPage]  = useState(0);

  const { data: stats,       isLoading: statsLoading   } = useAdminAnalyticsStats();
  const { data: byType = [],  isLoading: typeLoading    } = useAdminAnalyticsByType();
  const { data: trend = [],   isLoading: trendLoading   } = useAdminAnalyticsMonthlyTrend(6);
  const { data: growth = [],  isLoading: growthLoading  } = useAdminAnalyticsStakeholderGrowth(6);
  const { data: perfData,     isLoading: perfLoading    } = useAdminAnalyticsEventPerformance("", "", perfPage, 20);
  const { data: recentData,   isLoading: recentLoading  } = useAdminRecentRegistrations(regPage, 10);

  const perfEvents  = perfData?.events  ?? [];
  const perfTotal   = perfData?.totalCount ?? 0;
  const perfPages   = Math.ceil(perfTotal / 20);
  const recentItems = recentData?.content ?? [];
  const recentTotal = recentData?.totalElements ?? 0;
  const recentPages = Math.ceil(recentTotal / 10);

  if (statsLoading) return <Loader variant="page" text="Loading analytics…" />;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Stat cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Stakeholders"  value={stats?.totalStakeholders?.count  ?? 0} subtitle="Registered orgs"    icon={Building2}    accent={stats?.totalStakeholders?.color  ?? "#7c22c9"} />
        <StatCard title="Events"        value={stats?.totalEvents?.count        ?? 0} subtitle="Across platform"    icon={CalendarDays} accent={stats?.totalEvents?.color        ?? "#0891b2"} />
        <StatCard title="Participants"  value={stats?.totalParticipants?.count  ?? 0} subtitle="Total registrations" icon={Users}        accent={stats?.totalParticipants?.color  ?? "#16a34a"} />
        <StatCard title="Documents"     value={stats?.totalDocuments?.count     ?? 0} subtitle="Uploaded files"     icon={FileText}     accent={stats?.totalDocuments?.color     ?? "#d97706"} />
        <StatCard title="Avg Fill Rate" value={`${stats?.avgFillRate?.percentage ?? 0}%`} subtitle="Capacity utilisation" icon={BarChart2} accent={stats?.avgFillRate?.color ?? "#7c22c9"} />
      </div>

      {/* ── Events by type + Monthly trend ────────────────────────── */}
      <div className="grid grid-cols-2 gap-5">
        {/* By type */}
        <Card className="attend-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
            <h2 className="font-semibold text-[hsl(var(--foreground))]">Events by Type</h2>
          </div>
          {typeLoading ? <Loader variant="inline" /> : (
            <div className="px-5 py-4 flex flex-col gap-3">
              {byType.map((item) => {
                const color = item.color ?? TYPE_COLORS[item.type] ?? "#374151";
                return (
                  <div key={item.type} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: color + "18" }}>
                      <CalendarDays className="h-4 w-4" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-[hsl(var(--foreground))]">{TYPE_LABELS[item.type] ?? item.type}</span>
                        <span className="text-sm font-bold tabular-nums" style={{ color }}>{item.eventCount}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (item.eventCount / Math.max(...byType.map(b => b.eventCount), 1)) * 100)}%`, backgroundColor: color }} />
                      </div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{item.totalRsvps.toLocaleString()} RSVPs</p>
                    </div>
                  </div>
                );
              })}
              {byType.length === 0 && <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">No data yet.</p>}
            </div>
          )}
        </Card>

        {/* Monthly trend */}
        <Card className="attend-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
            <h2 className="font-semibold text-[hsl(var(--foreground))]">Monthly Registration Trend</h2>
          </div>
          {trendLoading ? <Loader variant="inline" /> : (
            <div className="px-5 py-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
                    <th className="text-left pb-2">Month</th>
                    <th className="text-right pb-2">Registrations</th>
                    <th className="text-right pb-2">Events</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.map((item) => (
                    <tr key={item.month} className="border-b border-[hsl(var(--border)/0.5)] last:border-0">
                      <td className="py-2 font-medium">{item.month}</td>
                      <td className="py-2 text-right tabular-nums">{item.registrations.toLocaleString()}</td>
                      <td className="py-2 text-right tabular-nums text-[hsl(var(--muted-foreground))]">{item.events}</td>
                    </tr>
                  ))}
                  {trend.length === 0 && (
                    <tr><td colSpan={3} className="py-6 text-center text-[hsl(var(--muted-foreground))]">No data yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* ── Stakeholder growth ─────────────────────────────────────── */}
      {!growthLoading && growth.length > 0 && (
        <Card className="attend-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
            <h2 className="font-semibold text-[hsl(var(--foreground))]">Stakeholder Growth</h2>
          </div>
          <div className="px-5 py-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
                  <th className="text-left pb-2">Month</th>
                  <th className="text-right pb-2">New</th>
                  <th className="text-right pb-2">Cumulative</th>
                </tr>
              </thead>
              <tbody>
                {growth.map((item) => (
                  <tr key={item.month} className="border-b border-[hsl(var(--border)/0.5)] last:border-0">
                    <td className="py-2 font-medium">{item.month}</td>
                    <td className="py-2 text-right tabular-nums text-emerald-600 font-medium">+{item.newCount ?? item.new ?? 0}</td>
                    <td className="py-2 text-right tabular-nums text-[hsl(var(--muted-foreground))]">{item.cumulative ?? item.total ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Event performance table ────────────────────────────────── */}
      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Event Performance</h2>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{perfTotal.toLocaleString()} events</span>
        </div>
        {perfLoading ? <Loader variant="inline" /> : (
          <>
            <table className="w-full">
              <thead>
                <tr className="attend-table-header">
                  <th className="px-5 py-3 text-left">Event</th>
                  <th className="px-5 py-3 text-left">Organisation</th>
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-right">RSVPs</th>
                  <th className="px-5 py-3 text-right">Capacity</th>
                  <th className="px-5 py-3 text-right">Fill</th>
                  <th className="px-5 py-3 text-right">Check-in</th>
                </tr>
              </thead>
              <tbody>
                {perfEvents.map((ev) => (
                  <tr key={ev.id} className="attend-table-row">
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate max-w-[200px]">{ev.title}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{TYPE_LABELS[ev.eventType] ?? ev.eventType}</p>
                    </td>
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] max-w-[140px] truncate">{ev.stakeholderName}</td>
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{formatDate(ev.date)}</td>
                    <td className="px-5 py-3 text-sm tabular-nums text-right">{ev.rsvpCount.toLocaleString()}</td>
                    <td className="px-5 py-3 text-sm tabular-nums text-right text-[hsl(var(--muted-foreground))]">{ev.capacity?.toLocaleString() ?? "—"}</td>
                    <td className="px-5 py-3 text-sm tabular-nums text-right font-semibold" style={{ color: fillRateColor(ev.fillRate) }}>
                      {ev.fillRate?.toFixed(1)}%
                    </td>
                    <td className="px-5 py-3 text-sm tabular-nums text-right text-[hsl(var(--muted-foreground))]">
                      {ev.checkInRate?.toFixed(1)}%
                    </td>
                  </tr>
                ))}
                {perfEvents.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">No events yet.</td></tr>
                )}
              </tbody>
            </table>
            {perfPages > 1 && (
              <div className="px-5 py-3 border-t border-[hsl(var(--border))] flex items-center justify-between">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">Page {perfPage + 1} of {perfPages}</span>
                <div className="flex gap-2">
                  <button disabled={perfPage === 0} onClick={() => setPerfPage(p => p - 1)} className="h-7 px-3 text-xs rounded-lg border border-[hsl(var(--border))] disabled:opacity-40 hover:bg-[hsl(var(--muted))]"><ChevronLeft className="h-3 w-3" /></button>
                  <button disabled={perfPage >= perfPages - 1} onClick={() => setPerfPage(p => p + 1)} className="h-7 px-3 text-xs rounded-lg border border-[hsl(var(--border))] disabled:opacity-40 hover:bg-[hsl(var(--muted))]"><ChevronRight className="h-3 w-3" /></button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* ── Recent registrations ───────────────────────────────────── */}
      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Recent Registrations</h2>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{recentTotal.toLocaleString()} total</span>
        </div>
        {recentLoading ? <Loader variant="inline" /> : (
          <>
            <div className="divide-y divide-[hsl(var(--border))]">
              {recentItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: item.avatarColor ?? "#7c22c9" }}
                  >
                    {item.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{item.participantName}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{item.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] shrink-0">
                    <Clock className="h-3 w-3" />{item.registeredAgo}
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    item.kycStatus === "VERIFIED" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                  }`}>{item.kycStatus}</span>
                </div>
              ))}
              {recentItems.length === 0 && (
                <div className="px-5 py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">No registrations yet.</div>
              )}
            </div>
            {recentPages > 1 && (
              <div className="px-5 py-3 border-t border-[hsl(var(--border))] flex items-center justify-between">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">Page {regPage + 1} of {recentPages}</span>
                <div className="flex gap-2">
                  <button disabled={regPage === 0} onClick={() => setRegPage(p => p - 1)} className="h-7 px-3 text-xs rounded-lg border border-[hsl(var(--border))] disabled:opacity-40 hover:bg-[hsl(var(--muted))]"><ChevronLeft className="h-3 w-3" /></button>
                  <button disabled={regPage >= recentPages - 1} onClick={() => setRegPage(p => p + 1)} className="h-7 px-3 text-xs rounded-lg border border-[hsl(var(--border))] disabled:opacity-40 hover:bg-[hsl(var(--muted))]"><ChevronRight className="h-3 w-3" /></button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
