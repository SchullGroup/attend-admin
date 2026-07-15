"use client";

/**
 * client-polls.ts — Live event polls (F1, backend shipped 2026-07-15)
 *
 * Client admin:
 *   POST   /api/v1/client/events/{eventId}/polls                → create + open
 *   PATCH  /api/v1/client/events/{eventId}/polls/{pollId}/close → manually close
 *   GET    /api/v1/client/events/{eventId}/polls                → history + live results
 *   DELETE /api/v1/client/events/{eventId}/polls/{pollId}       → remove (no votes yet)
 * Super admin (read-only):
 *   GET    /api/v1/admin/events/{id}/polls
 *
 * Rules (spec'd with product, enforced server-side):
 *   - one poll open at a time per event (409 otherwise)
 *   - one vote per participant (participant side)
 *   - close manually or automatically at closesAt
 *
 * Live updates arrive on the existing STOMP topic /topic/live.{eventId} as
 * POLL_OPENED / POLL_RESULTS_UPDATED / POLL_CLOSED (see use-live-websocket.ts);
 * these hooks are the snapshot/query side of the same data.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { parseAndToastApiError } from "@/lib/api-error";
import { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PollOption {
  id:    string;
  label: string;
}

export interface PollOptionResult {
  optionId:    string;
  votes:       number;
  percentage:  number;
}

export interface Poll {
  id:          string;
  question:    string;
  options:     PollOption[];
  status:      "OPEN" | "CLOSED";
  type?:       string;               // "SINGLE_CHOICE" today
  closesAt?:   string | null;
  createdAt?:  string;
  closedAt?:   string;
  totalVotes:  number;
  results:     PollOptionResult[];
}

export interface CreatePollRequest {
  question:  string;
  options:   string[];
  closesAt?: string;                 // ISO — omit for "open until closed"
}

// ---------------------------------------------------------------------------
// Normalization — response shapes for the list endpoint aren't formally
// documented, so parse defensively per codebase convention.
// ---------------------------------------------------------------------------

function normalizePoll(raw: any): Poll {
  const options: PollOption[] = (raw?.options ?? []).map((o: any, i: number) =>
    typeof o === "string"
      ? { id: String(i), label: o }
      : { id: String(o.id ?? o.optionId ?? i), label: o.label ?? o.text ?? "" }
  );
  const results: PollOptionResult[] = (raw?.results ?? raw?.finalResults ?? []).map((r: any) => ({
    optionId:   String(r.optionId ?? r.id ?? ""),
    votes:      r.votes ?? r.count ?? 0,
    percentage: r.percentage ?? r.pct ?? 0,
  }));
  const status = String(raw?.status ?? (raw?.closedAt ? "CLOSED" : "OPEN")).toUpperCase() === "CLOSED" ? "CLOSED" : "OPEN";
  return {
    id:         String(raw?.id ?? raw?.pollId ?? ""),
    question:   raw?.question ?? "",
    options,
    status,
    type:       raw?.type,
    closesAt:   raw?.closesAt ?? null,
    createdAt:  raw?.createdAt,
    closedAt:   raw?.closedAt,
    totalVotes: raw?.totalVotes ?? raw?.voteCount ?? results.reduce((s, r) => s + r.votes, 0),
    results,
  };
}

function normalizePollList(raw: any): Poll[] {
  const arr = Array.isArray(raw) ? raw : raw?.polls ?? raw?.content ?? raw?.items ?? [];
  return (arr as any[]).map(normalizePoll).filter((p) => p.id);
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const pollKeys = {
  list:      (eventId: string) => ["polls", "list", eventId] as const,
  adminList: (eventId: string) => ["polls", "adminList", eventId] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Client-admin list: history + live results for the currently open poll. */
export function useEventPolls(eventId: string | null | undefined, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: pollKeys.list(eventId ?? ""),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(`/api/v1/client/events/${eventId}/polls`);
      return normalizePollList(res.data.data);
    },
    enabled: !!eventId && (opts?.enabled ?? true),
    staleTime: 10_000,
  });
}

/** Super-admin read-only equivalent. */
export function useAdminEventPolls(eventId: string | null | undefined, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: pollKeys.adminList(eventId ?? ""),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(`/api/v1/admin/events/${eventId}/polls`);
      return normalizePollList(res.data.data);
    },
    enabled: !!eventId && (opts?.enabled ?? true),
    staleTime: 10_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations (client admin only)
// ---------------------------------------------------------------------------

export function useCreatePoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, ...body }: CreatePollRequest & { eventId: string }) => {
      const res = await apiClient.post<ApiResponse<any>>(`/api/v1/client/events/${eventId}/polls`, body);
      return normalizePoll(res.data.data);
    },
    onSuccess: (_d, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: pollKeys.list(eventId) });
    },
    onError: (e) => parseAndToastApiError(e, "Failed to create poll. Is another poll still open?"),
  });
}

export function useClosePoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, pollId }: { eventId: string; pollId: string }) => {
      const res = await apiClient.patch<ApiResponse<any>>(
        `/api/v1/client/events/${eventId}/polls/${pollId}/close`, {}
      );
      return res.data.data;
    },
    onSuccess: (_d, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: pollKeys.list(eventId) });
    },
    onError: (e) => parseAndToastApiError(e, "Failed to close poll."),
  });
}

export function useDeletePoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, pollId }: { eventId: string; pollId: string }) => {
      const res = await apiClient.delete<ApiResponse<any>>(
        `/api/v1/client/events/${eventId}/polls/${pollId}`
      );
      return res.data.data;
    },
    onSuccess: (_d, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: pollKeys.list(eventId) });
    },
    onError: (e) => parseAndToastApiError(e, "Failed to delete poll."),
  });
}
