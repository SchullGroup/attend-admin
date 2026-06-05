"use client";
import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import type { AuditCategory, AuditSeverity } from "@/lib/mock-data";

const CATEGORY_LABELS: Record<AuditCategory, string> = {
  auth: "Auth",
  kyc: "KYC",
  stakeholders: "Stakeholders",
  events: "Events",
  voting: "Voting",
  documents: "Documents",
  system: "System",
};

const CATEGORY_COLORS: Record<AuditCategory, { bg: string; text: string }> = {
  auth:         { bg: "rgba(17,24,39,0.08)",   text: "#374151" },
  kyc:          { bg: "rgba(124,58,237,0.08)",  text: "#6d28d9" },
  stakeholders: { bg: "rgba(79,70,229,0.08)",   text: "#4338ca" },
  events:       { bg: "rgba(22,163,74,0.08)",   text: "#15803d" },
  voting:       { bg: "rgba(217,119,6,0.08)",   text: "#b45309" },
  documents:    { bg: "rgba(234,88,12,0.08)",   text: "#c2410c" },
  system:       { bg: "rgba(100,116,139,0.1)",  text: "#475569" },
};

const SEVERITY_CONFIG: Record<AuditSeverity, { bg: string; text: string; label: string; dot: string }> = {
  info:     { bg: "rgba(100,116,139,0.08)", text: "#475569", label: "Info",     dot: "#94a3b8" },
  warning:  { bg: "rgba(245,158,11,0.1)",  text: "#b45309", label: "Warning",  dot: "#f59e0b" },
  critical: { bg: "rgba(239,68,68,0.1)",   text: "#dc2626", label: "Critical", dot: "#ef4444" },
};

const ALL_CATEGORIES: ("all" | AuditCategory)[] = ["all", "auth", "kyc", "stakeholders", "events", "voting", "documents", "system"];
const ALL_SEVERITIES: ("all" | AuditSeverity)[] = ["all", "info", "warning", "critical"];

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-NG", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

export default function AuditLogPage() {
  const { auditLog } = useStore();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | AuditCategory>("all");
  const [severity, setSeverity] = useState<"all" | AuditSeverity>("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return auditLog.filter((e) => {
      if (category !== "all" && e.category !== category) return false;
      if (severity !== "all" && e.severity !== severity) return false;
      if (q && !e.actor.toLowerCase().includes(q) && !e.actorEmail.toLowerCase().includes(q) && !e.action.toLowerCase().includes(q) && !e.resource.toLowerCase().includes(q) && !(e.details ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [auditLog, search, category, severity]);

  const counts = useMemo(() => ({
    total: auditLog.length,
    critical: auditLog.filter((e) => e.severity === "critical").length,
    warning: auditLog.filter((e) => e.severity === "warning").length,
    today: auditLog.filter((e) => new Date(e.timestamp).toDateString() === new Date().toDateString()).length,
  }), [auditLog]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Audit Log</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Complete record of all platform actions and security events
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Events", value: counts.total, color: "#111827" },
          { label: "Today", value: counts.today, color: "#16a34a" },
          { label: "Warnings", value: counts.warning, color: "#d97706" },
          { label: "Critical", value: counts.critical, color: "#dc2626" },
        ].map((s) => (
          <Card key={s.label} className="attend-card p-4">
            <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium">{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="attend-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by actor, action, resource or details…"
            className="flex-1 h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as "all" | AuditCategory)}
            className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          >
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c === "all" ? "All categories" : CATEGORY_LABELS[c]}</option>
            ))}
          </select>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as "all" | AuditSeverity)}
            className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          >
            {ALL_SEVERITIES.map((s) => (
              <option key={s} value={s}>{s === "all" ? "All severities" : SEVERITY_CONFIG[s].label}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-3 border-b border-[hsl(var(--border))] flex items-center justify-between">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Events</h2>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{filtered.length} of {auditLog.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left">Timestamp</th>
                <th className="px-5 py-3 text-left">Actor</th>
                <th className="px-5 py-3 text-left">Action</th>
                <th className="px-5 py-3 text-left">Category</th>
                <th className="px-5 py-3 text-left">Resource</th>
                <th className="px-5 py-3 text-left">Details</th>
                <th className="px-5 py-3 text-left">Severity</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
                    No audit events match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((entry) => {
                  const sev = SEVERITY_CONFIG[entry.severity];
                  const cat = CATEGORY_COLORS[entry.category];
                  return (
                    <tr key={entry.id} className="attend-table-row">
                      <td className="px-5 py-3 text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap font-mono">
                        {formatTimestamp(entry.timestamp)}
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-sm text-[hsl(var(--foreground))] font-medium truncate max-w-[180px]">{entry.actor}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate max-w-[180px]">{entry.actorEmail}</p>
                        <p className="text-xs font-mono" style={{ color: "#94a3b8" }}>{entry.ip}</p>
                      </td>
                      <td className="px-5 py-3 text-sm font-medium text-[hsl(var(--foreground))] whitespace-nowrap">{entry.action}</td>
                      <td className="px-5 py-3">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: cat.bg, color: cat.text }}
                        >
                          {CATEGORY_LABELS[entry.category]}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] max-w-[160px] truncate">{entry.resource}</td>
                      <td className="px-5 py-3 text-xs text-[hsl(var(--muted-foreground))] max-w-[220px]">
                        <span className="line-clamp-2">{entry.details}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: sev.bg, color: sev.text }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: sev.dot }} />
                          {sev.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
