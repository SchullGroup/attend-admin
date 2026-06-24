"use client";

/**
 * client-live.ts — Live Control Room API
 *
 * Endpoints under /api/v1/client/live/{eventId}
 * Provides real-time snapshots and Q&A moderation for in-progress events.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { parseAndToastApiError } from "@/lib/api-error";
import { ApiResponse } from "@/types/api";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LiveResolution {
  id:                string;
  order:             number;
  title:             string;
  description?:      string;
  specialResolution: boolean;
  /** PENDING = not yet open, OPEN = voting active, CLOSED = voting ended */
  status:            "PENDING" | "OPEN" | "CLOSED";
  myVote?:           string;
  votingDeadline?:   string;
  secondsRemaining?: number;
  forCount:          number;
  againstCount:      number;
  abstainCount:      number;
  forShares:         number;
  againstShares:     number;
  abstainShares:     number;
}

export interface LivePendingQuestion {
  id:          string;
  content:     string;
  askerName:   string;
  anonymous:   boolean;
  submittedAt: string;
}

export interface LiveAttendeeEntry {
  name:     string;
  initials: string;
  mode:     string;
  joinedAt: string;
}

export interface LiveRoomDetail {
  eventId:           string;
  title:             string;
  organiserName:     string;
  venue?:            string;
  format:            string;
  eventType:         string;
  status:            string;
  streamUrl?:        string;
  attendeeCount:     number;
  checkedInCount:    number;
  capacity?:         number;
  elapsedMinutes:    number;
  quorumPct?:        number;
  requiredQuorumPct?: number;
  resolutions:       LiveResolution[];
  pendingQuestions:  LivePendingQuestion[];
  recentAttendance:  LiveAttendeeEntry[];
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const liveKeys = {
  detail:     (eventId: string) => ["live", "detail",     eventId] as const,
  attendance: (eventId: string) => ["live", "attendance", eventId] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Full live-room snapshot for a single event.
 * Polls every 15 seconds so counts stay fresh without WebSocket setup.
 */
export function useLiveRoomDetail(eventId: string | null | undefined) {
  return useQuery({
    queryKey: liveKeys.detail(eventId ?? ""),
    queryFn:  async () => {
      const res = await apiClient.get<ApiResponse<LiveRoomDetail>>(
        `/api/v1/client/live/${eventId}`
      );
      const raw = (res.data.data ?? (res.data as any)) as LiveRoomDetail;
      return raw;
    },
    enabled:        !!eventId,
    refetchInterval: 15_000,
    staleTime:       10_000,
  });
}

/**
 * 20 most-recent check-ins for the event.
 * Polls every 10 seconds.
 */
export function useLiveAttendance(eventId: string | null | undefined) {
  return useQuery({
    queryKey: liveKeys.attendance(eventId ?? ""),
    queryFn:  async () => {
      const res = await apiClient.get<ApiResponse<LiveAttendeeEntry[]>>(
        `/api/v1/client/live/${eventId}/attendance`
      );
      const raw = (res.data.data ?? (res.data as any)) as LiveAttendeeEntry[];
      return Array.isArray(raw) ? raw : [];
    },
    enabled:        !!eventId,
    refetchInterval: 10_000,
    staleTime:       8_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Approve a pending Q&A question. Broadcasts QUESTION_MODERATED via WS. */
export function useApproveQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, questionId }: { eventId: string; questionId: string }) => {
      const res = await apiClient.patch<ApiResponse<Record<string, string>>>(
        `/api/v1/client/live/${eventId}/questions/${questionId}/approve`
      );
      return res.data;
    },
    onSuccess: (_, { eventId }) => {
      toast.success("Question approved");
      qc.invalidateQueries({ queryKey: liveKeys.detail(eventId) });
    },
    onError: (error) => parseAndToastApiError(error),
  });
}

/** Reject a pending Q&A question. Broadcasts QUESTION_MODERATED via WS. */
export function useRejectQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, questionId }: { eventId: string; questionId: string }) => {
      const res = await apiClient.patch<ApiResponse<Record<string, string>>>(
        `/api/v1/client/live/${eventId}/questions/${questionId}/reject`
      );
      return res.data;
    },
    onSuccess: (_, { eventId }) => {
      toast.success("Question rejected");
      qc.invalidateQueries({ queryKey: liveKeys.detail(eventId) });
    },
    onError: (error) => parseAndToastApiError(error),
  });
}
