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
  id:       string;
  title:    string;
  eventType: string;
  date:     string;
  format:   string;
  rsvpCount: number;
  capacity:  number;
  fillRate:  number;
  status:   "DRAFT" | "PUBLISHED" | "UPCOMING" | "LIVE" | "ENDED" | "CANCELLED";
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
  id?:     string;
  order?:  number;
  time:    string;
  title:   string;
  speaker?: string;
}

export interface AddAgendaItemRequest {
  time:     string;
  title:    string;
  speaker?: string;
}

export interface UpdateAgendaItemRequest {
  time?:    string;
  title?:   string;
  speaker?: string;
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
}

export interface EventDocumentListResponse {
  totalCount: number;
  documents:  DocumentItem[];
}

export interface UploadDocumentRequest {
  title:            string;
  documentType:     string;
  eventId:          string;
  fileData:         string;   // base64-encoded
  originalFilename: string;
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

/** Paginated event list for the authenticated stakeholder. */
export function useClientEvents(type = "ALL", page = 0, size = 20) {
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
export function useClientEventDetail(id: string) {
  return useQuery({
    queryKey: clientEventKeys.detail(id),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        `/api/v1/client/events/${id}`
      );
      return res.data.data;
    },
    enabled: !!id,
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
export function useClientEventDocuments(eventId: string, search = "") {
  return useQuery({
    queryKey: clientEventKeys.documents(eventId),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<EventDocumentListResponse>>(
        `/api/v1/client/events/${eventId}/documents`,
        { params: search ? { search } : undefined }
      );
      return res.data.data?.documents ?? [];
    },
    enabled: !!eventId,
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
      if (!doc?.fileData) return;
      // Decode base64 and trigger download
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
