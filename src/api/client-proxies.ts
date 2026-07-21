"use client";

/**
 * client-proxies.ts — Proxy dashboard & reporting (AGM milestone #5)
 *
 *   GET   /api/v1/client/votes/{eventId}/proxies?search=&status=&page=&size=
 *         Roles: CLIENT_ADMIN / ADMIN / EVENT_MANAGER / VIEWER (read-only)
 *   PATCH /api/v1/client/votes/{eventId}/proxies/{proxyId}/attended
 *         Roles: CLIENT_ADMIN / ADMIN only
 *
 * Notes from the backend handoff:
 * - status is only ever PENDING or ATTENDED in practice today; ACCEPTED is
 *   modeled for a future confirmation flow — don't build UI that assumes
 *   it's reachable.
 * - Marking attended does NOT adjust offline vote totals — that stays a
 *   separate manual admin action on the resolution cards.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import { ApiResponse } from "@/types/api";

export type ProxyStatus = "PENDING" | "ACCEPTED" | "ATTENDED";

export interface EventProxy {
  id:                string;
  grantorName:       string;
  grantorEmail?:     string;
  proxyName:         string;
  proxyEmail?:       string;
  proxyPhone?:       string;
  status:            ProxyStatus;
  sharesRepresented?: number;
  assignedAt?:       string;
  attendedAt?:       string | null;
}

export interface ProxyTab {
  key:   string;
  label: string;
  count: number;
}

export interface ProxyListResponse {
  eventId:    string;
  eventTitle: string;
  summary:    { total: number; pending: number; accepted: number; attended: number };
  tabs:       ProxyTab[];
  totalCount: number;
  page:       number;
  size:       number;
  proxies:    EventProxy[];
}

function normalize(raw: any): ProxyListResponse {
  const proxies: EventProxy[] = (raw?.proxies ?? raw?.content ?? raw?.items ?? []).map((p: any) => ({
    id:                String(p?.id ?? ""),
    grantorName:       p?.grantorName ?? "",
    grantorEmail:      p?.grantorEmail ?? undefined,
    proxyName:         p?.proxyName ?? "",
    proxyEmail:        p?.proxyEmail ?? undefined,
    proxyPhone:        p?.proxyPhone ?? undefined,
    status:            (String(p?.status ?? "PENDING").toUpperCase() as ProxyStatus),
    sharesRepresented: p?.sharesRepresented ?? undefined,
    assignedAt:        p?.assignedAt ?? undefined,
    attendedAt:        p?.attendedAt ?? null,
  }));
  return {
    eventId:    raw?.eventId ?? "",
    eventTitle: raw?.eventTitle ?? "",
    summary:    raw?.summary ?? { total: proxies.length, pending: 0, accepted: 0, attended: 0 },
    tabs:       raw?.tabs ?? [],
    totalCount: raw?.totalCount ?? raw?.totalElements ?? proxies.length,
    page:       raw?.page ?? 0,
    size:       raw?.size ?? proxies.length,
    proxies,
  };
}

export const proxyKeys = {
  list: (eventId: string, search: string, status: string, page: number, size: number) =>
    ["proxies", "list", eventId, { search, status, page, size }] as const,
};

export function useEventProxies(
  eventId: string | null | undefined,
  { search = "", status = "", page = 0, size = 20 }: { search?: string; status?: string; page?: number; size?: number } = {},
) {
  return useQuery({
    queryKey: proxyKeys.list(eventId ?? "", search, status, page, size),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status && status !== "ALL") params.set("status", status);
      params.set("page", String(page));
      params.set("size", String(size));
      const res = await apiClient.get<ApiResponse<any>>(
        `/api/v1/client/votes/${eventId}/proxies?${params.toString()}`
      );
      return normalize(res.data.data);
    },
    enabled: !!eventId,
    staleTime: 10_000,
    placeholderData: (prev) => prev, // keep the table stable while refetching
  });
}

export function useMarkProxyAttended() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, proxyId }: { eventId: string; proxyId: string }) => {
      const res = await apiClient.patch<ApiResponse<any>>(
        `/api/v1/client/votes/${eventId}/proxies/${proxyId}/attended`, {}
      );
      return res.data.data;
    },
    onSuccess: () => {
      // Invalidate every cached page/filter combination for proxies
      queryClient.invalidateQueries({ queryKey: ["proxies", "list"] });
      popup.success(
        "Proxy Marked Attended",
        "Note: this does not adjust offline vote totals — record those on the resolution if needed.",
        3500
      );
    },
    onError: (e) => parseAndToastApiError(e, "Failed to mark proxy as attended."),
  });
}
