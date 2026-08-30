"use client";

/**
 * client-events.ts — Client Event Management API
 *
 * All endpoints are under /api/v1/client/events and belong to the
 * stakeholder/register whose account is authenticated.
 *
 * Lifecycle state machine:
 *   DRAFT → PUBLISHED (publish) → LIVE (go-live) → ENDED (end)
 *   Any non-terminal state → CANCELLED (cancel)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import { ApiResponse } from "@/types/api";
import type { RegisterBranding } from "@/types/super-admin";

// ---------------------------------------------------------------------------
// Types — aligned with swagger schemas
// ---------------------------------------------------------------------------

export interface EventListItem {
  id:          string;
  title:       string;
  eventType:   string;
  date:        string;
  format:      string;
  rsvpCount:   number;
  capacity:    number;
  fillRate:    number;
  status:      "DRAFT" | "PUBLISHED" | "UPCOMING" | "LIVE" | "ENDED" | "CANCELLED";
  /** The name of the register (organisation) that owns this event — use for the "Organizer" UI field. */
  registerName?: string;
  registerId?:   string;
  rsvpEnabled?:  boolean;
  /** Register branding (F4), inherited live — { logoUrl, brandColor }. */
  branding?:     RegisterBranding;
}

export interface EventListResponse {
  totalCount: number;
  label?:     string;
  page:       number;
  size:       number;
  events:     EventListItem[];
}

export interface EventOption {
  id:    string;
  label: string;
}

export type EventStatus = "DRAFT" | "PUBLISHED" | "UPCOMING" | "LIVE" | "ENDED" | "CANCELLED";

export interface StatusTransitionResponse {
  id:                    string;
  status:                EventStatus;
  updatedAt:             string;
  zoomMeetingEndStatus?: "NOT_CONFIGURED" | "NOT_IN_PROGRESS" | "ENDED" | "PENDING_RETRY";
}

// Zoom Meeting — returned on event detail once a host slot has been claimed for the
// event (lazily, via POST /events/{id}/zoom), not at creation time (see §7a).
export interface ZoomMeetingDto {
  meetingId:       number;
  password:        string;
  joinUrl:         string;
  startUrl:        string;
  durationMinutes: number;
  /**
   * §7f: the host's ZAK (Zoom Access Key) minted for this meeting on a pooled host
   * account, letting the organiser start it as host from the dashboard. Short-lived
   * and re-minted on every create/refresh call, so it is never cached — just passed
   * through when present. Absent until the §7 backend deploys.
   */
  hostZak?:        string;
}

// Agenda
export interface AgendaItemDto {
  id?:              string;
  order?:           number;
  time:             string;
  title:            string;
  speaker?:         string;
  durationMinutes?: number;
}

export interface AddAgendaItemRequest {
  time:             string;
  title:            string;
  speaker?:         string;
  durationMinutes?: number;
}

export interface UpdateAgendaItemRequest {
  time?:            string;
  title?:           string;
  speaker?:         string;
  durationMinutes?: number;
}

export interface AgendaListResponse {
  eventId:     string;
  agendaItems: AgendaItemDto[];
}

// Speakers
export interface SpeakerRequest {
  name:      string;
  roleTitle: string;
  bio?:      string;
}

// PATCH event
export interface UpdateEventRequest {
  title?:                     string;
  description?:               string;
  format?:                    "VIRTUAL" | "IN_PERSON" | "HYBRID";
  date?:                      string;
  startTime?:                 string;
  streamUrl?:                 string;
  venue?:                     string;
  maximumCapacity?:           number;
  agenda?:                    AgendaItemDto[];
  speakers?:                  SpeakerRequest[];
  innovationChallengeConfig?: InnovationChallengeConfigRequest;
  flyerUrl?:                  string;
}

// Documents
export interface DocumentItem {
  id:               string;
  title:            string;
  documentType:     string;
  fileType:         string;
  mimeType:         string;
  originalFilename: string;
  sizeBytes:        number;
  sizeLabel:        string;
  uploadedAt:       string;
  downloadCount:    number;
  fileData?:        string;   // base64, present only on single-document fetch
  fileUrl?:         string;   // Cloudinary URL, preferred for download
  downloadUrl?:     string;   // alias used by some API versions
}

export interface EventDocumentListResponse {
  totalCount: number;
  documents:  DocumentItem[];
}

export interface UploadDocumentRequest {
  title:              string;
  documentType:       string;
  eventId:            string;
  /** Cloudinary URL */
  fileUrl?:           string;
  /** Cloudinary public_id returned by the upload proxy */
  cloudinaryPublicId?: string;
  originalFilename:   string;
  /** File size in bytes — the backend 500s without this (NPE computing sizeLabel). */
  sizeBytes?:         number;
}

// Attendees
export interface AttendeeItem {
  id:          string;
  fullName:    string;
  initials:    string;
  avatarColor: string;
  email:       string;
  phone:       string;
  kycStatus:   string;
  rsvpDate:    string;
}

export interface AttendeeListResponse {
  totalCount: number;
  label?:     string;
  page:       number;
  size:       number;
  attendees:  AttendeeItem[];
}

// Settings info
export interface UpdateEventInfoRequest {
  title:        string;
  description?: string;
}

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const clientEventKeys = {
  all:       ["clientEvents"] as const,
  list:      (type: string, page: number, size: number) =>
               ["clientEvents", "list", { type, page, size }] as const,
  detail:    (id: string) => ["clientEvents", "detail", id] as const,
  agenda:    (id: string) => ["clientEvents", "agenda", id] as const,
  documents: (id: string) => ["clientEvents", "documents", id] as const,
  attendees: (id: string, kycStatus: string, page: number, size: number) =>
               ["clientEvents", "attendees", id, { kycStatus, page, size }] as const,
  dropdown:  () => ["clientEvents", "dropdown"] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Valid `type` filter values for GET /api/v1/client/events. */
export type ClientEventTypeFilter = "ALL" | "AGM" | "LAUNCH" | "INNOVATION" | "HACKATHON" | "GENERAL";

/** Paginated event list for the authenticated stakeholder. Default type=ALL returns every event. */
export function useClientEvents(type: ClientEventTypeFilter = "ALL", page = 0, size = 20) {
  return useQuery({
    queryKey: clientEventKeys.list(type, page, size),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<EventListResponse>>(
        "/api/v1/client/events",
        { params: { type, page, size } }
      );
      return res.data.data;
    },
    staleTime: 30_000,
  });
}

/** Full event detail including agenda, speakers, config, and overview stats. */
export function useClientEventDetail(id: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clientEventKeys.detail(id),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        `/api/v1/client/events/${id}`
      );
      return res.data.data;
    },
    enabled: !!id && (opts?.enabled ?? true),
    staleTime: 60_000,
  });
}

/** Minimal id + label list for filter dropdowns. */
export function useClientEventsDropdown(enabled = true) {
  return useQuery({
    queryKey: clientEventKeys.dropdown(),
    enabled,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<{ events: EventOption[] }>>(
        "/api/v1/client/events/dropdown"
      );
      return res.data.data?.events ?? [];
    },
    staleTime: 60_000,
  });
}

