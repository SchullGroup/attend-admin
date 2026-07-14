"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import {
  DashboardStatsResponse,
  PlatformStatsResponse,
  StakeholderSummaryResponse,
  EnrollmentResponse,
  EnrollStakeholderRequest,
  RejectEnrollmentRequest,
  PendingEnrollmentsResponse,
  EventSummaryResponse,
  RegistrationSummaryResponse,
  UserSummaryResponse,
  ClientAdminItem,
  GlobalDocumentListResponse,
  PagedResponse,
  PagedApiResponse,
  EventDetailResponse,
  KycApproveRequest,
  KycDeclineRequest,
  SearchResponse,
  SearchParams,
  NotificationResponse,
  NotificationListResponse,
  EventDocumentDetailResponse,
  EventDocumentSummary,
} from "@/types/super-admin";
import { ApiResponse } from "@/types/api";

export const superAdminKeys = {
  all: ["super-admin"] as const,
  auditLogs: (search: string, category: string, severity: string, page: number, size: number) =>
    ["super-admin", "audit-logs", { search, category, severity, page, size }] as const,
  dashboardStats: () => [...superAdminKeys.all, "dashboard-stats"] as const,
  platformStats: () => [...superAdminKeys.all, "platform-stats"] as const,
  stakeholders: (page: number, limit: number) => [...superAdminKeys.all, "stakeholders", page, limit] as const,
  pendingEnrollments: (page: number, limit: number) => [...superAdminKeys.all, "pending-enrollments", page, limit] as const,
  events: (status: string, page: number, limit: number) => [...superAdminKeys.all, "events", status, page, limit] as const,
  eventDetail: (id: string) => [...superAdminKeys.all, "event-detail", id] as const,
  users: (kycStatus: string, page: number, limit: number) => ["admin", "users", kycStatus, page, limit] as const,
  documents: (search: string, eventId: string, type: string, page: number, limit: number) => [...superAdminKeys.all, "documents", search, eventId, type, page, limit] as const,
  recentRegistrations: (page: number, limit: number) => [...superAdminKeys.all, "recent-registrations", page, limit] as const,
  eventDocuments: (id: string) => [...superAdminKeys.all, "event-documents", id] as const,
  eventDocument:  (eventId: string, documentId: string) => [...superAdminKeys.all, "event-document", eventId, documentId] as const,
  // Search — keyed by query string + pagination so each unique query caches independently
  search: (q: string, page: number, limit: number) => [...superAdminKeys.all, "search", q, page, limit] as const,
  userDetail: (id: string) => ["admin", "user-detail", id] as const,
  clientAdmins: (page: number, limit: number) => ["admin", "client-admins", page, limit] as const,
  clientAdminDetail: (id: string) => ["admin", "client-admin-detail", id] as const,
};

// --- Queries ---

export function useDashboardStats(enabled = true) {
  return useQuery({
    queryKey: superAdminKeys.dashboardStats(),
    enabled,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<DashboardStatsResponse>>("/api/v1/admin/dashboard/stats");
      return res.data;
    },
  });
}

/**
 * Full admin dashboard overview — GET /api/v1/admin/dashboard
 * Returns aggregated platform metrics, recent activity, and a KYC summary.
 */
export function useAdminDashboard(enabled = true) {
  return useQuery({
    queryKey: [...superAdminKeys.all, "dashboard"] as const,
    enabled,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>("/api/v1/admin/dashboard");
      return res.data.data ?? res.data;
    },
    staleTime: 60_000,
  });
}

export function usePlatformStats() {
  return useQuery({
    queryKey: superAdminKeys.platformStats(),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PlatformStatsResponse>>("/api/v1/admin/stats");
      return res.data;
    },
  });
}

export function useStakeholders(page = 0, limit = 10) {
  return useQuery({
    queryKey: superAdminKeys.stakeholders(page, limit),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PagedResponse<StakeholderSummaryResponse>>>(
        `/api/v1/admin/stakeholders?page=${page}&limit=${limit}`
      );
      return res.data;
    },
  });
}

export function usePendingEnrollments(page = 0, limit = 20, enabled = true) {
  return useQuery({
    queryKey: superAdminKeys.pendingEnrollments(page, limit),
    enabled,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PendingEnrollmentsResponse>>(
        `/api/v1/admin/stakeholders/pending?page=${page}&size=${limit}`
      );
      return res.data;
    },
  });
}

export function useEvents(status = "", page = 0, size = 10, enabled = true) {
  return useQuery({
    queryKey: superAdminKeys.events(status, page, size),
    enabled,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        `/api/v1/admin/events`,
        // Backend expects "size" (not "limit") for pagination — matches all other endpoints
        { params: { page, size, ...(status ? { status } : {}) } }
      );
      // API envelope: { status: true, data: { content:[...], totalElements, ... }, message }
      const body    = res.data;              // full JSON response body
      const payload = body?.data ?? body;    // unwrap standard envelope; fall back to body if stripped
      const content: EventSummaryResponse[] =
        Array.isArray(payload?.content) ? payload.content :
        Array.isArray(payload)          ? payload          : [];
      return {
        content,
        totalElements: payload?.totalElements ?? payload?.totalCount ?? content.length,
        totalPages:    payload?.totalPages    ?? 1,
        page:          payload?.page          ?? payload?.number      ?? page,
        size:          payload?.size          ?? size,
        number:        payload?.number        ?? payload?.page        ?? page,
        last:          payload?.last          ?? false,
      } as PagedResponse<EventSummaryResponse>;
    },
  });
}

