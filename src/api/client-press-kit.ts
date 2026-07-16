"use client";

/**
 * client-press-kit.ts — Press Kit for Product Launch events (F2, backend 2026-07-15)
 *
 * Client admin:
 *   POST   /api/v1/client/events/{eventId}/press-kit                 → upload
 *   PATCH  /api/v1/client/events/{eventId}/press-kit/{docId}         → update metadata/embargo
 *   PATCH  /api/v1/client/events/{eventId}/press-kit/{docId}/release → release one
 *   PATCH  /api/v1/client/events/{eventId}/press-kit/release-all     → release all
 *   DELETE /api/v1/client/events/{eventId}/press-kit/{docId}         → delete
 *   GET    /api/v1/client/events/{eventId}/press-kit                 → list (admin view)
 * Super admin (read-only):
 *   GET    /api/v1/admin/events/{id}/press-kit
 *
 * File handling mirrors the event-documents pattern: the binary goes to
 * POST /api/v1/upload (multipart, returns fileUrl/cloudinaryPublicId), then
 * this module posts metadata + fileUrl to the press-kit endpoint. If the
 * backend turns out to expect base64/multipart directly on the press-kit
 * route instead, only `useUploadPressKitDoc`'s payload needs adjusting.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReleaseMode = "MANUAL" | "SCHEDULED";

export interface PressKitDoc {
  id:                string;
  title:             string;
  fileUrl?:          string;
  originalFilename?: string;
  sizeBytes?:        number;
  sizeLabel?:        string;
  releaseMode:       ReleaseMode;
  releaseAt?:        string | null;
  released:          boolean;
  releasedAt?:       string | null;
  createdAt?:        string;
}

export interface CreatePressKitDocRequest {
  title:               string;
  fileUrl:             string;
  cloudinaryPublicId?: string;
  originalFilename:    string;
  sizeBytes:           number;
  releaseMode:         ReleaseMode;
  releaseAt?:          string;      // ISO — required when SCHEDULED
}

export interface UpdatePressKitDocRequest {
  title?:       string;
  releaseMode?: ReleaseMode;
  releaseAt?:   string | null;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

// Confirmed live shape (2026-07-15): data.files[], with `downloadUrl`,
// `status: "EMBARGOED"|"RELEASED"`, `scheduledReleaseAt`, `uploadedAt`,
// `sizeLabel`. Earlier guesses kept as fallbacks.
function normalizeDoc(raw: any): PressKitDoc {
  const status = String(raw?.status ?? "").toUpperCase();
  const released =
    status === "RELEASED" ? true :
    status === "EMBARGOED" ? false :
    raw?.released ?? raw?.isReleased ?? !!raw?.releasedAt;
  const releaseAt = raw?.scheduledReleaseAt ?? raw?.releaseAt ?? null;
  return {
    id:               String(raw?.id ?? raw?.docId ?? raw?.documentId ?? ""),
    title:            raw?.title ?? raw?.name ?? "",
    fileUrl:          raw?.downloadUrl ?? raw?.fileUrl ?? raw?.url ?? undefined,
    originalFilename: raw?.originalFilename ?? raw?.filename ?? undefined,
    sizeBytes:        raw?.sizeBytes ?? undefined,
    sizeLabel:        raw?.sizeLabel ?? undefined,
    releaseMode:      String(raw?.releaseMode ?? (releaseAt ? "SCHEDULED" : "MANUAL")).toUpperCase() === "SCHEDULED" ? "SCHEDULED" : "MANUAL",
    releaseAt,
    released,
    releasedAt:       raw?.releasedAt ?? null,
    createdAt:        raw?.uploadedAt ?? raw?.createdAt,
  };
}

function normalizeList(raw: any): PressKitDoc[] {
  const arr = Array.isArray(raw) ? raw : raw?.files ?? raw?.documents ?? raw?.pressKit ?? raw?.items ?? raw?.content ?? [];
  return (arr as any[]).map(normalizeDoc).filter((d) => d.id);
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const pressKitKeys = {
  list:      (eventId: string) => ["pressKit", "list", eventId] as const,
  adminList: (eventId: string) => ["pressKit", "adminList", eventId] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function usePressKit(eventId: string | null | undefined, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: pressKitKeys.list(eventId ?? ""),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(`/api/v1/client/events/${eventId}/press-kit`);
      return normalizeList(res.data.data);
    },
    enabled: !!eventId && (opts?.enabled ?? true),
    staleTime: 15_000,
  });
}

export function useAdminPressKit(eventId: string | null | undefined, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: pressKitKeys.adminList(eventId ?? ""),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(`/api/v1/admin/events/${eventId}/press-kit`);
      return normalizeList(res.data.data);
    },
    enabled: !!eventId && (opts?.enabled ?? true),
    staleTime: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations (client admin)
// ---------------------------------------------------------------------------

function useInvalidatingMutation<TVars extends { eventId: string }>(
  fn: (vars: TVars) => Promise<any>,
  errorMsg: string,
  successToast?: { title: string; message: string }
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: pressKitKeys.list(vars.eventId) });
      if (successToast) popup.success(successToast.title, successToast.message, 2500);
    },
    onError: (e) => parseAndToastApiError(e, errorMsg),
  });
}

export function useUploadPressKitDoc() {
  return useInvalidatingMutation(
    async ({ eventId, payload }: { eventId: string; payload: CreatePressKitDocRequest }) => {
      const res = await apiClient.post<ApiResponse<any>>(`/api/v1/client/events/${eventId}/press-kit`, payload);
      return normalizeDoc(res.data.data);
    },
    "Failed to add press kit document.",
    { title: "Document Added", message: "Press kit document uploaded." }
  );
}

export function useUpdatePressKitDoc() {
  return useInvalidatingMutation(
    async ({ eventId, docId, payload }: { eventId: string; docId: string; payload: UpdatePressKitDocRequest }) => {
      const res = await apiClient.patch<ApiResponse<any>>(`/api/v1/client/events/${eventId}/press-kit/${docId}`, payload);
      return res.data.data;
    },
    "Failed to update document."
  );
}

export function useReleasePressKitDoc() {
  return useInvalidatingMutation(
    async ({ eventId, docId }: { eventId: string; docId: string }) => {
      const res = await apiClient.patch<ApiResponse<any>>(`/api/v1/client/events/${eventId}/press-kit/${docId}/release`, {});
      return res.data.data;
    },
    "Failed to release document.",
    { title: "Released", message: "Document is now visible to attendees." }
  );
}

export function useReleaseAllPressKit() {
  return useInvalidatingMutation(
    async ({ eventId }: { eventId: string }) => {
      const res = await apiClient.patch<ApiResponse<any>>(`/api/v1/client/events/${eventId}/press-kit/release-all`, {});
      return res.data.data;
    },
    "Failed to release documents.",
    { title: "All Released", message: "Every embargoed document is now live." }
  );
}

export function useDeletePressKitDoc() {
  return useInvalidatingMutation(
    async ({ eventId, docId }: { eventId: string; docId: string }) => {
      await apiClient.delete(`/api/v1/client/events/${eventId}/press-kit/${docId}`);
    },
    "Failed to delete document."
  );
}
