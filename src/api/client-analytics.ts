"use client";

/**
 * client-analytics.ts — Client Analytics API
 *
 * GET  /api/v1/client/analytics/stats
 * GET  /api/v1/client/analytics/by-type
 * GET  /api/v1/client/analytics/monthly-trend
 * GET  /api/v1/client/analytics/rsvps-by-event
 * GET  /api/v1/client/analytics/fill-rate-overview
 * GET  /api/v1/client/analytics/event-performance   ?page&size
 * GET  /api/v1/client/analytics/export/registrations?eventId&from&to
 */

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Cookies from "js-cookie";
import { apiClient } from "@/lib/api-client";
import { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Stat helper
// ---------------------------------------------------------------------------

/** A stat field may come back as a plain number OR { count, color } OR { percentage, color }. */
export type StatField =
  | number
  | { count?: number; percentage?: number; color?: string; change?: number; changePercent?: number };

/**
 * `change` — signed week-over-week percentage (this week vs. the prior 7
 * days). Confirmed live on `/analytics/stats` by backend (BACKEND_BUGS item
 * 15d) — `null` means no prior-week data to compare against, not "0%
 * change", so we only render the trend badge when `change` is a number
 * (the `??` chain below naturally turns `null` into `undefined`, which the
 * `StatCard` UI treats as "don't render").
 */
export function extractStat(val: StatField | undefined): { value: number; color?: string; change?: number } {
  if (val == null) return { value: 0 };
  if (typeof val === "number") return { value: val };
  const v = val as { count?: number; percentage?: number; color?: string; change?: number; changePercent?: number };
  return {
    value:  v.count ?? v.percentage ?? 0,
    color:  v.color ?? undefined,
    change: v.change ?? v.changePercent ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Types — aligned with actual API response shapes
// ---------------------------------------------------------------------------

/** GET /analytics/stats */
export interface AnalyticsStatsResponse {
  totalEvents:         { count: number;      color?: string; change?: number; changePercent?: number };
  totalAttendees:      { count: number;      color?: string; change?: number; changePercent?: number };
  avgFillRate:         { percentage: number; color?: string; change?: number; changePercent?: number };
  documentsPublished:  { count: number;      color?: string; change?: number; changePercent?: number };
  // legacy aliases the API may also return
  totalRsvps?:         StatField;
  totalDocuments?:     StatField;
}

/** GET /analytics/by-type — each item in the `byType` array */
export interface ByTypeItem {
  type:        string;   // "AGM_EGM" | "PRODUCT_LAUNCH" | "HACKATHON" | …
  color?:      string;
  eventCount:  number;
  totalRsvps?: number;
}

export interface ByTypeResponse {
  byType: ByTypeItem[];
}

/** GET /analytics/fill-rate-overview — each item in `fillRateOverview` */
export interface FillRateOverviewItem {
  eventId:    string;
  eventTitle: string;
  eventType?: string;
  fillRate:   number;
  barColor?:  string;
}

export interface FillRateOverviewResponse {
  fillRateOverview: FillRateOverviewItem[];
  yaxisMarkers?:    number[];
}

/** GET /analytics/rsvps-by-event */
export interface RsvpsByEventItem {
  eventId:    string;
  eventTitle: string;
  eventType?: string;
  rsvpCount:  number;
  capacity:   number;
  fillRate:   number;
  barColor?:  string;
}

export interface RsvpsByEventResponse {
  rsvpsByEvent: RsvpsByEventItem[];
}

/** GET /analytics/monthly-trend */
export interface MonthlyTrendItem {
  month:         string;   // e.g. "Jan 2025"
  registrations: number;
}

export interface MonthlyTrendResponse {
  trend: MonthlyTrendItem[];
}

/** GET /analytics/event-performance */
export interface EventPerformanceItem {
  id:             string;   // API field name
  eventId?:       string;   // normalised alias
  title:          string;   // API field name
  eventTitle?:    string;   // normalised alias
  eventType?:     string;
  dotColor?:      string;
  date:           string;
  status:         string;
  rsvpCount:      number;
  capacity:       number;
  fillRate:       number;
  checkedInCount: number;
  checkInRate:    number;
  /** Same as the admin `event-performance` shape. `qaResponses` is a real,
   *  confirmed count of EventQuestion rows per event — backend confirmed
   *  `pollResponses` never existed as a field; kept only as a fallback for
   *  older cached/mocked shapes. See BACKEND_BUGS item 13d. */
  avgWatchMinutes?: number;
  qaResponses?:     number;
  pollResponses?:   number;  // legacy/fallback field name — never actually populated
}

/** GET /analytics/event-format — distribution of events by format */
export interface EventFormatItem {
  format: string;
  count:  number;
  color?: string;
}

export interface EventFormatResponse {
  formats: EventFormatItem[];
}

/**
 * GET /analytics/engagement — org-wide engagement metrics.
 * No `pollResponseRate` field — backend confirmed there is no polling
 * feature anywhere in the product (no Poll entity, no response tracking).
 * Q&A is the only live-session engagement feature.
 */
export interface EngagementMetrics {
  avgWatchTimeMinutes: number;
  qaParticipationRate: number;
  documentDownloads:   number;
}

export interface EventPerformanceResponse {
  totalCount: number;
  page:       number;
  size:       number;
  events:     EventPerformanceItem[];
}

/** GET /analytics/export/registrations */
export interface ExportRegistrationItem {
  fullName:     string;
  email:        string;
  phone?:       string;
  registeredAt: string;
  checkedIn:    boolean;
  checkedInAt?: string;
}

export interface ExportRegistrationsResponse {
  eventId:       string;
  eventTitle:    string;
  eventDate:     string;
  exportedAt:    string;
  total:         number;
  registrations: ExportRegistrationItem[];
}

// ---------------------------------------------------------------------------
// Check-In Overview (not in official spec — keep with graceful fallback)
// ---------------------------------------------------------------------------

export interface CheckInEventItem {
  eventId:     string;
  eventTitle:  string;
  totalRsvps:  number;
  checkedIn:   number;
  checkInRate: number;
}

export interface CheckInOverviewResponse {
  totalRegistrations: number;
  totalCheckedIn:     number;
  overallCheckInRate: number;
  events:             CheckInEventItem[];
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
/**
 * Date window for every client analytics endpoint (backend 2026-09-18 C1).
 *
 * The window filters on EVENT DATE, not created-at — an AGM created in January and
 * held in September belongs to September — and everything derived from it (RSVPs,
 * documents, check-ins, fill rate) is computed over the events the window selects,
 * so the figures on a page agree with each other.
 *
 * Two documented exceptions: `monthly-trend` buckets on registration created-at (a
 * registration trend is about when people registered), and `engagement.documentDownloads`
 * is always all-time, because `downloadCount` is a running counter with no per-download
 * timestamp to filter on.
 *
 * An unrecognised value is a 400, deliberately — a wrong range that quietly answers a
 * different question is worse than an error.
 */
export type AnalyticsRange = "7d" | "30d" | "90d" | "12m" | "all";

export const ANALYTICS_RANGES: { value: AnalyticsRange; label: string }[] = [
  { value: "7d",  label: "7 days"    },
  { value: "30d", label: "30 days"   },
  { value: "90d", label: "90 days"   },
  { value: "12m", label: "12 months" },
  { value: "all", label: "All time"  },
];

/**
 * Omitted entirely for "all" so the request stays byte-identical to the pre-C1 one —
 * the API treats absent and `all` the same, which keeps this working either side of
 * the deploy.
 */
function rangeParams(range: AnalyticsRange) {
  return range && range !== "all" ? { range } : undefined;
}

export const clientAnalyticsKeys = {
  all:              ["clientAnalytics"] as const,
  stats:            (range: AnalyticsRange = "all") => ["clientAnalytics", "stats", range] as const,
  byType:           (range: AnalyticsRange = "all") => ["clientAnalytics", "byType", range] as const,
  fillRateOverview: (range: AnalyticsRange = "all") => ["clientAnalytics", "fillRateOverview", range] as const,
  rsvpsByEvent:     (range: AnalyticsRange = "all") => ["clientAnalytics", "rsvpsByEvent", range] as const,
  performance:      (page: number, size: number, range: AnalyticsRange = "all") =>
                      ["clientAnalytics", "performance", { page, size, range }] as const,
  checkInOverview:  (range: AnalyticsRange = "all") => ["clientAnalytics", "checkInOverview", range] as const,
  monthlyTrend:     (range: AnalyticsRange = "all") => ["clientAnalytics", "monthlyTrend", range] as const,
  eventFormat:      (range: AnalyticsRange = "all") => ["clientAnalytics", "eventFormat", range] as const,
  engagement:       (range: AnalyticsRange = "all") => ["clientAnalytics", "engagement", range] as const,
  exportRegs:       (eventId: string, from?: string, to?: string) =>
                      ["clientAnalytics", "exportRegs", { eventId, from, to }] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** GET /analytics/stats — aggregate summary: totalEvents, totalAttendees, avgFillRate, documentsPublished */
export function useAnalyticsStats(range: AnalyticsRange = "all") {
  return useQuery({
    queryKey: clientAnalyticsKeys.stats(range),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<AnalyticsStatsResponse>>(
        "/api/v1/client/analytics/stats",
        { params: rangeParams(range) }
      );
      return res.data.data;
    },
    staleTime: 60_000,
  });
}

/** GET /analytics/by-type — event counts grouped by type */
export function useAnalyticsByType(range: AnalyticsRange = "all") {
  return useQuery({
    queryKey: clientAnalyticsKeys.byType(range),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        "/api/v1/client/analytics/by-type",
        { params: rangeParams(range) }
      );
      const raw: any = res.data.data ?? res.data;
      const byType: ByTypeItem[] =
        raw?.byType ?? raw?.items ?? (Array.isArray(raw) ? raw : []);
      return { byType } as ByTypeResponse;
    },
    staleTime: 60_000,
  });
}

/** GET /analytics/fill-rate-overview — per-event fill rates with bar colors */
export function useAnalyticsFillRateOverview(range: AnalyticsRange = "all") {
  return useQuery({
    queryKey: clientAnalyticsKeys.fillRateOverview(range),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        "/api/v1/client/analytics/fill-rate-overview",
        { params: rangeParams(range) }
      );
      const raw: any = res.data.data ?? res.data;
      const fillRateOverview: FillRateOverviewItem[] =
        raw?.fillRateOverview ?? raw?.events ?? (Array.isArray(raw) ? raw : []);
      const yaxisMarkers: number[] = raw?.yaxisMarkers ?? [];
      return { fillRateOverview, yaxisMarkers } as FillRateOverviewResponse;
    },
    staleTime: 60_000,
  });
}

