"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import { NotificationListResponse, NotificationResponse } from "@/types/super-admin";
import { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const notificationKeys = {
  all:  ["admin", "notifications"] as const,
  list: (page: number, limit: number, read?: boolean) =>
          ["admin", "notifications", "list", page, limit, read] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Admin notification feed — GET /api/v1/admin/notifications
 *
 * Polls every 30 seconds while the tab is focused so the bell badge stays
 * current without requiring a manual refresh.
 *
 * @param page  Zero-based page index.
 * @param limit Items per page. Pass 1 when you only need the unread count badge.
 * @param read  Pass `false` to filter to unread only; omit for all notifications.
 */
export function useAdminNotifications(page = 0, limit = 10, read?: boolean) {
  return useQuery({
    queryKey: notificationKeys.list(page, limit, read),
    queryFn: async () => {
      const params = new URLSearchParams({
        page:  page.toString(),
        limit: limit.toString(),
      });
      if (read !== undefined) params.append("read", read.toString());
      const res = await apiClient.get<ApiResponse<NotificationListResponse>>(
        `/api/v1/admin/notifications?${params.toString()}`
      );
      return res.data; // returns ApiResponse<NotificationListResponse> — unwrap .data for list
    },
    // Poll every 30 s while the window is focused
    refetchInterval:        30_000,
    refetchIntervalInBackground: false,
    staleTime:              20_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Mark a single notification as read — PATCH /api/v1/admin/notifications/{id}/read
 *
 * Invalidates the entire ["admin", "notifications"] subtree so:
 *   - the unread count badge (page 0, limit 1, read: false) refetches
 *   - the full notification list also refetches
 * Both happen in one invalidation call (exact: false is default).
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
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to mark notification as read."),
  });
}
