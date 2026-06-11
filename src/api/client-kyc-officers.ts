"use client";

/**
 * client-kyc-officers.ts — KYC Officer Management API
 *
 * Endpoints:
 *   GET  /api/v1/client/kyc-officers   — list KYC officers
 *   POST /api/v1/client/kyc-officers   — create KYC officer (sends invite)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KycOfficer {
  id:        string;
  firstName: string;
  lastName:  string;
  fullName:  string;
  email:     string;
  status:    string;
  createdAt: string;
}

export interface CreateKycOfficerRequest {
  firstName: string;
  lastName:  string;
  email:     string;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const kycOfficerKeys = {
  all:  ["kycOfficers"] as const,
  list: ["kycOfficers", "list"] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** List all KYC officers for the authenticated stakeholder. */
export function useKycOfficers() {
  return useQuery({
    queryKey: kycOfficerKeys.list,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        "/api/v1/client/kyc-officers"
      );
      // Endpoint returns ApiResponseListMapStringObject — normalise to array
      const raw = res.data.data;
      return (Array.isArray(raw) ? raw : raw?.officers ?? raw?.content ?? []) as KycOfficer[];
    },
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Create a new KYC officer (sends onboarding email). */
export function useCreateKycOfficer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateKycOfficerRequest) => {
      const res = await apiClient.post<ApiResponse<any>>(
        "/api/v1/client/kyc-officers",
        data
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kycOfficerKeys.all });
      popup.success("KYC Officer Created", "An invitation has been sent to the new officer.", 3000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to create KYC officer."),
  });
}