/** Ordered agenda items for a single event. */
export function useClientEventAgenda(eventId: string) {
  return useQuery({
    queryKey: clientEventKeys.agenda(eventId),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<AgendaListResponse>>(
        `/api/v1/client/events/${eventId}/agenda`
      );
      return res.data.data?.agendaItems ?? [];
    },
    enabled: !!eventId,
    staleTime: 30_000,
  });
}

/** Documents attached to this event. */
export function useClientEventDocuments(eventId: string, search = "", opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clientEventKeys.documents(eventId),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<EventDocumentListResponse>>(
        `/api/v1/client/events/${eventId}/documents`,
        { params: search ? { search } : undefined }
      );
      return res.data.data?.documents ?? [];
    },
    enabled: !!eventId && (opts?.enabled ?? true),
    staleTime: 30_000,
  });
}

/** Registered attendees for an event with optional KYC filter. */
export function useClientEventAttendees(
  eventId: string,
  kycStatus = "",
  page = 0,
  size = 50
) {
  return useQuery({
    queryKey: clientEventKeys.attendees(eventId, kycStatus, page, size),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<AttendeeListResponse>>(
        `/api/v1/client/events/${eventId}/attendees`,
        {
          params: {
            page,
            size,
            ...(kycStatus ? { kycStatus } : {}),
          },
        }
      );
      return res.data.data;
    },
    enabled: !!eventId,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations — lifecycle
// ---------------------------------------------------------------------------

function makeLifecycleMutation(
  path: (id: string) => string,
  successMessage: string,
  errorMessage: string
) {
  return () => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        const res = await apiClient.post<ApiResponse<StatusTransitionResponse>>(path(id));
        return res.data.data;
      },
      onSuccess: (data, id) => {
        queryClient.invalidateQueries({ queryKey: clientEventKeys.detail(id) });
        queryClient.invalidateQueries({ queryKey: clientEventKeys.all });
        const zoomOutcome = data?.zoomMeetingEndStatus;
        const detail = zoomOutcome === "ENDED"
          ? "The event status was updated and the linked Zoom meeting was ended."
          : zoomOutcome === "NOT_IN_PROGRESS"
            ? "The event status was updated. The linked Zoom meeting was not in progress."
            : zoomOutcome === "NOT_CONFIGURED"
              ? "The event status was updated. No Zoom meeting was configured."
              : `Status: ${data?.status ?? "updated"}`;
        popup.success(successMessage, detail, 3000);
      },
      onError: (error: any) => parseAndToastApiError(error, errorMessage),
    });
  };
}

/** DRAFT → PUBLISHED */
export const usePublishEvent = makeLifecycleMutation(
  (id) => `/api/v1/client/events/${id}/publish`,
  "Event Published",
  "Publish failed."
);

/**
 * PUBLISHED → LIVE.
 *
 * §1 (idempotency): a go-live request can fail in transit or be retried after
 * the transition already happened server-side. Rather than surface a misleading
 * "Go-live failed." on a transition that actually succeeded, re-check the
 * event's current status when the POST errors — if it is already LIVE, the
 * go-live is treated as successful.
 */
export function useGoLiveEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        const res = await apiClient.post<ApiResponse<StatusTransitionResponse>>(
          `/api/v1/client/events/${id}/go-live`
        );
        return res.data.data;
      } catch (error) {
        // Re-check before failing: the event may already be LIVE (retry / lost response).
        try {
          const check = await apiClient.get<ApiResponse<{ status?: EventStatus }>>(
            `/api/v1/client/events/${id}`
          );
          if (check.data.data?.status === "LIVE") {
            return { id, status: "LIVE", updatedAt: new Date().toISOString() } as StatusTransitionResponse;
          }
        } catch {
          // Status re-check failed too — fall through and surface the original error.
        }
        throw error;
      }
    },
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: clientEventKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: clientEventKeys.all });
      popup.success("Event is now Live", `Status: ${data?.status ?? "LIVE"}`, 3000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Go-live failed."),
  });
}

/** LIVE → ENDED */
export const useEndEvent = makeLifecycleMutation(
  (id) => `/api/v1/client/events/${id}/end`,
  "Event Ended",
  "End event failed."
);

/** Any non-terminal → CANCELLED */
export const useCancelEvent = makeLifecycleMutation(
  (id) => `/api/v1/client/events/${id}/cancel`,
  "Event Cancelled",
  "Cancellation failed."
);

// ---------------------------------------------------------------------------
// Mutations — content
// ---------------------------------------------------------------------------

/** Partially update top-level event fields and/or replace full agenda/speakers. */
export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateEventRequest }) => {
      const res = await apiClient.patch<ApiResponse<any>>(
        `/api/v1/client/events/${id}`,
        data
      );
      return res.data.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: clientEventKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: clientEventKeys.agenda(id) });
      popup.success("Event Updated", "Changes saved successfully.", 2000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Update failed."),
  });
}

/** Update only title + description (safe to call even while LIVE). */
export function useUpdateEventInfo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateEventInfoRequest }) => {
      const res = await apiClient.put<ApiResponse<any>>(
        `/api/v1/client/events/${id}/settings/info`,
        data
      );
      return res.data.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: clientEventKeys.detail(id) });
      popup.success("Event Info Saved", "Title and description updated.", 2000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Save failed."),
  });
}

// ---------------------------------------------------------------------------
// Mutations — agenda CRUD
// ---------------------------------------------------------------------------

/** Append a new agenda item. */
export function useAddAgendaItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, item }: { eventId: string; item: AddAgendaItemRequest }) => {
      const res = await apiClient.post<ApiResponse<AgendaItemDto>>(
        `/api/v1/client/events/${eventId}/agenda`,
        item
      );
      return res.data.data;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: clientEventKeys.agenda(eventId) });
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to add item."),
  });
}

/** Update an existing agenda item. */
export function useUpdateAgendaItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      eventId,
      itemId,
      data,
    }: {
      eventId: string;
      itemId:  string;
      data:    UpdateAgendaItemRequest;
    }) => {
      const res = await apiClient.put<ApiResponse<AgendaItemDto>>(
        `/api/v1/client/events/${eventId}/agenda/${itemId}`,
        data
      );
      return res.data.data;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: clientEventKeys.agenda(eventId) });
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to update item."),
  });
}

/** Delete an agenda item. */
export function useDeleteAgendaItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, itemId }: { eventId: string; itemId: string }) => {
      await apiClient.delete(`/api/v1/client/events/${eventId}/agenda/${itemId}`);
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: clientEventKeys.agenda(eventId) });
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to delete item."),
  });
}

// ---------------------------------------------------------------------------
// Mutations — documents
// ---------------------------------------------------------------------------