/** GET /analytics/rsvps-by-event — RSVP counts per event */
export function useAnalyticsRsvpsByEvent(range: AnalyticsRange = "all") {
  return useQuery({
    queryKey: clientAnalyticsKeys.rsvpsByEvent(range),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        "/api/v1/client/analytics/rsvps-by-event",
        { params: rangeParams(range) }
      );
      const raw: any = res.data.data ?? res.data;
      const rsvpsByEvent: RsvpsByEventItem[] =
        raw?.rsvpsByEvent ?? raw?.events ?? (Array.isArray(raw) ? raw : []);
      return { rsvpsByEvent } as RsvpsByEventResponse;
    },
    staleTime: 60_000,
  });
}

/** GET /analytics/monthly-trend — last 6 months of registration counts */
export function useAnalyticsMonthlyTrend(range: AnalyticsRange = "all") {
  return useQuery({
    queryKey: clientAnalyticsKeys.monthlyTrend(range),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        "/api/v1/client/analytics/monthly-trend",
        { params: rangeParams(range) }
      );
      const raw: any = res.data.data ?? res.data;
      const trend: MonthlyTrendItem[] =
        raw?.trend ?? (Array.isArray(raw) ? raw : []);
      return { trend } as MonthlyTrendResponse;
    },
    staleTime: 60_000,
  });
}

