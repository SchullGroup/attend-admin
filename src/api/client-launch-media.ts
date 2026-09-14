"use client";

/**
 * client-launch-media.ts — event media gallery (backend note 2026-09-11 §2, generalised 09-14)
 *
 * `launch-media` in the paths is historical. The PRODUCT_LAUNCH type guard was dropped on
 * 2026-09-14: these endpoints serve every event type, and `launchMedia[]` on the participant
 * event detail populates for all of them.
 *
 * Client admin:
 *   POST   /api/v1/client/events/{eventId}/launch-media/upload-session   → signed PUT URL
 *   PUT    <uploadUrl>                                                   → raw bytes → OBS
 *   POST   /api/v1/client/events/{eventId}/launch-media/{mediaId}/complete
 *   GET    /api/v1/client/events/{eventId}/launch-media                  → organiser gallery
 *   DELETE /api/v1/client/events/{eventId}/launch-media/{mediaId}
 *
 * The bytes never touch our API — this is the same three-step signed-upload
 * shape the CSV invite import uses (see useImportInviteCsv in client-events.ts),
 * so neither the 25MB app limit nor the nginx body limit applies to the file
 * itself. Only the small JSON session/complete calls go through the API.
 *
 * Two things the backend note is explicit about and this module depends on:
 *   1. `url` on a READY asset is a SIGNED OBS URL that expires in about an hour.
 *      It must never be persisted, cached or emailed — the list query re-reads
 *      it before expiry (see `refreshIntervalMs`) so long-lived tabs don't rot.
 *   2. The browser PUT is preflighted and stays blocked until the OBS bucket
 *      CORS rule lands (note §6.2) with the web origins on GET/HEAD/PUT. Until
 *      then the PUT fails as a network error with no response — the copy in
 *      `useUploadLaunchMedia` says so instead of a bare "upload failed".
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LaunchMediaType   = "IMAGE" | "VIDEO";
/** AWAITING_UPLOAD assets appear on the organiser list only, and carry a null url. */
export type LaunchMediaStatus = "AWAITING_UPLOAD" | "READY";

export interface LaunchMediaAsset {
  id:                   string;
  mediaType:            LaunchMediaType;
  status:               LaunchMediaStatus;
  /** Signed OBS URL — null while AWAITING_UPLOAD. Short-lived; never persist it. */
  url:                  string | null;
  /** Lifetime of `url` in seconds (~3600). Drives the background refresh below. */
  urlExpiresInSeconds?: number;
  contentType:          string;
  originalFilename?:    string;
  sizeBytes?:           number;
  title?:               string | null;
  orderIndex:           number;
}

export interface LaunchMediaUploadSession {
  mediaId:         string;
  uploadUrl:       string;
  requiredHeaders: Record<string, string>;
  expiresAt:       string;
  mediaType:       LaunchMediaType;
}

export interface CreateLaunchMediaSessionRequest {
  filename:    string;
  contentType: string;
  sizeBytes:   number;
  title?:      string;
}

// ---------------------------------------------------------------------------
// Accepted types and size caps (note §2 "Limits and rejections")
// ---------------------------------------------------------------------------
//
// Checked client-side so an oversized or unsupported file is refused before we
// spend bandwidth on it — the server checks the declared `sizeBytes` at session
// creation and is still the authority (415 / 413).

export const LAUNCH_MEDIA_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const LAUNCH_MEDIA_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
export const LAUNCH_MEDIA_ACCEPT      = [...LAUNCH_MEDIA_IMAGE_TYPES, ...LAUNCH_MEDIA_VIDEO_TYPES].join(",");

export const MAX_LAUNCH_IMAGE_BYTES = 15  * 1_048_576;   // 15MB
export const MAX_LAUNCH_VIDEO_BYTES = 500 * 1_048_576;   // 500MB

