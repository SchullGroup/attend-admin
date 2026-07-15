"use client";

/**
 * client-challenge-resources.ts — Resources for Innovation Challenges (F3, backend 2026-07-15)
 *
 * Client admin:
 *   POST   /api/v1/client/challenges/{challengeId}/resources               → add
 *   PATCH  /api/v1/client/challenges/{challengeId}/resources/{resourceId}  → update
 *   DELETE /api/v1/client/challenges/{challengeId}/resources/{resourceId}  → delete
 *   GET    /api/v1/client/challenges/{challengeId}/resources               → list
 * Super admin (read-only):
 *   GET    /api/v1/admin/challenges/{id}/resources
 *
 * PDF/DOC resources upload their binary via POST /api/v1/upload first (same
 * two-step pattern as event documents); LINK/VIDEO resources are just URLs.
 * Backend notifies challenge participants automatically on every add.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResourceType = "PDF" | "DOC" | "LINK" | "VIDEO";

export interface ChallengeResource {
  id:           string;
  title:        string;
  description?: string;
  category?:    string;
  type:         ResourceType;
  fileUrl?:     string;
  externalUrl?: string;
  createdAt?:   string;
}

export interface CreateResourceRequest {
  title:        string;
  description?: string;
  category?:    string;
  type:         ResourceType;
  fileUrl?:     string;      // for PDF/DOC (from /api/v1/upload)
  externalUrl?: string;      // for LINK/VIDEO
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

const VALID_TYPES = new Set<ResourceType>(["PDF", "DOC", "LINK", "VIDEO"]);

function normalizeResource(raw: any): ChallengeResource {
  const type = String(raw?.type ?? "LINK").toUpperCase() as ResourceType;
  return {
    id:          String(raw?.id ?? raw?.resourceId ?? ""),
    title:       raw?.title ?? raw?.name ?? "",
    description: raw?.description ?? undefined,
    category:    raw?.category ?? undefined,
    type:        VALID_TYPES.has(type) ? type : "LINK",
    fileUrl:     raw?.fileUrl ?? raw?.downloadUrl ?? undefined,
    externalUrl: raw?.externalUrl ?? raw?.url ?? undefined,
    createdAt:   raw?.createdAt,
  };
}

function normalizeList(raw: any): ChallengeResource[] {
  const arr = Array.isArray(raw) ? raw : raw?.resources ?? raw?.items ?? raw?.content ?? [];
  return (arr as any[]).map(normalizeResource).filter((r) => r.id);
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const resourceKeys = {
  list:      (challengeId: string) => ["challengeResources", "list", challengeId] as const,
  adminList: (challengeId: string) => ["challengeResources", "adminList", challengeId] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useChallengeResources(challengeId: string | null | undefined, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: resourceKeys.list(challengeId ?? ""),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(`/api/v1/client/challenges/${challengeId}/resources`);
      return normalizeList(res.data.data);
    },
    enabled: !!challengeId && (opts?.enabled ?? true),
    staleTime: 30_000,
  });
}

export function useAdminChallengeResources(challengeId: string | null | undefined, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: resourceKeys.adminList(challengeId ?? ""),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(`/api/v1/admin/challenges/${challengeId}/resources`);
      return normalizeList(res.data.data);
    },
    enabled: !!challengeId && (opts?.enabled ?? true),
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations (client admin)
// ---------------------------------------------------------------------------

export function useAddChallengeResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ challengeId, payload }: { challengeId: string; payload: CreateResourceRequest }) => {
      const res = await apiClient.post<ApiResponse<any>>(`/api/v1/client/challenges/${challengeId}/resources`, payload);
      return normalizeResource(res.data.data);
    },
    onSuccess: (_d, { challengeId }) => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.list(challengeId) });
      popup.success("Resource Added", "Participants have been notified.", 2500);
    },
    onError: (e) => parseAndToastApiError(e, "Failed to add resource."),
  });
}

export function useUpdateChallengeResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ challengeId, resourceId, payload }: {
      challengeId: string; resourceId: string; payload: Partial<CreateResourceRequest>;
    }) => {
      const res = await apiClient.patch<ApiResponse<any>>(
        `/api/v1/client/challenges/${challengeId}/resources/${resourceId}`, payload
      );
      return res.data.data;
    },
    onSuccess: (_d, { challengeId }) => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.list(challengeId) });
    },
    onError: (e) => parseAndToastApiError(e, "Failed to update resource."),
  });
}

export function useDeleteChallengeResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ challengeId, resourceId }: { challengeId: string; resourceId: string }) => {
      await apiClient.delete(`/api/v1/client/challenges/${challengeId}/resources/${resourceId}`);
    },
    onSuccess: (_d, { challengeId }) => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.list(challengeId) });
    },
    onError: (e) => parseAndToastApiError(e, "Failed to delete resource."),
  });
}
