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
  KycDeclineRequest
} from "@/types/super-admin";
import { ApiResponse } from "@/types/api";

export const participantKeys = {
  all: ["participants"] as const,
  stats: () => [...participantKeys.all, "stats"] as const,
  list: (search: string, kycStatus: string, accountStatus: string, page: number, limit: number) => 
    [...participantKeys.all, "list", search, kycStatus, accountStatus, page, limit] as const,
  detail: (id: string) => [...participantKeys.all, "detail", id] as const,
  kycQueue: (status: string, page: number, limit: number) => [...participantKeys.all, "kycQueue", status, page, limit] as const,
  kycDetail: (id: string) => [...participantKeys.all, "kycDetail", id] as const,
};

// --- Queries ---

export function useParticipantStats() {
  return useQuery({
    queryKey: participantKeys.stats(),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>("/api/v1/admin/participants/stats");
      return res.data;
    },
  });
}

export function useParticipants(search = "", kycStatus = "", accountStatus = "", page = 0, limit = 20) {
  return useQuery({
    queryKey: participantKeys.list(search, kycStatus, accountStatus, page, limit),
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        size: limit.toString(),
      });
      if (search) params.append("search", search);
      if (kycStatus) params.append("kycStatus", kycStatus);
      if (accountStatus) params.append("accountStatus", accountStatus);

      const res = await apiClient.get<ApiResponse<ParticipantListResponse>>(
        `/api/v1/admin/participants?${params.toString()}`
      );
      return res.data;
    },
  });
}

export function useParticipantDetail(id: string) {
  return useQuery({
    queryKey: participantKeys.detail(id),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ParticipantDetailResponse>>(`/api/v1/admin/participants/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useKycQueue(status = "", page = 0, limit = 20) {
  return useQuery({
    queryKey: participantKeys.kycQueue(status, page, limit),
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        size: limit.toString(),
      });
      if (status) params.append("status", status);

      const res = await apiClient.get<ApiResponse<KycQueueResponse>>(
        `/api/v1/admin/participants/kyc/queue?${params.toString()}`
      );
      return res.data;
    },
  });
}

export function useParticipantKycDetail(id: string) {
  return useQuery({
    queryKey: participantKeys.kycDetail(id),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ParticipantKycDetailResponse>>(`/api/v1/admin/participants/${id}/kyc`);
      return res.data;
    },
    enabled: !!id,
  });
}

// --- Mutations ---

export function useApproveKyc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: KycApproveRequest }) => {
      const res = await apiClient.post<ApiResponse<any>>(`/api/v1/admin/participants/${id}/kyc/approve`, data);
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: participantKeys.kycQueue("", 0, 20) });
      queryClient.invalidateQueries({ queryKey: participantKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: participantKeys.kycDetail(variables.id) });
      popup.success("KYC Approved", "Participant KYC has been successfully approved.", 3000);
    },
    onError: (error: any) => {
      popup.error("KYC Approval Failed", error?.response?.data?.message || "An error occurred.");
    }
  });
}

export function useDeclineKyc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: KycDeclineRequest }) => {
      const res = await apiClient.post<ApiResponse<any>>(`/api/v1/admin/participants/${id}/kyc/decline`, data);
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: participantKeys.kycQueue("", 0, 20) });
      queryClient.invalidateQueries({ queryKey: participantKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: participantKeys.kycDetail(variables.id) });
      popup.success("KYC Declined", "Participant KYC has been successfully declined.", 3000);
    },
    onError: (error: any) => {
      popup.error("KYC Decline Failed", error?.response?.data?.message || "An error occurred.");
    }
  });
}

export function useSuspendParticipant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SuspendParticipantRequest }) => {
      const res = await apiClient.post<ApiResponse<any>>(`/api/v1/admin/participants/${id}/suspend`, data);
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: participantKeys.list("", "", "", 0, 20) });
      queryClient.invalidateQueries({ queryKey: participantKeys.detail(variables.id) });
      popup.success("Suspended", "Participant has been suspended.", 3000);
    },
    onError: (error: any) => {
      popup.error("Suspension Failed", error?.response?.data?.message || "An error occurred.");
    }
  });
}

export function useReactivateParticipant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<ApiResponse<any>>(`/api/v1/admin/participants/${id}/reactivate`);
      return res.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: participantKeys.list("", "", "", 0, 20) });
      queryClient.invalidateQueries({ queryKey: participantKeys.detail(id) });
      popup.success("Reactivated", "Participant has been reactivated.", 3000);
    },
    onError: (error: any) => {
      popup.error("Reactivation Failed", error?.response?.data?.message || "An error occurred.");
    }
  });
}
