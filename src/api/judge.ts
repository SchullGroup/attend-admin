"use client";
/**
 * judge.ts — Judge-role APIs
 *
 * GET  /api/v1/judge/judging                                          — list of challenges assigned to this judge
 * GET  /api/v1/judge/challenges/{challengeId}/scoring                 — shortlisted teams + criteria
 * GET  /api/v1/judge/challenges/{challengeId}/applications/{appId}    — full application detail for judge
 * POST /api/v1/judge/challenges/{challengeId}/applications/{appId}/score — submit score
 * GET  /api/v1/judge/notifications                                    — judge notification feed
 * PATCH /api/v1/judge/notifications/{id}/read                         — mark notification read
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import { ApiResponse } from "@/types/api";
import type {
  ChallengeListResponse,
  ApplicationListResponse,
  LeaderboardResponse,
} from "@/api/client-challenges";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JudgeChallengeItem {
  id:               string;
  title:            string;
  type?:            string;   // e.g. "INNOVATION_CHALLENGE" | "HACKATHON" | "EVENT"
  organiserName?:   string;
  date?:            string;
  format?:          string;
  status?:          string;
  shortlistedCount?: number;
  scoredCount?:     number;
  pendingCount?:    number;
  totalCount?:      number;
}

export interface JudgeChallengeListResponse {
  challenges:  JudgeChallengeItem[];
  totalCount?: number;
}

export interface ScoringCriteria {
  name:        string;
  weight:      number;
  description?: string;
}

export interface ScoringApplication {
  applicationId: string;
  teamName:      string;
  ideaTitle?:    string;
  track?:        string;
  memberCount?:  number;
  rank?:         number;
  score?:        number | null;        // THIS judge's score (null = not scored yet)
  averageScore?: number | null;        // average across ALL judges
  judgeCount?:   number;              // how many judges have scored this team
  scored?:       boolean;
  comment?:      string | null;
  scoredAt?:     string | null;
}

export interface ScoringPanelResponse {
  challengeId:    string;
  challengeTitle: string;
  criteria:       ScoringCriteria[];
  applications:   ScoringApplication[];
  totalCount?:    number;
}

export interface SubmitScoreRequest {
  score:    number;
  comment?: string;
}

export interface SubmitScoreResponse {
  applicationId: string;
  teamName:      string;
  score:         number;        // this judge's updated score
  averageScore:  number;        // recomputed average
  comment?:      string;
}

export interface JudgeMember {
  id:       string;
  fullName: string;
  email:    string;
  role?:    string;
}

export interface JudgeCriterionScore {
  criterion: string;
  weight:    number;
  score:     number;
}

export interface JudgeStatusHistory {
  status:    string;
  timestamp: string;
  by:        string;
  note:      string;
}

export interface JudgeApplicationDetail {
  id:                     string;
  challengeId:            string;
  challengeTitle:         string;
  teamName:               string;
  teamInitial:            string;
  teamInitialColor:       string;
  ideaTitle:              string;
  ideaDescription?:       string;
  track:                  string;
  status:                 string;
  score:                  number | null;
  scoreOutOf:             number;
  hasScore:               boolean;
  submittedAt:            string;
  // Submission content
  projectDescription?:    string;
  // Media / links
  ideaVideoUrl?:          string;
  ideaSupportingDocUrl?:  string;
  sourceCodeUrl?:         string;
  liveDemoUrl?:           string;
  pitchDeckUrl?:          string;
  pitchVideoUrl?:         string;
  demoVideoUrl?:          string;
  additionalDocumentsUrl?: string;
  // Relations
  members:         JudgeMember[];
  criteriaScores:  JudgeCriterionScore[];
  statusHistory:   JudgeStatusHistory[];
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const judgeKeys = {
  all:           ["judge"] as const,
  notifications: ["judge", "notifications"] as const,
  judging:       ["judge", "judging"] as const,
  challenges:   (search: string, status: string, page: number, size: number) =>
                  ["judge", "challenges", { search, status, page, size }] as const,
  applications: (challengeId: string, status: string, track: string, page: number, size: number) =>
                  ["judge", challengeId, "applications", { status, track, page, size }] as const,
  leaderboard:  (challengeId: string) => ["judge", challengeId, "leaderboard"] as const,
  scoring:      (challengeId: string) => ["judge", challengeId, "scoring"] as const,
  application:  (challengeId: string, applicationId: string) =>
                  ["judge", challengeId, "application", applicationId] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** List of challenges assigned to the current judge. */
