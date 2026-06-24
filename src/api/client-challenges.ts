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
  activeChallenges:  number;
  teamsToScore?:     number;   // legacy
  shortlisted?:      number;   // API field
  selected?:         number;   // API field
  totalApplications: number;
}

export interface ChallengeListItem {
  id:                 string;
  title:              string;
  organiserName:      string;
  date:               string;
  format:             string;
  applicationCount?:  number;   // total submissions
  shortlistedTeams?:  number;   // legacy
  shortlistedCount?:  number;   // API field
  status:             string;
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

export interface SubmissionRequirements {
  requireSourceCode:           boolean;
  requireLiveDemoUrl:          boolean;
  requireProjectDescription:   boolean;
  requirePitchDeck:            boolean;
  requirePitchVideoUrl:        boolean;
  requireDemoVideo:            boolean;
  requireAdditionalDocuments:  boolean;
}

export interface ChallengeDetail {
  id:                      string;
  title:                   string;
  description:             string;
  status:                  string;
  applicationsOpen:        boolean;
  date:                    string;
  applicationCount:        number;
  shortlistedCount:        number;
  judgeCount:              number;
  topPrizePool:            string;
  applicationDeadline:     string;
  minTeamSize:             number;
  maxTeamSize:             number;
  tracks:                  string[];
  prizeTiers:              PrizeTier[];
  problemStatement:        string;
  expectedDeliverable:     string;
  eligibilityCriteria:     string;
  submissionRequirements?: SubmissionRequirements;
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
  id:        string;
  name?:     string;     // API field
  fullName?: string;     // legacy alias
  email:     string;
  role?:     string | null;
  lead?:     boolean;
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
  id:                    string;
  challengeId:           string;
  challengeTitle:        string;
  teamName:              string;
  teamInitial:           string;
  teamInitialColor:      string;
  ideaTitle:             string;
  ideaDescription?:      string;
  track:                 string;
  status:                string;
  score:                 number | null;
  scoreOutOf:            number;
  hasScore:              boolean;
  submittedAt:           string;
  members:               TeamMember[];
  criteriaScores:        CriterionScore[];
  statusHistory:         StatusHistoryEntry[];
  // Submission content
  projectDescription?:   string;
  solutionDescription?:  string;
  techStack?:            string;
  problemStatement?:     string;
  targetAudience?:       string;
  // Media / document links
  ideaVideoUrl?:         string;
  ideaSupportingDocUrl?: string;
  sourceCodeUrl?:        string;
  liveDemoUrl?:          string;
  pitchDeckUrl?:         string;
  pitchVideoUrl?:        string;
  demoVideoUrl?:         string;
  additionalDocumentsUrl?: string;
  // Legacy link fields (kept for backwards compat)
  presentationUrl?:      string;
  githubUrl?:            string;
  websiteUrl?:           string;
  videoUrl?:             string;
}

export interface LeaderboardEntry {
  rank:          number;
  applicationId: string;
  teamName:      string;
  track:         string;
  ideaTitle:     string;
  score:         number;   // average across all judges who scored this entry
  averageScore?: number;   // alias returned by some API versions
  judgeCount?:   number;   // number of judges who have scored this entry
  status:        string;
}

export interface LeaderboardResponse {
  challengeId:    string;
  challengeTitle: string;
  results:        LeaderboardEntry[];
}

export interface JudgeItem {
  id:              string;
  userId?:         string;
  initials?:       string;
  color?:          string;
  name:            string;
  organization?:   string;
  specialtyTrack?: string;
  assignedCount:   number;
  scoredCount:     number;
  progressPercent: number;
}

export interface JudgePoolItem {
  id:            string;
  name:          string;
  email?:        string;
  organization?: string;
}

export interface JudgePoolResponse {
  judges:      JudgePoolItem[];
  totalCount?: number;
}

/** Full judge panel for a challenge — GET /challenges/{id}/judges */
export interface JudgePanelResponse {
  challengeId:    string;
  challengeTitle?: string;
  tracks?:        string[];
  topPrizePool?:  string;
  judges:         JudgeItem[];
}

export interface AddJudgeRequest {
  userId?:         string;
  name:            string;
  email?:          string;
  organization?:   string;
  specialtyTrack?: string;
}

export interface AssignJudgeRequest {
  specialtyTrack?: string;
}

/** Export response for GET /challenges/{id}/export/applications */
export interface ExportApplicationMember {
  fullName: string;
  email:    string;
  role?:    string;
  lead?:    boolean;
}

export interface ExportApplicationItem {
  teamName:              string;
  track?:                string;
  ideaTitle?:            string;
  ideaDescription?:      string;
  leadName?:             string;
  leadEmail?:            string;
  memberCount?:          number;
  members?:              ExportApplicationMember[];
  status:                string;
  score?:                number | null;
  submittedAt?:          string;
  ideaVideoUrl?:         string;
  ideaSupportingDocUrl?: string;
  sourceCodeUrl?:        string;
  liveDemoUrl?:          string;
  projectDescription?:   string;
  pitchDeckUrl?:         string;
  pitchVideoUrl?:        string;
  demoVideoUrl?:         string;
  additionalDocumentsUrl?: string;
}

export interface ExportApplicationsResponse {
  challengeId:    string;
  challengeTitle: string;
  exportedAt:     string;
  total:          number;
  applications:   ExportApplicationItem[];
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
  judges:      (id: string) => ["clientChallenges", id, "judges"] as const,
  exportApps:  (id: string, from?: string, to?: string) =>
                 ["clientChallenges", id, "export", "applications", { from, to }] as const,
};

export const judgePoolKeys = {
  all:  ["clientJudgePool"] as const,
  list: () => ["clientJudgePool", "list"] as const,
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
      // Handle both enveloped ({ status, data: { challenges } }) and flat responses
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

/** GET /challenges/{id}/judges — full judge panel with progress per track */
export function useClientChallengeJudges(challengeId: string) {
  return useQuery({
    queryKey: clientChallengeKeys.judges(challengeId),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        `/api/v1/client/challenges/${challengeId}/judges`
      );
      const raw: any = res.data.data ?? res.data;
      const judges: JudgeItem[] =
        Array.isArray(raw) ? raw : (raw?.judges ?? []);
      return {
        challengeId:    raw?.challengeId    ?? challengeId,
        challengeTitle: raw?.challengeTitle ?? "",
        tracks:         raw?.tracks         ?? [],
        topPrizePool:   raw?.topPrizePool   ?? "",
        judges,
      } as JudgePanelResponse;
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
      // Invalidate the entire clientChallenges cache so the list shortlisted
      // count and the detail application list both refresh automatically.
      queryClient.invalidateQueries({ queryKey: clientChallengeKeys.all });
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
      queryClient.invalidateQueries({ queryKey: clientChallengeKeys.judges(challengeId) });
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
      queryClient.invalidateQueries({ queryKey: clientChallengeKeys.judges(challengeId) });
      popup.success("Judge Removed", "Judge has been unassigned.", 2000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to remove judge."),
  });
}

/** Full judge pool for this registrar — GET /api/v1/client/judges */
export function useGetJudgePool() {
  return useQuery({
    queryKey: judgePoolKeys.list(),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<JudgePoolResponse>>(
        "/api/v1/client/judges"
      );
      const raw = res.data.data ?? (res.data as any);
      return (Array.isArray(raw) ? raw : (raw as any)?.judges ?? []) as JudgePoolItem[];
    },
    staleTime: 30_000,
  });
}

/** Add a judge to the registrar's pool — POST /api/v1/client/judges */
export function useAddJudgeToPool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: AddJudgeRequest) => {
      const res = await apiClient.post<ApiResponse<JudgePoolItem>>(
        "/api/v1/client/judges",
        data
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: judgePoolKeys.all });
    },
    // 409 = already exists — caller handles it; other errors get toasted
    onError: (error: any) => {
      if (error?.response?.status !== 409) {
        parseAndToastApiError(error, "Failed to add judge to pool.");
      }
    },
  });
}

