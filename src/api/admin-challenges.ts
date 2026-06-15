"use client";
/**
 * admin-challenges.ts — Innovation Challenges & Hackathons (Admin)
 *
 * GET  /api/v1/admin/challenges
 * GET  /api/v1/admin/challenges/overview
 * GET  /api/v1/admin/challenges/judging
 * GET  /api/v1/admin/challenges/filters/organisers
 * GET  /api/v1/admin/challenges/{challengeId}/applications
 * GET  /api/v1/admin/challenges/{challengeId}/applications/{applicationId}
 * PUT  /api/v1/admin/challenges/{challengeId}/applications/{applicationId}/status
 * POST /api/v1/admin/challenges/{challengeId}/judging/scores
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ApplicationStatus =
  | "SUBMITTED" | "UNDER_REVIEW" | "SHORTLISTED" | "SELECTED" | "NOT_PROGRESSED";

export interface ChallengeItem {
  id:               string;
  title:            string;
  organiserName:    string;
  date:             string;
  format:           string;
  shortlistedTeams: number;
  status:           string;
}

export interface ChallengeSummary {
  activeChallenges:  number;
  teamsToScore:      number;
  totalApplications: number;
}

export interface ChallengeListResponse {
  summary:    ChallengeSummary;
  totalCount: number;
  page:       number;
  size:       number;
  challenges: ChallengeItem[];
}

export interface ChallengeOverview {
  totalChallenges:     number;
  totalApplications:   number;
  shortlistedCount:    number;
  selectedCount:       number;
  underReviewCount:    number;
  submittedCount:      number;
  tracks:              Array<{ track: string; count: number }>;
}

export interface ApplicationItem {
  id:          string;
  teamName:    string;
  ideaTitle:   string;
  track:       string;
  memberCount: number;
  status:      string;
  score?:      number | null;
  submittedAt: string;
}

export interface ApplicationListResponse {
  content:       ApplicationItem[];
  totalElements: number;
  totalPages:    number;
}

export interface ApplicationDetail extends ApplicationItem {
  description?:    string;
  repositoryUrl?:  string;
  demoUrl?:        string;
  members?:        Array<{ id: string; fullName: string; email: string }>;
}

export interface JudgingPanelResponse {
  challengeId:   string;
  challengeTitle: string;
  shortlisted:   ApplicationItem[];
  criteria:      Array<{ name: string; weight: number }>;
}

export interface UpdateApplicationStatusRequest {
  status: ApplicationStatus;
  note?:  string;
}

export interface SubmitJudgingScoresRequest {
  scores: Array<{ applicationId: string; score: number; notes?: string }>;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const challengeKeys = {
  all:          ["adminChallenges"] as const,
  list:         (page: number, size: number) =>
                  ["adminChallenges", "list", { page, size }] as const,
  overview:     ["adminChallenges", "overview"] as const,
  judging:      ["adminChallenges", "judging"] as const,
  organisers:   ["adminChallenges", "organisers"] as const,
  applications: (id: string, status: string, page: number, size: number) =>
                  ["adminChallenges", id, "applications", { status, page, size }] as const,
  application:  (cId: string, aId: string) =>
                  ["adminChallenges", cId, "applications", aId] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Paginated challenge list. */
export function useAdminChallenges(search = "", organiserId = "", status = "", page = 0, size = 20) {
  return useQuery({
    queryKey: [...challengeKeys.list(page, size), search, organiserId, status] as const,
    queryFn: async () => {
      const params: Record<string, string | number> = { page, size };
      if (search)      params.search      = search;
      if (organiserId) params.organiserId = organiserId;
      if (status)      params.status      = status;
      const res = await apiClient.get<ApiResponse<ChallengeListResponse>>(
        "/api/v1/admin/challenges",
        { params }
      );
      return (res.data.data ?? (res.data as any)) as ChallengeListResponse;
    },
    staleTime: 30_000,
  });
}

/** Summary stats for the challenges dashboard. */
export function useAdminChallengesOverview() {
  return useQuery({
    queryKey: challengeKeys.overview,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ChallengeOverview>>(
        "/api/v1/admin/challenges/overview"
      );
      return res.data.data;
    },
    staleTime: 60_000,
  });
}

/** Judging panel with shortlisted teams + scoring criteria. */
export function useAdminChallengesJudging() {
  return useQuery({
    queryKey: challengeKeys.judging,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<JudgingPanelResponse>>(
        "/api/v1/admin/challenges/judging"
      );
      return res.data.data;
    },
    staleTime: 30_000,
  });
}

/** Organiser filter dropdown. */
export function useAdminChallengeOrganisers() {
  return useQuery({
    queryKey: challengeKeys.organisers,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        "/api/v1/admin/challenges/filters/organisers"
      );
      const raw = res.data.data;
      return (Array.isArray(raw) ? raw : raw?.organisers ?? raw?.content ?? []) as string[];
    },
    staleTime: 300_000,
  });
}

/** Applications for a specific challenge, with optional status filter. */
export function useAdminChallengeApplications(
  challengeId: string,
  status = "",
  page = 0,
  size = 50
) {
  return useQuery({
    queryKey: challengeKeys.applications(challengeId, status, page, size),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ApplicationListResponse>>(
        `/api/v1/admin/challenges/${challengeId}/applications`,
        { params: { ...(status ? { status } : {}), page, size } }
      );
      return res.data.data;
    },
    enabled: !!challengeId,
    staleTime: 30_000,
  });
}

/** Full detail for a single application. */
export function useAdminChallengeApplication(challengeId: string, applicationId: string) {
  return useQuery({
    queryKey: challengeKeys.application(challengeId, applicationId),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ApplicationDetail>>(
        `/api/v1/admin/challenges/${challengeId}/applications/${applicationId}`
      );
      return res.data.data;
    },
    enabled: !!challengeId && !!applicationId,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Move an application to a new status (e.g. SHORTLISTED, SELECTED). */
export function useUpdateApplicationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      challengeId,
      applicationId,
      data,
    }: {
      challengeId:   string;
      applicationId: string;
      data:          UpdateApplicationStatusRequest;
    }) => {
      const res = await apiClient.put<ApiResponse<any>>(
        `/api/v1/admin/challenges/${challengeId}/applications/${applicationId}/status`,
        data
      );
      return res.data.data;
    },
    onSuccess: (_, { challengeId }) => {
      queryClient.invalidateQueries({ queryKey: ["adminChallenges", challengeId] });
      queryClient.invalidateQueries({ queryKey: challengeKeys.overview });
      popup.success("Status Updated", "Application status has been changed.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Status update failed."),
  });
}

/** Submit judging scores for shortlisted teams. */
export function useSubmitJudgingScores() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      challengeId,
      data,
    }: {
      challengeId: string;
      data:        SubmitJudgingScoresRequest;
    }) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/admin/challenges/${challengeId}/judging/scores`,
        data
      );
      return res.data.data;
    },
    onSuccess: (_, { challengeId }) => {
      queryClient.invalidateQueries({ queryKey: ["adminChallenges", challengeId] });
      queryClient.invalidateQueries({ queryKey: challengeKeys.judging });
      popup.success("Scores Submitted", "Judging scores have been recorded.", 3000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Score submission failed."),
  });
}
