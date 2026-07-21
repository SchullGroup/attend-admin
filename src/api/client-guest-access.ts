"use client";

/**
 * client-guest-access.ts — Guest access codes for events (AGM milestone #2)
 *
 * Admin side only (CLIENT_ADMIN / ADMIN / EVENT_MANAGER):
 *   POST   /api/v1/client/events/{eventId}/guest-access             → create code
 *   GET    /api/v1/client/events/{eventId}/guest-access             → list codes
 *   DELETE /api/v1/client/events/{eventId}/guest-access/{accessId}  → revoke (immediate)
 *
 * The guest-facing join/view endpoints (/api/v1/guest/*) belong to the
 * participant platform, not this dashboard. A "shareable link" is just the
 * code embedded in the participant app's join-page URL — no link entity
 * exists on the backend.
 *
 * Scope note: guest access is view/join only — no voting, polls, or chat.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import { ApiResponse } from "@/types/api";

export interface GuestAccessCode {
  id:        string;
  code:      string;
  label?:    string | null;
  expiresAt?: string | null;
  maxUses?:  number | null;
  useCount:  number;
  revoked:   boolean;
  createdAt?: string;
}

export interface CreateGuestAccessRequest {
  label?:     string;
  expiresAt?: string;   // ISO
  maxUses?:   number;
}

function normalizeCode(raw: any): GuestAccessCode {
  return {
    id:        String(raw?.id ?? ""),
    code:      raw?.code ?? "",
    label:     raw?.label ?? null,
    expiresAt: raw?.expiresAt ?? null,
    maxUses:   raw?.maxUses ?? null,
    useCount:  raw?.useCount ?? 0,
    revoked:   !!raw?.revoked,
    createdAt: raw?.createdAt,
  };
}

export const guestAccessKeys = {
  list: (eventId: string) => ["guestAccess", "list", eventId] as const,
};

export function useGuestAccessCodes(eventId: string | null | undefined, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: guestAccessKeys.list(eventId ?? ""),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(`/api/v1/client/events/${eventId}/guest-access`);
      const raw = res.data.data;
      const arr = Array.isArray(raw) ? raw : raw?.codes ?? raw?.items ?? raw?.content ?? [];
      return (arr as any[]).map(normalizeCode).filter((c) => c.id);
    },
    enabled: !!eventId && (opts?.enabled ?? true),
    staleTime: 15_000,
  });
}

export function useCreateGuestAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, payload }: { eventId: string; payload: CreateGuestAccessRequest }) => {
      const res = await apiClient.post<ApiResponse<any>>(`/api/v1/client/events/${eventId}/guest-access`, payload);
      return normalizeCode(res.data.data);
    },
    onSuccess: (code, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: guestAccessKeys.list(eventId) });
      popup.success("Guest Code Created", `Code ${code.code} is ready to share.`, 2500);
    },
    onError: (e) => parseAndToastApiError(e, "Failed to create guest access code."),
  });
}

export function useRevokeGuestAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, accessId }: { eventId: string; accessId: string }) => {
      await apiClient.delete(`/api/v1/client/events/${eventId}/guest-access/${accessId}`);
    },
    onSuccess: (_d, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: guestAccessKeys.list(eventId) });
      popup.success("Code Revoked", "Existing guest tokens for this code stop working immediately.", 2500);
    },
    onError: (e) => parseAndToastApiError(e, "Failed to revoke code."),
  });
}