/** Upload a base64-encoded document to an event. */
export function useUploadEventDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      eventId,
      payload,
    }: {
      eventId: string;
      payload: UploadDocumentRequest;
    }) => {
      const res = await apiClient.post<ApiResponse<DocumentItem>>(
        `/api/v1/client/events/${eventId}/documents`,
        payload
      );
      return res.data.data;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: clientEventKeys.documents(eventId) });
      popup.success("Document Uploaded", "File has been attached to the event.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Upload failed. Max 10 MB."),
  });
}

/** Delete a document from an event. */
export function useDeleteEventDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, documentId }: { eventId: string; documentId: string }) => {
      await apiClient.delete(
        `/api/v1/client/events/${eventId}/documents/${documentId}`
      );
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: clientEventKeys.documents(eventId) });
      popup.success("Document Deleted", "The file has been removed.", 2000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Delete failed."),
  });
}

/**
 * Download an event document, CORS-safely.
 *
 * The per-event documents LIST omits `fileUrl`, so callers reach this hook only for
 * rows with no direct URL. Rather than XHR-read the counted
 * `/client/documents/{id}/download` endpoint — which 302-redirects to a pre-signed
 * Huawei OBS URL that a cross-origin blob read can't follow (the bucket sends no
 * `Access-Control-Allow-Origin`, so the browser blocks the 200 response) — first
 * fetch the SINGLE-document detail. That payload carries the pre-signed `fileUrl`
 * (or legacy base64 `fileData`), exactly like the admin download and the global
 * Documents page. Opening `fileUrl` is a top-level anchor navigation, which is not
 * subject to OBS CORS, and OBS's `Content-Disposition: attachment` triggers the save.
 *
 * The counted blob endpoint is kept as a fallback: if a given API version doesn't
 * expose the single-doc detail (404) or omits both url and data, we degrade to the
 * previous behaviour rather than regress.
 */
export function useDownloadEventDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, documentId, filename }: { eventId: string; documentId: string; filename?: string }) => {
      const fallbackName = filename || `document-${documentId}`;

      // Preferred: resolve a direct URL / base64 from the single-document detail.
      try {
        const res = await apiClient.get<ApiResponse<DocumentItem>>(
          `/api/v1/client/events/${eventId}/documents/${documentId}`
        );
        const doc = (res.data?.data ?? (res.data as any)) as DocumentItem;
        const directUrl = doc?.fileUrl ?? doc?.downloadUrl;
        if (directUrl) return { kind: "url" as const, url: directUrl, eventId };
        if (doc?.fileData) {
          return {
            kind: "base64" as const,
            base64: doc.fileData,
            mimeType: doc.mimeType,
            filename: doc.originalFilename || doc.title || fallbackName,
            eventId,
          };
        }
      } catch {
        /* endpoint absent on this API version — fall through to the counted blob path */
      }

      // Fallback: counted blob endpoint (works if OBS CORS is enabled or the backend
      // proxies the bytes itself instead of redirecting).
      const blobRes = await apiClient.get<Blob>(
        `/api/v1/client/documents/${documentId}/download`,
        { responseType: "blob" }
      );
      return { kind: "blob" as const, blob: blobRes.data, filename: fallbackName, eventId };
    },
    onSuccess: (result) => {
      if (result.kind === "url") {
        // `download` attr is dropped: ignored for cross-origin hrefs and, with
        // target="_blank", it aborts the request. Anchor must be in the DOM to click.
        const a = document.createElement("a");
        a.href = result.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else if (result.kind === "base64") {
        const byteChars = atob(result.base64);
        const bytes = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
        const blob = new Blob([bytes], { type: result.mimeType || "application/octet-stream" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href = url;
        a.download = result.filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5_000);
      } else {
        const url  = URL.createObjectURL(result.blob);
        const a    = document.createElement("a");
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);
      }
      queryClient.invalidateQueries({ queryKey: clientEventKeys.documents(result.eventId) });
    },
    onError: (error: any) => parseAndToastApiError(error, "Download failed."),
  });
}

/**
 * Export the full attendee list as a CSV file and trigger a browser download.
 * The endpoint returns a raw binary stream (not the JSON envelope).
 */
