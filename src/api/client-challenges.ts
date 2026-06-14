"use client";
/**
 * client-challenges.ts — Innovation Challenges & Hackathons (Client / Registrar)
 *
 * GET    /api/v1/client/challenges
 * GET    /api/v1/client/challenges/{challengeId}
 * GET    /api/v1/client/challenges/{challengeId}/applications
 * GET    /api/v1/client/challenges/{challengeId}/applications/{applicationId}
 * GET    /api/v1/client/challenges/{challengeId}/judging/leaderboard
 * PATCH  /api/v1/client/challenges/{challengeId}/applications/open
 * POST   /api/v1/client/challenges/{challengeId}/judges
 * PUT    /api/v1/client/challenges/{challengeId}/applications/{applicationId}/status
 * DELETE /api/v1/client/challenges/{challengeId}/judges/{judgeId}
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

export interface ChallengeSummary {
  activeChallenges:   number;
  teamsToScore:       number;
  totalApplications:  number;
}

export interface ChallengeListItem {
  id:               string;
  title:            string;
  organiserName:    string;
  date:             string;
  format:           string;
  shortlistedTeams: number;
  status:           string;
}

export interface ChallengeListResponse {
  summary:    ChallengeSummary;
  totalCount: number;
  page:       number;
  size:       number;
  challenges: ChallengeListItem[];
}

export interface PrizeTier {
  position: string;
  reward:   string;
}

export interface ChallengeDetail {
  id:                    string;
  title:                 string;
  description:           string;
  status:                string;
  applicationsOpen:      boolean;
  date:                  string;
  applicationCount:      number;
  shortlistedCount:      number;
  judgeCount:            number;
  topPrizePool:          string;
  applicationDeadline:   string;
  minTeamSize:           number;
  maxTeamSize:           number;
  tracks:                string[];
  prizeTiers:            PrizeTier[];
  problemStatement:      string;
  expectedDeliverable:   string;
  eligibilityCriteria:   string;
}

export interface ApplicationTab {
  key:   string;
  label: string;
  count: number;
}

export interface ApplicationItem {
  id:               string;
  teamInitial:      string;
  teamInitialColor: string;
  teamName:         string;
  ideaTitle:        string;
  track:            string;
  trackColor:       string;
  memberCount:      number;
  status:           string;
  statusColor:      string;
  score:            number | null;
  scoreOutOf:       number;
  hasScore:         boolean;
  submittedAt:      string;
  submittedLabel:   string;
}

export interface ApplicationListResponse {
  challengeId:   string;
  challengeTitle: string;
  organiserName: string;
  summary:       ChallengeSummary;
  tabs:          ApplicationTab[];
  totalCount:    number;
  page:          number;
  size:          number;
  applications:  ApplicationItem[];
}

export interface TeamMember {
  id:       string;
  fullName: string;
  email:    string;
}

export interface CriterionScore {
  criterion: string;
  weight:    number;
  score:     number;
}

export interface StatusHistoryEntry {
  status:    string;
  timestamp: string;
  by:        string;
  note:      string;
}

export interface ApplicationDetail {
  id:                  string;
  challengeId:         string;
  challengeTitle:      string;
  teamName:            string;
  teamInitial:         string;
  teamInitialColor:    string;
  ideaTitle:           string;
  track:               string;
  status:              string;
  score:               number | null;
  scoreOutOf:          number;
  hasScore:            boolean;
  submittedAt:         string;
  members:             TeamMember[];
  criteriaScores:      CriterionScore[];
  statusHistory:       StatusHistoryEntry[];
  // Submission content fields (present on detail fetch)
  ideaDescription?:    string;
  solutionDescription?: string;
  techStack?:          string;
  problemStatement?:   string;
  targetAudience?:     string;
  // Links
  presentationUrl?:    string;
  githubUrl?:          string;
  websiteUrl?:         string;
  videoUrl?:           string;
  pitchDeckUrl?:       string;
}

export interface LeaderboardEntry {
  rank:          number;
  applicationId: string;
  teamName:      string;
  track:         string;
  ideaTitle:     string;
  score:         number;
  status:        string;
}

export interface LeaderboardResponse {
  challengeId:    string;
  challengeTitle: string;
  results:        LeaderboardEntry[];
}

export interface JudgeItem {
  id:              string;
  initials:        string;
  color:           string;
  name:            string;
  organization:    string;
  specialtyTrack:  string;
  assignedCount:   number;
  scoredCount:     number;
  progressPercent: number;
}

export interface AddJudgeRequest {
  name:            string;
  organization:    string;
  specialtyTrack?: string;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const clientChallengeKeys = {
  all:         ["clientChallenges"] as const,
  list:        (search: string, status: string, page: number, size: number) =>
                 ["clientChallenges", "list", { search, status, page, size }] as const,
  detail:      (id: string) => ["clientChallenges", "detail", id] as const,
  applications:(id: string, status: string, track: string, page: number, size: number) =>
                 ["clientChallenges", id, "applications", { status, track, page, size }] as const,
  application: (cId: string, aId: string) =>
                 ["clientChallenges", cId, "applications", aId] as const,
  leaderboard: (id: string) => ["clientChallenges", id, "leaderboard"] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useClientChallenges(search = "", status = "", page = 0, size = 20) {
  return useQuery({
    queryKey: clientChallengeKeys.list(search, status, page, size),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ChallengeListResponse>>(
        "/api/v1/client/challenges",
        { params: { ...(search ? { search } : {}), ...(status ? { status } : {}), page, size } }
      );
      return res.data.data;
    },
    staleTime: 30_000,
  });
}

export function useClientChallengeDetail(challengeId: string) {
  return useQuery({
    queryKey: clientChallengeKeys.detail(challengeId),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ChallengeDetail>>(
        `/api/v1/client/challenges/${challengeId}`
      );
      return res.data.data;
    },
    enabled: !!challengeId,
    staleTime: 60_000,
  });
}

export function useClientChallengeApplications(
  challengeId: string,
  status = "",
  track = "",
  page = 0,
  size = 50
) {
  return useQuery({
    queryKey: clientChallengeKeys.applications(challengeId, status, track, page, size),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ApplicationListResponse>>(
        `/api/v1/client/challenges/${challengeId}/applications`,
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
    enabled: !!challengeId,
    staleTime: 30_000,
  });
}

export function useClientChallengeApplication(challengeId: string, applicationId: string) {
  return useQuery({
    queryKey: clientChallengeKeys.application(challengeId, applicationId),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ApplicationDetail>>(
        `/api/v1/client/challenges/${challengeId}/applications/${applicationId}`
      );
      return res.data.data;
    },
    enabled: !!challengeId && !!applicationId,
    staleTime: 60_000,
  });
}

export function useClientChallengeLeaderboard(challengeId: string) {
  return useQuery({
    queryKey: clientChallengeKeys.leaderboard(challengeId),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<LeaderboardResponse>>(
        `/api/v1/client/challenges/${challengeId}/judging/leaderboard`
      );
      return res.data.data;
    },
    enabled: !!challengeId,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useToggleApplicationsOpen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ challengeId, open }: { challengeId: string; open: boolean }) => {
      const res = await apiClient.patch<ApiResponse<any>>(
        `/api/v1/client/challenges/${challengeId}/applications/open`,
        { open }
      );
      return res.data.data;
    },
    onSuccess: (_, { challengeId, open }) => {
      queryClient.invalidateQueries({ queryKey: clientChallengeKeys.detail(challengeId) });
      popup.success(
        open ? "Applications Opened" : "Applications Closed",
        open ? "Participants can now apply." : "Applications are now closed.",
        2500
      );
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to update applications status."),
  });
}

export function useUpdateClientApplicationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      challengeId,
      applicationId,
      status,
    }: {
      challengeId:   string;
      applicationId: string;
      status:        ApplicationStatus;
    }) => {
      const res = await apiClient.put<ApiResponse<any>>(
        `/api/v1/client/challenges/${challengeId}/applications/${applicationId}/status`,
        { status }
      );
      return res.data.data;
    },
    onSuccess: (_, { challengeId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientChallenges", challengeId] });
      popup.success("Status Updated", "Application status changed.", 2000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Status update failed."),
  });
}

export function useAddJudge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      challengeId,
      data,
    }: {
      challengeId: string;
      data:        AddJudgeRequest;
    }) => {
      const res = await apiClient.post<ApiResponse<JudgeItem>>(
        `/api/v1/client/challenges/${challengeId}/judges`,
        data
      );
      return res.data.data;
    },
    onSuccess: (_, { challengeId }) => {
      queryClient.invalidateQueries({ queryKey: clientChallengeKeys.detail(challengeId) });
      popup.success("Judge Added", "New judge has been assigned to this challenge.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to add judge."),
  });
}

export function useRemoveJudge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ challengeId, judgeId }: { challengeId: string; judgeId: string }) => {
      await apiClient.delete(
        `/api/v1/client/challenges/${challengeId}/judges/${judgeId}`
      );
    },
    onSuccess: (_, { challengeId }) => {
      queryClient.invalidateQueries({ queryKey: clientChallengeKeys.detail(challengeId) });
      popup.success("Judge Removed", "Judge has been unassigned.", 2000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to remove judge."),
  });
}