/**
 * GET /analytics/event-performance — paginated event performance table.
 *
 * Routed through our own Next.js server (/api/reports/event-summary)
 * instead of calling the external API directly from the browser — the
 * literal string "event-performance" gets silently killed by ad/privacy
 * blocker extensions (net::ERR_BLOCKED_BY_CLIENT, 0 bytes, request never
 * sent) because it matches common analytics-tracker filter rules. Every
 * other /analytics/* endpoint here is unaffected; this is the only name
 * that collides. See src/app/api/reports/event-summary/route.ts.
 */
export function useAnalyticsEventPerformance(page = 0, size = 10, range: AnalyticsRange = "all") {
  return useQuery({
    queryKey: clientAnalyticsKeys.performance(page, size, range),
    queryFn: async () => {
      // Plain axios (no baseURL) so this resolves same-origin against our
      // own Next.js server rather than apiClient's external baseURL — same
      // trick refreshAccessToken() uses in lib/api-client.ts. Auth header
      // is attached manually since this bypasses apiClient's interceptor.
      const token = Cookies.get("accessToken");
      const res = await axios.get<ApiResponse<any>>(
        "/api/reports/event-summary",
        {
          params:  { page, size, ...(rangeParams(range) ?? {}) },
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      );
      const raw: any = res.data.data ?? res.data;
      const events: EventPerformanceItem[] = (raw?.events ?? raw?.content ?? []).map(
        (e: any) => ({
          ...e,
          eventId:    e.eventId    ?? e.id,
          eventTitle: e.eventTitle ?? e.title,
        })
      );
      return {
        totalCount: raw?.totalCount ?? raw?.totalElements ?? 0,
        page:       raw?.page       ?? page,
        size:       raw?.size       ?? size,
        events,
      } as EventPerformanceResponse;
    },
    staleTime: 60_000,
    // Keep showing the previous page's rows while the next page loads,
    // instead of flipping isLoading back to true on every page change —
    // that was tripping the analytics page's top-level full-page loader
    // gate (see ClientAnalytics in analytics/page.tsx).
    placeholderData: (prev) => prev,
  });
}

/** GET /analytics/check-in-overview (optional endpoint — may not exist on all backends) */
export function useAnalyticsCheckInOverview(range: AnalyticsRange = "all") {
  return useQuery({
    queryKey: clientAnalyticsKeys.checkInOverview(range),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<CheckInOverviewResponse>>(
        "/api/v1/client/analytics/check-in-overview",
        { params: rangeParams(range) }
      );
      return res.data.data;
    },
    staleTime: 60_000,
    retry: false,   // don't retry if the endpoint doesn't exist
  });
}