/** Fetch pool directly (used for 409 recovery) */
export async function fetchJudgePool(): Promise<JudgePoolItem[]> {
  const res = await apiClient.get<ApiResponse<JudgePoolResponse>>("/api/v1/client/judges");
  const raw = res.data.data ?? (res.data as any);
  return (Array.isArray(raw) ? raw : (raw as any)?.judges ?? []) as JudgePoolItem[];
}

/** Assign a pool judge to a challenge — POST /api/v1/client/challenges/{id}/judges/{judgeId}/assign */
export function useAssignJudge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      challengeId,
      judgeId,
      data = {},
    }: {
      challengeId: string;
      judgeId:     string;
      data?:       AssignJudgeRequest;
    }) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/client/challenges/${challengeId}/judges/${judgeId}/assign`,
        data
      );
      return res.data.data;
    },
    onSuccess: (_, { challengeId }) => {
      queryClient.invalidateQueries({ queryKey: clientChallengeKeys.judges(challengeId) });
      queryClient.invalidateQueries({ queryKey: clientChallengeKeys.detail(challengeId) });
      popup.success("Judge Assigned", "Judge has been assigned to this challenge.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to assign judge."),
  });
}

/** Remove a judge from the registrar's pool — DELETE /api/v1/client/judges/{judgeId} */
export function useRemoveJudgeFromPool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (judgeId: string) => {
      await apiClient.delete(`/api/v1/client/judges/${judgeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: judgePoolKeys.all });
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to remove judge from pool."),
  });
}