export function useExportAttendees() {
  return useMutation({
    mutationFn: async (eventId: string) => {
      const res = await apiClient.get(
        `/api/v1/client/events/${eventId}/attendees/export`,
        { responseType: "blob" }
      );
      return { blob: res.data as Blob, eventId };
    },
    onSuccess: ({ blob, eventId }) => {
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `attendees-${eventId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (error: any) => parseAndToastApiError(error, "Export failed."),
  });
}

// ---------------------------------------------------------------------------
// Create event — unified endpoint used by client (event manager) admins
// ---------------------------------------------------------------------------

export interface AgmConfigRequest {
  resolutions?: Array<{
    title:                string;
    description?:         string;
    isSpecialResolution?: boolean;
  }>;
  shareholderTargeting?:    "ALL_REGISTERED" | "CUSTOM_LIST";
  enableProxyVoting?:       boolean;
  /** Cloudinary URL of the uploaded AGM notice PDF */
  agmNoticeUrl?:            string;
  agmNoticeFilename?:       string;
  /** Size in bytes of the uploaded AGM notice PDF, as returned by /api/v1/upload */
  agmNoticeSizeBytes?:      number;
  /** Legacy base64 field — prefer agmNoticeUrl */
  agmNoticeBase64?:         string;
  shareholderListBase64?:   string;
  shareholderListFilename?: string;
}

export interface EmbargoRequest {
  enabled:   boolean;
  releaseAt?: string; // ISO-8601
}

export interface ProductLaunchConfigRequest {
  embargo?:           EmbargoRequest;
  audienceTargeting?: AudienceTargeting;
  flyerUrl?:          string;
}

export interface InnovationChallengeConfigRequest {
  audienceTargeting?:   AudienceTargeting;
  tracks?:              string[];
  problemStatement?:    string;
  expectedDeliverable?: string;
  submissionDeadline?:  string;   // YYYY-MM-DD
  allowedTechStack?:    string;
  participationType?:   "SOLO" | "TEAM" | "SOLO_AND_TEAM";
  minTeamSize?:         number;
  maxTeamSize?:         number;
  eligibilityCriteria?: string;
  maximumEntries?:      number;
  prizeTiers?:          Array<{ position: string; reward: string }>;
  judgingCriteria?:     Array<{ criterion: string; weight: number }>;
}

export interface GeneralEventConfigRequest {
  /** CRITICAL: only these three values are accepted. Any other string causes a 400. */
  audienceTargeting?: AudienceTargeting;
}

/** Strict audience targeting enums — any other value causes a "Malformed Request Body" error. */
export type AudienceTargeting = "OPEN_REGISTRATION" | "INVITE_ONLY" | "RESTRICT_BY_EMAIL_DOMAIN";

export interface CreateEventRequest {
  registerId:                  string;
  eventType:                   "AGM_EGM" | "PRODUCT_LAUNCH" | "INNOVATION_CHALLENGE" | "HACKATHON" | "GENERAL_EVENT";
  title:                       string;
  description?:                string;
  format:                      "VIRTUAL" | "IN_PERSON" | "HYBRID";
  date:                        string;       // YYYY-MM-DD (must be a future date)
  endDate?:                    string;       // YYYY-MM-DD — for multi-day events
  startTime:                   string;       // HH:mm (no seconds)
  endTime?:                    string;       // HH:mm (no seconds) — optional end time
  /** Optional stream/join URL for VIRTUAL or HYBRID events. Can be added — or a Zoom meeting generated — later from the event's Settings tab. */
  streamUrl?:                  string;
  /** Physical location / venue */
  location?:                   string;
  venue?:                      string;
  maximumCapacity:             number;
  featured?:                   boolean;
  rsvpEnabled?:                boolean;
  agenda?:                     Array<{ time: string; title: string; speaker?: string }>;
  speakers?:                   SpeakerRequest[];
  agmConfig?:                  AgmConfigRequest;
  productLaunchConfig?:        ProductLaunchConfigRequest;
  innovationChallengeConfig?:  InnovationChallengeConfigRequest;
  generalEventConfig?:         GeneralEventConfigRequest;
}

/** Create a new event (client/event-manager). DRAFT status on creation. */
export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateEventRequest) => {
      const res = await apiClient.post<ApiResponse<any>>(
        "/api/v1/client/events",
        payload
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientEventKeys.all });
      popup.success("Event Created", "Your event has been created as a Draft.", 3000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to create event."),
  });
}

// ---------------------------------------------------------------------------
// Queries — legacy registrations, AGM downloads, retain-data
// ---------------------------------------------------------------------------

/** Legacy: GET /api/v1/client/events/{id}/registrations */
export function useClientEventRegistrations(eventId: string, page = 0, limit = 10) {
  return useQuery({
    queryKey: ["clientEvents", "registrations", eventId, { page, limit }] as const,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        `/api/v1/client/events/${eventId}/registrations`,
        { params: { page, limit } }
      );
      return res.data.data;
    },
    enabled: !!eventId,
    staleTime: 30_000,
  });
}

/** Download AGM notice PDF (binary blob). Returns a Blob URL you can open/download. */
export function useDownloadAgmNotice() {
  return useMutation({
    mutationFn: async (eventId: string) => {
      const res = await apiClient.get(
        `/api/v1/client/events/${eventId}/agm-notice`,
        { responseType: "blob" }
      );
      return { blob: res.data as Blob, eventId };
    },
    onSuccess: ({ blob, eventId }) => {
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `agm-notice-${eventId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (error: any) => parseAndToastApiError(error, "AGM notice download failed."),
  });
}

/** Download shareholder list CSV (binary blob). */
export function useDownloadShareholderList() {
  return useMutation({
    mutationFn: async (eventId: string) => {
      const res = await apiClient.get(
        `/api/v1/client/events/${eventId}/shareholder-list`,
        { responseType: "blob" }
      );
      return { blob: res.data as Blob, eventId };
    },
    onSuccess: ({ blob, eventId }) => {
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `shareholders-${eventId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (error: any) => parseAndToastApiError(error, "Shareholder list download failed."),
  });
}

// ---------------------------------------------------------------------------
// Broadcast
// ---------------------------------------------------------------------------

export interface BroadcastHistoryItem {
  id:               string;
  channel:          string;
  subject?:         string;
  message:          string;
  totalRecipients:  number;
  emailSent:        number;
  smsSent:          number;
  pushSent?:        number;
  inAppSent?:       number;
  skipped:          number;
  sentAt:           string;
  timeAgo:          string;
}

export interface BroadcastHistoryResponse {
  content:       BroadcastHistoryItem[];
  page:          number;
  size:          number;
  totalElements: number;
  totalPages:    number;
  last:          boolean;
}

export interface SendBroadcastRequest {
  subject?:        string;
  message:         string;
  channel:         "EMAIL" | "SMS" | "PUSH" | "IN_APP" | "ALL";
  idempotencyKey?: string;
}

export interface BulkNoticeRequest {
  eventIds: string[];
  subject:  string;
  message:  string;
}

/** GET /api/v1/client/events/{id}/broadcast/recipients */
export function useBroadcastRecipients(eventId: string) {
  return useQuery({
    queryKey: ["broadcast", "recipients", eventId],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<Record<string, string>>>(
        `/api/v1/client/events/${eventId}/broadcast/recipients`
      );
      const raw = res.data.data as any;
      return (raw?.count ?? raw?.recipientCount ?? raw?.totalRecipients ?? 0) as number;
    },
    enabled:   !!eventId,
    staleTime: 60_000,
  });
}

/** GET /api/v1/client/events/{id}/broadcast/history */
export function useBroadcastHistory(eventId: string, page = 0, size = 20) {
  return useQuery({
    queryKey: ["broadcast", "history", eventId, page, size],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<BroadcastHistoryResponse>>(
        `/api/v1/client/events/${eventId}/broadcast/history`,
        { params: { page, size } }
      );
      return res.data.data;
    },
    enabled:   !!eventId,
    staleTime: 30_000,
  });
}

/** POST /api/v1/client/events/{id}/broadcast */
export function useSendBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, data }: { eventId: string; data: SendBroadcastRequest }) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/client/events/${eventId}/broadcast`,
        data
      );
      return res.data.data;
    },
    onSuccess: (_, { eventId }) => {
      qc.invalidateQueries({ queryKey: ["broadcast", "history", eventId] });
      popup.success("Broadcast Sent", "Your message has been delivered to attendees.", 3000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Broadcast failed."),
  });
}

/** POST /api/v1/client/events/notify-bulk */
export function useSendBulkNotice() {
  return useMutation({
    mutationFn: async (data: BulkNoticeRequest) => {
      const res = await apiClient.post<ApiResponse<any>>(
        "/api/v1/client/events/notify-bulk",
        data
      );
      return res.data.data;
    },
    onSuccess: () => popup.success("Bulk Notice Sent", "Notice delivered across all selected events.", 3000),
    onError:   (error: any) => parseAndToastApiError(error, "Bulk notice failed."),
  });
}

/** POST /api/v1/client/events/{id}/retain-data */
export function useRetainEventData() {
  return useMutation({
    mutationFn: async (eventId: string) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/client/events/${eventId}/retain-data`
      );
      return res.data.data;
    },
    onSuccess: () => popup.success("Data Retained", "Event data has been retained.", 2500),
    onError: (error: any) => parseAndToastApiError(error, "Retain data failed."),
  });
}

/**
 * POST /api/v1/client/events/{id}/feature
 * Toggles the featured flag. Returns the new featured state.
 */
export function useToggleEventFeatured() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      const res = await apiClient.post<ApiResponse<Record<string, any>>>(
        `/api/v1/client/events/${eventId}/feature`
      );
      return res.data.data;
    },
    onSuccess: (_, eventId) => {
      queryClient.invalidateQueries({ queryKey: clientEventKeys.detail(eventId) });
      popup.success("Featured toggled", "Event featured status updated.", 2000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Toggle featured failed."),
  });
}

// ---------------------------------------------------------------------------
// Expected Attendees — /api/v1/client/events/{eventId}/expected-attendees
// ---------------------------------------------------------------------------

export interface ExpectedAttendee {
  id:              string;
  firstName?:      string;
  lastName?:       string;
  /** Derived display name — firstName + lastName, or fullName from legacy payloads */
  fullName?:       string;
  email:           string;
  phone?:          string;
  shareholderRef?: string;
  /** Share units owned — carried over from the register when available. */
  units?:          number;
}

export interface ExpectedAttendeeListResponse {
  attendees:  ExpectedAttendee[];
  totalCount: number;
}

/** POST body for adding one or more expected attendees */
export interface UploadAttendeesRequest {
  attendees: Array<{
    firstName:       string;
    lastName:        string;
    email:           string;
    phone?:          string;
    shareholderRef?: string;
    units?:          number;
  }>;
}

export interface RegisterShareholderItem {
  id:       string;
  fullName: string;
  chn?:     string;
  email?:   string;
  phone?:   string;
  units?:   number;
  status?:  string;
}

interface RegisterShareholdersResponse {
  totalCount:    number;
  activeCount:   number;
  page:          number;
  size:          number;
  shareholders:  RegisterShareholderItem[];
}

/**
 * Import shareholders from a register into an event's expected-attendees list.
 *
 * The backend's one-shot POST /expected-attendees/import endpoint has been
 * unreliable (500s). Instead, this pulls the register's ACTIVE shareholders
 * page-by-page from the proven-working
 * GET /api/v1/client/registers/{registerId}/shareholders endpoint, maps them
 * to the expected-attendee shape, and submits them through the
 * already-working POST /api/v1/client/events/{eventId}/expected-attendees
 * (bulk upload) endpoint instead.
 */
export function useImportShareholdersToEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, registerId }: { eventId: string; registerId: string }) => {
      const PAGE_SIZE = 200;
      const HARD_PAGE_CAP = 50; // safety net against a runaway loop
      const attendees: UploadAttendeesRequest["attendees"] = [];
      let skipped = 0;
      let page = 0;
      let totalPages = 1;

      do {
        const res = await apiClient.get<ApiResponse<RegisterShareholdersResponse>>(
          `/api/v1/client/registers/${registerId}/shareholders`,
          { params: { status: "ACTIVE", page, size: PAGE_SIZE } }
        );
        const data = res.data.data;
        const list = data?.shareholders ?? [];

        for (const sh of list) {
          const email = (sh.email ?? "").trim();
          // Expected-attendees requires a usable email — shareholders on the
          // register without one can't be imported this way; skip and report.
          if (!email || !email.includes("@")) {
            skipped += 1;
            continue;
          }
          const parts = (sh.fullName ?? "").trim().split(/\s+/).filter(Boolean);
          attendees.push({
            firstName:      parts[0] ?? sh.fullName ?? "Shareholder",
            lastName:       parts.slice(1).join(" ") || "-",
            email,
            phone:          sh.phone || undefined,
            shareholderRef: sh.chn || sh.id,
            units:          sh.units,
          });
        }

        totalPages = data ? Math.max(1, Math.ceil((data.totalCount ?? 0) / PAGE_SIZE)) : 1;
        page += 1;
      } while (page < totalPages && page < HARD_PAGE_CAP);

      if (attendees.length === 0) {
        throw new Error(
          skipped > 0
            ? `Found ${skipped} shareholder(s) on this register, but none have an email on file to import.`
            : "No active shareholders found on this register."
        );
      }

      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/client/events/${eventId}/expected-attendees`,
        { attendees } as UploadAttendeesRequest
      );
      return { imported: attendees.length, skipped, ...(res.data.data ?? {}) };
    },
    onSuccess: (data, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientEvents", "expectedAttendees", eventId] });
      const { imported, skipped } = data as { imported: number; skipped: number };
      popup.success(
        "Shareholders Imported",
        skipped > 0
          ? `${imported} shareholder(s) added as expected attendees (${skipped} skipped — no email on file).`
          : `${imported} shareholder(s) added as expected attendees.`,
        4000
      );
    },
    onError: (error: any) => {
      if (error instanceof Error && !(error as any).response) {
        popup.error("Import Failed", error.message, 4000);
        return;
      }
      parseAndToastApiError(error, "Failed to import shareholders from register.");
    },
  });
}

/** List expected attendees for an event. */
export function useExpectedAttendees(eventId: string) {
  return useQuery({
    queryKey: ["clientEvents", "expectedAttendees", eventId] as const,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ExpectedAttendeeListResponse>>(
        `/api/v1/client/events/${eventId}/expected-attendees`
      );
      return res.data.data;
    },
    enabled: !!eventId,
    staleTime: 30_000,
  });
}