/** Mirrors the server's own derivation of mediaType from the content type. */
export function launchMediaKind(contentType: string): LaunchMediaType | null {
  const ct = (contentType || "").toLowerCase();
  if ((LAUNCH_MEDIA_IMAGE_TYPES as readonly string[]).includes(ct)) return "IMAGE";
  if ((LAUNCH_MEDIA_VIDEO_TYPES as readonly string[]).includes(ct)) return "VIDEO";
  return null;
}

/** Returns a human-readable rejection reason, or null when the file is acceptable. */
export function validateLaunchMediaFile(file: File): string | null {
  const kind = launchMediaKind(file.type);
  if (!kind) {
    return "Unsupported file type. Images: JPEG, PNG, WebP, GIF. Video: MP4, WebM, MOV.";
  }
  const cap = kind === "IMAGE" ? MAX_LAUNCH_IMAGE_BYTES : MAX_LAUNCH_VIDEO_BYTES;
  if (file.size > cap) {
    return kind === "IMAGE"
      ? "Images must be 15 MB or smaller."
      : "Videos must be 500 MB or smaller.";
  }
  return null;
}

export function formatMediaSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function responseData<T>(response: any): T {
  return ((response?.data as any)?.data ?? response?.data) as T;
}

function normalizeAsset(raw: any): LaunchMediaAsset {
  const status = String(raw?.status ?? "").toUpperCase() === "READY" ? "READY" : "AWAITING_UPLOAD";
  return {
    id:                  String(raw?.id ?? raw?.mediaId ?? ""),
    mediaType:           String(raw?.mediaType ?? "").toUpperCase() === "VIDEO" ? "VIDEO" : "IMAGE",
    status,
    url:                 raw?.url ?? null,
    urlExpiresInSeconds: typeof raw?.urlExpiresInSeconds === "number" ? raw.urlExpiresInSeconds : undefined,
    contentType:         raw?.contentType ?? "",
    originalFilename:    raw?.originalFilename ?? undefined,
    sizeBytes:           typeof raw?.sizeBytes === "number" ? raw.sizeBytes : undefined,
    title:               raw?.title ?? null,
    orderIndex:          typeof raw?.orderIndex === "number" ? raw.orderIndex : 0,
  };
}

