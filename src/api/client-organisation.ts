"use client";

/**
 * client-organisation.ts — Organisation Profile, Branding & Team API
 *
 * Endpoints:
 *   GET  /api/v1/client/organisation/profile
 *   PUT  /api/v1/client/organisation/profile/info
 *   POST /api/v1/client/organisation/profile/branding/logo   (multipart)
 *   PUT  /api/v1/client/organisation/profile/branding/color
 *   GET  /api/v1/client/organisation/team
 *   POST /api/v1/client/organisation/team/invite
 *   GET  /api/v1/client/organisation/team/roles
 *   GET  /api/v1/client/organisation/team/permissions
 *   POST /api/v1/client/organisation/team/{id}/reactivate
 *   DELETE /api/v1/client/organisation/team/{id}/revoke
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompanyProfileResponse {
  id:              string;
  companyName:     string;
  industry?:       string;
  rcNumber:        string;
  contactEmail:    string;
  phone?:          string;
  website?:        string;
  logoUrl?:        string;
  primaryColor?:   string;
  status:          string;
  createdAt:       string;
}

export interface UpdateOrganisationInfoRequest {
  companyName:   string;
  industry?:     string;
  rcNumber:      string;
  contactEmail:  string;
  phone?:        string;
  website?:      string;
}

export interface UpdateBrandingColorRequest {
  primaryColor: string; // hex #RRGGBB
}

export type TeamMemberRole = "ADMIN" | "EVENT_MANAGER" | "VIEWER";
export type TeamMemberStatus = "ACTIVE" | "INVITED" | "REVOKED";

export interface TeamMember {
  id:         string;
  firstName:  string;
  lastName:   string;
  fullName:   string;
  email:      string;
  role:       TeamMemberRole;
  status:     TeamMemberStatus;
  invitedAt?: string;
  joinedAt?:  string;
}

export interface TeamMembersResponse {
  totalCount:  number;
  page:        number;
  size:        number;
  members:     TeamMember[];
}

export interface InviteMemberRequest {
  firstName: string;
  lastName:  string;
  email:     string;
  role:      TeamMemberRole;
}

// Stakeholder profile (GET /api/v1/client/stakeholder)
export interface StakeholderProfile {
  id:        string;
  name:      string;
  email:     string;
  phone?:    string;
  address?:  string;
  industry?: string;
  website?:  string;
  logoUrl?:  string | null;
  status:    string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const clientOrgKeys = {
  all:         ["clientOrg"] as const,
  stakeholder: ["clientOrg", "stakeholder"] as const,
  profile:     ["clientOrg", "profile"] as const,
  team:        (role: string, status: string, page: number, size: number) =>
                 ["clientOrg", "team", { role, status, page, size }] as const,
  roles:       ["clientOrg", "roles"] as const,
  permissions: ["clientOrg", "permissions"] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Stakeholder profile for the authenticated user's organisation.
 * GET /api/v1/client/stakeholder
 * Returns logoUrl which is the primary branding image.
 */
export function useClientStakeholder(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clientOrgKeys.stakeholder,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<StakeholderProfile>>(
        "/api/v1/client/stakeholder"
      );
      return res.data.data;
    },
    staleTime: 300_000,
    enabled: opts?.enabled !== false,
  });
}

/** Full organisation profile including branding. */
export function useOrganisationProfile() {
  return useQuery({
    queryKey: clientOrgKeys.profile,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<CompanyProfileResponse>>(
        "/api/v1/client/organisation/profile"
      );
      return res.data.data;
    },
    staleTime: 120_000,
  });
}

/** Paginated team member list with optional role/status filter. */
export function useOrganisationTeam(role = "", status = "", page = 0, size = 20) {
  return useQuery({
    queryKey: clientOrgKeys.team(role, status, page, size),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<TeamMembersResponse>>(
        "/api/v1/client/organisation/team",
        { params: { ...(role ? { role } : {}), ...(status ? { status } : {}), page, size } }
      );
      return res.data.data;
    },
    staleTime: 60_000,
  });
}

/** Invitable roles for the current user (depends on their own role). */
export function useOrganisationRoles() {
  return useQuery({
    queryKey: clientOrgKeys.roles,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        "/api/v1/client/organisation/team/roles"
      );
      return res.data.data;
    },
    staleTime: 300_000,
  });
}

/** Permission map for the authenticated user. */
export function useOrganisationPermissions() {
  return useQuery({
    queryKey: clientOrgKeys.permissions,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        "/api/v1/client/organisation/team/permissions"
      );
      return res.data.data;
    },
    staleTime: 300_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Update company name, industry, RC number, contact email, phone, website. */
export function useUpdateOrganisationInfo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateOrganisationInfoRequest) => {
      const res = await apiClient.put<ApiResponse<any>>(
        "/api/v1/client/organisation/profile/info",
        data
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientOrgKeys.profile });
      popup.success("Profile Updated", "Organisation info has been saved.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Update failed."),
  });
}

/** Upload company logo (multipart/form-data). Pass a File object. */
export function useUploadOrgLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await apiClient.post<ApiResponse<any>>(
        "/api/v1/client/organisation/profile/branding/logo",
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientOrgKeys.profile });
      popup.success("Logo Updated", "Your organisation logo has been saved.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Logo upload failed."),
  });
}

/** Update primary brand colour. Must be a valid 6-digit hex (#RRGGBB). */
export function useUpdateBrandingColor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (primaryColor: string) => {
      const res = await apiClient.put<ApiResponse<any>>(
        "/api/v1/client/organisation/profile/branding/color",
        { primaryColor }
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientOrgKeys.profile });
      popup.success("Brand Color Saved", "Primary color updated.", 2000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Color update failed."),
  });
}

/** Invite a new team member (sends email invite). */
export function useInviteTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InviteMemberRequest) => {
      const res = await apiClient.post<ApiResponse<any>>(
        "/api/v1/client/organisation/team/invite",
        data
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientOrgKeys.all });
      popup.success("Invite Sent", "An invitation email has been sent to the new member.", 3000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Invite failed."),
  });
}

/** Reactivate a previously revoked team member. */
export function useReactivateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/client/organisation/team/${id}/reactivate`
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientOrgKeys.all });
      popup.success("Member Reactivated", "The team member's access has been restored.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Reactivation failed."),
  });
}

/** Revoke a team member's access. */
export function useRevokeTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/v1/client/organisation/team/${id}/revoke`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientOrgKeys.all });
      popup.success("Access Revoked", "The team member no longer has access.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Revoke failed."),
  });
}
