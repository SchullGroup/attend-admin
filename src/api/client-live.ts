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
import type { ZoomMeetingDto } from "@/api/client-events";
import type { RegisterBranding } from "@/types/super-admin";

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

export interface LiveQuestion {
  id:           string;
  content:      string;
  askerName:    string;
  anonymous:    boolean;
  submittedAt:  string;
  /** PENDING = awaiting moderation, APPROVED = visible to all, ANSWERED = has answer, REJECTED = hidden */
  status:       "PENDING" | "APPROVED" | "ANSWERED" | "REJECTED";
  answer?:      string;
  answeredBy?:  string;
  answeredAt?:  string;
}

/** @deprecated use LiveQuestion */
export type LivePendingQuestion = LiveQuestion;

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
  /** All questions (PENDING / APPROVED / ANSWERED). Filter by status client-side. */
  questions:         LiveQuestion[];
  /** @deprecated alias — same as questions */
  pendingQuestions?: LiveQuestion[];
  recentAttendance:  LiveAttendeeEntry[];
  /** Zoom meeting info — returned by some backend versions alongside the live snapshot */
  zoomMeeting?:      ZoomMeetingDto;
  /** Register branding (F4), inherited live — { logoUrl, brandColor }. Drives the control-room accent colour. */
  branding?:         RegisterBranding;
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
      // Normalise: backend may return field as "questions" or "pendingQuestions"
      if (!raw.questions) {
        raw.questions = (raw.pendingQuestions ?? []).map((q) => ({
          ...q,
          status: (q as any).status ?? "PENDING" as const,
        }));
      }
      return raw;
    },
    enabled:        !!eventId,
    refetchInterval: 4_000,
    staleTime:       3_000,
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
      // Send empty body — some backends return 400 if no JSON body is present on PATCH
      const res = await apiClient.patch<ApiResponse<Record<string, string>>>(
        `/api/v1/client/live/${eventId}/questions/${questionId}/approve`,
        {}
      );
      return res.data;
    },
    onSuccess: (_, { eventId, questionId }) => {
      toast.success("Question approved");
      // Optimistically update cached questions so the UI flips immediately
      qc.setQueryData<any>(liveKeys.detail(eventId), (old: any) => {
        if (!old?.questions) return old;
        return {
          ...old,
          questions: old.questions.map((q: any) =>
            q.id === questionId ? { ...q, status: "APPROVED" } : q
          ),
        };
      });
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
        `/api/v1/client/live/${eventId}/questions/${questionId}/reject`,
        {}
      );
      return res.data;
    },
    onSuccess: (_, { eventId, questionId }) => {
      toast.success("Question rejected");
      qc.setQueryData<any>(liveKeys.detail(eventId), (old: any) => {
        if (!old?.questions) return old;
        return {
          ...old,
          questions: old.questions.map((q: any) =>
            q.id === questionId ? { ...q, status: "REJECTED" } : q
          ),
        };
      });
      qc.invalidateQueries({ queryKey: liveKeys.detail(eventId) });
    },
    onError: (error) => parseAndToastApiError(error),
  });
}

/** Post an answer to an approved Q&A question. Broadcasts QUESTION_ANSWERED via WS. */
export function useAnswerQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      eventId,
      questionId,
      answer,
    }: {
      eventId:    string;
      questionId: string;
      answer:     string;
    }) => {
      const res = await apiClient.patch<ApiResponse<Record<string, string>>>(
        `/api/v1/client/live/${eventId}/questions/${questionId}/answer`,
        { answer }
      );
      return res.data;
    },
    onSuccess: (_, { eventId }) => {
      toast.success("Answer posted");
      qc.invalidateQueries({ queryKey: liveKeys.detail(eventId) });
    },
    onError: (error) => parseAndToastApiError(error),
  });
}