export function useJudgeEvents() {
  return useQuery({
    queryKey: judgeKeys.judging,
    queryFn:  async () => {
      const res = await apiClient.get<ApiResponse<JudgeChallengeListResponse>>(
        "/api/v1/judge/judging"
      );
      const raw = res.data.data ?? (res.data as any);
      const challenges: JudgeChallengeItem[] =
        raw?.challenges ?? (raw as any)?.content ?? (Array.isArray(raw) ? raw : []);
      return { challenges, totalCount: raw?.totalCount ?? challenges.length } as JudgeChallengeListResponse;
    },
    staleTime: 30_000,
  });
}

/** All challenges visible to the logged-in judge. */
export function useJudgeChallenges(search = "", status = "", page = 0, size = 50) {
  return useQuery({
    queryKey: judgeKeys.challenges(search, status, page, size),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ChallengeListResponse>>(
        "/api/v1/judge/challenges",
        { params: { ...(search ? { search } : {}), ...(status ? { status } : {}), page, size } }
      );
      const raw = (res.data.data ?? (res.data as any)) as any;
      return {
        summary:    raw?.summary    ?? { activeChallenges: 0, teamsToScore: 0, totalApplications: 0 },
        totalCount: raw?.totalCount ?? raw?.totalElements ?? 0,
        page:       raw?.page       ?? page,
        size:       raw?.size       ?? size,
        challenges: Array.isArray(raw) ? raw : (raw?.challenges ?? raw?.content ?? []),
      } as ChallengeListResponse;
    },
    staleTime: 30_000,
  });
}

/** Applications list for a challenge (judge view). */
export function useJudgeChallengeApplications(
  challengeId: string,
  status = "",
  track  = "",
  page   = 0,
  size   = 100
) {
  return useQuery({
    queryKey: judgeKeys.applications(challengeId, status, track, page, size),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ApplicationListResponse>>(
        `/api/v1/judge/challenges/${challengeId}/applications`,
        {
          params: {
            ...(status ? { status } : {}),
            ...(track  ? { track }  : {}),
            page,
            size,
          },
        }
      );
      return res.data.data;
    },
    enabled:   !!challengeId,
    staleTime: 30_000,
  });
}

/** Leaderboard for a challenge (judge view). */
export function useJudgeChallengeLeaderboard(challengeId: string) {
  return useQuery({
    queryKey: judgeKeys.leaderboard(challengeId),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<LeaderboardResponse>>(
        `/api/v1/judge/challenges/${challengeId}/judging/leaderboard`
      );
      return res.data.data;
    },
    enabled:   !!challengeId,
    staleTime: 30_000,
  });
}

/** Full application detail for a judge — idea, links, team, scores. */
export function useJudgeApplication(challengeId: string, applicationId: string) {
  return useQuery({
    queryKey: judgeKeys.application(challengeId, applicationId),
    queryFn:  async () => {
      const res = await apiClient.get<ApiResponse<JudgeApplicationDetail>>(
        `/api/v1/judge/challenges/${challengeId}/applications/${applicationId}`
      );
      return res.data.data;
    },
    enabled:   !!challengeId && !!applicationId,
    staleTime: 60_000,
  });
}

