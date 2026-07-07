"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import {
  CreateUserRequest,
  SuspendUserAccountRequest,
  UserSummaryResponse,
} from "@/types/super-admin";
import { ApiResponse } from "@/types/api";
import { participantKeys } from "@/api/participants";

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const userKeys = {
  all: ["admin", "users"] as const,
};

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Create an individual user account — POST /api/users
 * Use for general (non-corporate) individual registrations.
 * Unwraps: response.data.data → UserSummaryResponse
 */
export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateUserRequest) => {
      const res = await apiClient.post<ApiResponse<UserSummaryResponse>>(
        "/api/users",
        data
      );
      return res.data.data;
    },
    onSuccess: () => {
      // Invalidate both the admin users list and the participants list so any
      // table showing the new user refreshes automatically.
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      queryClient.invalidateQueries({ queryKey: participantKeys.all });
      popup.success("User Created", "The new user account has been created successfully.", 3000);
    },
    onError: (error: any) => parseAndToastApiError(error, "User creation failed."),
  });
}

/**
 * Suspend a single user by their individual identity ID.
 * POST /api/v1/admin/users/{userId}/suspend
 *
 * IMPORTANT: pass `p.id` or `p.userId` from the attendee row — NOT the parent
 * organisation/stakeholder ID.  Distinct from useSuspendRegister (org-level).
 *
 * Invalidates: participant detail + full participant list so the table row
 * status badge updates immediately without a manual refresh.
 */
export function useSuspendUserAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      data,
    }: {
      userId: string;
      data?: SuspendUserAccountRequest;
    }) => {
      // Spec: PATCH /api/v1/admin/users/{id}/suspend — NOT POST
      const res = await apiClient.patch<ApiResponse<UserSummaryResponse>>(
        `/api/v1/admin/users/${userId}/suspend`,
        data ?? {}
      );
      return res.data.data;
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: participantKeys.detail(userId) });
      queryClient.invalidateQueries({ queryKey: participantKeys.all });
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      popup.success("User Suspended", "The user account has been suspended.", 3000);
    },
    onError: (error: any) => parseAndToastApiError(error, "User suspension failed."),
  });
}