/**
 * Paginated admin users list with optional KYC status filter.
 * Query key: ["admin", "users", kycStatus, page, limit] — kycStatus is first
 * so every tab change produces a structurally different key and React Query
 * fires a fresh targeted request instead of serving a stale cached result.
 */
export function useUsers(kycStatus = "", page = 0, limit = 20, enabled = true) {
  return useQuery({
    queryKey: superAdminKeys.users(kycStatus, page, limit),
    enabled,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PagedResponse<UserSummaryResponse>>>(
        "/api/v1/admin/users",
        {
          params: {
            page,
            limit,
            ...(kycStatus ? { kycStatus } : {}), // omit key entirely when empty → unfiltered list
          },
        }
      );
      return res.data.data; // unwrap envelope → PagedResponse<UserSummaryResponse>
    },
  });
}

/**
 * Single user detail — GET /api/v1/admin/users/{id}
 * Returns the same UserSummaryResponse shape as the list.
 */
export function useAdminUserDetail(id: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: superAdminKeys.userDetail(id),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<UserSummaryResponse>>(
        `/api/v1/admin/users/${id}`
      );
      return res.data.data ?? (res.data as any);
    },
    enabled: !!id && (opts?.enabled ?? true),
    staleTime: 60_000,
  });
}

/**
 * Paginated client admins list — GET /api/v1/admin/client-admins
 * Returns { content: ClientAdminItem[], page, size, totalElements, totalPages, last }
 */
export function useClientAdmins(page = 0, limit = 20) {
  return useQuery({
    queryKey: superAdminKeys.clientAdmins(page, limit),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PagedResponse<ClientAdminItem>>>(
        "/api/v1/admin/client-admins",
        { params: { page, limit } }
      );
      const body = res.data;
      const payload = body?.data ?? body;
      const content: ClientAdminItem[] =
        Array.isArray(payload?.content) ? payload.content :
        Array.isArray(payload)          ? payload          : [];
      return {
        content,
        totalElements: payload?.totalElements ?? (payload as any)?.totalCount ?? content.length,
        totalPages:    payload?.totalPages    ?? 1,
        page:          payload?.page          ?? page,
        size:          payload?.size          ?? limit,
        last:          payload?.last          ?? false,
      } as PagedResponse<ClientAdminItem>;
    },
  });
}

/**
 * Single client admin detail — GET /api/v1/admin/client-admins/{id}
 * Returns the same ClientAdminItem shape as the list.
 */
export function useClientAdminDetail(id: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: superAdminKeys.clientAdminDetail(id),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ClientAdminItem>>(
        `/api/v1/admin/client-admins/${id}`
      );
      return res.data.data ?? (res.data as any);
    },
    enabled: !!id && (opts?.enabled ?? true),
    staleTime: 60_000,
  });
}

export function useGlobalDocuments(search = "", eventId = "", type = "", page = 0, limit = 20) {
  return useQuery({
    queryKey: superAdminKeys.documents(search, eventId, type, page, limit),
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        size: limit.toString(),
      });
      if (search)  params.append("search",  search);
      if (eventId) params.append("eventId", eventId);
      if (type)    params.append("type",    type);

      const res = await apiClient.get<ApiResponse<GlobalDocumentListResponse>>(
        `/api/v1/admin/documents?${params.toString()}`
      );
      // Return the payload directly: { totalCount, documents: [...] }
      return (res.data.data ?? (res.data as any)) as GlobalDocumentListResponse;
    },
  });
}

export function useRecentRegistrations(page = 0, limit = 10) {
  return useQuery({
    queryKey: superAdminKeys.recentRegistrations(page, limit),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PagedResponse<RegistrationSummaryResponse>>>(
        `/api/v1/admin/registrations?page=${page}&limit=${limit}`
      );
      return res.data;
    },
  });
}

// ---------------------------------------------------------------------------
// Global Search  — GET /api/v1/admin/search
// ---------------------------------------------------------------------------
/**
 * Searches across events, stakeholders, and participants by keyword.
 *
 * - Disabled when `q` is empty so the query never fires on an empty input.
 * - staleTime: 30 s — search results change quickly; no long-lived cache.
 * - gcTime: 60 s — discard cached results after one minute of inactivity.
 *
 * Usage:
 *   const { data, isLoading, isFetching } = useGlobalSearch("GTCo");
 *   const results = data?.data;   // SearchResponse
 */
export function useGlobalSearch({ q, page = 0, limit = 10 }: SearchParams) {
  return useQuery({
    queryKey: superAdminKeys.search(q, page, limit),
    queryFn: async () => {
      // Rule 3: strict ?q= binding via Axios params object (not URLSearchParams string)
      const res = await apiClient.get<ApiResponse<SearchResponse>>("/api/v1/admin/search", {
        params: { q, page, limit },
      });
      return res.data.data; // SearchResponse — unwrapped from envelope
    },
    enabled: q.trim().length > 0,
    staleTime: 30_000,
    gcTime: 60_000,
    placeholderData: (prev) => prev,
  });
}