function normalizeList(raw: any): LaunchMediaAsset[] {
  const arr = Array.isArray(raw) ? raw : raw?.media ?? raw?.launchMedia ?? raw?.items ?? raw?.content ?? [];
  return (arr as any[])
    .map(normalizeAsset)
    .filter((a) => a.id)
    // There is no reorder endpoint yet (note "Not done"): orderIndex is assigned
    // on upload and honoured on read, so sorting here is the whole ordering story.
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

/**
 * When to re-read the list so signed URLs are replaced before they expire.
 * 80% of the shortest TTL on the page, floored at a minute so a short or
 * mis-reported TTL can't turn into a refetch storm.
 */
function refreshIntervalMs(assets: LaunchMediaAsset[] | undefined): number | false {
  const ttls = (assets ?? [])
    .map((a) => a.urlExpiresInSeconds)
    .filter((n): n is number => typeof n === "number" && n > 0);
  if (!ttls.length) return false;
  return Math.max(60_000, Math.min(...ttls) * 800);
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const launchMediaKeys = {
  list: (eventId: string) => ["launchMedia", "list", eventId] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Organiser gallery. Includes AWAITING_UPLOAD assets, so a failed upload is
 * visible and removable instead of invisibly stuck. Participants see only
 * READY assets, via `launchMedia[]` on the participant event detail.
 */
export function useLaunchMedia(eventId: string | null | undefined, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: launchMediaKeys.list(eventId ?? ""),
    enabled: !!eventId && (opts?.enabled ?? true),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        `/api/v1/client/events/${eventId}/launch-media`
      );
      return normalizeList(responseData<any>(res));
    },
    // Signed URLs go stale on a wall clock, not on user activity.
    staleTime: 30_000,
    refetchInterval: (query) => refreshIntervalMs(query.state.data as LaunchMediaAsset[] | undefined),
    refetchIntervalInBackground: false,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Errors we raise ourselves (rather than an axios failure with a server body).
 * `parseAndToastApiError` reads server payloads and would otherwise fall back to
 * a generic string, throwing away the more specific message.
 */
class LaunchMediaUploadError extends Error {}

/**
 * Three-step upload: session → direct PUT to storage → complete.
 *
 * The PUT deliberately uses the bare axios instance: apiClient would attach our
 * bearer token and a JSON content type to a third-party signed URL, and the
 * Content-Type has to match the one signed into the session exactly.
 */
export function useUploadLaunchMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      eventId,
      file,
      title,
      onUploadProgress,
    }: {
      eventId: string;
      file: File;
      title?: string;
      onUploadProgress?: (percent: number) => void;
    }) => {
      const contentType = file.type || "application/octet-stream";

      // 1 — reserve the asset and get a signed URL (expires in 15 minutes)
      const sessionRes = await apiClient.post<ApiResponse<LaunchMediaUploadSession>>(
        `/api/v1/client/events/${eventId}/launch-media/upload-session`,
        {
          filename:    file.name,
          contentType,
          sizeBytes:   file.size,
          ...(title?.trim() ? { title: title.trim() } : {}),
        } satisfies CreateLaunchMediaSessionRequest
      );
      const session = responseData<LaunchMediaUploadSession>(sessionRes);
      if (!session?.uploadUrl || !session?.mediaId) {
        throw new LaunchMediaUploadError("The server did not return an upload URL.");
      }

      // 2 — raw bytes straight to storage. No multipart, no form fields, no
      // Authorization header. Content-Type is part of the signature.
      try {
        await axios.put(session.uploadUrl, file, {
          headers: { "Content-Type": contentType, ...(session.requiredHeaders ?? {}) },
          maxBodyLength:    Infinity,
          maxContentLength: Infinity,
          timeout:          0,
          onUploadProgress: (progress) => {
            if (!onUploadProgress) return;
            const total = progress.total ?? file.size;
            onUploadProgress(total > 0 ? Math.min(100, Math.round((progress.loaded / total) * 100)) : 0);
          },
        });
      } catch (err: any) {
        // A cross-origin PUT with no response at all is the §6.2 CORS rule
        // missing, not a broken file — say which one it is.
        if (!err?.response) {
          throw new LaunchMediaUploadError(
            "The browser could not upload to storage. This is the bucket CORS rule (GET/HEAD/PUT for this origin) not being in place yet, not a problem with the file."
          );
        }
        throw err;
      }

      // 3 — publish. Verifies the object actually landed; 409 if it did not.
      // Idempotent, so a retry after a dropped response is safe.
      const completeRes = await apiClient.post<ApiResponse<any>>(
        `/api/v1/client/events/${eventId}/launch-media/${session.mediaId}/complete`,
        {}
      );
      return normalizeAsset(responseData<any>(completeRes));
    },
    onSuccess: (_asset, { eventId }) => {
      popup.success("Media Added", "The file is uploaded and live on the event page.", 2500);
    },
    // Refresh on failure as well, not just success. The session step commits the
    // AWAITING_UPLOAD row before handing back the signed URL (backend note 2026-09-14 §7.1),
    // so a failed PUT leaves a real orphan row — and there is no server-side sweeper for it.
    // Invalidating only onSuccess left that row invisible until the refresh timer fired,
    // which is why a failed upload looked like it had left no trace.
    onSettled: (_data, _error, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: launchMediaKeys.list(eventId) });
    },
    onError: (error: any) =>
      parseAndToastApiError(
        error,
        error instanceof LaunchMediaUploadError ? error.message : "Failed to upload media."
      ),
  });
}

/** Removes the asset and the stored file. */
export function useDeleteLaunchMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, mediaId }: { eventId: string; mediaId: string }) => {
      await apiClient.delete(`/api/v1/client/events/${eventId}/launch-media/${mediaId}`);
    },
    onSuccess: (_d, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: launchMediaKeys.list(eventId) });
      popup.success("Media Removed", "The asset and its stored file are deleted.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to delete media."),
  });
}
