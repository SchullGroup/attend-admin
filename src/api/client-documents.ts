"use client";

/**
 * client-documents.ts — Global Document Vault API
 *
 * These endpoints operate on the organisation-wide document vault, separate
 * from per-event documents (which live in client-events.ts).
 *
 * Endpoints:
 *   GET    /api/v1/client/documents                    — paginated list w/ filters
 *   POST   /api/v1/client/documents                    — upload document
 *   GET    /api/v1/client/documents/filters/events     — event filter options
 *   GET    /api/v1/client/documents/filters/types      — document type options
 *   GET    /api/v1/client/documents/{documentId}       — get single document (with base64)
 *   DELETE /api/v1/client/documents/{documentId}       — delete document
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GlobalDocumentItem {
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
  eventId?:         string;
  eventTitle?:      string;
  fileData?:        string; // base64, present only on single-document fetch
}

export interface GlobalDocumentListResponse {
  content:       GlobalDocumentItem[];
  totalElements: number;
  totalPages:    number;
  size:          number;
  number:        number; // current page (0-based)
}

export interface UploadGlobalDocumentRequest {
  title:            string;
  documentType:     string;
  eventId:          string; // uuid — document must be linked to an event
  fileData:         string; // base64-encoded file content
  originalFilename: string;
}

export interface DocumentEventFilterOption {
  id:    string;
  label: string;
}

export interface DocumentFilterEventsResponse {
  events: DocumentEventFilterOption[];
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const clientDocumentKeys = {
  all:     ["clientDocuments"] as const,
  list:    (search: string, eventId: string, type: string, page: number, size: number) =>
             ["clientDocuments", "list", { search, eventId, type, page, size }] as const,
  detail:  (id: string) => ["clientDocuments", "detail", id] as const,
  filterEvents: ["clientDocuments", "filterEvents"] as const,
  filterTypes:  ["clientDocuments", "filterTypes"] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Paginated document list with optional search, event, and type filters.
 *
 * GET /api/v1/client/documents
 */
export function useGlobalDocuments(
  search  = "",
  eventId = "",
  type    = "",
  page    = 0,
  size    = 20
) {
  return useQuery({
    queryKey: clientDocumentKeys.list(search, eventId, type, page, size),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<GlobalDocumentListResponse>>(
        "/api/v1/client/documents",
        {
          params: {
            page,
            size,
            ...(search  ? { search }  : {}),
            ...(eventId ? { eventId } : {}),
            ...(type    ? { type }    : {}),
          },
        }
      );
      return res.data.data;
    },
    staleTime: 30_000,
  });
}

/** Dropdown options for the event filter on the document list. */
export function useDocumentEventFilterOptions() {
  return useQuery({
    queryKey: clientDocumentKeys.filterEvents,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<DocumentFilterEventsResponse>>(
        "/api/v1/client/documents/filters/events"
      );
      return res.data.data?.events ?? [];
    },
    staleTime: 120_000,
  });
}

/** Available document type options (returns array of { key, label } maps). */
export function useDocumentTypeOptions() {
  return useQuery({
    queryKey: clientDocumentKeys.filterTypes,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        "/api/v1/client/documents/filters/types"
      );
      // Returns ApiResponseListMapStringString — normalise to flat string[]
      const raw = res.data.data;
      if (Array.isArray(raw)) {
        return raw.flatMap((m: Record<string, string>) => Object.values(m)) as string[];
      }
      return raw as string[];
    },
    staleTime: 300_000,
  });
}

/** Fetch single document including base64 fileData (increments download count). */
export function useGlobalDocument(documentId: string) {
  return useQuery({
    queryKey: clientDocumentKeys.detail(documentId),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<GlobalDocumentItem>>(
        `/api/v1/client/documents/${documentId}`
      );
      return res.data.data;
    },
    enabled:   !!documentId,
    staleTime: 0, // always fresh — downloading increments a counter
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Upload a document to the global vault (linked to a specific event). */
export function useUploadGlobalDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UploadGlobalDocumentRequest) => {
      const res = await apiClient.post<ApiResponse<GlobalDocumentItem>>(
        "/api/v1/client/documents",
        payload
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientDocumentKeys.all });
      popup.success("Document Uploaded", "File has been added to the document vault.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Upload failed. Max 10 MB."),
  });
}

/** Delete a document from the vault. */
export function useDeleteGlobalDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: string) => {
      await apiClient.delete(`/api/v1/client/documents/${documentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientDocumentKeys.all });
      popup.success("Document Deleted", "The file has been removed from the vault.", 2000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Delete failed."),
  });
}

/** Download a document: fetch its base64 fileData and trigger browser download. */
export function useDownloadGlobalDocument() {
  return useMutation({
    mutationFn: async (documentId: string) => {
      const res = await apiClient.get<ApiResponse<GlobalDocumentItem>>(
        `/api/v1/client/documents/${documentId}`
      );
      return res.data.data;
    },
    onSuccess: (doc) => {
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
