"use client";

/**
 * registrars.ts — Registrars Module
 *
 * UI context : /registrars        (directory listing)
 *              /registrars/[id]   (registrar profile)
 *
 * Endpoint contract — all paths contain /registrar (not /register):
 *   Directory     GET  /api/v1/admin/registrars
 *   Pending       GET  /api/v1/admin/registrars/pending
 *   Enrol         POST /api/v1/admin/registrars/enroll
 *   Approve       POST /api/v1/admin/registrars/{id}/approve
 *   Reject        POST /api/v1/admin/registrars/{id}/reject
 *   Suspend       PATCH /api/v1/admin/registrars/{id}/suspend
 *   Activate      PATCH /api/v1/admin/registrars/{id}/activate
 *
 * Cache roots: ["registrars"] / ["registrar", id]
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegistrarItem {
  id:                   string;
  companyName?:         string;
  name?:                string;
  industry?:            string | null;
  rcNumber?:            string | null;
  representativeName?:  string;
  repName?:             string;
  contactEmail?:        string;
  repEmail?:            string;
  representativePhone?: string;
  repPhone?:            string;
  plan?:                string;
  registersCount?:      number;
  eventsCount?:         number;
  status:               string;
  enrolledAt?:          string;
  approvedAt?:          string;
  createdAt?:           string;
}

export interface RegistrarsListResponse {
  registrars:  RegistrarItem[];
  totalCount:  number;
  page:        number;
  size:        number;
  totalPages?: number;
}

export interface PendingRegistrarItem {
  id:            string;
  companyName?:  string;
  name?:         string;
  industry?:     string | null;
  rcNumber?:     string | null;
  contactEmail?: string;
  email?:        string;
  plan?:         string;
  status?:       string;
  requestedAt?:  string;
  requestedAgo?: string;
}

/** Payload for POST /api/v1/admin/registrars/enroll */
export interface EnrollRegistrarRequest {
  companyName:  string;
  contactEmail: string;
  plan:         string;
  rcNumber:     string | null;   // nullable — send null, not undefined
  industry:     string | null;   // nullable — send null, not undefined
}

// ---------------------------------------------------------------------------
// Query key factory
// Cache contract: mutations invalidate BOTH ["registrars"] AND ["registrar", id]
// ---------------------------------------------------------------------------
export const registrarKeys = {
  all:     ["registrars"] as const,
  list:    (status: string, page: number, size: number) =>
             ["registrars", "list", { status, page, size }] as const,
  pending: (page: number, size: number) =>
             ["registrars", "pending", page, size] as const,
  detail:  (id: string) => ["registrar", id] as const,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeList(raw: any, page: number, size: number): RegistrarsListResponse {
  const registrars: RegistrarItem[] =
    raw?.registrars ??
    raw?.content    ??
    raw?.data       ??
    [];
  return {
    registrars,
    totalCount: raw?.totalCount ?? raw?.totalElements ?? registrars.length,
    page:       raw?.page       ?? page,
    size:       raw?.size       ?? size,
    totalPages: raw?.totalPages,
  };
}

export function getRegistrarDisplayName(r: RegistrarItem | PendingRegistrarItem) {
  return (r as RegistrarItem).companyName || (r as RegistrarItem).name || "—";
}
export function getRegistrarRepName(r: RegistrarItem) {
  return r.representativeName || r.repName || "—";
}
export function getRegistrarEmail(r: RegistrarItem | PendingRegistrarItem) {
  return (r as RegistrarItem).contactEmail || (r as RegistrarItem).repEmail || "—";
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Active registrar directory.
 *
 * API: GET /api/v1/admin/registrars
 * Unwrap: response.data.data.registrars ?? content ?? []
 */
export function useRegistrars(status = "", page = 0, size = 50) {
  return useQuery({
    queryKey: registrarKeys.list(status, page, size),
    queryFn:  async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        "/api/v1/admin/registrars",
        {
          params: {
            page,
            size,
            ...(status ? { status } : {}),
          },
        }
      );
      return normalizeList(res.data.data, page, size);
    },
    staleTime: 30_000,
  });
}