// ---------------------------------------------------------------------------
// Super Admin Audit Log — GET /api/v1/admin/audit-logs
// ---------------------------------------------------------------------------

export interface AdminAuditLogEntry {
  id:              string;
  timestamp:       string;
  stakeholderName: string;
  actorEmail:      string;
  actorIp:         string;
  action:          string;
  category:        string;
  resourceName:    string;
  resourceId:      string;
  details:         string;
  severity:        string;
}

export interface AdminAuditLogsResponse {
  totalCount:   number;
  totalEvents?: number;
  today:        number;
  warnings:     number;
  critical:     number;
  page:         number;
  size:         number;
  logs:         AdminAuditLogEntry[];
}

export function useAdminAuditLogs(
  params: {
    search?:   string;
    category?: string;
    severity?: string;
    page?:     number;
    size?:     number;
  } = {},
  enabled = true,
) {
  const { search = "", category = "", severity = "", page = 0, size = 20 } = params;
  return useQuery({
    queryKey: superAdminKeys.auditLogs(search, category, severity, page, size),
    enabled,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<AdminAuditLogsResponse>>(
        "/api/v1/admin/audit-logs",
        {
          params: {
            page,
            size,
            ...(search.trim()  ? { search:   search.trim()  } : {}),
            ...(category       ? { category                 } : {}),
            ...(severity       ? { severity                 } : {}),
          },
        }
      );
      const raw = (res.data.data ?? res.data) as any;
      // Normalise field aliases (totalEvents vs totalCount, logs vs entries)
      const logs = raw?.logs ?? raw?.entries ?? raw?.auditLogs ?? raw?.content ?? [];
      return {
        ...raw,
        logs,
        totalCount:   raw?.totalCount   ?? raw?.totalElements ?? logs.length,
        totalEvents:  raw?.totalEvents  ?? raw?.totalCount    ?? raw?.totalElements ?? 0,
        today:        raw?.today        ?? 0,
        warnings:     raw?.warnings     ?? 0,
        critical:     raw?.critical     ?? 0,
        page:         raw?.page         ?? 0,
        size:         raw?.size         ?? 20,
      } as AdminAuditLogsResponse;
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

// ---------------------------------------------------------------------------
// Super Admin Analytics — GET /api/v1/admin/analytics/*
// ---------------------------------------------------------------------------

export interface AdminAnalyticsStatItem { count: number; color: string; }
export interface AdminAnalyticsStats {
  totalStakeholders: AdminAnalyticsStatItem;
  totalEvents:       AdminAnalyticsStatItem;
  totalParticipants: AdminAnalyticsStatItem;
  totalDocuments:    AdminAnalyticsStatItem;
  avgFillRate:       { percentage: number; color: string };
  [key: string]: any;
}

export interface AdminAnalyticsByTypeItem {
  type:        string;
  eventCount:  number;
  totalRsvps:  number;
  color:       string;
}

export interface AdminAnalyticsTrendItem {
  month:         string;
  registrations: number;
  events:        number;
}

export interface AdminAnalyticsGrowthItem {
  month:       string;
  newCount:    number;
  cumulative:  number;
  [key: string]: any;
}

export interface AdminAnalyticsEventItem {
  id:              string;
  title:           string;
  eventType:       string;
  stakeholderName: string;
  date:            string;
  status:          string;
  rsvpCount:       number;
  capacity:        number;
  fillRate:        number;
  checkedInCount:  number;
  checkInRate:     number;
  avgWatchMinutes?: number;  // optional — returned by some backends
  /** Q&A engagement count for this event. The platform's live-session engagement
   *  feature is Q&A, not a separate "polls" feature — `pollResponses` is kept as a
   *  fallback for whichever field name the backend actually returns. */
  qaResponses?:    number;
  pollResponses?:  number;   // legacy/fallback field name
  dotColor?:       string;
}

export interface AdminAnalyticsEventPerformanceResponse {
  totalCount: number;
  page:       number;
  size:       number;
  events:     AdminAnalyticsEventItem[];
}

export interface AdminRecentRegistrationItem {
  id:             string;
  participantName:string;
  email:          string;
  initials:       string;
  avatarColor:    string;
  kycStatus:      string;
  registeredAgo:  string;
  registeredAt:   string;
}

export interface AdminRecentRegistrationsResponse {
  content:       AdminRecentRegistrationItem[];
  page:          number;
  size:          number;
  totalElements: number;
  totalPages:    number;
  last:          boolean;
}

// ---------------------------------------------------------------------------
// Helpers for normalising the various shapes the analytics API may return
// ---------------------------------------------------------------------------

/** Accepts { count, color } or a plain number — always returns { count, color }. */
function toStatItem(v: any, fallbackColor = "#374151"): { count: number; color: string } {
  if (typeof v === "number") return { count: v,        color: fallbackColor };
  return                             { count: v?.count ?? 0, color: v?.color ?? fallbackColor };
}

/** Returns the first value in `raw` that is a plain array, or []. */
function firstArray(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    for (const val of Object.values(raw)) {
      if (Array.isArray(val)) return val as any[];
    }
  }
  return [];
}

/** GET /api/v1/admin/analytics/stats */
export function useAdminAnalyticsStats() {
  return useQuery({
    queryKey: [...superAdminKeys.all, "analytics", "stats"],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<AdminAnalyticsStats>>("/api/v1/admin/analytics/stats");
      const d = (res.data.data ?? res.data) as any;
      // Normalise: backend may return flat numbers or { count, color } objects
      return {
        ...d,
        totalStakeholders: toStatItem(d?.totalStakeholders ?? d?.enrolledStakeholders, "#7c22c9"),
        totalEvents:       toStatItem(d?.totalEvents,       "#0891b2"),
        totalParticipants: toStatItem(d?.totalParticipants ?? d?.totalUsers ?? d?.totalRegistrations, "#16a34a"),
        totalDocuments:    toStatItem(d?.totalDocuments,    "#d97706"),
        avgFillRate: {
          percentage: typeof d?.avgFillRate === "number"
            ? d.avgFillRate
            : (d?.avgFillRate?.percentage ?? d?.averageFillRate ?? 0),
          color: d?.avgFillRate?.color ?? "#7c22c9",
        },
      } as AdminAnalyticsStats;
    },
    staleTime: 60_000,
  });
}

/**
 * GET /api/v1/admin/analytics/by-type
 * @param range Date-range code sent as `?range=` — "30d" | "90d" | "12m" | "all".
 * Confirmed live by backend across all admin analytics endpoints (BACKEND_BUGS
 * item 13a). Omitted from the request when undefined (defaults server-side to "all").
 */
export function useAdminAnalyticsByType(range?: string) {
  return useQuery({
    queryKey: [...superAdminKeys.all, "analytics", "by-type", range],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<{ byType: AdminAnalyticsByTypeItem[] }>>(
        "/api/v1/admin/analytics/by-type",
        { params: range ? { range } : undefined }
      );
      const raw = (res.data.data ?? res.data) as any;
      // Try named fields first, fall back to first array found in the object
      const arr: any[] = Array.isArray(raw)
        ? raw
        : (raw?.byType ?? raw?.eventsByType ?? raw?.types ?? firstArray(raw));
      // Normalise field aliases
      return arr.map((item: any) => ({
        type:       item.type       ?? item.eventType ?? item.category ?? "UNKNOWN",
        eventCount: item.eventCount ?? item.count     ?? item.total    ?? 0,
        totalRsvps: item.totalRsvps ?? item.rsvpCount ?? item.rsvps   ?? 0,
        color:      item.color      ?? "#374151",
      })) as AdminAnalyticsByTypeItem[];
    },
    staleTime: 60_000,
  });
}

