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
} from "@/types/super-admin";
import { ApiResponse } from "@/types/api";

export const superAdminKeys = {
  all: ["super-admin"] as const,
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

export function useDashboardStats() {
  return useQuery({
    queryKey: superAdminKeys.dashboardStats(),
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
export function useAdminDashboard() {
  return useQuery({
    queryKey: [...superAdminKeys.all, "dashboard"] as const,
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

export function usePendingEnrollments(page = 0, limit = 20) {
  return useQuery({
    queryKey: superAdminKeys.pendingEnrollments(page, limit),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PendingEnrollmentsResponse>>(
        `/api/v1/admin/stakeholders/pending?page=${page}&size=${limit}`
      );
      return res.data;
    },
  });
}

export function useEvents(status = "", page = 0, size = 10) {
  return useQuery({
    queryKey: superAdminKeys.events(status, page, size),
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
export function useUsers(kycStatus = "", page = 0, limit = 20) {
  return useQuery({
    queryKey: superAdminKeys.users(kycStatus, page, limit),
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
      if (search) params.append("search", search);
      if (eventId) params.append("eventId", eventId);
      if (type) params.append("type", type);

      const res = await apiClient.get<ApiResponse<GlobalDocumentListResponse>>(
        `/api/v1/admin/documents?${params.toString()}`
      );
      return res.data;
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
      return res.data.data;
    },
    enabled: !!id && (opts?.enabled ?? true),
    staleTime: 60_000,
  });
}

export function useEventAttendees(id: string, page = 0, size = 20, kycStatus = "", opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clientEventKeys.attendees(id, page, size, kycStatus),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        `/api/v1/client/events/${id}/attendees`,
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
      const res = await apiClient.get<ApiResponse<any>>(`/api/v1/admin/events/${id}/documents`);
      return res.data;
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
      return res.data;
    },
    enabled: enabled && !!eventId && !!documentId,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
  });
}

/**
 * Mutation variant — use when you want to trigger a one-off download
 * imperatively (e.g. from a table row action button) without pre-fetching.
 *
 * The `onSuccess` callback receives the full response; call
 * `triggerBase64Download` inside your component to hand off to the browser.
 */
export function useDownloadEventDocument() {
  return useMutation({
    mutationFn: async ({ eventId, documentId }: { eventId: string; documentId: string }) => {
      const res = await apiClient.get<ApiResponse<EventDocumentDetailResponse>>(
        `/api/v1/admin/events/${eventId}/documents/${documentId}`
      );
      return res.data;
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

