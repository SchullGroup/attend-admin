"use client";
/**
 * judge.ts — Judge-role APIs
 *
 * GET  /api/v1/judge/judging                                          — list of challenges assigned to this judge
 * GET  /api/v1/judge/challenges/{challengeId}/scoring                 — shortlisted teams + criteria
 * GET  /api/v1/judge/challenges/{challengeId}/applications/{appId}    — full application detail for judge
 * POST /api/v1/judge/challenges/{challengeId}/applications/{appId}/score — submit score
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import { ApiResponse } from "@/types/api";

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
  score?:        number | null;
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
  all:         ["judge"] as const,
  judging:     ["judge", "judging"] as const,
  scoring:     (challengeId: string) => ["judge", challengeId, "scoring"] as const,
  application: (challengeId: string, applicationId: string) =>
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

/** Submit a score + comment for a single application. */
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
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/judge/challenges/${challengeId}/applications/${applicationId}/score`,
        data
      );
      return res.data.data;
    },
    onSuccess: (_, { challengeId }) => {
      queryClient.invalidateQueries({ queryKey: judgeKeys.scoring(challengeId) });
      popup.success("Score Submitted", "Your score has been recorded.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Score submission failed."),
  });
}