/** GET /api/v1/admin/analytics/monthly-trend */
export function useAdminAnalyticsMonthlyTrend(months = 6) {
  return useQuery({
    queryKey: [...superAdminKeys.all, "analytics", "monthly-trend", months],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<{ trend: AdminAnalyticsTrendItem[] }>>(
        "/api/v1/admin/analytics/monthly-trend", { params: { months } }
      );
      const raw = (res.data.data ?? res.data) as any;
      const arr: any[] = Array.isArray(raw)
        ? raw
        : (raw?.trend ?? raw?.monthlyTrend ?? raw?.months ?? firstArray(raw));
      return arr.map((item: any) => ({
        month:         item.month         ?? item.period    ?? item.label ?? "",
        registrations: item.registrations ?? item.rsvps     ?? item.count ?? 0,
        events:        item.events        ?? item.eventCount ?? item.total ?? 0,
      })) as AdminAnalyticsTrendItem[];
    },
    staleTime: 60_000,
  });
}

/** GET /api/v1/admin/analytics/stakeholder-growth */
export function useAdminAnalyticsStakeholderGrowth(months = 6) {
  return useQuery({
    queryKey: [...superAdminKeys.all, "analytics", "stakeholder-growth", months],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<{ growth: AdminAnalyticsGrowthItem[] }>>(
        "/api/v1/admin/analytics/stakeholder-growth", { params: { months } }
      );
      const raw = (res.data.data ?? res.data) as any;
      const arr = Array.isArray(raw)
        ? raw
        : (raw?.growth ?? raw?.stakeholderGrowth ?? raw?.data ?? firstArray(raw));
      // Normalise field aliases so consumers can use newCount / cumulative
      return (arr as any[]).map((item: any) => ({
        month:      item.month,
        newCount:   item.newCount   ?? item.new       ?? item.added    ?? 0,
        cumulative: item.cumulative ?? item.total      ?? item.cumulativeCount ?? 0,
        ...item,
      })) as AdminAnalyticsGrowthItem[];
    },
    staleTime: 60_000,
  });
}