/**
 * Pending enrolment queue.
 *
 * API: GET /api/v1/admin/registrars/pending
 * Unwrap: response.data.data.pendingStakeholders (falls back to [])
 */
export function usePendingRegistrars(page = 0, size = 20) {
  return useQuery({
    queryKey: registrarKeys.pending(page, size),
    queryFn:  async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        "/api/v1/admin/registrars/pending",
        { params: { page, size } }
      );
      const raw = res.data.data;
      const items: PendingRegistrarItem[] =
        raw?.pendingStakeholders ??
        raw?.registrars          ??
        raw?.content             ??
        [];
      return {
        items,
        totalCount: raw?.totalCount ?? raw?.totalElements ?? items.length,
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Enrol a new registrar.
 *
 * API: POST /api/v1/admin/registrars/enroll
 * Body: { companyName, contactEmail, plan, rcNumber (null ok), industry (null ok) }
 */
export function useEnrollRegistrar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: EnrollRegistrarRequest) => {
      const res = await apiClient.post<ApiResponse<any>>(
        "/api/v1/admin/registrars/enroll",
        data
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: registrarKeys.all });
      popup.success("Registrar Enrolled", "A confirmation email has been sent to the representative.", 3000);
    },
    onError: (error: any) =>
      parseAndToastApiError(error, "Enrolment failed. Please check the form and try again."),
  });
}

/**
 * Approve a pending registrar.
 *
 * API: POST /api/v1/admin/registrars/{id}/approve
 */
export function useApproveRegistrar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/admin/registrars/${id}/approve`
      );
      return res.data.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: registrarKeys.all });
      queryClient.invalidateQueries({ queryKey: registrarKeys.detail(id) });
      popup.success("Approved", "The registrar account has been approved and activated.", 3000);
    },
    onError: (error: any) =>
      parseAndToastApiError(error, "Approval failed. Please try again."),
  });
}

/**
 * Reject a pending registrar.
 *
 * API: POST /api/v1/admin/registrars/{id}/reject
 */
export function useRejectRegistrar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/admin/registrars/${id}/reject`,
        reason ? { reason } : {}
      );
      return res.data.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: registrarKeys.all });
      queryClient.invalidateQueries({ queryKey: registrarKeys.detail(id) });
      popup.success("Rejected", "A rejection notice has been sent.", 3000);
    },
    onError: (error: any) =>
      parseAndToastApiError(error, "Rejection failed. Please try again."),
  });
}

/**
 * Suspend an active registrar account.
 *
 * API: PATCH /api/v1/admin/registrars/{id}/suspend
 * Cache: invalidates ["registrars"] root + ["registrar", id]
 */
export function useSuspendRegistrar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.patch<ApiResponse<any>>(
        `/api/v1/admin/registrars/${id}/suspend`
      );
      return res.data.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: registrarKeys.all });
      queryClient.invalidateQueries({ queryKey: registrarKeys.detail(id) });
      popup.success("Suspended", "The registrar account has been suspended.", 3000);
    },
    onError: (error: any) =>
      parseAndToastApiError(error, "Suspension failed. Please try again."),
  });
}

/**
 * Reactivate a suspended registrar account.
 *
 * API: PATCH /api/v1/admin/registrars/{id}/activate
 * Cache: invalidates ["registrars"] root + ["registrar", id]
 */
export function useActivateRegistrar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.patch<ApiResponse<any>>(
        `/api/v1/admin/registrars/${id}/activate`
      );
      return res.data.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: registrarKeys.all });
      queryClient.invalidateQueries({ queryKey: registrarKeys.detail(id) });
      popup.success("Activated", "The registrar account has been reactivated.", 3000);
    },
    onError: (error: any) =>
      parseAndToastApiError(error, "Activation failed. Please try again."),
  });
}
