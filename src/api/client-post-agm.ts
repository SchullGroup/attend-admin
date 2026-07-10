"use client";

/**
 * client-post-agm.ts — Post-AGM Minutes, Certificates & Filing API
 *
 * GET  /api/v1/client/events/{eventId}/post-agm/summary
 * GET  /api/v1/client/events/{eventId}/post-agm/minutes
 * PUT  /api/v1/client/events/{eventId}/post-agm/minutes                    → save draft
 * POST /api/v1/client/events/{eventId}/post-agm/minutes/finalise           → 409 if no draft / already finalised
 * GET  /api/v1/client/events/{eventId}/post-agm/certificates/eligibility
 * POST /api/v1/client/events/{eventId}/post-agm/certificates/send          → async, returns queued count
 * GET  /api/v1/client/events/{eventId}/post-agm/export/attendance          → raw CSV text
 * GET  /api/v1/client/events/{eventId}/post-agm/export/vote-audit          → raw CSV text
 * GET  /api/v1/client/events/{eventId}/post-agm/statutory-return           → structured JSON (fields TBD)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PostAgmSummary {
  totalRegistered:             number;
  totalCheckedIn:               number;
  totalEligibleForCertificate:  number;
  certificatesSent:             number;
  totalResolutions:             number;
  resolutionsPassed:            number;
  resolutionsFailed:            number;
  totalVotesCastShares:         number;
  minutesStatus:                string; // "DRAFT" | "FINALISED" | "NOT_STARTED" etc.
}

export interface AgmMinutes {
  id?:           string;
  content:       string;
  status:        "DRAFT" | "FINALISED" | string;
  finalisedAt?:  string | null;
  finalisedBy?:  string | null;
  updatedAt?:    string;
  updatedBy?:    string;
}

export interface CertificateEligibleAttendee {
  userId:             string;
  fullName:           string;
  email:              string;
  kycStatus:          string;
  checkedInAt?:        string;
  certificateStatus:  "PENDING" | "SENT" | string;
  emailedAt?:          string | null;
}

export interface CertificateEligibilityResponse {
  totalEligible: number;
  totalSent:     number;
  totalPending:  number;
  attendees:     CertificateEligibleAttendee[];
}

export interface SendCertificatesResponse {
  totalEligible: number;
  queued:        number;
  message:       string;
}

export interface StatutoryReturnResolution {
  order:             number;
  title:             string;
  specialResolution: boolean;
  forVotes:          number;
  againstVotes:      number;
  abstainVotes:      number;
  forShares:         number;
  againstShares:     number;
  abstainShares:     number;
  passed:            boolean;
}

/** Confirmed shape — vote/share totals already fold in offline (paper/proxy) votes. */
export interface StatutoryReturn {
  eventName:            string;
  eventDate:             string;
  eventVenue:            string;
  organisationName:      string;
  totalRegistered:       number;
  totalAttended:         number;
  totalVotesCastShares:  number;
  resolutions:           StatutoryReturnResolution[];
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const postAgmKeys = {
  summary:            (eventId: string) => ["postAgm", eventId, "summary"] as const,
  minutes:            (eventId: string) => ["postAgm", eventId, "minutes"] as const,
  certEligibility:    (eventId: string) => ["postAgm", eventId, "certEligibility"] as const,
  exportAttendance:   (eventId: string) => ["postAgm", eventId, "export", "attendance"] as const,
  exportVoteAudit:    (eventId: string) => ["postAgm", eventId, "export", "voteAudit"] as const,
  statutoryReturn:    (eventId: string) => ["postAgm", eventId, "statutoryReturn"] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Summary cards: attendance, resolutions passed/failed, votes cast, minutes status, certificate counts. */
export function usePostAgmSummary(eventId: string) {
  return useQuery({
    queryKey: postAgmKeys.summary(eventId),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PostAgmSummary>>(
        `/api/v1/client/events/${eventId}/post-agm/summary`
      );
      // React Query forbids returning undefined — fall back to null when the
      // backend has nothing yet (e.g. event hasn't run its post-AGM flow).
      return res.data.data ?? null;
    },
    enabled: !!eventId,
    staleTime: 30_000,
  });
}

/** Current draft or finalised minutes content. Returns null if no minutes exist yet. */
export function useAgmMinutes(eventId: string) {
  return useQuery({
    queryKey: postAgmKeys.minutes(eventId),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<AgmMinutes>>(
        `/api/v1/client/events/${eventId}/post-agm/minutes`
      );
      return res.data.data ?? null;
    },
    enabled: !!eventId,
    staleTime: 15_000,
  });
}

/** Attendees eligible for a certificate (checked-in AND KYC verified), with current send status. */
export function useCertificateEligibility(eventId: string) {
  return useQuery({
    queryKey: postAgmKeys.certEligibility(eventId),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<CertificateEligibilityResponse>>(
        `/api/v1/client/events/${eventId}/post-agm/certificates/eligibility`
      );
      return res.data.data ?? null;
    },
    enabled: !!eventId,
    staleTime: 30_000,
  });
}

/**
 * Attendance register CSV — raw text body (not the standard JSON envelope).
 * enabled:false — caller calls refetch() then downloads result.data as a .csv file.
 */
export function useExportAttendanceRegister(eventId: string) {
  return useQuery({
    queryKey: postAgmKeys.exportAttendance(eventId),
    queryFn: async () => {
      const res = await apiClient.get<string>(
        `/api/v1/client/events/${eventId}/post-agm/export/attendance`,
        { responseType: "text", transformResponse: (data) => data }
      );
      return typeof res.data === "string" ? res.data : (res.data == null ? "" : JSON.stringify(res.data));
    },
    enabled: false,
    staleTime: 0,
  });
}