/** GET /api/v1/admin/analytics/event-performance */
export function useAdminAnalyticsEventPerformance(
  stakeholderId = "", eventType = "", page = 0, size = 20, range?: string
) {
  return useQuery({
    queryKey: [...superAdminKeys.all, "analytics", "event-performance", { stakeholderId, eventType, page, size, range }],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<AdminAnalyticsEventPerformanceResponse>>(
        "/api/v1/admin/analytics/event-performance",
        { params: { ...(stakeholderId ? { stakeholderId } : {}), ...(eventType ? { eventType } : {}), ...(range ? { range } : {}), page, size } }
      );
      const raw = (res.data.data ?? res.data) as any;
      const events = Array.isArray(raw)
        ? raw
        : (raw?.events ?? raw?.content ?? raw?.data ?? firstArray(raw));
      return {
        totalCount: raw?.totalCount ?? raw?.totalElements ?? events.length,
        page:       raw?.page       ?? page,
        size:       raw?.size       ?? size,
        events,
      } as AdminAnalyticsEventPerformanceResponse;
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

/** GET /api/v1/admin/registrations */
export function useAdminRecentRegistrations(page = 0, limit = 10) {
  return useQuery({
    queryKey: [...superAdminKeys.all, "recent-registrations", page, limit],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<AdminRecentRegistrationsResponse>>(
        "/api/v1/admin/registrations", { params: { page, limit } }
      );
      const raw = (res.data.data ?? res.data) as any;
      // API might return Spring Page (content/totalElements) or custom (registrations/totalCount)
      const content: AdminRecentRegistrationItem[] = Array.isArray(raw)
        ? raw
        : (raw?.content ?? raw?.registrations ?? raw?.items ?? raw?.data ?? firstArray(raw));
      return {
        content,
        page:          raw?.page          ?? page,
        size:          raw?.size          ?? limit,
        totalElements: raw?.totalElements ?? raw?.totalCount ?? content.length,
        totalPages:    raw?.totalPages    ?? Math.ceil((raw?.totalCount ?? content.length) / Math.max(limit, 1)),
        last:          raw?.last          ?? false,
      } as AdminRecentRegistrationsResponse;
    },
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// New analytics types & hooks — added to match expected dashboard design
// ---------------------------------------------------------------------------

export interface AdminSummaryStats {
  totalRegistrations:  number;
  registrationsChange?: number;   // % vs prior period (positive = up)
  eventsHosted:        number;
  eventsHostedChange?: number;    // % vs prior period
  docsDistributed:     number;
  docsChange?:         number;
  votesCast:           number;
  votesCastChange?:    number;    // % vs prior period
  [key: string]: any;
}

export interface TopOrganiserItem {
  stakeholderName: string;
  name?:           string;
  eventCount:      number;
  color?:          string;
}

export interface KycBreakdownItem {
  label:      string;
  type?:      string;
  count:      number;
  percentage: number;
  color?:     string;
}

export interface EventFormatItem {
  format: string;
  count:  number;
  color?: string;
}

/**
 * No `pollResponseRate` field — backend confirmed there is no polling feature
 * anywhere in the product (no Poll entity, no response tracking of any kind).
 * Q&A is the only live-session engagement feature.
 */
export interface AdminEngagementMetrics {
  avgWatchTimeMinutes:  number;
  qaParticipationRate:  number;
  documentDownloads:    number;
  [key: string]: any;
}

/**
 * GET /api/v1/admin/analytics/summary
 * Summary stat cards at the top of the analytics page. Backend confirmed
 * week-over-week `*Change` percentages (registrationsChange, eventsHostedChange,
 * docsChange, votesCastChange) — always last-7-days-vs-prior-7-days regardless
 * of the `range` filter; `null` when there's no prior-week data to compare
 * against. See BACKEND_BUGS item 13b.
 */
export function useAdminSummaryStats(range?: string) {
  return useQuery({
    queryKey: [...superAdminKeys.all, "analytics", "summary", range],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<AdminSummaryStats>>(
        "/api/v1/admin/analytics/summary",
        { params: range ? { range } : undefined }
      );
      const d = (res.data.data ?? res.data) as any;
      return {
        totalRegistrations:  d?.totalRegistrations  ?? d?.registrations       ?? d?.totalParticipants ?? 0,
        registrationsChange: d?.registrationsChange ?? d?.registrationChange  ?? d?.changePercent     ?? undefined,
        eventsHosted:        d?.eventsHosted        ?? d?.totalEvents          ?? d?.eventCount        ?? 0,
        eventsHostedChange:  d?.eventsHostedChange  ?? d?.eventsChange         ?? undefined,
        docsDistributed:     d?.docsDistributed     ?? d?.totalDocuments       ?? d?.documentCount     ?? 0,
        docsChange:          d?.docsChange          ?? d?.documentsChange      ?? undefined,
        votesCast:           d?.votesCast           ?? d?.totalVotes           ?? d?.votes             ?? 0,
        votesCastChange:     d?.votesCastChange     ?? d?.votesChange          ?? undefined,
      } as AdminSummaryStats;
    },
    staleTime: 60_000,
  });
}

/**
 * GET /api/v1/admin/analytics/top-organisers?limit=5
 * Top organisers ranked by number of events hosted.
 */
export function useAdminTopOrganisers(limit = 5, range?: string) {
  return useQuery({
    queryKey: [...superAdminKeys.all, "analytics", "top-organisers", limit, range],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<{ organisers: TopOrganiserItem[] }>>(
        "/api/v1/admin/analytics/top-organisers", { params: { limit, ...(range ? { range } : {}) } }
      );
      const raw = (res.data.data ?? res.data) as any;
      const arr: any[] = Array.isArray(raw)
        ? raw
        : (raw?.organisers ?? raw?.topOrganisers ?? raw?.stakeholders ?? firstArray(raw));
      return arr.map((item: any) => ({
        stakeholderName: item.stakeholderName ?? item.name ?? item.companyName ?? "Unknown",
        eventCount:      item.eventCount      ?? item.count ?? item.events     ?? 0,
        color:           item.color           ?? "#374151",
      })) as TopOrganiserItem[];
    },
    staleTime: 60_000,
  });
}

/**
 * GET /api/v1/admin/analytics/kyc-breakdown
 * KYC verification status breakdown across all registered stakeholders.
 */
export function useAdminKycBreakdown(range?: string) {
  return useQuery({
    queryKey: [...superAdminKeys.all, "analytics", "kyc-breakdown", range],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<{ breakdown: KycBreakdownItem[] }>>(
        "/api/v1/admin/analytics/kyc-breakdown",
        { params: range ? { range } : undefined }
      );
      const raw = (res.data.data ?? res.data) as any;
      const arr: any[] = Array.isArray(raw)
        ? raw
        : (raw?.breakdown ?? raw?.kycBreakdown ?? raw?.items ?? firstArray(raw));
      return arr.map((item: any) => ({
        label:      item.label      ?? item.type       ?? item.status     ?? "Unknown",
        type:       item.type       ?? item.status,
        count:      item.count      ?? item.total       ?? 0,
        percentage: item.percentage ?? item.percent     ?? item.ratio     ?? 0,
        color:      item.color      ?? "#374151",
      })) as KycBreakdownItem[];
    },
    staleTime: 60_000,
  });
}

/**
 * GET /api/v1/admin/analytics/event-format
 * Distribution of events by format (virtual / hybrid / in-person).
 */
export function useAdminEventFormat(range?: string) {
  return useQuery({
    queryKey: [...superAdminKeys.all, "analytics", "event-format", range],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<{ formats: EventFormatItem[] }>>(
        "/api/v1/admin/analytics/event-format",
        { params: range ? { range } : undefined }
      );
      const raw = (res.data.data ?? res.data) as any;
      const arr: any[] = Array.isArray(raw)
        ? raw
        : (raw?.formats ?? raw?.eventFormats ?? raw?.distribution ?? firstArray(raw));
      return arr.map((item: any) => ({
        format: item.format ?? item.type ?? item.name ?? "Unknown",
        count:  item.count  ?? item.total ?? 0,
        color:  item.color  ?? "#374151",
      })) as EventFormatItem[];
    },
    staleTime: 60_000,
  });
}

/**
 * GET /api/v1/admin/analytics/engagement
 * Platform-wide engagement metrics (watch time, poll rates, downloads).
 */
export function useAdminEngagement(range?: string) {
  return useQuery({
    queryKey: [...superAdminKeys.all, "analytics", "engagement", range],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<AdminEngagementMetrics>>(
        "/api/v1/admin/analytics/engagement",
        { params: range ? { range } : undefined }
      );
      const d = (res.data.data ?? res.data) as any;
      return {
        avgWatchTimeMinutes: d?.avgWatchTimeMinutes ?? d?.avgWatchTime    ?? d?.averageWatchTime ?? 0,
        qaParticipationRate: d?.qaParticipationRate ?? d?.qaRate           ?? d?.qaParticipation ?? 0,
        documentDownloads:   d?.documentDownloads   ?? d?.totalDownloads   ?? d?.downloads       ?? 0,
      } as AdminEngagementMetrics;
    },
    staleTime: 60_000,
  });
}

