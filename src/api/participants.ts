"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import {
  ParticipantListResponse,
  ParticipantDetailResponse,
  KycQueueResponse,
  ParticipantKycDetailResponse,
  SuspendParticipantRequest,
  KycApproveRequest,
  KycDeclineRequest,
} from "@/types/super-admin";
import { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const participantKeys = {
  all:    ["admin", "participants"] as const,
  stats:  () => [...participantKeys.all, "stats"] as const,
  /**
   * Rule 4B: object-shaped final segment so search + kycStatus + pagination are
   * all visible together in React Query DevTools and change as one atomic unit.
   */
  list:   (search: string, kycStatus: string, accountStatus: string, page: number, limit: number) =>
            [...participantKeys.all, "list", { search, kycStatus, accountStatus, page, limit }] as const,
  detail: (id: string) => [...participantKeys.all, "detail", id] as const,
  /**
   * Fix 2: root changed to ["admin", "kycQueue"] so the key hierarchy matches
   * the architectural requirement. `status` is explicitly first so a tab change
   * is immediately visible as a cache-key change → React Query refetches.
   */
  kycQueue:  (status: string, page: number, limit: number) =>
               ["admin", "kycQueue", status, page, limit] as const,
  kycDetail: (id: string) => [...participantKeys.all, "kycDetail", id] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useParticipantStats() {
  return useQuery({
    queryKey: participantKeys.stats(),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>("/api/v1/admin/participants/stats");
      return res.data.data; // Rule 3: unwrap envelope
    },
  });
}

/**
 * Paginated participants list — GET /api/v1/admin/participants
 * Rule 3: returns payload directly; consumers access `.participants` (or `.content` fallback).
 */
export interface UseParticipantsParams {
  /** Pass `undefined` (not empty string) to omit from the request entirely */
  search?:        string;
  /** Rule 4A enums: FULL_KYC | BASIC_KYC | PENDING | NO_KYC. Pass `undefined` for unfiltered. */
  kycStatus?:     string;
  accountStatus?: string;
  page?:          number;
  limit?:         number;
}

/**
 * Paginated participants list — GET /api/v1/admin/participants
 * Accepts an options object so callers can pass `undefined` for optional filters
 * without polluting the Axios params or the React Query cache key.
 */
export function useParticipants({
  search,
  kycStatus,
  accountStatus,
  page  = 0,
  limit = 20,
}: UseParticipantsParams = {}) {
  return useQuery({
    queryKey: participantKeys.list(search ?? "", kycStatus ?? "", accountStatus ?? "", page, limit),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ParticipantListResponse>>(
        "/api/v1/admin/participants",
        {
          params: {
            page,
            size: limit,
            // Omit key entirely when undefined — no ?search= noise in the URL
            ...(search        ? { search }        : {}),
            ...(kycStatus     ? { kycStatus }     : {}),
            ...(accountStatus ? { accountStatus } : {}),
          },
        }
      );
      return res.data.data; // ParticipantListResponse
    },
  });
}

/**
 * Full profile for a single participant — GET /api/v1/admin/participants/{id}
 * Rule 3: returns payload directly; consumers use `data` not `data.data`.
 */
export function useParticipantDetail(id: string) {
  return useQuery({
    queryKey: participantKeys.detail(id),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ParticipantDetailResponse>>(
        `/api/v1/admin/participants/${id}`
      );
      return res.data.data; // ParticipantDetailResponse
    },
    enabled:   !!id,
    staleTime: 60_000,
  });
}

/**
 * KYC review queue — GET /api/v1/admin/participants/kyc/queue
 * Rule 1: server wraps array under `queue`, not `content`.
 * Rule 3: returns payload; consumers use `data?.queue || []`.
 */
export function useKycQueue(status = "", page = 0, limit = 20) {
  return useQuery({
    queryKey: participantKeys.kycQueue(status, page, limit),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<KycQueueResponse>>(
        "/api/v1/admin/participants/kyc/queue",
        {
          params: {
            page,
            size: limit,
            ...(status ? { status } : {}),
          },
        }
      );
      return res.data.data; // KycQueueResponse — use .queue for the items array
    },
  });
}

/**
 * Raw KYC credentials (BVN / NIN / CHN) — GET /api/v1/admin/participants/{id}/kyc
 * Rule 3: returns payload directly.
 */
export function useParticipantKycDetail(id: string) {
  return useQuery({
    queryKey: participantKeys.kycDetail(id),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ParticipantKycDetailResponse>>(
        `/api/v1/admin/participants/${id}/kyc`
      );
      return res.data.data; // ParticipantKycDetailResponse
    },
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useApproveKyc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: KycApproveRequest }) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/admin/participants/${id}/kyc/approve`,
        data
      );
      return res.data.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: participantKeys.kycQueue("", 0, 20) });
      queryClient.invalidateQueries({ queryKey: participantKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: participantKeys.kycDetail(id) });
      popup.success("KYC Approved", "Participant KYC has been successfully approved.", 3000);
    },
    onError: (error: any) => {
      popup.error("KYC Approval Failed", error?.response?.data?.message || "An error occurred.");
    },
  });
}

export function useDeclineKyc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: KycDeclineRequest }) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/admin/participants/${id}/kyc/decline`,
        data
      );
      return res.data.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: participantKeys.kycQueue("", 0, 20) });
      queryClient.invalidateQueries({ queryKey: participantKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: participantKeys.kycDetail(id) });
      popup.success("KYC Declined", "Participant KYC has been successfully declined.", 3000);
    },
    onError: (error: any) => {
      popup.error("KYC Decline Failed", error?.response?.data?.message || "An error occurred.");
    },
  });
}

/**
 * Suspend participant — POST /api/v1/admin/participants/{id}/suspend
 * Rule 2: invalidates detail + full list + kycQueue so every UI surface refreshes.
 */
export function useSuspendParticipant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SuspendParticipantRequest }) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/admin/participants/${id}/suspend`,
        data
      );
      return res.data.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: participantKeys.detail(id) });    // detail page badge
      queryClient.invalidateQueries({ queryKey: participantKeys.all });           // list table row
      queryClient.invalidateQueries({ queryKey: participantKeys.kycQueue("", 0, 20) }); // Rule 2: queue row
      popup.success("Suspended", "Participant account has been suspended.", 3000);
    },
    onError: (error: any) => {
      popup.error("Suspension Failed", error?.response?.data?.message || "An error occurred.");
    },
  });
}

/**
 * Reactivate participant — POST /api/v1/admin/participants/{id}/reactivate
 * Rule 2: mirrors suspension — invalidates detail + list + kycQueue.
 */
export function useReactivateParticipant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/admin/participants/${id}/reactivate`
      );
      return res.data.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: participantKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: participantKeys.all });
      queryClient.invalidateQueries({ queryKey: participantKeys.kycQueue("", 0, 20) }); // Rule 2
      popup.success("Reactivated", "Participant account has been reactivated.", 3000);
    },
    onError: (error: any) => {
      popup.error("Reactivation Failed", error?.response?.data?.message || "An error occurred.");
    },
  });
}
