"use client";

/**
 * client-votes.ts — AGM/EGM Vote Records & Resolution Management
 *
 * GET    /api/v1/client/votes                                                  → list
 * GET    /api/v1/client/votes/stats                                            → summary stats
 * GET    /api/v1/client/votes/{eventId}/results                               → per-event results
 * PATCH  /api/v1/client/votes/{eventId}/resolutions/{resolutionId}/offline-votes
 * POST   /api/v1/client/votes/{eventId}/resolutions/{resolutionId}/open
 * POST   /api/v1/client/votes/{eventId}/resolutions/{resolutionId}/close
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VoteListItem {
  eventId:          string;
  title:            string;
  date:             string;
  status:           string;
  resolutionCount:  number;
  totalVotesCast:   number;
}

export interface VoteListResponse {
  totalCount:  number;
  page:        number;
  size:        number;
  events:      VoteListItem[];
}

export interface VoteStats {
  liveAgms:         number;
  withVoteRecords:  number;
  upcomingOrDraft:  number;
}

export interface ResolutionResult {
  id:                    string;
  order:                 number;
  title:                 string;
  status:                string;
  // Online counts
  votesFor:              number;
  votesAgainst:          number;
  abstentions:           number;
  totalVotesCast:        number;
  // Online shares
  sharesFor:             number;
  sharesAgainst:         number;
  sharesAbstain:         number;
  totalShares:           number;
  // Offline counts
  offlineForCount:       number;
  offlineAgainstCount:   number;
  offlineAbstainCount:   number;
  // Offline shares
  offlineForShares:      number;
  offlineAgainstShares:  number;
  offlineAbstainShares:  number;
  // Combined counts
  combinedForCount:      number;
  combinedAgainstCount:  number;
  combinedAbstainCount:  number;
  // Combined shares
  combinedForShares:     number;
  combinedAgainstShares: number;
  combinedAbstainShares: number;
  // Summary
  percentageFor:         number;
  passed:                boolean;
  specialResolution:     boolean;
}

export interface VoteResultsResponse {
  eventId:          string;
  title:            string;
  stakeholderName:  string;
  registerId:       string;
  registerName:     string;
  date:             string;
  status:           string;
  totalVotesCast:   number;
  quorumPercentage: number;
  quorumMet:        boolean;
  resolutions:      ResolutionResult[];
}

export interface OfflineVoteRequest {
  forCount:       number;
  againstCount:   number;
  abstainCount:   number;
  forShares?:     number;
  againstShares?: number;
  abstainShares?: number;
}

export interface OpenResolutionRequest {
  durationSeconds?: number;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const clientVoteKeys = {
  all:     ["clientVotes"] as const,
  list:    (search: string, status: string, page: number, size: number) =>
             ["clientVotes", "list", { search, status, page, size }] as const,
  stats:   ["clientVotes", "stats"] as const,
  results: (eventId: string) => ["clientVotes", "results", eventId] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Paginated list of AGM/EGM events with resolution + vote totals. */
export function useClientVoteList(search = "", status = "", page = 0, size = 20) {
  return useQuery({
    queryKey: clientVoteKeys.list(search, status, page, size),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<VoteListResponse>>(
        "/api/v1/client/votes",
        {
          params: {
            ...(search ? { search } : {}),
            ...(status ? { status } : {}),
            page,
            size,
          },
        }
      );
      return res.data.data;
    },
    staleTime: 30_000,
  });
}

/** Summary stats: liveAgms, withVoteRecords, upcomingOrDraft. */
export function useVoteStats() {
  return useQuery({
    queryKey: clientVoteKeys.stats,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<VoteStats>>(
        "/api/v1/client/votes/stats"
      );
      return res.data.data;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/** Full resolution-by-resolution breakdown for one event. */
export function useVoteResults(eventId: string) {
  return useQuery({
    queryKey: clientVoteKeys.results(eventId),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<VoteResultsResponse>>(
        `/api/v1/client/votes/${eventId}/results`
      );
      return res.data.data;
    },
    enabled: !!eventId,
    staleTime: 15_000,
    refetchInterval: 15_000, // live refresh every 15 s during voting
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Enter / update physical in-room (offline) vote counts for a resolution. */
export function useRecordOfflineVotes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      eventId,
      resolutionId,
      data,
    }: {
      eventId:      string;
      resolutionId: string;
      data:         OfflineVoteRequest;
    }) => {
      const res = await apiClient.patch<ApiResponse<any>>(
        `/api/v1/client/votes/${eventId}/resolutions/${resolutionId}/offline-votes`,
        data
      );
      return res.data.data;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: clientVoteKeys.results(eventId) });
      popup.success("Offline Votes Recorded", "In-room vote counts have been saved.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to record offline votes."),
  });
}

/** Open voting on a resolution (event must be LIVE). */
export function useOpenResolutionVoting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      eventId,
      resolutionId,
      durationSeconds,
    }: {
      eventId:          string;
      resolutionId:     string;
      durationSeconds?: number;
    }) => {
      const body: Record<string, number> = {};
      if (durationSeconds != null) body.durationSeconds = durationSeconds;
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/client/votes/${eventId}/resolutions/${resolutionId}/open`,
        body
      );
      return res.data.data;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: clientVoteKeys.results(eventId) });
      popup.success("Voting Opened", "Participants can now vote on this resolution.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to open voting."),
  });
}

/** Close voting on a resolution. */
export function useCloseResolutionVoting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      eventId,
      resolutionId,
    }: {
      eventId:      string;
      resolutionId: string;
    }) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/client/votes/${eventId}/resolutions/${resolutionId}/close`
      );
      return res.data.data;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: clientVoteKeys.results(eventId) });
      popup.success("Voting Closed", "This resolution's voting period has ended.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to close voting."),
  });
}
