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
import { clientEventKeys } from "@/api/client-events";
import { liveKeys } from "@/api/client-live";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VoteListItem {
  id:                 string;
  eventId?:           string;   // alias — some shapes return eventId instead
  title:              string;
  stakeholderName?:   string;
  registerId?:        string;
  registerName?:      string;
  date:               string;
  dateLabel?:         string;
  totalResolutions?:  number;
  resolutionCount?:   number;   // alias
  closedResolutions?: number;
  resolutionLabel?:   string;
  votesCast?:         number;
  totalVotesCast?:    number;   // alias
  votesCastLabel?:    string;
  status:             string;
  canManageVotes?:    boolean;
}

export interface VoteListResponse {
  totalCount:  number;
  page:        number;
  size:        number;
  records:     VoteListItem[];
  events?:     VoteListItem[];   // alias in case old shape is returned
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
  // Whether tallies show share-weighted totals in addition to headcount.
  // API field name isn't confirmed yet — normalized from common aliases in the hook below.
  shareWeightedTalliesEnabled?: boolean;
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

export interface CreateResolutionRequest {
  title:                   string;
  description?:            string;
  specialResolution?:      boolean;
  votingDeadline?:         string;   // ISO datetime e.g. "2026-06-22T18:00:00"
  order?:                  number;
  defaultDurationSeconds?: number;
}

export interface ExportResolutionItem {
  order:             number;
  title:             string;
  specialResolution: boolean;
  status:            string;
  forCount:          number;
  againstCount:      number;
  abstainCount:      number;
  forShares:         number;
  againstShares:     number;
  abstainShares:     number;
  totalVotes:        number;
  result:            string;
}

export interface ExportResolutionsResponse {
  eventId:     string;
  eventTitle:  string;
  eventDate:   string;
  exportedAt:  string;
  total:       number;
  resolutions: ExportResolutionItem[];
}

export interface ResolutionItem {
  id:                  string;
  order?:              number;
  title:               string;
  description?:        string;
  isSpecialResolution?: boolean;
  specialResolution?:  boolean;
  status?:             string;
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
  export:  (eventId: string) => ["clientVotes", "export", eventId] as const,
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
      const raw = (res.data.data ?? (res.data as any)) as any;
      return {
        totalCount: raw?.totalCount ?? raw?.totalElements ?? 0,
        page:       raw?.page       ?? page,
        size:       raw?.size       ?? size,
        records:    raw?.records    ?? raw?.events ?? raw?.content ?? [],
      } as VoteListResponse;
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
      const raw = res.data.data as any;
      if (!raw) return raw as VoteResultsResponse;
      // Normalize whichever alias the backend uses for the share-weighted toggle.
      const shareWeightedTalliesEnabled =
        raw.shareWeightedTalliesEnabled ??
        raw.shareWeightedTallies ??
        raw.weightedTalliesEnabled ??
        raw.showShareWeightedTallies ??
        false;
      return { ...raw, shareWeightedTalliesEnabled } as VoteResultsResponse;
    },
    enabled: !!eventId,
    staleTime: 15_000,
    refetchInterval: 15_000, // live refresh every 15 s during voting
  });
}

/** Export all resolutions for an event as structured data (for CSV download). */
export function useExportResolutions(eventId: string) {
  return useQuery({
    queryKey: clientVoteKeys.export(eventId),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ExportResolutionsResponse>>(
        `/api/v1/client/votes/${eventId}/export/resolutions`
      );
      return res.data.data;
    },
    enabled: false, // only fetch on demand
    staleTime: 0,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * PATCH /api/v1/client/votes/{eventId}/config/share-weighted-tallies
 * Toggle whether vote tallies show only headcount (false) or headcount +
 * share-weighted totals, using each shareholder's Units from the register.
 */
export function useSetShareWeightedTallies() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, enabled }: { eventId: string; enabled: boolean }) => {
      const res = await apiClient.patch<ApiResponse<any>>(
        `/api/v1/client/votes/${eventId}/config/share-weighted-tallies`,
        { enabled }
      );
      return res.data.data;
    },
    onSuccess: (_, { eventId, enabled }) => {
      queryClient.invalidateQueries({ queryKey: clientVoteKeys.results(eventId) });
      popup.success(
        enabled ? "Share-Weighted Tallies On" : "Share-Weighted Tallies Off",
        enabled
          ? "Vote tallies now show share-weighted totals alongside headcount."
          : "Vote tallies now show headcount only.",
        2500
      );
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to update tally display setting."),
  });
}

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
      queryClient.invalidateQueries({ queryKey: liveKeys.detail(eventId) });
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
      queryClient.invalidateQueries({ queryKey: liveKeys.detail(eventId) });
      popup.success("Voting Closed", "This resolution's voting period has ended.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to close voting."),
  });
}

/**
 * Add a new resolution to an AGM/EGM event.
 * POST /api/v1/client/votes/{eventId}/resolutions
 * Invalidates the event detail cache so agmConfig.resolutions refreshes.
 */
export function useAddResolution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      eventId,
      data,
    }: {
      eventId: string;
      data:    CreateResolutionRequest;
    }) => {
      const res = await apiClient.post<ApiResponse<ResolutionItem>>(
        `/api/v1/client/votes/${eventId}/resolutions`,
        data
      );
      return (res.data.data ?? (res.data as any)) as ResolutionItem;
    },
    onSuccess: (_, { eventId }) => {
      // Refresh agmConfig.resolutions in the event detail
      queryClient.invalidateQueries({ queryKey: clientEventKeys.detail(eventId) });
      // Also refresh vote results if they're open
      queryClient.invalidateQueries({ queryKey: clientVoteKeys.results(eventId) });
      popup.success("Resolution Added", "The resolution has been saved.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to add resolution."),
  });
}