/**
 * GET /analytics/event-format — distribution of this org's events by format
 * (virtual / hybrid / in-person). Confirmed live by backend — see
 * BACKEND_BUGS item 13c. Scoped to the caller's own stakeholder.
 */
export function useAnalyticsEventFormat(range: AnalyticsRange = "all") {
  return useQuery({
    queryKey: clientAnalyticsKeys.eventFormat(range),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        "/api/v1/client/analytics/event-format",
        { params: rangeParams(range) }
      );
      const raw: any = res.data.data ?? res.data;
      const formats: EventFormatItem[] =
        raw?.formats ?? raw?.eventFormats ?? raw?.distribution ?? (Array.isArray(raw) ? raw : []);
      return { formats } as EventFormatResponse;
    },
    staleTime: 60_000,
  });
}

/**
 * GET /analytics/engagement — org-wide engagement metrics (watch time, Q&A
 * participation, document downloads), scoped to the caller's stakeholder.
 * Confirmed live by backend (BACKEND_BUGS item 15b) — `avgWatchTime` is
 * confirmed to legitimately return `null` (no watch-time tracking infra
 * exists yet, same as the admin endpoint), so it's read defensively as 0
 * here until the UI is updated to distinguish "not tracked" from "zero".
 */
export function useAnalyticsEngagement(range: AnalyticsRange = "all") {
  return useQuery({
    queryKey: clientAnalyticsKeys.engagement(range),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        "/api/v1/client/analytics/engagement",
        { params: rangeParams(range) }
      );
      const d: any = res.data.data ?? res.data;
      return {
        avgWatchTimeMinutes: d?.avgWatchTimeMinutes ?? d?.avgWatchTime    ?? d?.averageWatchTime ?? 0,
        qaParticipationRate: d?.qaParticipationRate ?? d?.qnaParticipation ?? d?.qaRate ?? d?.qaParticipation ?? 0,
        documentDownloads:   d?.documentDownloads   ?? d?.totalDownloads ?? d?.downloads         ?? 0,
      } as EngagementMetrics;
    },
    staleTime: 60_000,
  });
}

/**
 * GET /analytics/export/registrations?eventId=&from=&to=
 * enabled:false by default — call refetch() on demand.
 */
export function useExportRegistrations(
  eventId: string,
  from?: string,
  to?: string
) {
  return useQuery({
    queryKey: clientAnalyticsKeys.exportRegs(eventId, from, to),
    queryFn: async () => {
      const params: Record<string, string> = { eventId };
      if (from) params.from = from;
      if (to)   params.to   = to;
      const res = await apiClient.get<ApiResponse<ExportRegistrationsResponse>>(
        "/api/v1/client/analytics/export/registrations",
        { params }
      );
      return res.data.data;
    },
    enabled: false,   // on-demand only — caller calls refetch()
    staleTime: 0,
  });
}