/**
 * Vote audit log CSV — raw text body (not the standard JSON envelope).
 * enabled:false — caller calls refetch() then downloads result.data as a .csv file.
 */
export function useExportVoteAuditLog(eventId: string) {
  return useQuery({
    queryKey: postAgmKeys.exportVoteAudit(eventId),
    queryFn: async () => {
      const res = await apiClient.get<string>(
        `/api/v1/client/events/${eventId}/post-agm/export/vote-audit`,
        { responseType: "text", transformResponse: (data) => data }
      );
      return typeof res.data === "string" ? res.data : (res.data == null ? "" : JSON.stringify(res.data));
    },
    enabled: false,
    staleTime: 0,
  });
}

/** Structured statutory return data. enabled:false — caller calls refetch() on demand. */
export function useStatutoryReturn(eventId: string) {
  return useQuery({
    queryKey: postAgmKeys.statutoryReturn(eventId),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<StatutoryReturn>>(
        `/api/v1/client/events/${eventId}/post-agm/statutory-return`
      );
      return res.data.data ?? null;
    },
    enabled: false,
    staleTime: 0,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Save (create or update) draft minutes. 409 if already finalised. */
export function useSaveDraftMinutes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, content }: { eventId: string; content: string }) => {
      const res = await apiClient.put<ApiResponse<AgmMinutes>>(
        `/api/v1/client/events/${eventId}/post-agm/minutes`,
        { content }
      );
      return res.data.data;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: postAgmKeys.minutes(eventId) });
      queryClient.invalidateQueries({ queryKey: postAgmKeys.summary(eventId) });
      popup.success("Draft Saved", "Minutes saved as draft.", 2000);
    },
    onError: (error: any) => {
      if (error?.response?.status === 409) {
        popup.error("Already Finalised", "These minutes have already been finalised and can no longer be edited.", 3500);
        return;
      }
      parseAndToastApiError(error, "Failed to save draft minutes.");
    },
  });
}

/** Lock minutes as finalised. 409 if no draft exists or already finalised. */
export function useFinaliseMinutes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      const res = await apiClient.post<ApiResponse<AgmMinutes>>(
        `/api/v1/client/events/${eventId}/post-agm/minutes/finalise`
      );
      return res.data.data;
    },
    onSuccess: (_, eventId) => {
      queryClient.invalidateQueries({ queryKey: postAgmKeys.minutes(eventId) });
      queryClient.invalidateQueries({ queryKey: postAgmKeys.summary(eventId) });
      popup.success("Minutes Finalised", "The minutes have been locked and finalised.", 3000);
    },
    onError: (error: any) => {
      if (error?.response?.status === 409) {
        popup.error("Can't Finalise", "No draft exists, or the minutes are already finalised.", 3500);
        return;
      }
      parseAndToastApiError(error, "Failed to finalise minutes.");
    },
  });
}

/** Queue attendance certificates for all eligible attendees. Sending runs asynchronously. */
export function useSendCertificates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      const res = await apiClient.post<ApiResponse<SendCertificatesResponse>>(
        `/api/v1/client/events/${eventId}/post-agm/certificates/send`
      );
      return res.data.data;
    },
    onSuccess: (data, eventId) => {
      queryClient.invalidateQueries({ queryKey: postAgmKeys.certEligibility(eventId) });
      queryClient.invalidateQueries({ queryKey: postAgmKeys.summary(eventId) });
      popup.success(
        "Certificates Queued",
        data?.message ?? `${data?.queued ?? 0} of ${data?.totalEligible ?? 0} eligible attendee(s) queued.`,
        3500
      );
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to send certificates."),
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Trigger a browser download of raw CSV text returned by the export endpoints above. */
export function downloadCsvText(filename: string, csvText: string) {
  const blob = new Blob([csvText], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Render the statutory return as a readable plain-text filing document (SEC/CAC style). */
export function formatStatutoryReturnText(r: StatutoryReturn): string {
  const pct = (n: number, total: number) => (total > 0 ? `${((n / total) * 100).toFixed(1)}%` : "0.0%");
  const lines: string[] = [
    "STATUTORY RETURN",
    "=".repeat(60),
    "",
    `Organisation:      ${r.organisationName}`,
    `Meeting:           ${r.eventName}`,
    `Date:              ${r.eventDate}`,
    `Venue:             ${r.eventVenue}`,
    "",
    "ATTENDANCE",
    "-".repeat(60),
    `Total Registered:  ${r.totalRegistered.toLocaleString()}`,
    `Total Attended:    ${r.totalAttended.toLocaleString()} (${pct(r.totalAttended, r.totalRegistered)})`,
    `Total Shares Voted: ${r.totalVotesCastShares.toLocaleString()}`,
    "",
    "RESOLUTIONS",
    "-".repeat(60),
  ];

  for (const res of r.resolutions) {
    const totalShares = res.forShares + res.againstShares + res.abstainShares;
    lines.push(
      "",
      `${res.order}. ${res.title}${res.specialResolution ? "  [SPECIAL RESOLUTION]" : ""}`,
      `   Result: ${res.passed ? "PASSED" : "NOT PASSED"}`,
      `   Votes   — For: ${res.forVotes.toLocaleString()}  Against: ${res.againstVotes.toLocaleString()}  Abstain: ${res.abstainVotes.toLocaleString()}`,
      `   Shares  — For: ${res.forShares.toLocaleString()} (${pct(res.forShares, totalShares)})  ` +
        `Against: ${res.againstShares.toLocaleString()} (${pct(res.againstShares, totalShares)})  ` +
        `Abstain: ${res.abstainShares.toLocaleString()} (${pct(res.abstainShares, totalShares)})`
    );
  }

  lines.push("", "=".repeat(60), `Generated: ${new Date().toLocaleString()}`);
  return lines.join("\n");
}