/** Upload / replace expected attendee list. */
export function useUploadExpectedAttendees() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, payload }: { eventId: string; payload: UploadAttendeesRequest }) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/client/events/${eventId}/expected-attendees`,
        payload
      );
      return res.data.data;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientEvents", "expectedAttendees", eventId] });
      popup.success("Attendees Uploaded", "Expected attendee list updated.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Upload failed."),
  });
}

/** Delete ALL expected attendees for an event. */
export function useDeleteAllExpectedAttendees() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      await apiClient.delete(`/api/v1/client/events/${eventId}/expected-attendees`);
    },
    onSuccess: (_, eventId) => {
      queryClient.invalidateQueries({ queryKey: ["clientEvents", "expectedAttendees", eventId] });
      popup.success("List Cleared", "All expected attendees removed.", 2000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Delete failed."),
  });
}

/** Delete a single expected attendee. */
export function useDeleteExpectedAttendee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, attendeeId }: { eventId: string; attendeeId: string }) => {
      await apiClient.delete(
        `/api/v1/client/events/${eventId}/expected-attendees/${attendeeId}`
      );
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientEvents", "expectedAttendees", eventId] });
    },
    onError: (error: any) => parseAndToastApiError(error, "Delete failed."),
  });
}

/**
 * Delete several expected attendees at once.
 * There's no bulk-by-ids endpoint, so this fires the existing per-attendee
 * DELETE for each selected id in parallel.
 */
export function useBulkDeleteExpectedAttendees() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, attendeeIds }: { eventId: string; attendeeIds: string[] }) => {
      const results = await Promise.allSettled(
        attendeeIds.map((id) =>
          apiClient.delete(`/api/v1/client/events/${eventId}/expected-attendees/${id}`)
        )
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      return { removed: attendeeIds.length - failed, failed };
    },
    onSuccess: ({ removed, failed }, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientEvents", "expectedAttendees", eventId] });
      if (failed > 0) {
        popup.error("Partial Delete", `${removed} removed, ${failed} failed. Try again for the rest.`, 3500);
      } else {
        popup.success("Attendees Removed", `${removed} attendee${removed !== 1 ? "s" : ""} removed from the list.`, 2500);
      }
    },
    onError: (error: any) => parseAndToastApiError(error, "Bulk delete failed."),
  });
}

// ---------------------------------------------------------------------------
// Stream URL  — PUT /api/v1/client/events/{id}/settings/stream-url
// ---------------------------------------------------------------------------

export function useUpdateStreamUrl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, streamUrl }: { eventId: string; streamUrl: string }) => {
      const res = await apiClient.put<ApiResponse<unknown>>(
        `/api/v1/client/events/${eventId}/settings/stream-url`,
        { streamUrl }
      );
      return (res.data as any).data ?? res.data;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientEvents", "detail", eventId] });
      popup.success("Stream URL Updated", "The stream URL has been saved.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to update stream URL."),
  });
}

// ---------------------------------------------------------------------------
// Zoom Meeting  — POST /api/v1/client/events/{id}/zoom
// ---------------------------------------------------------------------------

/**
 * Create or refresh a Zoom meeting for an existing event.
 * Requires Zoom Server-to-Server OAuth configured on the backend.
 * Only works for VIRTUAL or HYBRID events.
 *
 * §7f: `forceNew` (default false) asks the backend to mint a brand-new meeting on a
 * (possibly different) pooled host rather than refreshing the existing one. A refresh
 * (`forceNew=false`) is idempotent — it returns a fresh token/hostZak without stranding
 * anyone. `forceNew=true` STRANDS everyone already connected to the old meeting, so the
 * caller must confirm-guard it. When the shared host pool is exhausted the backend
 * answers 503; we surface the real capacity message rather than the generic OAuth hint.
 */
export function useCreateEventZoomMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, durationMinutes = 120, forceNew = false }: { eventId: string; durationMinutes?: number; forceNew?: boolean }) => {
      const res = await apiClient.post<ApiResponse<ZoomMeetingDto>>(
        `/api/v1/client/events/${eventId}/zoom`,
        null,
        { params: { durationMinutes, forceNew } }
      );
      return (res.data as any).data as ZoomMeetingDto;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: clientEventKeys.detail(eventId) });
      popup.success("Zoom Meeting Created", "Zoom meeting has been created for this event.", 3000);
    },
    onError: (error: any) => {
      // §7f: the shared Zoom host pool can be exhausted — the backend answers 503.
      // Surface the real "no host capacity" message (or the backend's own wording)
      // instead of the generic Zoom-OAuth failure hint.
      if (error?.response?.status === 503) {
        const serverMsg =
          (typeof error?.response?.data?.message === "string" && error.response.data.message) ||
          (typeof error?.response?.data?.error === "string" && error.response.data.error) ||
          "";
        popup.error(
          "No Zoom host capacity",
          serverMsg || "All shared Zoom host accounts are in use right now. Please try again in a few minutes.",
          6000
        );
        return;
      }
      parseAndToastApiError(error, "Failed to create Zoom meeting. Check that Zoom OAuth is configured on the server.");
    },
  });
}

// ---------------------------------------------------------------------------
// Audience Tiers  — /api/v1/client/events/{id}/tiers
// ---------------------------------------------------------------------------

export interface AudienceTier {
  id:            string;
  name:          string;
  description?:  string;
  tierType:      string;
  displayOrder:  number;
  invitedCount?: number;
}

export interface CreateTierRequest {
  name:         string;
  description?: string;
  tierType:     string;
  displayOrder: number;
}

export function useListTiers(eventId: string) {
  return useQuery({
    queryKey: ["clientEvents", "tiers", eventId],
    enabled:  !!eventId,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<{ tiers: AudienceTier[] }>>(
        `/api/v1/client/events/${eventId}/tiers`
      );
      const raw = (res.data as any).data ?? res.data;
      return (raw?.tiers ?? raw?.content ?? raw ?? []) as AudienceTier[];
    },
  });
}

export function useCreateTier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, body }: { eventId: string; body: CreateTierRequest }) => {
      const res = await apiClient.post<ApiResponse<AudienceTier>>(
        `/api/v1/client/events/${eventId}/tiers`,
        body
      );
      return (res.data as any).data ?? res.data;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientEvents", "tiers", eventId] });
      popup.success("Tier Created", "Audience tier has been created.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to create tier."),
  });
}

export function useUpdateTier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, tierId, body }: { eventId: string; tierId: string; body: Partial<CreateTierRequest> }) => {
      const res = await apiClient.put<ApiResponse<AudienceTier>>(
        `/api/v1/client/events/${eventId}/tiers/${tierId}`,
        body
      );
      return (res.data as any).data ?? res.data;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientEvents", "tiers", eventId] });
      popup.success("Tier Updated", "Audience tier has been updated.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to update tier."),
  });
}

export function useDeleteTier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, tierId }: { eventId: string; tierId: string }) => {
      await apiClient.delete(`/api/v1/client/events/${eventId}/tiers/${tierId}`);
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientEvents", "tiers", eventId] });
      popup.success("Tier Deleted", "Audience tier removed.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to delete tier."),
  });
}

// ---------------------------------------------------------------------------
// Invites  — /api/v1/client/events/{id}/tiers/invite
// ---------------------------------------------------------------------------

export function useSendInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, email, tierId }: { eventId: string; email: string; tierId: string }) => {
      const res = await apiClient.post<ApiResponse<unknown>>(
        `/api/v1/client/events/${eventId}/tiers/invite`,
        { email, tierId }
      );
      return (res.data as any).data ?? res.data;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientEvents", "tiers", eventId] });
      popup.success("Invite Sent", "The invitation has been delivered.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to send invite."),
  });
}

export function useBulkInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, invites }: { eventId: string; invites: { email: string; tierId: string }[] }) => {
      const res = await apiClient.post<ApiResponse<unknown>>(
        `/api/v1/client/events/${eventId}/tiers/invite/bulk`,
        { invites }
      );
      return (res.data as any).data ?? res.data;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientEvents", "tiers", eventId] });
      popup.success("Bulk Invites Sent", "All invitations have been delivered.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to send bulk invites."),
  });
}

export function useExportInvites(eventId: string) {
  return useQuery({
    queryKey: ["clientEvents", "tiers", "export", eventId],
    enabled:  false, // triggered manually
    queryFn: async () => {
      const res = await apiClient.get<string>(
        `/api/v1/client/events/${eventId}/tiers/invites/export`
      );
      return (res.data as any) as string;
    },
  });
}

// ---------------------------------------------------------------------------
// Invite directory and asynchronous campaigns
//   /api/v1/client/events/{id}/invites
// ---------------------------------------------------------------------------

export interface InviteInput {
  email:     string;
  firstName?: string;
  lastName?:  string;
  phone?:     string;
  tierId?:    string;
  tierName?:  string;
}

export type InviteDeliveryStatus =
  | "NOT_SENT"
  | "QUEUED"
  | "PROCESSING"
  | "SENT"
  | "DELIVERED"
  | "BOUNCED"
  | "FAILED";

export type InviteRegistrationStatus = "INVITED" | "REGISTERED" | "REVOKED" | "EXPIRED";

/** Invite-directory row returned by GET /invites. */
export interface InviteItem extends InviteInput {
  id?:                string;
  deliveryStatus?:    InviteDeliveryStatus;
  registrationStatus?: InviteRegistrationStatus;
  providerMessageId?: string;
}

export interface InviteSummary {
  total:      number;
  unsent:     number;
  queued:     number;
  sent:       number;
  delivered:  number;
  failed:     number;
  bounced:    number;
  registered: number;
  revoked:    number;
}

export interface InviteListResponse {
  summary: InviteSummary;
  items:   InviteItem[];
  total:   number;
}

export interface InviteImportJob {
  id:               string;
  eventId:          string;
  originalFilename?: string;
  status:            string;
  totalRows:        number;
  processedRows:    number;
  acceptedRows:     number;
  createdRows:      number;
  updatedRows:      number;
  duplicateRows:    number;
  rejectedRows:     number;
  errorReportUrl?:  string;
  startedAt?:       string;
  completedAt?:     string;
  lastHeartbeatAt?: string;
  errorCode?:       string;
  errorMessage?:    string;
}

export interface InviteUploadSession {
  uploadId:        string;
  storageKey:      string;
  uploadUrl:       string;
  expiresAt:       string;
  requiredHeaders: Record<string, string>;
}

export type InviteCampaignSelection = "ALL_UNSENT" | "SELECTED" | "TIER" | "IMPORT_JOB";

export interface CreateInviteCampaignRequest {
  selection:    InviteCampaignSelection;
  importJobId?: string;
  tierId?:      string;
  inviteIds?:   string[];
}

export interface InviteCampaign {
  campaignId:   string;
  eventId:      string;
  status:       string;
  selectionType: string;
  selectedCount: number;
  queuedCount:   number;
  sentCount:     number;
  failedCount:   number;
  skippedCount:  number;
  startedAt?:    string;
  completedAt?:  string;
  lastHeartbeatAt?: string;
  errorCode?:     string;
  errorMessage?:  string;
}

export interface InviteListFilters {
  page?:        number;
  size?:        number;
  search?:      string;
  status?:      string;
  deliveryStatus?: InviteDeliveryStatus;
  registrationStatus?: InviteRegistrationStatus;
  tierId?:      string;
  importJobId?:  string;
}

const inviteKeys = {
  list:     (eventId: string, filters: InviteListFilters) => ["clientEvents", "invites", eventId, filters] as const,
  campaign: (eventId: string, campaignId: string) => ["clientEvents", "invite-campaign", eventId, campaignId] as const,
  import:   (eventId: string, jobId: string) => ["clientEvents", "invite-import", eventId, jobId] as const,
};

// ~3 min at 3s — after this a still-PENDING import is treated as stalled and
// polling stops (the UI surfaces a "may be stuck" note).
const MAX_IMPORT_POLLS = 60;

function responseData<T>(response: any): T {
  return ((response?.data as any)?.data ?? response?.data) as T;
}

const INVITE_DELIVERY_STATUSES = new Set<InviteDeliveryStatus>([
  "NOT_SENT",
  "QUEUED",
  "PROCESSING",
  "SENT",
  "DELIVERED",
  "FAILED",
  "BOUNCED",
]);

function inviteListParams(filters: InviteListFilters) {
  const params: Record<string, string | number> = {};

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params[key] = value;
  }

  // The directory selector contains both delivery and registration states.
  // Send the explicit parameter as well as the legacy `status` alias so the
  // client works with both deployed API contract versions.
  if (filters.status) {
    if (INVITE_DELIVERY_STATUSES.has(filters.status as InviteDeliveryStatus)) {
      params.deliveryStatus = filters.status;
    } else {
      params.registrationStatus = filters.status;
    }
  }

  return params;
}

export function useListInvites(eventId: string, filters: InviteListFilters = {}) {
  return useQuery({
    queryKey: inviteKeys.list(eventId, filters),
    enabled: !!eventId,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<InviteListResponse>>(
        `/api/v1/client/events/${eventId}/invites`,
        { params: inviteListParams(filters) }
      );
      const raw = responseData<InviteListResponse>(res);
      return {
        summary: raw?.summary ?? { total: 0, unsent: 0, queued: 0, sent: 0, delivered: 0, failed: 0, bounced: 0, registered: 0, revoked: 0 },
        items: raw?.items ?? [],
        total: raw?.total ?? 0,
      } as InviteListResponse;
    },
    staleTime: 10_000,
  });
}

export function useCreateInvites() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, invites }: { eventId: string; invites: InviteInput[] }) => {
      const res = await apiClient.post<ApiResponse<unknown>>(
        `/api/v1/client/events/${eventId}/invites`,
        { invites }
      );
      return responseData<unknown>(res);
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientEvents", "invites", eventId] });
      popup.success("Invites Added", "The invite list has been updated.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to add invites."),
  });
}

export function useImportInvites() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, invites, defaultTierId }: { eventId: string; invites: InviteInput[]; defaultTierId?: string }) => {
      const res = await apiClient.post<ApiResponse<InviteImportJob>>(
        `/api/v1/client/events/${eventId}/invites/import`,
        { invites },
        { params: defaultTierId ? { defaultTierId } : undefined }
      );
      return responseData<InviteImportJob>(res);
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientEvents", "invites", eventId] });
      popup.success("Import Started", "Your audience import is processing in the background.", 3000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to start invite import."),
  });
}

/**
 * Production import path for large CSVs. The file is uploaded directly to the
 * backend-issued storage URL, then the durable import job is finalized.
 */
export function useImportInviteCsv() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      eventId,
      file,
      defaultTierId,
      onUploadProgress,
    }: {
      eventId: string;
      file: File;
      defaultTierId?: string;
      onUploadProgress?: (percent: number) => void;
    }) => {
      const idempotencyKey = crypto.randomUUID();
      const sessionResponse = await apiClient.post<ApiResponse<InviteUploadSession>>(
        `/api/v1/client/events/${eventId}/invite-imports/upload-session`,
        { filename: file.name, contentType: file.type || "text/csv", sizeBytes: file.size },
        { headers: { "Idempotency-Key": idempotencyKey } }
      );
      const session = responseData<InviteUploadSession>(sessionResponse);

      // Use the global Axios client here. apiClient would attach the Attend
      // bearer token and its JSON default to a third-party signed storage URL.
      await axios.put(session.uploadUrl, file, {
        headers: session.requiredHeaders,
        onUploadProgress: (progress) => {
          if (!onUploadProgress) return;
          const total = progress.total ?? file.size;
          onUploadProgress(total > 0 ? Math.min(100, Math.round((progress.loaded / total) * 100)) : 0);
        },
      });

      const finalizeResponse = await apiClient.post<ApiResponse<InviteImportJob>>(
        `/api/v1/client/events/${eventId}/invite-imports`,
        { uploadId: session.uploadId, defaultTierId: defaultTierId || undefined },
        { headers: { "Idempotency-Key": idempotencyKey } }
      );
      return responseData<InviteImportJob>(finalizeResponse);
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientEvents", "invites", eventId] });
      popup.success("Import Started", "The CSV was uploaded and is processing in the background.", 3000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to upload and start invite import."),
  });
}

export function useInviteImportProgress(eventId: string, jobId: string | null) {
  return useQuery({
    queryKey: inviteKeys.import(eventId, jobId ?? ""),
    enabled: !!eventId && !!jobId,
    retry: false,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<InviteImportJob>>(
        `/api/v1/client/events/${eventId}/invite-imports/${jobId}`
      );
      return responseData<InviteImportJob>(res);
    },
    refetchInterval: (query) => {
      const status = (query.state.data as InviteImportJob | undefined)?.status?.toUpperCase();
      if (status && ["COMPLETED", "FAILED", "CANCELLED"].includes(status)) return false;
      // Stop polling a job that never leaves PENDING (backend worker stalled) or
      // whose status endpoint keeps erroring — otherwise this loops forever. The
      // sum of update + error counts bounds attempts across both cases.
      const ticks = query.state.dataUpdateCount + query.state.errorUpdateCount;
      if (ticks >= MAX_IMPORT_POLLS) return false;
      return 3000;
    },
  });
}

export function useCreateInviteCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, body }: { eventId: string; body: CreateInviteCampaignRequest }) => {
      const res = await apiClient.post<ApiResponse<InviteCampaign>>(
        `/api/v1/client/events/${eventId}/invite-campaigns`,
        body
      );
      return responseData<InviteCampaign>(res);
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientEvents", "invites", eventId] });
      popup.success("Campaign Started", "Invitation delivery has been queued.", 3000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to start invitation campaign."),
  });
}

export function useInviteCampaignProgress(eventId: string, campaignId: string | null) {
  return useQuery({
    queryKey: inviteKeys.campaign(eventId, campaignId ?? ""),
    enabled: !!eventId && !!campaignId,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<InviteCampaign>>(
        `/api/v1/client/events/${eventId}/invite-campaigns/${campaignId}`
      );
      return responseData<InviteCampaign>(res);
    },
    refetchInterval: (query) => {
      const status = (query.state.data as InviteCampaign | undefined)?.status?.toUpperCase();
      return status && ["COMPLETED", "FAILED", "CANCELLED"].includes(status) ? false : 3000;
    },
  });
}

export function useExportAudienceInvites(eventId: string, filters: Omit<InviteListFilters, "page" | "size"> = {}) {
  return useQuery({
    queryKey: ["clientEvents", "invites", "export", eventId, filters],
    enabled: false,
    queryFn: async () => {
      const res = await apiClient.get<string>(
        `/api/v1/client/events/${eventId}/invites/export`,
        { params: inviteListParams(filters) }
      );
      return res.data as string;
    },
  });
}

export function useResendInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, inviteId }: { eventId: string; inviteId: string }) => {
      const res = await apiClient.post<ApiResponse<InviteItem>>(`/api/v1/client/events/${eventId}/invites/${inviteId}/resend`);
      return responseData<InviteItem>(res);
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientEvents", "invites", eventId] });
      popup.success("Invitation Sent", "A fresh invitation email was sent.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to resend invite."),
  });
}

export function useRevokeInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, inviteId }: { eventId: string; inviteId: string }) => {
      const res = await apiClient.delete<ApiResponse<InviteItem>>(`/api/v1/client/events/${eventId}/invites/${inviteId}`);
      return responseData<InviteItem>(res);
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientEvents", "invites", eventId] });
      popup.success("Invitation Revoked", "This invitation can no longer be used to register.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to revoke invite."),
  });
}

export function useUnrevokeInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, inviteId }: { eventId: string; inviteId: string }) => {
      const res = await apiClient.post<ApiResponse<InviteItem>>(
        `/api/v1/client/events/${eventId}/invites/${inviteId}/unrevoke`
      );
      return responseData<InviteItem>(res);
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientEvents", "invites", eventId] });
      popup.success("Invitation Restored", "The invitee can register and receive invitations again.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to restore invite."),
  });
}

// ---------------------------------------------------------------------------
// Waitlist  — /api/v1/client/events/{id}/waitlist
// ---------------------------------------------------------------------------

export interface WaitlistEntry {
  id:        string;
  userId?:   string;
  firstName: string;
  lastName:  string;
  email:     string;
  status:    string;
  position:  number;
  joinedAt:  string;
}

export interface WaitlistResponse {
  entries:        WaitlistEntry[];
  totalWaiting:   number;
  totalApproved:  number;
  page:           number;
  size:           number;
  totalElements:  number;
  totalPages:     number;
}

export function useListWaitlist(eventId: string, page = 0, size = 20) {
  return useQuery({
    queryKey: ["clientEvents", "waitlist", eventId, page, size],
    enabled:  !!eventId,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<WaitlistResponse>>(
        `/api/v1/client/events/${eventId}/waitlist`,
        { params: { page, size } }
      );
      const raw = (res.data as any).data ?? res.data;
      return {
        entries:       raw?.entries       ?? raw?.content ?? [],
        totalWaiting:  raw?.totalWaiting  ?? 0,
        totalApproved: raw?.totalApproved ?? 0,
        totalElements: raw?.totalElements ?? 0,
        totalPages:    raw?.totalPages    ?? 1,
        page:          raw?.page          ?? 0,
        size:          raw?.size          ?? size,
      } as WaitlistResponse;
    },
  });
}

export function useApproveWaitlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, waitlistId }: { eventId: string; waitlistId: string }) => {
      const res = await apiClient.post<ApiResponse<unknown>>(
        `/api/v1/client/events/${eventId}/waitlist/${waitlistId}/approve`
      );
      return (res.data as any).data ?? res.data;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientEvents", "waitlist", eventId] });
      popup.success("Entry Approved", "Waitlist entry has been approved.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to approve entry."),
  });
}

export function useRemoveWaitlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, waitlistId }: { eventId: string; waitlistId: string }) => {
      await apiClient.delete(`/api/v1/client/events/${eventId}/waitlist/${waitlistId}`);
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientEvents", "waitlist", eventId] });
      popup.success("Entry Removed", "Waitlist entry has been removed.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to remove entry."),
  });
}

// ---------------------------------------------------------------------------
// QR Check-In Scan  — POST /api/v1/client/events/{eventId}/scan-qr
// ---------------------------------------------------------------------------

export interface ScanQrRequest {
  qrToken: string;
}

export interface ScanQrResponse {
  success:      boolean;
  attendeeId?:  string;
  fullName?:    string;
  email?:       string;
  kycStatus?:   string;
  seatRef?:     string;
  checkedInAt?: string;
  message?:     string;
}

export function useClientScanQr() {
  return useMutation({
    mutationFn: async ({ eventId, qrToken }: { eventId: string; qrToken: string }) => {
      const res = await apiClient.post<ApiResponse<ScanQrResponse>>(
        `/api/v1/client/events/${eventId}/scan-qr`,
        { qrToken }
      );
      return (res.data as any).data ?? res.data;
    },
    onError: (error: any) => parseAndToastApiError(error, "QR scan failed."),
  });
}