// --- Mutations ---

export function useEnrollStakeholder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: EnrollStakeholderRequest) => {
      const res = await apiClient.post<ApiResponse<EnrollmentResponse>>("/api/v1/admin/stakeholders/enroll", data);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: superAdminKeys.stakeholders(0, 10) });
      queryClient.invalidateQueries({ queryKey: superAdminKeys.pendingEnrollments(0, 20) });
      popup.success("Stakeholder Enrolled", "The enrollment request was sent successfully.", 3000);
    },
    onError: (error: any) => {
      popup.error("Enrollment Failed", error?.response?.data?.message || "An error occurred.");
    }
  });
}

export function useApproveEnrollment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<ApiResponse<any>>(`/api/v1/admin/stakeholders/${id}/approve`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: superAdminKeys.stakeholders(0, 10) });
      queryClient.invalidateQueries({ queryKey: superAdminKeys.pendingEnrollments(0, 20) });
      popup.success("Approved", "The stakeholder has been approved and activated.", 3000);
    },
    onError: (error: any) => {
      popup.error("Approval Failed", error?.response?.data?.message || "An error occurred.");
    }
  });
}

export function useRejectEnrollment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RejectEnrollmentRequest }) => {
      const res = await apiClient.post<ApiResponse<any>>(`/api/v1/admin/stakeholders/${id}/reject`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: superAdminKeys.pendingEnrollments(0, 20) });
      popup.success("Rejected", "The enrollment request has been rejected.", 3000);
    },
    onError: (error: any) => {
      popup.error("Rejection Failed", error?.response?.data?.message || "An error occurred.");
    }
  });
}

export function useSuspendUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.patch<ApiResponse<UserSummaryResponse>>(`/api/v1/admin/users/${id}/suspend`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      popup.success("Suspended", "The user has been suspended successfully.", 3000);
    },
    onError: (error: any) => {
      popup.error("Suspension Failed", error?.response?.data?.message || "An error occurred.");
    }
  });
}

