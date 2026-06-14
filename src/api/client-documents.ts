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
  eventId?:         string;
  eventName?:       string;
  registerId?:      string;
  registerName?:    string;
  fileType:         string;
  mimeType:         string;
  originalFilename: string;
  sizeBytes:        number;
  sizeLabel:        string;
  uploadedAt:       string;
  downloadCount:    number;
  fileUrl?:         string;
  fileData?:        string; // base64, present only on single-document fetch
}

export interface GlobalDocumentListResponse {
  totalCount: number;
  label?:     string;
  page:       number;
  size:       number;
  documents:  GlobalDocumentItem[];
}

export interface UploadGlobalDocumentRequest {
  title:               string;
  documentType:        string;
  eventId:             string;
  fileUrl:             string;  // Cloudinary URL from /api/v1/upload
  cloudinaryPublicId?: string;
  originalFilename:    string;
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
  all:             ["clientDocuments"] as const,
  list:            (search: string, registerId: string, eventId: string, type: string, page: number, size: number) =>
                     ["clientDocuments", "list", { search, registerId, eventId, type, page, size }] as const,
  detail:          (id: string) => ["clientDocuments", "detail", id] as const,
  filterEvents:    ["clientDocuments", "filterEvents"] as const,
  filterRegisters: ["clientDocuments", "filterRegisters"] as const,
  filterTypes:     ["clientDocuments", "filterTypes"] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Paginated document list with optional search, registerId, eventId, and type filters.
 *
 * GET /api/v1/client/documents
 */
export function useGlobalDocuments(
  search     = "",
  registerId = "",
  eventId    = "",
  type       = "",
  page       = 0,
  size       = 20
) {
  return useQuery({
    queryKey: clientDocumentKeys.list(search, registerId, eventId, type, page, size),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<GlobalDocumentListResponse>>(
        "/api/v1/client/documents",
        {
          params: {
            page,
            size,
            ...(search     ? { search }     : {}),
            ...(registerId ? { registerId } : {}),
            ...(eventId    ? { eventId }    : {}),
            ...(type       ? { type }       : {}),
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

/** Dropdown options for the register (organiser) filter on the document list. */
export function useDocumentRegisterFilterOptions() {
  return useQuery({
    queryKey: clientDocumentKeys.filterRegisters,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<DocumentFilterEventsResponse>>(
        "/api/v1/client/documents/filters/registers"
      );
      return res.data.data?.events ?? []; // API returns same shape { events: [{id, label}] }
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

/**
 * Upload a document to the global vault.
 * Two-step: POST /api/v1/upload (multipart) → POST /api/v1/client/documents (JSON).
 */
export function useUploadGlobalDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      title,
      documentType,
      eventId,
    }: {
      file:         File;
      title:        string;
      documentType: string;
      eventId:      string;
    }) => {
      // Step 1 — upload file to Cloudinary via backend proxy
      // Do NOT set Content-Type manually: the browser must set it with the multipart boundary.
      // Setting it to undefined removes the axios instance default (application/json).
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await apiClient.post<ApiResponse<Record<string, string>>>(
        "/api/v1/upload",
        form,
        {
          params:           { folder: "documents" },
          headers:          { "Content-Type": undefined },
          maxBodyLength:    Infinity,
          maxContentLength: Infinity,
          timeout:          120_000,
        }
      );
      const uploadData         = uploadRes.data?.data ?? {};
      const fileUrl            =
        uploadData.fileUrl        ??
        uploadData.secure_url     ??
        uploadData.url            ??
        uploadData.downloadUrl    ??
        "";
      const cloudinaryPublicId  =
        uploadData.cloudinaryPublicId ??
        uploadData.public_id          ??
        undefined;

      if (!fileUrl) throw new Error("Upload failed — no file URL returned by server.");

      // Step 2 — register in the global vault
      const payload: UploadGlobalDocumentRequest = {
        title,
        documentType,
        eventId,
        fileUrl,
        originalFilename: file.name,
        ...(cloudinaryPublicId ? { cloudinaryPublicId } : {}),
      };
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

/**
 * Upload a file URL directly to Cloudinary then register it in the document vault.
 * Flow: fetch file blob → POST /api/v1/upload (FormData) → POST /api/v1/client/documents.
 */
export interface UploadCloudinaryDocumentRequest {
  /** Absolute or relative URL of the file to fetch and re-upload. */
  sourceUrl:    string;
  title:        string;
  documentType: string;
  eventId:      string;
  /** Suggested filename, e.g. "AGM-Notice.pdf" */
  originalFilename?: string;
}

export function useUploadCloudinaryDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sourceUrl,
      title,
      documentType,
      eventId,
      originalFilename = "document.pdf",
    }: UploadCloudinaryDocumentRequest) => {
      // 1. Fetch the raw file blob from the source URL
      const fileResponse = await apiClient.get<Blob>(sourceUrl, {
        responseType: "blob",
      });
      const blob = fileResponse.data;

      // 2. Upload to Cloudinary via the platform upload proxy
      const formData = new FormData();
      formData.append("file", blob, originalFilename);
      const uploadRes = await apiClient.post<ApiResponse<Record<string, string>>>(
        "/api/v1/upload",
        formData,
        {
          params:  { folder: "documents" },
          headers: { "Content-Type": undefined },
        }
      );
      const uploadData = uploadRes.data.data ?? {};
      const fileUrl           = uploadData["fileUrl"]           ?? uploadData["url"]        ?? "";
      const cloudinaryPublicId = uploadData["cloudinaryPublicId"] ?? uploadData["public_id"] ?? "";

      // 3. Register the document in the vault
      const docRes = await apiClient.post<ApiResponse<GlobalDocumentItem>>(
        "/api/v1/client/documents",
        { title, documentType, eventId, fileUrl, cloudinaryPublicId, originalFilename }
      );
      return docRes.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientDocumentKeys.all });
      popup.success("AGM Notice Uploaded", "AGM notice has been added to documents.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "AGM notice upload failed."),
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

/** Download a document — opens the Cloudinary URL directly, or falls back to base64. */
export function useDownloadGlobalDocument() {
  return useMutation({
    mutationFn: async (documentId: string) => {
      const res = await apiClient.get<ApiResponse<GlobalDocumentItem>>(
        `/api/v1/client/documents/${documentId}`
      );
      return res.data.data;
    },
    onSuccess: (doc) => {
      // Prefer Cloudinary URL — just open it
      const directUrl = (doc as any).fileUrl ?? (doc as any).downloadUrl;
      if (directUrl) {
        const a    = document.createElement("a");
        a.href     = directUrl;
        a.download = (doc as any).originalFilename || doc.title;
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
      a.download = (doc as any).originalFilename || doc.title;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (error: any) => parseAndToastApiError(error, "Download failed."),
  });
}
