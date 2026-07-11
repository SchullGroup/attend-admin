"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, ShieldAlert, AlertTriangle, Info, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CustomSelect } from "@/components/custom/custom-select";
import { Button } from "@/components/ui/button";
import { useGetMe } from "@/api/auth/hooks";
import {
  useClientAuditLogs,
  type AuditLogEntry,
  type AuditCategory,
  type AuditSeverity,
} from "@/api/client-audit";
import { useAdminAuditLogs } from "@/api/super-admin";
import { resolveRole, isSuperAdminRole } from "@/lib/utils";

// ─── Display config ───────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<AuditCategory, { label: string; bg: string; text: string }> = {
  AUTH:         { label: "Auth",         bg: "rgba(17,24,39,0.08)",   text: "#374151" },
  EVENTS:       { label: "Events",       bg: "rgba(22,163,74,0.08)",  text: "#15803d" },
  DOCUMENTS:    { label: "Documents",    bg: "rgba(234,88,12,0.08)",  text: "#c2410c" },
  TEAM:         { label: "Team",         bg: "rgba(79,70,229,0.08)",  text: "#4338ca" },
  APPLICATIONS: { label: "Applications", bg: "rgba(124,58,237,0.08)", text: "#6d28d9" },
};

const SEVERITY_CONFIG: Record<AuditSeverity, { label: string; bg: string; text: string; dot: string; icon: React.ElementType }> = {
  INFO:     { label: "Info",     bg: "rgba(100,116,139,0.08)", text: "#475569", dot: "#94a3b8",  icon: Info          },
  WARNING:  { label: "Warning",  bg: "rgba(245,158,11,0.1)",   text: "#b45309", dot: "#f59e0b",  icon: AlertTriangle },
  CRITICAL: { label: "Critical", bg: "rgba(239,68,68,0.1)",    text: "#dc2626", dot: "#ef4444",  icon: ShieldAlert   },
};

const defaultCat = { label: "Unknown", bg: "rgba(100,116,139,0.08)", text: "#475569" };
const defaultSev = { label: "—",       bg: "rgba(100,116,139,0.08)", text: "#475569", dot: "#94a3b8", icon: Info };

const CATEGORY_OPTIONS = [
  { value: "",             label: "All categories"  },
  { value: "AUTH",         label: "Auth"            },
  { value: "EVENTS",       label: "Events"          },
  { value: "DOCUMENTS",    label: "Documents"       },
  { value: "TEAM",         label: "Team"            },
  { value: "APPLICATIONS", label: "Applications"    },
];

