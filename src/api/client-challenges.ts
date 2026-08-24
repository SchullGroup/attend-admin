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
import { parseAndToastApiError, getApiErrorCode } from "@/lib/api-error";
import { ApiResponse } from "@/types/api";
import type { RegisterBranding } from "@/types/super-admin";

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
  /** Register branding (AGM handoff #10), resolved from the register that created this challenge. */
  branding?:          RegisterBranding;
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
  participationType?:      "SOLO" | "TEAM" | "SOLO_AND_TEAM";
  prizeTiers:              PrizeTier[];
  problemStatement:        string;
  expectedDeliverable:     string;
  eligibilityCriteria:     string;
  submissionRequirements?: SubmissionRequirements;
  /** Register branding (AGM handoff #10), resolved from the register that created this challenge. */
  branding?:               RegisterBranding;
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

// ---------------------------------------------------------------------------
// Judge Application Assignment types
// ---------------------------------------------------------------------------

export interface JudgeAssignment {
  judgeId:     string;
  judgeName?:  string;
  judgeEmail?: string;
  name?:       string;   // alias returned by some API versions
  role:        "PRIMARY" | "CO_JUDGE";
}

export interface ApplicationAssignmentsResponse {
  applicationId: string;
  teamName?:     string;
  judges:        JudgeAssignment[];
}

export interface BulkAssignEntry {
  applicationId: string;
  judgeId:       string;
}

export interface BulkAssignResponse {
  eventId:  string;
  assigned: number;
}

export interface AutoDistributeResponse {
  eventId:       string;
  totalAssigned: number;
  tracks:        string[];
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
  assignmentsPerApp: (challengeId: string, appId: string) =>
                 ["clientChallenges", challengeId, "applications", appId, "assignments"] as const,
  winnersPreview: (id: string) => ["clientChallenges", id, "winners", "preview"] as const,
  winnerAnnouncement: (id: string, announcementId: string) =>
                 ["clientChallenges", id, "winners", "announcement", announcementId] as const,
  winnerAnnouncementLatest: (id: string) =>
                 ["clientChallenges", id, "winners", "announcement", "latest"] as const,
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

export function useClientChallengeDetail(challengeId: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clientChallengeKeys.detail(challengeId),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ChallengeDetail>>(
        `/api/v1/client/challenges/${challengeId}`
      );
      return res.data.data;
    },
    enabled: !!challengeId && (opts?.enabled ?? true),
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

// ---------------------------------------------------------------------------
// Application-level assignment hooks (bulk assign, auto-distribute, co-judges)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Judge Application Assignment hooks
// ---------------------------------------------------------------------------

/** GET /challenges/{id}/applications/{appId}/assignments */
export function useApplicationJudgeAssignments(
  challengeId:   string,
  applicationId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: clientChallengeKeys.assignmentsPerApp(challengeId, applicationId),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ApplicationAssignmentsResponse>>(
        `/api/v1/client/challenges/${challengeId}/applications/${applicationId}/assignments`
      );
      return res.data.data;
    },
    enabled: !!challengeId && !!applicationId && enabled,
    staleTime: 30_000,
  });
}

/**
 * POST /challenges/{id}/applications/assign
 * Body: { assignments: [{ applicationId, judgeId }] }
 * Assigns a primary judge to each listed application.
 */
export function useBulkAssignJudges() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      challengeId,
      assignments,
    }: {
      challengeId:  string;
      assignments:  { applicationId: string; judgeId: string }[];
    }) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/client/challenges/${challengeId}/applications/assign`,
        { assignments }
      );
      return res.data.data;
    },
    onSuccess: (_, { challengeId }) => {
      queryClient.invalidateQueries({ queryKey: clientChallengeKeys.all });
      popup.success("Judges Assigned", "Applications have been assigned to the selected judge.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Bulk assignment failed."),
  });
}

/**
 * POST /challenges/{id}/applications/auto-distribute?track=X
 * Round-robin distributes applications across all assigned judges.
 * Omit track to distribute all tracks.
 */
export function useAutoDistributeJudges() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      challengeId,
      track,
    }: {
      challengeId: string;
      track?:      string;
    }) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/client/challenges/${challengeId}/applications/auto-distribute`,
        null,
        { params: track ? { track } : {} }
      );
      return res.data.data;
    },
    onSuccess: (_, { challengeId }) => {
      queryClient.invalidateQueries({ queryKey: clientChallengeKeys.all });
      popup.success(
        "Auto-Distributed",
        "Applications have been distributed across judges via round-robin.",
        2500
      );
    },
    onError: (error: any) => parseAndToastApiError(error, "Auto-distribute failed."),
  });
}