export function useActivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.patch<ApiResponse<UserSummaryResponse>>(`/api/v1/admin/users/${id}/activate`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      popup.success("Activated", "The user has been activated successfully.", 3000);
    },
    onError: (error: any) => {
      popup.error("Activation Failed", error?.response?.data?.message || "An error occurred.");
    }
  });
}

// --- Client Event Queries & Mutations ---

export const clientEventKeys = {
  all: ["client-events"] as const,
  detail: (id: string) => [...clientEventKeys.all, "detail", id] as const,
  attendees: (id: string, page: number, size: number, kycStatus: string) => [...clientEventKeys.all, "attendees", id, page, size, kycStatus] as const,
  documents: (id: string) => [...clientEventKeys.all, "documents", id] as const,
};

export function useEventDetail(id: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: superAdminKeys.eventDetail(id),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<EventDetailResponse>>(`/api/v1/admin/events/${id}`);
      return res.data.data ?? (res.data as any);
    },
    enabled: !!id && (opts?.enabled ?? true),
    staleTime: 60_000,
  });
}

/**
 * Attendees for a platform event — SUPER_ADMIN view.
 *
 * API: GET /api/v1/admin/events/{id}/attendees (mirrors the admin documents
 * endpoint pattern: GET /api/v1/admin/events/{id}/documents). This used to
 * incorrectly call the org-scoped /api/v1/client/events/{id}/attendees, which
 * 403s / returns nothing for super_admin (no client org) — that's why the
 * Attendees tab showed "0 participants" even for events with real RSVPs.
 * Flagged to backend to confirm this admin endpoint exists (BACKEND_BUGS item 12).
 */
export function useEventAttendees(id: string, page = 0, size = 20, kycStatus = "", opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clientEventKeys.attendees(id, page, size, kycStatus),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        `/api/v1/admin/events/${id}/attendees`,
        { params: { page, size, ...(kycStatus ? { kycStatus } : {}) } }
      );
      return res.data.data;
    },
    enabled: !!id && (opts?.enabled ?? true),
  });
}

export function useEventDocuments(id: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: superAdminKeys.eventDocuments(id),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<{ totalCount: number; documents: EventDocumentSummary[] }>>(
        `/api/v1/admin/events/${id}/documents`
      );
      // API wraps in { data: { totalCount, documents: [] } }
      const payload = res.data.data ?? (res.data as any);
      return (payload?.documents ?? payload) as EventDocumentSummary[];
    },
    enabled: !!id && (opts?.enabled ?? true),
  });
}

/**
 * Fetches metadata + base64 payload for a single event document.
 *
 * - `enabled: false` by default — the caller opts in by passing `enabled: true`
 *   so the large base64 string is never fetched until the user explicitly
 *   requests it (e.g. clicks "Preview" or "Download").
 * - `staleTime: Infinity` — document binary content never changes;
 *   once cached there is no reason to re-fetch.
 * - `gcTime: 5 * 60_000` — evict from memory after 5 min of inactivity
 *   to avoid holding large base64 strings indefinitely.
 *
 * Usage:
 *   const { data, refetch, isFetching } = useEventDocument(eventId, documentId, false);
 *   // When user clicks download:
 *   const { fileData, mimeType, originalFilename } = (await refetch()).data!.data!;
 *   triggerBase64Download(fileData, mimeType, originalFilename);
 */
export function useEventDocument(eventId: string, documentId: string, enabled = false) {
  return useQuery({
    queryKey: superAdminKeys.eventDocument(eventId, documentId),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<EventDocumentDetailResponse>>(
        `/api/v1/admin/events/${eventId}/documents/${documentId}`
      );
      return (res.data.data ?? res.data) as EventDocumentDetailResponse;
    },
    enabled: enabled && !!eventId && !!documentId,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
  });
}

/**
 * Mutation variant — fetches the admin document detail to get the fileUrl,
 * then opens it for download. Works for both fileUrl and legacy fileData responses.
 */
export function useDownloadEventDocument() {
  return useMutation({
    mutationFn: async ({ eventId, documentId }: { eventId: string; documentId: string }) => {
      const res = await apiClient.get<ApiResponse<EventDocumentDetailResponse>>(
        `/api/v1/admin/events/${eventId}/documents/${documentId}`
      );
      return (res.data.data ?? res.data) as EventDocumentDetailResponse;
    },
    onSuccess: (doc) => {
      // Prefer direct fileUrl; fall back to legacy base64 fileData
      if (doc.fileUrl) {
        const a = document.createElement("a");
        a.href = doc.fileUrl;
        a.download = doc.originalFilename || doc.title;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.click();
      } else if (doc.fileData) {
        const byteChars = atob(doc.fileData);
        const bytes = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
        const blob = new Blob([bytes], { type: doc.mimeType || "application/octet-stream" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href = url; a.download = doc.originalFilename || doc.title; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5_000);
      }
    },
    onError: (error: any) => {
      popup.error("Download Failed", error?.response?.data?.message || "Could not download the document.");
    },
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post<ApiResponse<any>>("/api/v1/client/events", data);
      return res.data;
    },
    onSuccess: () => {
      // Broad partial-key invalidation: clears ALL events queries regardless of
      // active status filter, page number, or size — so the list always reflects
      // the latest state after any mutation.
      queryClient.invalidateQueries({ queryKey: [...superAdminKeys.all, "events"] });
      popup.success("Event Created", "The event has been successfully created as a draft.", 3000);
    },
    onError: (error: any) => {
      popup.error("Creation Failed", error?.response?.data?.message || "An error occurred.");
    }
  });
}

