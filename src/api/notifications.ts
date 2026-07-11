"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import { NotificationListResponse, NotificationResponse } from "@/types/super-admin";
import { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Client notification types  (GET /api/v1/client/notifications)
// ---------------------------------------------------------------------------
export interface ClientNotificationItem {
  id:          string;
  title:       string;
  message:     string;
  read:        boolean;
  type:        string;
  referenceId: string;
  createdAt:   string;
}

export interface ClientNotificationListResponse {
  unreadCount:   number;
  page:          number;
  limit:         number;
  totalCount:    number;
  notifications: ClientNotificationItem[];
}

// ---------------------------------------------------------------------------
// Query key factories
// ---------------------------------------------------------------------------
export const clientNotificationKeys = {
  all:  ["client", "notifications"] as const,
  list: (page: number, limit: number, read?: boolean) =>
          ["client", "notifications", "list", page, limit, read] as const,
};

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
export function useAdminNotifications(page = 0, limit = 10, read?: boolean, enabled = true) {
  return useQuery({
    queryKey: notificationKeys.list(page, limit, read),
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams({
        page:  page.toString(),
        limit: limit.toString(),
      });
      if (read !== undefined) params.append("read", read.toString());
      const res = await apiClient.get<ApiResponse<NotificationListResponse>>(
        `/api/v1/admin/notifications?${params.toString()}`
      );
      // Handle both wrapped { data: { notifications: [] } } and direct shapes
      const raw = (res.data.data ?? res.data) as any;
      return {
        ...raw,
        notifications: raw?.notifications ?? raw?.content ?? [],
        totalCount:    raw?.totalCount    ?? raw?.totalElements ?? 0,
        unreadCount:   raw?.unreadCount   ?? raw?.totalUnread   ?? 0,
      } as NotificationListResponse;
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

/**
 * Mark every unread admin notification as read.
 *
 * There's no bulk "mark all read" endpoint on the backend, so this fetches
 * every currently-unread notification (large limit, read:false) and fires
 * the existing per-notification PATCH for each one in parallel.
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const listRes = await apiClient.get<ApiResponse<any>>(
        "/api/v1/admin/notifications",
        { params: { page: 0, limit: 500, read: false } }
      );
      const raw = listRes.data.data ?? (listRes.data as any);
      const unread: any[] = raw?.notifications ?? raw?.content ?? [];
      await Promise.allSettled(
        unread.map((n) => apiClient.patch(`/api/v1/admin/notifications/${n.id}/read`))
      );
      return unread.length;
    },
    onSuccess: (count: number) => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      if (count > 0) popup.success("All Caught Up", `${count} notification${count !== 1 ? "s" : ""} marked as read.`, 2000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to mark all notifications as read."),
  });
}

// ---------------------------------------------------------------------------
// Client notification hooks  (GET /api/v1/client/notifications)
// ---------------------------------------------------------------------------

/**
 * Client notification feed — GET /api/v1/client/notifications
 *
 * @param page  Zero-based page index.
 * @param limit Items per page. Pass 1 when you only need the unread count.
 * @param read  `false` = unread only; omit for all.
 */
export function useClientNotifications(page = 0, limit = 10, read?: boolean) {
  return useQuery({
    queryKey: clientNotificationKeys.list(page, limit, read),
    queryFn: async () => {
      const params: Record<string, string> = {
        page:  page.toString(),
        limit: limit.toString(),
      };
      if (read !== undefined) params.read = read.toString();
      const res = await apiClient.get<ApiResponse<ClientNotificationListResponse>>(
        "/api/v1/client/notifications",
        { params }
      );
      return res.data.data;
    },
    refetchInterval:             30_000,
    refetchIntervalInBackground: false,
    staleTime:                   20_000,
  });
}

/** Mark a client notification as read — PATCH /api/v1/client/notifications/{id}/read */
export function useMarkClientNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.patch<ApiResponse<string>>(
        `/api/v1/client/notifications/${id}/read`
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientNotificationKeys.all });
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to mark notification as read."),
  });
}

/**
 * Mark every unread client notification as read.
 * Same "no bulk endpoint" workaround as useMarkAllNotificationsRead.
 */
export function useMarkAllClientNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const listRes = await apiClient.get<ApiResponse<ClientNotificationListResponse>>(
        "/api/v1/client/notifications",
        { params: { page: 0, limit: 500, read: false } }
      );
      const raw = listRes.data.data ?? (listRes.data as any);
      const unread: ClientNotificationItem[] = raw?.notifications ?? (raw as any)?.content ?? [];
      await Promise.allSettled(
        unread.map((n) => apiClient.patch(`/api/v1/client/notifications/${n.id}/read`))
      );
      return unread.length;
    },
    onSuccess: (count: number) => {
      queryClient.invalidateQueries({ queryKey: clientNotificationKeys.all });
      if (count > 0) popup.success("All Caught Up", `${count} notification${count !== 1 ? "s" : ""} marked as read.`, 2000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to mark all notifications as read."),
  });
}