/** POST /challenges/{id}/applications/{appId}/co-judges/{judgeId} */
export function useAddCoJudge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      challengeId,
      applicationId,
      judgeId,
    }: {
      challengeId:   string;
      applicationId: string;
      judgeId:       string;
    }) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/client/challenges/${challengeId}/applications/${applicationId}/co-judges/${judgeId}`
      );
      return res.data.data;
    },
    onSuccess: (_, { challengeId, applicationId }) => {
      queryClient.invalidateQueries({
        queryKey: clientChallengeKeys.assignmentsPerApp(challengeId, applicationId),
      });
      popup.success("Co-Judge Added", "Co-judge has been added to this application.", 2000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to add co-judge."),
  });
}

/** DELETE /challenges/{id}/applications/{appId}/co-judges/{judgeId} */
export function useRemoveCoJudge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      challengeId,
      applicationId,
      judgeId,
    }: {
      challengeId:   string;
      applicationId: string;
      judgeId:       string;
    }) => {
      await apiClient.delete(
        `/api/v1/client/challenges/${challengeId}/applications/${applicationId}/co-judges/${judgeId}`
      );
    },
    onSuccess: (_, { challengeId, applicationId }) => {
      queryClient.invalidateQueries({
        queryKey: clientChallengeKeys.assignmentsPerApp(challengeId, applicationId),
      });
      popup.success("Co-Judge Removed", "Co-judge has been removed from this application.", 2000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to remove co-judge."),
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

// ---------------------------------------------------------------------------
// Winner announcement & certificates  (backend spec: dave-innov.md item 68)
//
//   An INNOVATION_CHALLENGE / HACKATHON event IS the challenge, so `challengeId`
//   here doubles as the eventId used by these client/event-scoped routes.
//
//   Winners = applications explicitly moved to SELECTED, intersected with the
//   final leaderboard placement (ties share a position; unscored SELECTED apps
//   are silently excluded by the backend). The FE never computes or submits the
//   winner set — it only approves a message + delivery channels.
//
//   Response DTOs are inferred from the spec and parsed tolerantly — confirm the
//   exact field names against staging once the backend deploys.
// ---------------------------------------------------------------------------

export interface WinnerMember {
  memberId?:         string;
  name:              string;
  email?:            string;
  hasAttendAccount?: boolean;        // eligible for in-app notification
  certificateId?:    string | null;  // present once certificates are issued
}

export interface WinnerTeam {
  applicationId: string;
  teamName:      string;
  ideaTitle?:    string;
  track?:        string;
  finalPosition: number;             // tie-aware (1, 2, 2, 4 …)
  members:       WinnerMember[];
}

export interface WinnerPreviewResponse {
  eventId:          string;
  eventTitle?:      string;
  winners:          WinnerTeam[];
  totalTeams?:      number;
  totalRecipients?: number;
  emailRecipients?: number;
  inAppRecipients?: number;
  defaultMessage:   string;          // generated, organiser-editable (no prize info)
}

export type WinnerAnnouncementStatus =
  | "PENDING" | "PROCESSING" | "COMPLETED" | "COMPLETED_WITH_ERRORS" | "FAILED";

export interface WinnerAnnouncementFailure {
  recipient?: string;
  reason?:    string;
}

export interface WinnerAnnouncement {
  announcementId:      string;
  eventId?:            string;
  status:              WinnerAnnouncementStatus;
  totalRecipients?:    number;
  emailsSent?:         number;
  emailsFailed?:       number;
  inAppSent?:          number;
  inAppSkipped?:       number;
  certificatesIssued?: number;
  certificatesFailed?: number;
  startedAt?:          string;
  completedAt?:        string;
  createdAt?:          string;
  errorCode?:          string;
  errorMessage?:       string;
  failures?:           WinnerAnnouncementFailure[];
}

/**
 * Normalise the announcement job across the two field-name variants the backend
 * ships. The job id arrives as `id` (not `announcementId`) on both the 202
 * announce response and the status poll, and the counters are singular
 * (`emailSent` / `emailFailed` / `inAppSkipped` / `certificatesFailed`). Keep the
 * plural/`announcementId` fallbacks so either contract works.
 */
function parseWinnerAnnouncement(raw: any, fallbackEventId?: string): WinnerAnnouncement {
  const r = raw ?? {};
  return {
    announcementId:     r.announcementId ?? r.id ?? "",
    eventId:            r.eventId ?? fallbackEventId,
    status:             (r.status ?? "PENDING") as WinnerAnnouncementStatus,
    totalRecipients:    r.totalRecipients,
    emailsSent:         r.emailsSent         ?? r.emailSent,
    emailsFailed:       r.emailsFailed       ?? r.emailFailed,
    inAppSent:          r.inAppSent,
    inAppSkipped:       r.inAppSkipped,
    certificatesIssued: r.certificatesIssued,
    certificatesFailed: r.certificatesFailed,
    startedAt:          r.startedAt,
    completedAt:        r.completedAt,
    createdAt:          r.createdAt ?? r.startedAt,
    errorCode:          r.errorCode ?? undefined,
    errorMessage:       r.errorMessage ?? undefined,
    failures:           Array.isArray(r.failures) ? r.failures : undefined,
  };
}

// Stop polling a job that never leaves PENDING/PROCESSING (backend worker stalled)
// or whose status endpoint keeps erroring, instead of hammering it forever.
const MAX_ANNOUNCEMENT_POLLS = 40; // ~2 min at 3s

const WINNER_TERMINAL_STATUSES: WinnerAnnouncementStatus[] = [
  "COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED",
];

export function isWinnerAnnouncementTerminal(status?: string): boolean {
  return !!status && WINNER_TERMINAL_STATUSES.includes(status.toUpperCase() as WinnerAnnouncementStatus);
}

// Winners can only be announced once the challenge has ended. The backend pinned
// the canonical EventStatus vocabulary (DRAFT, PUBLISHED, UPCOMING, LIVE, ENDED,
// CANCELLED) and confirmed the terminal "ended" state is exactly `ENDED` — so we
// key off that alone (see the 2026-08-23 incident reply, item 72-3).
export function isChallengeEnded(status?: string): boolean {
  return status?.toUpperCase() === "ENDED";
}

/**
 * POST /client/challenges/{challengeId}/end
 *
 * Explicit, guarded, terminal action. The backend atomically closes applications
 * and scoring, freezes the SELECTED winner set, and transitions the challenge to
 * `ENDED` — then unlocks the winner preview/announce endpoints. It is idempotent
 * (re-ending an already-ended challenge is a no-op) and cannot be reversed.
 *
 * Gate: rejects with 409 `SCORING_INCOMPLETE` when any shortlisted/selected
 * application still lacks a judge score, echoing the offending ids under
 * `data.unscoredApplicationIds`. That code is surfaced inline by the caller (an
 * actionable panel), so we deliberately DON'T toast it here; every other error
 * falls through to the standard toast.
 */
export function useEndChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ challengeId }: { challengeId: string }) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/client/challenges/${challengeId}/end`,
        {}
      );
      return res.data.data;
    },
    onSuccess: () => {
      // Ending touches detail (status/applicationsOpen), applications, leaderboard
      // and unlocks the winner preview — invalidate the whole cache like the other
      // lifecycle mutations so every tab reflects the terminal state.
      queryClient.invalidateQueries({ queryKey: clientChallengeKeys.all });
      popup.success(
        "Challenge Ended",
        "Applications and scoring are now locked. You can announce winners.",
        3500
      );
    },
    onError: (error: any) => {
      // The scoring-gate rejection is handled inline by the End Challenge panel
      // (it lists the unscored applications); suppress the duplicate toast.
      if (getApiErrorCode(error) === "SCORING_INCOMPLETE") return;
      parseAndToastApiError(error, "Failed to end the challenge.");
    },
  });
}

