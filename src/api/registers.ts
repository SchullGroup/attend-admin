"use client";

/**
 * registers.ts — Registers Module
 *
 * All operations use the CLIENT-facing registers API (not admin/stakeholders).
 *
 * Endpoint contract (from swagger — authoritative):
 *   Directory  GET  /api/v1/client/registers            params: status, page, size
 *   Detail     GET  /api/v1/client/registers/{id}
 *   Events     GET  /api/v1/admin/events?registerId={id}
 *   Documents  GET  /api/v1/admin/registers/{id}/documents
 *   Enroll     POST /api/v1/client/registers/enroll
 *   Approve    POST /api/v1/client/registers/{id}/approve
 *   Reject     POST /api/v1/client/registers/{id}/reject     body: { reason? }
 *   Suspend    POST /api/v1/client/registers/{id}/suspend    body: { reason? }
 *   Activate   POST /api/v1/client/registers/{id}/activate
 *
 * Cache roots: ["registers"] / ["register", id]
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import {
  RegistersListResponse,
  ClientRegisterDetailResponse,
  RegisterDocumentItem,
} from "@/types/super-admin";
import { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Enroll payload — matches swagger body contract exactly
// ---------------------------------------------------------------------------
export interface EnrollRegisterPayload {
  name:                  string;
  email:                 string;
  rcNumber?:             string | null;
  industry?:             string | null;
  representativeName?:   string;
  representativePhone?:  string;
}

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const registerKeys = {
  all:       ["registers"] as const,
  list:      (status: string, page: number, size: number) =>
               ["registers", "list", { status, page, size }] as const,
  detail:    (id: string) => ["register", id] as const,
  events:    (id: string) => ["register", id, "events"] as const,
  documents: (id: string) => ["register", id, "documents"] as const,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeRegisterList(raw: any, page: number, size: number): RegistersListResponse {
  // Swagger primary key: data.registers
  const registers =
    raw?.registers    ??
    raw?.registrars   ??
    raw?.stakeholders ??
    raw?.content      ??
    [];
  return {
    registrars:  registers,   // backward-compat alias kept for existing consumers
    registers,
    totalCount:  raw?.totalCount  ?? raw?.totalElements ?? registers.length,
    page:        raw?.page        ?? page,
    size:        raw?.size        ?? size,
    totalPages:  raw?.totalPages,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Paginated register directory.
 *
 * GET /api/v1/client/registers
 * Params: status (PENDING | ACTIVE | SUSPENDED | REJECTED), page, size
 * Response envelope: data.registers[]
 */
export function useRegisters(status = "", page = 0, size = 50, enabled = true) {
  return useQuery({
    queryKey: registerKeys.list(status, page, size),
    enabled,
    queryFn:  async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        "/api/v1/client/registers",
        {
          params: {
            page,
            size,
            ...(status ? { status } : {}),
          },
        }
      );
      return normalizeRegisterList(res.data.data, page, size);
    },
    staleTime: 30_000,
  });
}

/**
 * Full register profile — name, email, rcNumber, industry, representativeName,
 * representativePhone, status, enrolledAt, eventCount, events[].
 *
 * GET /api/v1/client/registers/{registerId}
 */
export function useRegisterDetail(id: string) {
  return useQuery({
    queryKey: registerKeys.detail(id),
    queryFn:  async () => {
      const res = await apiClient.get<ApiResponse<ClientRegisterDetailResponse>>(
        `/api/v1/client/registers/${id}`
      );
      return res.data.data;
    },
    enabled:   !!id,
    staleTime: 60_000,
  });
}

/**
 * Events created under this register.
 *
 * GET /api/v1/admin/events?registerId={id}
 * Note: detail response already embeds events[] — this hook is for the
 * dedicated tab which may need independent pagination/refresh.
 */
export function useRegisterEvents(registerId: string) {
  return useQuery({
    queryKey: registerKeys.events(registerId),
    queryFn:  async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        "/api/v1/admin/events",
        { params: { registerId, page: 0, size: 50 } }
      );
      const raw = res.data.data;
      return (raw?.content ?? raw?.events ?? raw?.data ?? []) as any[];
    },
    enabled:   !!registerId,
    staleTime: 30_000,
  });
}

/**
 * Compliance document vault for this register.
 *
 * GET /api/v1/client/documents?registerId={id}
 * (NOT /api/v1/client/documents/filters/registers — that endpoint only returns
 * dropdown filter options { events: [{id, label}] }, not actual documents.)
 * Column contract:
 *   doc.title         — filename string
 *   doc.eventTitle    — meeting scope (default "Global Space Notice" when null)
 *   doc.fileSizeBytes — raw bytes → formatted KB/MB in UI
 *   doc.downloadCount — cumulative download counter
 *   doc.uploadedAt    — ISO timestamp
 */
