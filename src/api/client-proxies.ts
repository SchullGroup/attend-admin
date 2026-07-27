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
  /**
   * Virtual proxy code (AGM handoff #10) — a random 10-digit code the proxy
   * holder enters as a guest to self-service cast this vote. Backend confirmed
   * this on the *create*-proxy-assignment response; not confirmed on this list
   * endpoint yet, so it's optional here and only rendered when actually present.
   */
  proxyCode?:        string;
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
    proxyCode:         p?.proxyCode ?? undefined,
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

// ---------------------------------------------------------------------------
// Bulk in-person proxy vote upload (AGM handoff #10)
//
//   POST /api/v1/client/votes/{eventId}/proxy-votes   (CLIENT_ADMIN / ADMIN)
//
// Each row upserts a Vote attributed to the *grantor* (the shareholder who
// assigned a proxy — referrerEmail), flows through the same tallying as a
// self-cast vote, and marks that grantor's ProxyAssignment ATTENDED. Once
// recorded, the grantor's own later vote attempt on that resolution/candidate
// is rejected (409) — proxy precedence.
// ---------------------------------------------------------------------------

export interface ProxyVoteInput {
  /** The grantor's (shareholder's) email — not the proxy holder's. */
  referrerEmail: string;
  resolutionId:  string;
  /** Only for CANDIDATE-type resolutions (F8) — omit for STANDARD. */
  candidateId?:  string;
  choice:        "FOR" | "AGAINST" | "ABSTAIN";
}

export interface ProxyVoteUploadResult {
  recorded:          number;
  skipped:           number;
  referrersNotified: number;
  errors:            string[];
}

export function useUploadProxyVotes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      eventId,
      proxyVotes,
    }: {
      eventId:    string;
      proxyVotes: ProxyVoteInput[];
    }) => {
      const res = await apiClient.post<ApiResponse<ProxyVoteUploadResult>>(
        `/api/v1/client/votes/${eventId}/proxy-votes`,
        { proxyVotes }
      );
      return res.data.data;
    },
    onSuccess: (data, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["proxies", "list"] });
      queryClient.invalidateQueries({ queryKey: ["clientVotes", "results", eventId] });
      const recorded = data?.recorded ?? 0;
      const skipped  = data?.skipped ?? 0;
      popup.success(
        "Proxy Votes Recorded",
        `${recorded} vote${recorded === 1 ? "" : "s"} recorded${skipped ? ` · ${skipped} skipped` : ""}.`,
        3500
      );
    },
    onError: (e) => parseAndToastApiError(e, "Failed to upload proxy votes."),
  });
}