const SEVERITY_OPTIONS = [
  { value: "",         label: "All severities" },
  { value: "INFO",     label: "Info"           },
  { value: "WARNING",  label: "Warning"        },
  { value: "CRITICAL", label: "Critical"       },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-NG", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
  } catch {
    return iso;
  }
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="attend-table-row">
      {[160, 180, 130, 80, 140, 200, 72].map((w, i) => (
        <td key={i} className="px-5 py-3.5">
          <div className="h-3.5 rounded bg-[hsl(var(--muted))] animate-pulse" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Log row ──────────────────────────────────────────────────────────────────

function LogRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const cat    = CATEGORY_CONFIG[entry.category as AuditCategory] ?? defaultCat;
  const sev    = SEVERITY_CONFIG[entry.severity as AuditSeverity] ?? defaultSev;

  return (
    <React.Fragment>
      <tr
        className="attend-table-row cursor-pointer select-none"
        onClick={() => setExpanded((p) => !p)}
      >
        {/* Timestamp */}
        <td className="px-5 py-3 text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap font-mono">
          {formatTimestamp(entry.timestamp)}
        </td>

        {/* Actor — org / email / IP */}
        <td className="px-5 py-3 max-w-[200px]">
          {entry.stakeholderName && (
            <p className="text-xs font-semibold text-[hsl(var(--primary))] truncate mb-0.5" title={entry.stakeholderName}>
              {entry.stakeholderName}
            </p>
          )}
          <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate" title={entry.actorEmail}>
            {entry.actorEmail || "—"}
          </p>
          <p className="text-xs font-mono text-[hsl(var(--muted-foreground))] mt-0.5">
            {entry.actorIp || "—"}
          </p>
        </td>

        {/* Action */}
        <td className="px-5 py-3 text-sm font-medium text-[hsl(var(--foreground))] whitespace-nowrap max-w-[160px] truncate" title={entry.action}>
          {entry.action}
        </td>

        {/* Category badge */}
        <td className="px-5 py-3">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
            style={{ backgroundColor: cat.bg, color: cat.text }}
          >
            {cat.label}
          </span>
        </td>

        {/* Resource name */}
        <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] max-w-[160px] truncate" title={entry.resourceName}>
          {entry.resourceName || "—"}
        </td>

        {/* Details — collapsed to 2 lines, expands on click */}
        <td className="px-5 py-3 text-xs text-[hsl(var(--muted-foreground))] max-w-[220px]">
          <span className={expanded ? undefined : "line-clamp-2"}>{entry.details || "—"}</span>
        </td>

        {/* Severity badge */}
        <td className="px-5 py-3">
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
            style={{ backgroundColor: sev.bg, color: sev.text }}
          >
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: sev.dot }} />
            {sev.label}
          </span>
        </td>
      </tr>

      {/* Expanded detail panel */}
      {expanded && (
        <tr className="bg-[hsl(var(--muted)/0.4)]">
          <td colSpan={7} className="px-5 py-4 border-b border-[hsl(var(--border))]">
            <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5">
              Full Details
            </p>
            <p className="text-sm text-[hsl(var(--foreground))] mb-3 leading-relaxed">
              {entry.details || "No additional details."}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-1 text-xs text-[hsl(var(--muted-foreground))]">
              {entry.stakeholderName && (
                <div><span className="font-semibold text-[hsl(var(--foreground))]">Organisation: </span>{entry.stakeholderName}</div>
              )}
              <div><span className="font-semibold text-[hsl(var(--foreground))]">Actor: </span>{entry.actorEmail}</div>
              <div><span className="font-semibold text-[hsl(var(--foreground))]">IP: </span><span className="font-mono">{entry.actorIp || "—"}</span></div>
              <div><span className="font-semibold text-[hsl(var(--foreground))]">Resource: </span>{entry.resourceName || "—"}</div>
              <div><span className="font-semibold text-[hsl(var(--foreground))]">Resource ID: </span><span className="font-mono text-[10px]">{entry.resourceId || "—"}</span></div>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function AuditLogPage() {
  const { data: userResponse, isLoading: userLoading } = useGetMe();
  const isSuperAdmin = isSuperAdminRole(resolveRole(userResponse?.data));

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [category,    setCategory]    = useState("");
  const [severity,    setSeverity]    = useState("");
  const [page,        setPage]        = useState(0);

  // Debounce search — fire API call 400 ms after the user stops typing
  useEffect(() => {
    const t = setTimeout(() => { setSearchQuery(searchInput); setPage(0); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const applyCategory = useCallback((v: string) => { setCategory(v); setPage(0); }, []);
  const applySeverity = useCallback((v: string) => { setSeverity(v); setPage(0); }, []);

  // Super admin uses the platform-wide audit log; client admin uses their org's log.
  // Hooks are always called (Rules of Hooks) but only enabled for the applicable role.
  const { data: adminData,  isLoading: adminLoading,  isFetching: adminFetching  } = useAdminAuditLogs(
    { search: searchQuery, category, severity, page, size: PAGE_SIZE },
    !userLoading && isSuperAdmin,
  );
  const { data: clientData, isLoading: clientLoading, isFetching: clientFetching } = useClientAuditLogs(
    !isSuperAdmin ? { search: searchQuery, category, severity, page, size: PAGE_SIZE } : {}
  );

  const data       = isSuperAdmin ? adminData  : clientData;
  // Include userLoading so we never briefly show the wrong role's data
  const isLoading  = userLoading || (isSuperAdmin ? adminLoading  : clientLoading);
  const isFetching = isSuperAdmin ? adminFetching : clientFetching;

  const logs       = data?.logs       ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasFilters = !!(searchQuery || category || severity);

  const stats = [
    { label: "Total Events", value: data?.totalEvents ?? 0, color: "#111827", icon: Activity     },
    { label: "Today",        value: data?.today       ?? 0, color: "#16a34a", icon: Info         },
    { label: "Warnings",     value: data?.warnings    ?? 0, color: "#d97706", icon: AlertTriangle },
    { label: "Critical",     value: data?.critical    ?? 0, color: "#dc2626", icon: ShieldAlert   },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Audit Log</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Activity history for your organisation. Filterable by category and severity.
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(({ label, value, color, icon: Icon }) => (
          <Card key={label} className="attend-card p-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: color + "15" }}>
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium leading-none">{label}</p>
                {isLoading
                  ? <div className="h-6 w-10 rounded bg-[hsl(var(--muted))] animate-pulse mt-1" />
                  : <p className="text-xl font-bold tabular-nums mt-0.5" style={{ color }}>{value.toLocaleString()}</p>
                }
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filter bar */}
      <Card className="attend-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search actor, action, resource, details…"
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>
          <CustomSelect value={category} onChange={applyCategory} placeholder="All categories" className="w-44" options={CATEGORY_OPTIONS} />
          <CustomSelect value={severity} onChange={applySeverity} placeholder="All severities" className="w-40" options={SEVERITY_OPTIONS} />
          {hasFilters && (
            <button
              type="button"
              onClick={() => { setSearchInput(""); setSearchQuery(""); setCategory(""); setSeverity(""); setPage(0); }}
              className="text-xs text-[hsl(var(--primary))] hover:underline self-center whitespace-nowrap"
            >
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[hsl(var(--border))] flex items-center justify-between">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Events</h2>
          <div className="flex items-center gap-3">
            {isFetching && !isLoading && (
              <span className="text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))] animate-pulse" /> Refreshing…
              </span>
            )}
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {isLoading ? "Loading…" : `${totalCount.toLocaleString()} event${totalCount !== 1 ? "s" : ""}`}
            </span>
          </div>
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
              {isLoading
                ? [...Array(8)].map((_, i) => <SkeletonRow key={i} />)
                : logs.length === 0
                  ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-14 text-center">
                        <Activity className="h-8 w-8 mx-auto mb-3 text-[hsl(var(--muted-foreground))] opacity-30" />
                        <p className="text-sm font-medium text-[hsl(var(--foreground))]">No events found</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                          {hasFilters ? "Try adjusting your filters." : "Audit events will appear here once activity is recorded."}
                        </p>
                      </td>
                    </tr>
                  )
                  : logs.map((entry) => <LogRow key={entry.id} entry={entry} />)
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-[hsl(var(--border))] flex items-center justify-between">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Page {page + 1} of {totalPages} · {totalCount.toLocaleString()} total
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page === 0 || isFetching} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page >= totalPages - 1 || isFetching} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