export function usePublishEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<ApiResponse<any>>(`/api/v1/client/events/${id}/publish`);
      return res.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: superAdminKeys.eventDetail(id) });
      // Broad partial-key invalidation: clears ALL events queries regardless of
      // active status filter, page number, or size — so the list always reflects
      // the latest state after any mutation.
      queryClient.invalidateQueries({ queryKey: [...superAdminKeys.all, "events"] });
      popup.success("Published", "The event has been published successfully.", 3000);
    },
    onError: (error: any) => {
      popup.error("Publishing Failed", error?.response?.data?.message || "An error occurred.");
    }
  });
}

export function useGoLive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<ApiResponse<any>>(`/api/v1/client/events/${id}/go-live`);
      return res.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: superAdminKeys.eventDetail(id) });
      // Broad partial-key invalidation: clears ALL events queries regardless of
      // active status filter, page number, or size — so the list always reflects
      // the latest state after any mutation.
      queryClient.invalidateQueries({ queryKey: [...superAdminKeys.all, "events"] });
      popup.success("Live Status", "Event is now Live.", 3000);
    },
    onError: (error: any) => {
      popup.error("Failed to Go Live", error?.response?.data?.message || "An error occurred.");
    }
  });
}

export function useEndEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<ApiResponse<any>>(`/api/v1/client/events/${id}/end`);
      return res.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: superAdminKeys.eventDetail(id) });
      // Broad partial-key invalidation: clears ALL events queries regardless of
      // active status filter, page number, or size — so the list always reflects
      // the latest state after any mutation.
      queryClient.invalidateQueries({ queryKey: [...superAdminKeys.all, "events"] });
      popup.success("Ended", "Event has been completed.", 3000);
    },
    onError: (error: any) => {
      popup.error("Failed to End Event", error?.response?.data?.message || "An error occurred.");
    }
  });
}

export function useCancelEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<ApiResponse<any>>(`/api/v1/client/events/${id}/cancel`);
      return res.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: superAdminKeys.eventDetail(id) });
      // Broad partial-key invalidation: clears ALL events queries regardless of
      // active status filter, page number, or size — so the list always reflects
      // the latest state after any mutation.
      queryClient.invalidateQueries({ queryKey: [...superAdminKeys.all, "events"] });
      popup.success("Cancelled", "Event has been cancelled.", 3000);
    },
    onError: (error: any) => {
      popup.error("Failed to Cancel Event", error?.response?.data?.message || "An error occurred.");
    }
  });
}

// --- Notifications Queries & Mutations ---

export const notificationKeys = {
  /** Root key — matches the architectural requirement: ["admin", "notifications"] */
  all:  ["admin", "notifications"] as const,
  list: (page: number, limit: number, read?: boolean) => [...notificationKeys.all, "list", page, limit, read] as const,
};

export function useNotifications(page = 0, limit = 10, read?: boolean) {
  return useQuery({
    queryKey: notificationKeys.list(page, limit, read),
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (read !== undefined) params.append("read", read.toString());
      const res = await apiClient.get<ApiResponse<any>>(`/api/v1/admin/notifications?${params.toString()}`);
      return res.data;
    },
  });
}

/**
 * Marks a single notification as read via PATCH /api/v1/admin/notifications/{id}/read.
 *
 * Cache invalidation strategy:
 *   - Invalidates the entire ["admin", "notifications"] subtree so every
 *     active useNotifications query (unread count badge, notification list)
 *     refetches immediately — badge count updates without a page reload.
 *   - Uses `exact: false` (the default) so both the unread-count query
 *     (page 0, limit 1, read: false) and the full list query are invalidated
 *     in one call.
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.patch<ApiResponse<string>>(
        `/api/v1/admin/notifications/${id}/read`
      );
      return res.data;
    },
    onSuccess: () => {
      // Explicit invalidation of the full notifications subtree
      queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] });
    },
    onError: (error: any) => {
      popup.error("Mark Read Failed", error?.response?.data?.message || "An error occurred.");
    },
  });
}

export function useApproveKyc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ participantId, request }: { participantId: string; request: KycApproveRequest }) => {
      const res = await apiClient.post<ApiResponse<any>>(`/api/v1/admin/participants/${participantId}/kyc/approve`, request);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-events", "attendees"] });
      popup.success("KYC Approved", "Participant's KYC has been approved successfully.", 3000);
    },
    onError: (error: any) => {
      popup.error("KYC Approval Failed", error?.response?.data?.message || "An error occurred.");
    }
  });
}

export function useDeclineKyc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ participantId, request }: { participantId: string; request: KycDeclineRequest }) => {
      const res = await apiClient.post<ApiResponse<any>>(`/api/v1/admin/participants/${participantId}/kyc/decline`, request);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-events", "attendees"] });
      popup.success("KYC Declined", "Participant's KYC has been declined successfully.", 3000);
    },
    onError: (error: any) => {
      popup.error("KYC Decline Failed", error?.response?.data?.message || "An error occurred.");
    }
  });
}