/** Shortlisted teams + scoring criteria for a specific challenge. */
export function useJudgeScoringPanel(challengeId: string) {
  return useQuery({
    queryKey: judgeKeys.scoring(challengeId),
    queryFn:  async () => {
      const res = await apiClient.get<ApiResponse<ScoringPanelResponse>>(
        `/api/v1/judge/challenges/${challengeId}/scoring`
      );
      const raw = res.data.data ?? (res.data as any);
      return {
        challengeId:    raw?.challengeId    ?? challengeId,
        challengeTitle: raw?.challengeTitle ?? "",
        criteria:       raw?.criteria       ?? [],
        applications:   raw?.applications   ?? (raw as any)?.shortlisted ?? (raw as any)?.teams ?? [],
        totalCount:     raw?.totalCount,
      } as ScoringPanelResponse;
    },
    enabled:   !!challengeId,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** POST — submit a score for the first time (upsert). */
export function useSubmitJudgeScore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      challengeId,
      applicationId,
      data,
    }: {
      challengeId:   string;
      applicationId: string;
      data:          SubmitScoreRequest;
    }) => {
      const res = await apiClient.post<ApiResponse<SubmitScoreResponse>>(
        `/api/v1/judge/challenges/${challengeId}/applications/${applicationId}/score`,
        data
      );
      return (res.data.data ?? res.data) as SubmitScoreResponse;
    },
    onSuccess: (_, { challengeId }) => {
      queryClient.invalidateQueries({ queryKey: judgeKeys.scoring(challengeId) });
      popup.success("Score Submitted", "Your score has been recorded.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Score submission failed."),
  });
}

/**
 * PATCH — update an existing score and recompute rankings.
 * Returns 409 if scoring is closed.
 */
export function useUpdateJudgeScore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      challengeId,
      applicationId,
      data,
    }: {
      challengeId:   string;
      applicationId: string;
      data:          SubmitScoreRequest;
    }) => {
      const res = await apiClient.patch<ApiResponse<SubmitScoreResponse>>(
        `/api/v1/judge/challenges/${challengeId}/applications/${applicationId}/score`,
        data
      );
      return (res.data.data ?? res.data) as SubmitScoreResponse;
    },
    onSuccess: (_, { challengeId }) => {
      queryClient.invalidateQueries({ queryKey: judgeKeys.scoring(challengeId) });
      popup.success("Score Updated", "Your score has been updated.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Score update failed."),
  });
}

// ---------------------------------------------------------------------------
// Judge Notifications — GET /api/v1/judge/notifications
// ---------------------------------------------------------------------------

export interface JudgeNotificationItem {
  id:          string;
  title:       string;
  message:     string;
  read:        boolean;
  type:        string;
  referenceId?: string;
  createdAt:   string;
}

export interface JudgeNotificationListResponse {
  unreadCount:   number;
  page:          number;
  limit:         number;
  totalCount:    number;
  notifications: JudgeNotificationItem[];
}

export const judgeNotificationKeys = {
  all:  ["judge", "notifications"] as const,
  list: (page: number, limit: number, read?: boolean) =>
          ["judge", "notifications", "list", page, limit, read] as const,
};

/** GET /api/v1/judge/notifications */
export function useJudgeNotifications(page = 0, limit = 10, read?: boolean, enabled = true) {
  return useQuery({
    queryKey: judgeNotificationKeys.list(page, limit, read),
    enabled,
    queryFn: async () => {
      const params: Record<string, string> = {
        page:  page.toString(),
        limit: limit.toString(),
      };
      if (read !== undefined) params.read = read.toString();
      const res = await apiClient.get<ApiResponse<JudgeNotificationListResponse>>(
        "/api/v1/judge/notifications",
        { params }
      );
      // Normalise: backend may return data at root or nested under .data
      const raw = (res.data.data ?? res.data) as any;
      return {
        ...raw,
        notifications: raw?.notifications ?? raw?.content ?? [],
        totalCount:    raw?.totalCount    ?? raw?.totalElements ?? 0,
        unreadCount:   raw?.unreadCount   ?? raw?.totalUnread   ?? 0,
      } as JudgeNotificationListResponse;
    },
    refetchInterval:             30_000,
    refetchIntervalInBackground: false,
    staleTime:                   20_000,
  });
}

/** PATCH /api/v1/judge/notifications/{id}/read */
export function useMarkJudgeNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.patch<ApiResponse<string>>(
        `/api/v1/judge/notifications/${id}/read`
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: judgeNotificationKeys.all });
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to mark notification as read."),
  });
}
