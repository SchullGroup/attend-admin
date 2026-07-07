"use client";

/**
 * client-dashboard.ts — Client Dashboard & Stakeholder Profile API
 *
 * Endpoints:
 *   GET  /api/v1/client/dashboard/stats  — summary counts for the stakeholder
 *   GET  /api/v1/client/stakeholder      — full org profile
 *   PATCH /api/v1/client/stakeholder     — update org profile (CLIENT_ADMIN only)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RsvpStat {
  count:    number;
  capacity: number;
  fillRate: number;   // 0–100
}

export interface SimpleStatCard {
  count: number;
  label: string;
}

export interface ClientDashboardStatsResponse {
  stakeholderName: string;
  stats: {
    rsvps:              RsvpStat;
    attendeesVerified:  SimpleStatCard;
    documents:          SimpleStatCard;
  };
}

export interface StakeholderProfileResponse {
  id:        string;
  name:      string;
  email:     string;
  phone:     string;
  address:   string;
  industry:  string;
  website:   string;
  logoUrl:   string;
  status:    "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING" | "REJECTED";
  createdAt: string;
}

export interface UpdateStakeholderRequest {
  name?:     string;
  email?:    string;
  phone?:    string;
  address?:  string;
  industry?: string;
  website?:  string;
  logoUrl?:  string;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const clientDashboardKeys = {
  stats:       ["clientDashboard", "stats"] as const,
  stakeholder: ["clientDashboard", "stakeholder"] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * High-level counts for the caller's stakeholder.
 * Returns RSVPs (count, capacity, fill rate), verified attendees, and documents.
 *
 * GET /api/v1/client/dashboard/stats
 */
export function useClientDashboardStats() {
  return useQuery({
    queryKey: clientDashboardKeys.stats,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ClientDashboardStatsResponse>>(
        "/api/v1/client/dashboard/stats"
      );
      return res.data.data;
    },
    staleTime: 60_000,
  });
}

/**
 * Full stakeholder organisation profile.
 *
 * GET /api/v1/client/stakeholder
 */
export function useStakeholderProfile() {
  return useQuery({
    queryKey: clientDashboardKeys.stakeholder,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<StakeholderProfileResponse>>(
        "/api/v1/client/stakeholder"
      );
      return res.data.data;
    },
    staleTime: 120_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Update stakeholder name and contact fields. Requires CLIENT_ADMIN role.
 *
 * PATCH /api/v1/client/stakeholder
 */
export function useUpdateStakeholder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateStakeholderRequest) => {
      const res = await apiClient.patch<ApiResponse<StakeholderProfileResponse>>(
        "/api/v1/client/stakeholder",
        data
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientDashboardKeys.stakeholder });
      queryClient.invalidateQueries({ queryKey: clientDashboardKeys.stats });
      popup.success("Profile Updated", "Organisation details have been saved.", 2500);
    },
    onError: (error: any) =>
      parseAndToastApiError(error, "Update failed. Please try again."),
  });
}
