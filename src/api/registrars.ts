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
  registerCount?:       number;   // alias used by some response shapes
  eventCount?:          number;
  status:               string;
  enrolledAt?:          string;
  approvedAt?:          string;
  createdAt?:           string;
  logoUrl?:             string;
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
  companyName:          string;
  representativeName:   string;
  representativeEmail:  string;
  representativePhone?: string;
  password:             string;
  plan:                 string;
  rcNumber:             string | null;   // nullable — send null, not undefined
  industry:             string | null;   // nullable — send null, not undefined
  /** Not currently collected by the enrol form's own fields — see BACKEND_BUGS. */
  address?:             string | null;
  website?:             string | null;
}

/** Payload for PATCH /api/v1/admin/registrars/{id} — editing an existing registrar's profile. */
export interface UpdateRegistrarProfileRequest {
  companyName?:          string;
  industry?:             string | null;
  rcNumber?:             string | null;
  plan?:                 string;
  address?:              string | null;
  website?:              string | null;
  representativeName?:   string;
  representativeEmail?:  string;
  representativePhone?:  string | null;
}

// ---------------------------------------------------------------------------
// Query key factory
// Cache contract: mutations invalidate BOTH ["registrars"] AND ["registrar", id]
// ---------------------------------------------------------------------------
export const registrarKeys = {
  all:       ["registrars"] as const,
  list:      (status: string, page: number, size: number) =>
               ["registrars", "list", { status, page, size }] as const,
  pending:   (page: number, size: number) =>
               ["registrars", "pending", page, size] as const,
  detail:    (id: string) => ["registrar", id] as const,
  registers: (id: string) => ["registrar", id, "registers"] as const,
  events:    (id: string) => ["registrar", id, "events"] as const,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeList(raw: any, page: number, size: number): RegistrarsListResponse {
  // The endpoint uses "stakeholders" as the primary key in its response envelope.
  // Fall back through common alternatives for forward-compatibility.
  const registrars: RegistrarItem[] =
    raw?.registrars   ??
    raw?.stakeholders ??
    raw?.content      ??
    raw?.data         ??
    [];
  return {
    registrars,
    totalCount: raw?.totalCount ?? raw?.totalElements ?? registrars.length,
    page:       raw?.page       ?? page,
    size:       raw?.size       ?? size,
    totalPages: raw?.totalPages,
  };
}

/**
 * Resolve the best available enrolled/approved date for a registrar.
 * Priority: enrolledAt → approvedAt → createdAt
 * Returns undefined when none are present so DateCell can render its own fallback.
 */
export function getRegistrarEnrolledAt(
  r: Pick<RegistrarItem, "enrolledAt" | "approvedAt" | "createdAt">
): string | undefined {
  return r.enrolledAt ?? r.approvedAt ?? r.createdAt;
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
export function useRegistrars(status = "", page = 0, size = 50, enabled = true) {
  return useQuery({
    queryKey: registrarKeys.list(status, page, size),
    enabled,
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
 * Full registrar profile including registers and events.
 *
 * API: GET /api/v1/admin/registrars/{id}
 */
export interface RegistrarDetailResponse {
  id:                   string;
  companyName?:         string;
  name?:                string;
  industry?:            string | null;
  rcNumber?:            string | null;
  representativeName?:  string;
  repName?:             string;
  contactEmail?:        string;
  email?:               string;       // alias returned by some response shapes
  repEmail?:            string;
  representativePhone?: string;
  phone?:               string;
  website?:             string | null;
  address?:             string | null;
  plan?:                string;
  status:               string;
  /** Primary enrolled-at timestamp — use enrolledAt → approvedAt → createdAt in that order. */
  enrolledAt?:          string;
  approvedAt?:          string;
  createdAt?:           string;
  logoUrl?:             string;
  registers?:           Array<{
    id:          string;
    name:        string;
    industry?:   string | null;
    status:      string;
    eventCount?: number;
    enrolledAt?: string;
  }>;
  events?:              Array<{
    id:        string;
    title:     string;
    eventType?: string;
    date:       string;
    status:     string;
    format:     string;
    registrationCount?: number;
    // Extra fields not guaranteed by every backend shape but read defensively
    // (as `any`) where present — register filter + created-time ordering.
    registerId?:   string;
    registerName?: string;
    createdAt?:    string;
    rsvpCount?:    number;
  }>;
  registersCount?: number;
  eventsCount?:    number;
  /** Team members — returned by GET /api/v1/admin/registrars/{id} */
  team?:           Array<{
    id:       string;
    fullName: string;
    email:    string;
    role?:    string;
    status?:  string;
  }>;
  /** Admin user account linked to this registrar */
  adminUser?:      {
    id:        string;
    fullName?: string;
    name?:     string;
    email:     string;
    role?:     string;
    status?:   string;
    createdAt?: string;
  };
}

export function useRegistrarDetail(id: string) {
  return useQuery({
    queryKey: registrarKeys.detail(id),
    queryFn:  async () => {
      const res = await apiClient.get<ApiResponse<RegistrarDetailResponse>>(
        `/api/v1/admin/registrars/${id}`
      );
      return res.data.data;
    },
    enabled:   !!id,
    staleTime: 60_000,
  });
}

/**
 * Registers managed by a registrar.
 *
 * API: GET /api/v1/admin/registrars/{id}/registers
 */
export function useRegistrarRegisters(id: string) {
  return useQuery({
    queryKey: registrarKeys.registers(id),
    queryFn:  async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        `/api/v1/admin/registrars/${id}/registers`
      );
      const raw = res.data.data;
      return (raw?.registers ?? raw?.content ?? raw?.data ?? (Array.isArray(raw) ? raw : [])) as RegistrarDetailResponse["registers"];
    },
    enabled:   !!id,
    staleTime: 60_000,
  });
}

/**
 * Events associated with a registrar.
 *
 * API: GET /api/v1/admin/registrars/{id}/events
 */
export function useRegistrarEvents(id: string) {
  return useQuery({
    queryKey: registrarKeys.events(id),
    queryFn:  async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        `/api/v1/admin/registrars/${id}/events`
      );
      const raw = res.data.data;
      return (raw?.events ?? raw?.content ?? raw?.data ?? (Array.isArray(raw) ? raw : [])) as RegistrarDetailResponse["events"];
    },
    enabled:   !!id,
    staleTime: 60_000,
  });
}

export interface RegistrarEventsPage {
  events:      NonNullable<RegistrarDetailResponse["events"]>;
  totalCount:  number;
  page:        number;
  size:        number;
}

/**
 * Paginated events associated with a registrar — used by the "view all events"
 * sub-page so we don't have to render every event inline on the profile.
 *
 * API: GET /api/v1/admin/registrars/{id}/events?page=&size=
 */
export function useRegistrarEventsPaged(id: string, page = 0, size = 20) {
  return useQuery({
    queryKey: [...registrarKeys.events(id), "paged", page, size],
    queryFn:  async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        `/api/v1/admin/registrars/${id}/events`,
        { params: { page, size } }
      );
      const raw = res.data.data;
      const events = (raw?.events ?? raw?.content ?? raw?.data ?? (Array.isArray(raw) ? raw : [])) as RegistrarEventsPage["events"];
      return {
        events,
        totalCount: raw?.totalCount ?? raw?.totalElements ?? events.length,
        page:       raw?.page ?? page,
        size:       raw?.size ?? size,
      } as RegistrarEventsPage;
    },
    enabled:   !!id,
    staleTime: 60_000,
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

/**
 * Edit an existing registrar's profile (company + representative details).
 *
 * API: PATCH /api/v1/admin/registrars/{id}
 * This endpoint didn't exist anywhere in the frontend before — the registrar
 * detail page only ever displayed these fields read-only. Built following the
 * same REST shape as the other registrar mutations (suspend/activate/logo);
 * flagged to backend to confirm/add if it 404s (see BACKEND_BUGS item 12).
 */
export function useUpdateRegistrarProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateRegistrarProfileRequest }) => {
      const res = await apiClient.patch<ApiResponse<any>>(
        `/api/v1/admin/registrars/${id}`,
        data
      );
      return res.data.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: registrarKeys.all });
      queryClient.invalidateQueries({ queryKey: registrarKeys.detail(id) });
      popup.success("Saved", "Registrar profile updated successfully.", 2500);
    },
    onError: (error: any) =>
      parseAndToastApiError(error, "Failed to update registrar. Please try again."),
  });
}

