"use client";

/**
 * admin-client-admins.ts — Admin: Client Admins Management
 *
 * Endpoints:
 *   GET /api/v1/admin/client-admins        — list all client admins (paginated)
 *   GET /api/v1/admin/client-admins/{id}   — get single client admin by ID
 *
 * "Client admins" are the event-manager / stakeholder users who belong to
 * registered organisations. Only accessible with a SUPER_ADMIN token.
 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClientAdminItem {
  id:              string;
  userId:          string;
  email:           string;
  fullName:        string;
  firstName?:      string;
  lastName?:       string;
  role:            string;
  status:          string;
  stakeholderId:   string;
  stakeholderName: string;
  createdAt?:      string;
}

export interface ClientAdminListResponse {
  content:       ClientAdminItem[];
  totalElements: number;
  totalPages:    number;
  size:          number;
  number:        number;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const clientAdminKeys = {
  all:    ["adminClientAdmins"] as const,
  list:   (page: number, size: number) =>
            ["adminClientAdmins", "list", { page, size }] as const,
  detail: (id: string) =>
            ["adminClientAdmins", "detail", id] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Paginated list of all client admins across all stakeholder organisations.
 *
 * GET /api/v1/admin/client-admins
 */
export function useAdminClientAdmins(page = 0, size = 20) {
  return useQuery({
    queryKey: clientAdminKeys.list(page, size),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ClientAdminListResponse>>(
        "/api/v1/admin/client-admins",
        { params: { page, size } }
      );
      return res.data.data;
    },
    staleTime: 60_000,
  });
}

/**
 * Full profile for a single client admin.
 *
 * GET /api/v1/admin/client-admins/{id}
 */
export function useAdminClientAdmin(id: string) {
  return useQuery({
    queryKey: clientAdminKeys.detail(id),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ClientAdminItem>>(
        `/api/v1/admin/client-admins/${id}`
      );
      return res.data.data;
    },
    enabled:   !!id,
    staleTime: 120_000,
  });
}
