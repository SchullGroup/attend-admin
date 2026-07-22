"use client";
/**
 * admin-votes.ts — AGM Vote Records & Resolution Management (Admin)
 *
 * GET  /api/v1/admin/votes
 * GET  /api/v1/admin/votes/stats
 * GET  /api/v1/admin/votes/filters/organisers
 * GET  /api/v1/admin/votes/{eventId}/results
 * POST /api/v1/admin/votes/{eventId}/resolutions/{resolutionId}/open
 * POST /api/v1/admin/votes/{eventId}/resolutions/{resolutionId}/close
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import { ApiResponse } from "@/types/api";
import type { VoteResultsResponse, ResolutionResult } from "@/api/client-votes";

// Re-export so existing/new consumers of this file can import the full,
// fully-populated result shape from either module — the admin `/results`
// endpoint now returns the exact same envelope as the client-admin one
// (AGM handoff #6).
export type { VoteResultsResponse, ResolutionResult } from "@/api/client-votes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolutionVoteResult {
  id:          string;
  title:       string;
  status:      "PENDING" | "OPEN" | "CLOSED" | "PASSED" | "FAILED";
  forVotes:    number;
  againstVotes:number;
  abstainVotes:number;
  totalVotes:  number;
  order?:      number;
}

export interface VoteRecord {
  eventId:     string;
  eventTitle:  string;
  organiser:   string;      // registerName / stakeholderName
  date:        string;
  status:      string;
  resolutions: ResolutionVoteResult[];
}

export interface VoteRecordListResponse {
  content:       VoteRecord[];
  totalElements: number;
  totalPages:    number;
  size:          number;
  number:        number;
}

export interface VoteStatsResponse {
  liveCount:    number;
  endedCount:   number;
  pendingCount: number;
  totalVotes:   number;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const voteKeys = {
  all:        ["adminVotes"] as const,
  list:       (search: string, org: string, page: number, size: number) =>
                ["adminVotes", "list", { search, org, page, size }] as const,
  stats:      ["adminVotes", "stats"] as const,
  organisers: ["adminVotes", "organisers"] as const,
  results:    (eventId: string) => ["adminVotes", "results", eventId] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Paginated AGM vote records. */
export function useAdminVoteRecords(search = "", org = "", page = 0, size = 50) {
  return useQuery({
    queryKey: voteKeys.list(search, org, page, size),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<VoteRecordListResponse>>(
        "/api/v1/admin/votes",
        {
          params: {
            page,
            size,
            ...(search ? { search } : {}),
            ...(org    ? { organiser: org } : {}),
          },
        }
      );
      return res.data.data;
    },
    staleTime: 30_000,
  });
}

/** Summary counts (live, ended, pending, total votes). */
export function useAdminVoteStats() {
  return useQuery({
    queryKey: voteKeys.stats,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<VoteStatsResponse>>(
        "/api/v1/admin/votes/stats"
      );
      return res.data.data;
    },
    staleTime: 30_000,
  });
}

/** Organiser dropdown for the vote filter. */
export function useAdminVoteOrganisers() {
  return useQuery({
    queryKey: voteKeys.organisers,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        "/api/v1/admin/votes/filters/organisers"
      );
      const raw = res.data.data;
      return (Array.isArray(raw) ? raw : raw?.organisers ?? []) as string[];
    },
    staleTime: 300_000,
  });
}

/**
 * Full, read-only vote results for a single AGM event (super admin).
 *
 * Backend confirmed (AGM handoff #6) this now returns the exact same
 * fully-populated fields the client-admin `/results` endpoint already did —
 * shares, offline/in-room counts, combined totals, real quorum, and
 * resolutionType/candidates for Candidate Polls (F8) — previously these
 * were present but always zero/false here. Normalized identically to
 * useVoteResults in client-votes.ts so both surfaces stay consistent.
 */
export function useAdminVoteResults(eventId: string) {
  return useQuery({
    queryKey: voteKeys.results(eventId),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<VoteResultsResponse>>(
        `/api/v1/admin/votes/${eventId}/results`
      );
      const raw = res.data.data as any;
      if (!raw) return raw as VoteResultsResponse;
      const requiredQuorumPercentage =
        raw.quorumPercentage ?? raw.requiredQuorumPercentage ?? raw.quorumRequiredPercentage ?? raw.quorumThreshold ?? undefined;
      const resolutions: ResolutionResult[] = (raw.resolutions ?? []).map((r: any) => ({
        ...r,
        shareWeightedTalliesEnabled:
          r.shareWeightedTalliesEnabled ?? r.shareWeightedTallies ?? r.weightedTalliesEnabled ?? false,
      }));
      return { ...raw, requiredQuorumPercentage, resolutions } as VoteResultsResponse;
    },
    enabled:   !!eventId,
    staleTime: 15_000,
    refetchInterval: (query) => {
      // Poll every 5 s when any resolution is OPEN (live voting)
      const data = query.state.data as VoteResultsResponse | undefined;
      const hasOpen = data?.resolutions?.some((r) => r.status === "OPEN");
      return hasOpen ? 5_000 : false;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Open voting for a resolution. */
export function useOpenResolution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, resolutionId }: { eventId: string; resolutionId: string }) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/admin/votes/${eventId}/resolutions/${resolutionId}/open`
      );
      return res.data.data;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: voteKeys.results(eventId) });
      queryClient.invalidateQueries({ queryKey: voteKeys.all });
      popup.success("Voting Opened", "Shareholders can now cast their votes.", 3000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to open voting."),
  });
}

/** Close voting for a resolution — results become final. */
export function useCloseResolution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, resolutionId }: { eventId: string; resolutionId: string }) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/admin/votes/${eventId}/resolutions/${resolutionId}/close`
      );
      return res.data.data;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: voteKeys.results(eventId) });
      queryClient.invalidateQueries({ queryKey: voteKeys.all });
      popup.success("Voting Closed", "Results are final for this resolution.", 3000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to close voting."),
  });
}
