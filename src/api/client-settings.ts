"use client";

/**
 * client-settings.ts — organisation-wide client settings (backend note 2026-09-11 §3)
 *
 *   GET /api/v1/client/settings/support-email                  → read the org address
 *   PUT /api/v1/client/settings/support-email                  → set it
 *   PUT /api/v1/client/events/{id}/settings/support-email      → override it for one AGM
 *
 * Resolution is AGM override → organisation setting → platform default, and it
 * happens on every read rather than being copied onto the event at creation —
 * so correcting a typo here immediately fixes every AGM that has not
 * deliberately overridden it.
 *
 * Two fields come back and both matter to the UI:
 *   supportEmail          — what is actually set (null when unset)
 *   effectiveSupportEmail — what attendees see after resolution
 *   platformDefault       — the fallback, used as the input placeholder
 *
 * Sending "" clears the setting; omitting the field leaves it unchanged. On the
 * per-AGM override, "" is how that AGM goes back to inheriting.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SupportEmailSettings {
  /** What is set at this scope — null when unset (i.e. inheriting). */
  supportEmail:          string | null;
  /** What attendees actually see once the cascade is resolved. Never null. */
  effectiveSupportEmail: string;
  /** Platform fallback, e.g. support@experienceattend.com. Use as placeholder. */
  platformDefault:       string;
}

export interface UpdateSupportEmailRequest {
  /** "" clears the setting (per-AGM: goes back to inheriting the org address). */
  supportEmail: string;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const clientSettingsKeys = {
  supportEmail:      ["clientSettings", "supportEmail"] as const,
  eventSupportEmail: (eventId: string) => ["clientSettings", "supportEmail", eventId] as const,
};

function responseData<T>(response: any): T {
  return ((response?.data as any)?.data ?? response?.data) as T;
}

function normalizeSupportEmail(raw: any): SupportEmailSettings {
  return {
    supportEmail:          raw?.supportEmail ?? null,
    effectiveSupportEmail: raw?.effectiveSupportEmail ?? raw?.supportEmail ?? raw?.platformDefault ?? "",
    platformDefault:       raw?.platformDefault ?? "",
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Organisation-wide support address every AGM inherits. */
export function useSupportEmail(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clientSettingsKeys.supportEmail,
    enabled: opts?.enabled ?? true,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>("/api/v1/client/settings/support-email");
      return normalizeSupportEmail(responseData<any>(res));
    },
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Set (or, with "", clear) the organisation's support address. */
export function useUpdateSupportEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (supportEmail: string) => {
      const res = await apiClient.put<ApiResponse<any>>(
        "/api/v1/client/settings/support-email",
        { supportEmail } satisfies UpdateSupportEmailRequest
      );
      return normalizeSupportEmail(responseData<any>(res));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: clientSettingsKeys.supportEmail });
      // Event reads resolve the address live, so anything showing "Need help?"
      // should pick the new one up.
      queryClient.invalidateQueries({ queryKey: ["clientEvents"] });
      popup.success(
        "Support Contact Saved",
        data.supportEmail
          ? `Attendees will be pointed at ${data.effectiveSupportEmail}.`
          : `Cleared — AGMs fall back to ${data.effectiveSupportEmail}.`,
        3000
      );
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to save the support address."),
  });
}

/**
 * Override the support address for one AGM. Send "" to drop the override and
 * go back to inheriting the organisation setting.
 */
export function useUpdateEventSupportEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, supportEmail }: { eventId: string; supportEmail: string }) => {
      const res = await apiClient.put<ApiResponse<any>>(
        `/api/v1/client/events/${eventId}/settings/support-email`,
        { supportEmail } satisfies UpdateSupportEmailRequest
      );
      return normalizeSupportEmail(responseData<any>(res));
    },
    onSuccess: (data, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: clientSettingsKeys.eventSupportEmail(eventId) });
      queryClient.invalidateQueries({ queryKey: ["clientEvents"] });
      popup.success(
        "Support Contact Updated",
        data.supportEmail
          ? `This AGM now uses ${data.effectiveSupportEmail}.`
          : `Override removed — this AGM inherits ${data.effectiveSupportEmail}.`,
        3000
      );
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to save the support address."),
  });
}