/**
 * PATCH /challenges/{id}/scoring/open
 * Pass { open: true } to allow judges to score, { open: false } to stop scoring.
 */
export function useToggleScoring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ challengeId, open }: { challengeId: string; open: boolean }) => {
      const res = await apiClient.patch<ApiResponse<any>>(
        `/api/v1/client/challenges/${challengeId}/scoring/open`,
        { open }
      );
      return res.data.data;
    },
    onSuccess: (_, { challengeId, open }) => {
      queryClient.invalidateQueries({ queryKey: clientChallengeKeys.detail(challengeId) });
      popup.success(
        open ? "Scoring Opened" : "Scoring Closed",
        open ? "Judges can now submit scores." : "No new scores will be accepted.",
        2500
      );
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to update scoring status."),
  });
}

/**
 * GET /challenges/{id}/export/applications?from=&to=
 * Returns all applications with full detail. enabled:false — caller calls refetch().
 */
export function useExportChallengeApplications(
  challengeId: string,
  from?: string,
  to?: string
) {
  return useQuery({
    queryKey: clientChallengeKeys.exportApps(challengeId, from, to),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (from) params.from = from;
      if (to)   params.to   = to;
      const res = await apiClient.get<ApiResponse<ExportApplicationsResponse>>(
        `/api/v1/client/challenges/${challengeId}/export/applications`,
        { params }
      );
      return res.data.data;
    },
    enabled: false,
    staleTime: 0,
  });
}

/** Toggle which submission fields applicants must fill in. */
export function useUpdateSubmissionRequirements() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      challengeId,
      data,
    }: {
      challengeId: string;
      data: Partial<SubmissionRequirements>;
    }) => {
      const res = await apiClient.patch<ApiResponse<any>>(
        `/api/v1/client/challenges/${challengeId}/submission-requirements`,
        data
      );
      return res.data.data;
    },
    onSuccess: (_, { challengeId }) => {
      queryClient.invalidateQueries({ queryKey: clientChallengeKeys.detail(challengeId) });
      popup.success("Saved", "Submission requirements updated.", 2000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to update requirements."),
  });
}