/**
 * Pull the unscored application ids off a `SCORING_INCOMPLETE` (409) end-challenge
 * rejection, tolerating a couple of shapes (`data.unscoredApplicationIds` per the
 * backend, or a top-level array). Empty array when absent.
 */
export function unscoredApplicationIdsFromError(error: any): string[] {
  const d = error?.response?.data;
  const ids = d?.data?.unscoredApplicationIds ?? d?.unscoredApplicationIds;
  return Array.isArray(ids) ? ids.filter((x: any) => typeof x === "string") : [];
}

/**
 * Public (unauthenticated) certificate PDF download — the backend 302-redirects
 * to a short-lived signed URL. Safe to open directly in a new tab.
 */
export function certificateDownloadUrl(certificateId: string): string {
  const base = (apiClient.defaults.baseURL ?? "").replace(/\/$/, "");
  return `${base}/api/v1/public/certificates/${certificateId}/download`;
}

/**
 * POST /client/events/{eventId}/challenge-winners/preview
 * Read-only server-computed winner set (no side effects). eventId === challengeId.
 */
export function useChallengeWinnerPreview(challengeId: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clientChallengeKeys.winnersPreview(challengeId),
    queryFn: async () => {
      const res = await apiClient.post<ApiResponse<WinnerPreviewResponse>>(
        `/api/v1/client/events/${challengeId}/challenge-winners/preview`,
        {}
      );
      const raw: any = res.data.data ?? res.data;
      // Backend keys the winning teams under `teams` and the editable copy under
      // `suggestedMessage`; keep `winners`/`defaultMessage`/array fallbacks for tolerance.
      const teams =
        Array.isArray(raw?.teams)   ? raw.teams :
        Array.isArray(raw?.winners) ? raw.winners :
        Array.isArray(raw)          ? raw : [];
      return {
        eventId:         raw?.eventId ?? challengeId,
        eventTitle:      raw?.eventTitle ?? "",
        winners:         teams,
        totalTeams:      raw?.totalTeams      ?? raw?.teamCount,
        totalRecipients: raw?.totalRecipients ?? raw?.recipientCount,
        emailRecipients: raw?.emailRecipients ?? raw?.emailCount,
        inAppRecipients: raw?.inAppRecipients ?? raw?.inAppCount,
        defaultMessage:  raw?.suggestedMessage ?? raw?.defaultMessage ?? raw?.message ?? "",
      } as WinnerPreviewResponse;
    },
    enabled: !!challengeId && (opts?.enabled ?? true),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * POST /client/events/{eventId}/challenge-winners/announce
 * Idempotent send. The FE echoes back the backend-computed winner set
 * (`applicationIds` from the preview) as the organiser's confirmation, plus the
 * approved message + delivery flags; the backend revalidates server-side.
 * Returns 202 + job.
 */
export function useAnnounceChallengeWinners() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      challengeId,
      applicationIds,
      message,
      sendEmail,
      sendInApp,
      idempotencyKey,
    }: {
      challengeId:    string;
      applicationIds: string[];
      message:        string;
      sendEmail:      boolean;
      sendInApp:      boolean;
      idempotencyKey: string;
    }) => {
      const res = await apiClient.post<ApiResponse<WinnerAnnouncement>>(
        `/api/v1/client/events/${challengeId}/challenge-winners/announce`,
        { applicationIds, message, sendEmail, sendInApp },
        { headers: { "Idempotency-Key": idempotencyKey } }
      );
      return parseWinnerAnnouncement(res.data.data ?? res.data, challengeId);
    },
    onSuccess: (data, { challengeId }) => {
      queryClient.invalidateQueries({ queryKey: clientChallengeKeys.winnersPreview(challengeId) });
      // Seed the status query from the 202 body so progress renders immediately,
      // even before (or without) the first poll returning.
      if (data.announcementId) {
        queryClient.setQueryData(
          clientChallengeKeys.winnerAnnouncement(challengeId, data.announcementId),
          data
        );
      }
      popup.success(
        "Winner Announcement Started",
        "Certificates and congratulations are being sent. Track progress below.",
        3000
      );
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to announce winners."),
  });
}

