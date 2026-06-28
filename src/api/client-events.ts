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
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import { ApiResponse } from "@/types/api";

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
  id:        string;
  status:    EventStatus;
  updatedAt: string;
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
  title?:           string;
  description?:     string;
  format?:          "VIRTUAL" | "IN_PERSON" | "HYBRID";
  date?:            string;
  startTime?:       string;
  streamUrl?:       string;
  venue?:           string;
  maximumCapacity?: number;
  agenda?:          AgendaItemDto[];
  speakers?:        SpeakerRequest[];
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
export function useClientEventsDropdown() {
  return useQuery({
    queryKey: clientEventKeys.dropdown(),
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
        popup.success(successMessage, `Status: ${data?.status ?? "updated"}`, 3000);
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

/** PUBLISHED → LIVE */
export const useGoLiveEvent = makeLifecycleMutation(
  (id) => `/api/v1/client/events/${id}/go-live`,
  "Event is now Live",
  "Go-live failed."
);

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
 * Fetch a single document (increments download count) and trigger a browser download.
 * Returns the DocumentItem including base64 fileData.
 */
export function useDownloadEventDocument() {
  return useMutation({
    mutationFn: async ({ eventId, documentId }: { eventId: string; documentId: string }) => {
      const res = await apiClient.get<ApiResponse<DocumentItem>>(
        `/api/v1/client/events/${eventId}/documents/${documentId}`
      );
      return res.data.data;
    },
    onSuccess: (doc) => {
      // Prefer Cloudinary URL — just open it directly
      const directUrl = doc?.fileUrl ?? doc?.downloadUrl;
      if (directUrl) {
        const a    = document.createElement("a");
        a.href     = directUrl;
        a.download = doc.originalFilename || doc.title;
        a.target   = "_blank";
        a.rel      = "noopener noreferrer";
        a.click();
        return;
      }
      // Fall back: decode base64
      if (!doc?.fileData) return;
      const binary = atob(doc.fileData);
      const bytes  = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: doc.mimeType || "application/octet-stream" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = doc.originalFilename || doc.title;
      a.click();
      URL.revokeObjectURL(url);
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
  /** Required when format is VIRTUAL or HYBRID. */
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
  subject?: string;
  message:  string;
  channel:  "EMAIL" | "SMS" | "ALL";
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
  }>;
}

/**
 * Import shareholders from a register into an event's expected-attendees list.
 * POST /api/v1/client/events/{eventId}/expected-attendees/import
 * Body: { registerId }
 */
export function useImportShareholdersToEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, registerId }: { eventId: string; registerId: string }) => {
      const res = await apiClient.post<ApiResponse<{ imported: number }>>(
        `/api/v1/client/events/${eventId}/expected-attendees/import`,
        { registerId }
      );
      return (res.data.data ?? (res.data as any)) as { imported: number };
    },
    onSuccess: (data, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["clientEvents", "expectedAttendees", eventId] });
      const count = (data as any)?.imported ?? "some";
      popup.success("Shareholders Imported", `${count} shareholders added as expected attendees.`, 3000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Could not import shareholders."),
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