// ---------------------------------------------------------------------------
// Logo upload — two-step: Cloudinary → registrar logo endpoint
// ---------------------------------------------------------------------------

/**
 * Step 1: Upload a file to Cloudinary via the platform proxy.
 * POST /api/v1/upload?folder=logos
 * Returns { fileUrl, cloudinaryPublicId } from response.data.data
 */
export function useUploadToCloudinary() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await apiClient.post<ApiResponse<Record<string, string>>>(
        "/api/v1/upload",
        form,
        {
          params:  { folder: "logos" },
          headers: { "Content-Type": undefined },
        }
      );
      const d = res.data.data ?? {};
      return {
        fileUrl:           d["fileUrl"]            ?? d["url"]        ?? "",
        cloudinaryPublicId: d["cloudinaryPublicId"] ?? d["public_id"] ?? "",
      };
    },
    onError: (error: any) =>
      parseAndToastApiError(error, "Image upload failed. Please try again."),
  });
}

/**
 * Step 2: Persist the Cloudinary URL as the registrar's logo.
 * PUT /api/v1/admin/registrars/{id}/logo
 * Body: { logoUrl }
 */
export function useUpdateRegistrarLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, logoUrl }: { id: string; logoUrl: string }) => {
      const res = await apiClient.put<ApiResponse<any>>(
        `/api/v1/admin/registrars/${id}/logo`,
        { logoUrl }
      );
      return res.data.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: registrarKeys.all });
      queryClient.invalidateQueries({ queryKey: registrarKeys.detail(id) });
      popup.success("Logo Updated", "The registrar logo has been saved successfully.", 2500);
    },
    onError: (error: any) =>
      parseAndToastApiError(error, "Failed to save logo. Please try again."),
  });
}