/**
 * GET /client/events/{eventId}/challenge-winners/announcements/{announcementId}
 * Polls every 3s until the job reaches a terminal state.
 */
export function useChallengeWinnerAnnouncement(challengeId: string, announcementId: string | null) {
  return useQuery({
    queryKey: clientChallengeKeys.winnerAnnouncement(challengeId, announcementId ?? ""),
    enabled: !!challengeId && !!announcementId,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<WinnerAnnouncement>>(
        `/api/v1/client/events/${challengeId}/challenge-winners/announcements/${announcementId}`
      );
      return parseWinnerAnnouncement(res.data.data ?? res.data, challengeId);
    },
    retry: false,
    refetchInterval: (query) => {
      const status = (query.state.data as WinnerAnnouncement | undefined)?.status;
      if (isWinnerAnnouncementTerminal(status)) return false;
      // Bound the poll: each success or error advances one of these counters, so
      // their sum caps total attempts whether the job is stuck PENDING or the
      // status endpoint is 404-ing.
      const ticks = query.state.dataUpdateCount + query.state.errorUpdateCount;
      if (ticks >= MAX_ANNOUNCEMENT_POLLS) return false;
      return 3000;
    },
  });
}

/**
 * GET /client/events/{eventId}/challenge-winners/announcements/latest
 *
 * Returns the most recently started announcement for the event (404 when none has
 * ever been started). Lets the admin UI restore an in-flight/last progress card
 * after a reload WITHOUT persisting the announcement id client-side. 404 is a
 * normal "no announcement yet" answer, so we swallow it to `null` rather than
 * error, and don't retry.
 */
export function useLatestChallengeWinnerAnnouncement(challengeId: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clientChallengeKeys.winnerAnnouncementLatest(challengeId),
    enabled: !!challengeId && (opts?.enabled ?? true),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<WinnerAnnouncement>>(
          `/api/v1/client/events/${challengeId}/challenge-winners/announcements/latest`
        );
        const parsed = parseWinnerAnnouncement(res.data.data ?? res.data, challengeId);
        return parsed.announcementId ? parsed : null;
      } catch (err: any) {
        if (err?.response?.status === 404) return null;
        throw err;
      }
    },
  });
}