export function useRegisterDocuments(registerId: string) {
  return useQuery({
    queryKey: registerKeys.documents(registerId),
    queryFn:  async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        `/api/v1/client/documents`,
        { params: { registerId, page: 0, size: 100 } }
      );
      const raw = res.data.data;
      const docs: any[] = raw?.documents ?? raw?.content ?? raw?.data ?? [];
      // Normalize global-vault field names to the RegisterDocumentItem shape.
      return docs.map((d) => ({
        id:            d.id,
        title:         d.title ?? d.originalFilename ?? "Untitled",
        eventTitle:    d.eventTitle ?? d.eventName ?? null,
        fileSizeBytes: d.fileSizeBytes ?? d.sizeBytes ?? 0,
        downloadCount: d.downloadCount ?? 0,
        uploadedAt:    d.uploadedAt,
        fileType:      d.fileType,
        mimeType:      d.mimeType,
        url:           d.url ?? d.fileUrl,
        documentType:  d.documentType ?? d.type,
      })) as RegisterDocumentItem[];
    },
    enabled:   !!registerId,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations — all invalidate ["registers"] root + ["register", id] on success
// ---------------------------------------------------------------------------

/**
 * Enroll a new register (creates in PENDING status).
 *
 * POST /api/v1/client/registers/enroll
 * Body: { name, email, rcNumber?, industry?, representativeName?, representativePhone? }
 */
export function useEnrollRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: EnrollRegisterPayload) => {
      const res = await apiClient.post<ApiResponse<any>>(
        "/api/v1/client/registers/enroll",
        payload
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: registerKeys.all });
      popup.success(
        "Register Enrolled",
        "The organisation has been added in PENDING status. Approve it to enable event creation.",
        4000
      );
    },
    onError: (error: any) =>
      parseAndToastApiError(error, "Enrolment failed. Please verify the details and try again."),
  });
}

/**
 * Approve a PENDING register — sets status to ACTIVE.
 * Events can only be created for ACTIVE registers.
 *
 * POST /api/v1/client/registers/{registerId}/approve
 */
export function useApproveRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/client/registers/${id}/approve`
      );
      return res.data.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: registerKeys.all });
      queryClient.invalidateQueries({ queryKey: registerKeys.detail(id) });
      popup.success("Register Approved", "The organisation is now ACTIVE. Events can be created.", 3000);
    },
    onError: (error: any) =>
      parseAndToastApiError(error, "Approval failed. Please try again."),
  });
}

/**
 * Reject a PENDING register with an optional reason.
 *
 * POST /api/v1/client/registers/{registerId}/reject
 * Body: { reason? }
 */
export function useRejectRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/client/registers/${id}/reject`,
        reason ? { reason } : {}
      );
      return res.data.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: registerKeys.all });
      queryClient.invalidateQueries({ queryKey: registerKeys.detail(id) });
      popup.success("Register Rejected", "A rejection notice has been recorded.", 3000);
    },
    onError: (error: any) =>
      parseAndToastApiError(error, "Rejection failed. Please try again."),
  });
}

/**
 * Suspend an ACTIVE register — prevents new event creation.
 *
 * POST /api/v1/client/registers/{registerId}/suspend
 * Body: { reason? }
 */
export function useSuspendRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/client/registers/${id}/suspend`,
        reason ? { reason } : {}
      );
      return res.data.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: registerKeys.all });
      queryClient.invalidateQueries({ queryKey: registerKeys.detail(id) });
      popup.success("Register Suspended", "The organisation has been suspended. No new events can be created.", 3000);
    },
    onError: (error: any) =>
      parseAndToastApiError(error, "Suspension failed. Please try again."),
  });
}

/**
 * Reactivate a SUSPENDED register so events can be created again.
 *
 * POST /api/v1/client/registers/{registerId}/activate
 */
export function useActivateRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/client/registers/${id}/activate`
      );
      return res.data.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: registerKeys.all });
      queryClient.invalidateQueries({ queryKey: registerKeys.detail(id) });
      popup.success("Register Reactivated", "The organisation is ACTIVE again. Events can be created.", 3000);
    },
    onError: (error: any) =>
      parseAndToastApiError(error, "Activation failed. Please try again."),
  });
}

// ---------------------------------------------------------------------------
// Backward-compat alias — useStakeholderEvents is still imported by the
// existing detail page. Delegates to the corrected useRegisterEvents hook.
// ---------------------------------------------------------------------------
export const useStakeholderEvents = useRegisterEvents;

// ---------------------------------------------------------------------------
// Shareholders
// GET    /api/v1/client/registers/{id}/shareholders
// POST   /api/v1/client/registers/{id}/shareholders           (single)
// POST   /api/v1/client/registers/{id}/shareholders/bulk      (CSV batch)
// DELETE /api/v1/client/registers/{id}/shareholders/{sid}
// ---------------------------------------------------------------------------

export interface Shareholder {
  id:         string;
  fullName?:  string;
  firstName?: string;  // legacy compat — some responses still split the name
  lastName?:  string;
  email:      string;
  phone?:     string;
  chn?:       string;   // Central Securities Clearing System Holder Number
  units?:     number;   // Share units owned
  status?:    "ACTIVE" | "INACTIVE";
}

/** Shape expected by POST /api/v1/client/registers/{id}/shareholders */
export interface ShareholderUploadItem {
  fullName:  string;
  email:     string;
  phone?:    string;
  chn?:      string;
  units?:    number;
  status?:   "ACTIVE" | "INACTIVE";
}

