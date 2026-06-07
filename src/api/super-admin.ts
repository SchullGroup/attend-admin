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
  GlobalDocumentListResponse,
  PagedResponse,
  EventDetailResponse,
  KycApproveRequest,
  KycDeclineRequest
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
  users: (page: number, limit: number) => [...superAdminKeys.all, "users", page, limit] as const,
  documents: (search: string, eventId: string, type: string, page: number, limit: number) => [...superAdminKeys.all, "documents", search, eventId, type, page, limit] as const,
  recentRegistrations: (page: number, limit: number) => [...superAdminKeys.all, "recent-registrations", page, limit] as const,
  eventDocuments: (id: string) => [...superAdminKeys.all, "event-documents", id] as const,
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

export function useEvents(status = "", page = 0, limit = 10) {
  return useQuery({
    queryKey: superAdminKeys.events(status, page, limit),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PagedResponse<EventSummaryResponse>>>(
        `/api/v1/admin/events?page=${page}&limit=${limit}${status ? `&status=${status}` : ""}`
      );
      return res.data;
    },
  });
}

export function useUsers(page = 0, limit = 20) {
  return useQuery({
    queryKey: superAdminKeys.users(page, limit),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PagedResponse<UserSummaryResponse>>>(
        `/api/v1/admin/users?page=${page}&limit=${limit}`
      );
      return res.data;
    },
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
      queryClient.invalidateQueries({ queryKey: superAdminKeys.users(0, 20) });
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
      queryClient.invalidateQueries({ queryKey: superAdminKeys.users(0, 20) });
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

export function useEventDetail(id: string) {
  return useQuery({
    queryKey: superAdminKeys.eventDetail(id),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<EventDetailResponse>>(`/api/v1/admin/events/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useEventAttendees(id: string, page = 0, size = 20, kycStatus = "") {
  return useQuery({
    queryKey: clientEventKeys.attendees(id, page, size, kycStatus),
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
      });
      if (kycStatus) params.append("kycStatus", kycStatus);
      const res = await apiClient.get<ApiResponse<any>>(`/api/v1/client/events/${id}/attendees?${params.toString()}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useEventDocuments(id: string) {
  return useQuery({
    queryKey: superAdminKeys.eventDocuments(id),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(`/api/v1/admin/events/${id}/documents`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useDownloadEventDocument() {
  return useMutation({
    mutationFn: async ({ eventId, documentId }: { eventId: string; documentId: string }) => {
      const res = await apiClient.get<ApiResponse<any>>(`/api/v1/admin/events/${eventId}/documents/${documentId}`);
      return res.data;
    },
    onError: (error: any) => {
      popup.error("Download Failed", error?.response?.data?.message || "Could not download the document.");
    }
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
      queryClient.invalidateQueries({ queryKey: superAdminKeys.events("", 0, 10) });
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
      queryClient.invalidateQueries({ queryKey: superAdminKeys.events("", 0, 10) });
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
      queryClient.invalidateQueries({ queryKey: superAdminKeys.events("", 0, 10) });
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
      queryClient.invalidateQueries({ queryKey: superAdminKeys.events("", 0, 10) });
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
      queryClient.invalidateQueries({ queryKey: superAdminKeys.events("", 0, 10) });
      popup.success("Cancelled", "Event has been cancelled.", 3000);
    },
    onError: (error: any) => {
      popup.error("Failed to Cancel Event", error?.response?.data?.message || "An error occurred.");
    }
  });
}

// --- Notifications Queries & Mutations ---

export const notificationKeys = {
  all: ["notifications"] as const,
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

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.patch<ApiResponse<any>>(`/api/v1/admin/notifications/${id}/read`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
    onError: (error: any) => {
      popup.error("Mark Read Failed", error?.response?.data?.message || "An error occurred.");
    }
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

