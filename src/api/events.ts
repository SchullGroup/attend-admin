"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { toast } from "sonner";
import { parseAndToastApiError } from "@/lib/api-error";
import {
  CreateAgmEventRequest,
  CreateGeneralEventRequest,
  CreateInnovationEventRequest,
  CreateProductLaunchEventRequest,
} from "@/types/super-admin";
import { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Cache key — matches the superAdminKeys.all root used in super-admin.ts
// so invalidation sweeps the same query tree.
// ---------------------------------------------------------------------------
const EVENTS_KEY = ["super-admin", "events"] as const;

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Create an AGM / EGM event — POST /api/v1/admin/events/agm
 * Handles shareholder targeting, proxy options, quorum, and optional base64 notice upload.
 * Event is initialized in DRAFT status.
 */
export function useCreateAgmEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateAgmEventRequest) => {
      const res = await apiClient.post<ApiResponse<any>>(
        "/api/v1/admin/events/agm",
        data
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EVENTS_KEY });
      popup.success(
        "AGM Created",
        "The meeting has been created as a draft. Publish when ready.",
        3000
      );
    },
    onError: (error: any) => parseAndToastApiError(error, "AGM creation failed. Please check the form and try again."),
  });
}

/**
 * Create a General Event — POST /api/v1/admin/events/general
 * For summits, conferences, workshops, or internal training sessions.
 * Event is initialized in DRAFT status.
 */
export function useCreateGeneralEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateGeneralEventRequest) => {
      const res = await apiClient.post<ApiResponse<any>>(
        "/api/v1/admin/events/general",
        data
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EVENTS_KEY });
      popup.success(
        "Event Created",
        "The event has been created as a draft. Publish when ready.",
        3000
      );
    },
    onError: (error: any) => parseAndToastApiError(error, "Event creation failed. Please check the form and try again."),
  });
}

/**
 * Create an Innovation Challenge / Hackathon — POST /api/v1/admin/events/innovation
 *
 * ⚠️ Judging criteria validation: the CALLER must verify that
 *    sum(data.judgingCriteria[].weightPercent) === 100 before calling mutate().
 *    This hook performs a secondary guard and rejects via toast if weights are off.
 *
 * Event is initialized in DRAFT status.
 */
export function useCreateInnovationEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateInnovationEventRequest) => {
      // Client-side criteria weight validation guard
      if (data.judgingCriteria && data.judgingCriteria.length > 0) {
        const totalWeight = data.judgingCriteria.reduce(
          (sum, c) => sum + (c.weight || 0),
          0
        );
        if (totalWeight !== 100) {
          throw new Error(
            `Judging criteria weights must sum to exactly 100% (current total: ${totalWeight}%).`
          );
        }
      }
      const res = await apiClient.post<ApiResponse<any>>(
        "/api/v1/admin/events/innovation",
        data
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EVENTS_KEY });
      popup.success(
        "Challenge Created",
        "The innovation challenge has been created as a draft. Publish when ready.",
        3000
      );
    },
    onError: (error: any) => {
      // Surface client-side weight validation error directly — it's not an API error
      if (error instanceof Error && error.message.includes("Judging criteria")) {
        toast.error(error.message);
        console.error("[Criteria Weight Validation]:", error.message);
        return;
      }
      parseAndToastApiError(error, "Innovation challenge creation failed. Please check the form and try again.");
    },
  });
}

/**
 * Create a Product Launch Event — POST /api/v1/admin/events/product-launch
 * Carries microsite slug, embargo details, and speaker tracking.
 * Event is initialized in DRAFT status.
 */
export function useCreateProductLaunchEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateProductLaunchEventRequest) => {
      const res = await apiClient.post<ApiResponse<any>>(
        "/api/v1/admin/events/product-launch",
        data
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EVENTS_KEY });
      popup.success(
        "Launch Created",
        "The product launch event has been created as a draft. Publish when ready.",
        3000
      );
    },
    onError: (error: any) => parseAndToastApiError(error, "Product launch creation failed. Please check the form and try again."),
  });
}