export interface ShareholderListResponse {
  shareholders:  Shareholder[];
  totalCount:    number;
  page:          number;
  size:          number;
  totalPages:    number;
}

export const shareholderKeys = {
  list: (registerId: string) => ["register", registerId, "shareholders"] as const,
};

export function useRegisterShareholders(registerId: string, page = 0, size = 100) {
  return useQuery({
    queryKey: shareholderKeys.list(registerId),
    queryFn:  async () => {
      const res = await apiClient.get<ApiResponse<ShareholderListResponse>>(
        `/api/v1/client/registers/${registerId}/shareholders`,
        { params: { page, size } }
      );
      const raw = (res.data.data ?? (res.data as any)) as any;
      return {
        shareholders: raw?.shareholders ?? raw?.content ?? raw?.data ?? [],
        totalCount:   raw?.totalCount   ?? raw?.totalElements ?? 0,
        page:         raw?.page         ?? page,
        size:         raw?.size         ?? size,
        totalPages:   raw?.totalPages   ?? 1,
      } as ShareholderListResponse;
    },
    enabled:   !!registerId,
    staleTime: 30_000,
  });
}

export function useAddShareholder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      registerId,
      shareholder,
    }: {
      registerId:  string;
      shareholder: ShareholderUploadItem;
    }) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/client/registers/${registerId}/shareholders`,
        { shareholders: [shareholder], replace: false }
      );
      return (res.data.data ?? (res.data as any));
    },
    onSuccess: (_, { registerId }) => {
      queryClient.invalidateQueries({ queryKey: shareholderKeys.list(registerId) });
      popup.success("Shareholder Added", "The shareholder has been enrolled.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to add shareholder."),
  });
}

export function useBulkAddShareholders() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      registerId,
      shareholders,
      replace = false,
    }: {
      registerId:   string;
      shareholders: ShareholderUploadItem[];
      replace?:     boolean;
    }) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/client/registers/${registerId}/shareholders`,
        { shareholders, replace }
      );
      return (res.data.data ?? (res.data as any));
    },
    onSuccess: (data, { registerId, shareholders }) => {
      queryClient.invalidateQueries({ queryKey: shareholderKeys.list(registerId) });
      const d = data as any;
      // New response shape (AGM milestone #3): inserted/updated/skipped +
      // per-row errors. Rows with neither email NOR phone are skipped
      // server-side instead of saved contactless.
      if (d?.inserted != null || d?.updated != null || d?.skipped != null) {
        const parts = [
          d?.inserted ? `${d.inserted} added` : null,
          d?.updated  ? `${d.updated} updated` : null,
        ].filter(Boolean).join(", ") || "No changes";
        if ((d?.skipped ?? 0) > 0) {
          const errs: string[] = d?.errors ?? [];
          const detail = errs.slice(0, 3).join(" ") + (errs.length > 3 ? ` (+${errs.length - 3} more)` : "");
          popup.error(
            `Imported with ${d.skipped} row${d.skipped > 1 ? "s" : ""} skipped`,
            `${parts}. Skipped rows need at least an email or phone. ${detail}`,
          );
        } else {
          popup.success("Shareholders Imported", `${parts}.`, 3000);
        }
      } else {
        // Legacy response fallback
        const count = d?.count ?? d?.imported ?? shareholders.length;
        popup.success("Shareholders Imported", `${count} shareholders added successfully.`, 3000);
      }
    },
    onError: (error: any) => parseAndToastApiError(error, "Bulk import failed."),
  });
}

/** Shape accepted by PATCH .../shareholders/{shareholderId} — all fields optional, send only what changed. */
export interface ShareholderUpdatePayload {
  fullName?: string;
  chn?:      string;
  email?:    string;
  phone?:    string;
  units?:    number;
  status?:   "ACTIVE" | "INACTIVE";
}

export function useUpdateShareholder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      registerId,
      shareholderId,
      updates,
    }: {
      registerId:    string;
      shareholderId: string;
      updates:       ShareholderUpdatePayload;
    }) => {
      const res = await apiClient.patch<ApiResponse<Shareholder>>(
        `/api/v1/client/registers/${registerId}/shareholders/${shareholderId}`,
        updates
      );
      return (res.data.data ?? (res.data as any)) as Shareholder;
    },
    onSuccess: (_, { registerId }) => {
      queryClient.invalidateQueries({ queryKey: shareholderKeys.list(registerId) });
      popup.success("Shareholder Updated", "Changes have been saved.", 2500);
    },
    // 409 = CHN collision with another shareholder in the same register
    onError: (error: any) => parseAndToastApiError(error, "Failed to update shareholder."),
  });
}

export function useDeleteShareholder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ registerId, shareholderId }: { registerId: string; shareholderId: string }) => {
      await apiClient.delete(`/api/v1/client/registers/${registerId}/shareholders/${shareholderId}`);
    },
    onSuccess: (_, { registerId }) => {
      queryClient.invalidateQueries({ queryKey: shareholderKeys.list(registerId) });
      popup.success("Shareholder Removed", "Shareholder has been removed from the register.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to remove shareholder."),
  });
}
