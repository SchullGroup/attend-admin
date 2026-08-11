"use client";

/**
 * client-audit.ts — Client Audit Log API
 *
 * Endpoint:
 *   GET /api/v1/client/audit-logs
 *   Params: search, actionType, severity, startDate, endDate, userEmail,
 *           entityId, page, size
 *   Returns paginated activity history for the authenticated organisation.
 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ApiResponse } from "@/types/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditCategory = "AUTH" | "EVENTS" | "DOCUMENTS" | "TEAM" | "APPLICATIONS";
export type AuditSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface AuditLogEntry {
  id:               string;
  timestamp:        string;
  stakeholderName?: string; // present in super-admin audit logs
  actorEmail:       string;
  actorIp:          string;
  action:           string;
  category:         string;   // AuditCategory — kept as string for forward-compat
  resourceName:     string;
  resourceId:       string;
  details:          string;
  severity:         string;   // AuditSeverity — kept as string for forward-compat
}

export interface AuditLogsResponse {
  totalEvents: number;
  today:       number;
  warnings:    number;
  critical:    number;
  totalCount:  number;
  page:        number;
  size:        number;
  logs:        AuditLogEntry[];
}

export interface AuditLogParams {
  search?:     string;
  actionType?: string;
  /** Legacy/admin alias. Client requests are sent as actionType. */
  category?:   string;
  severity?:   string;
  startDate?:  string;
  endDate?:    string;
  userEmail?:  string;
  entityId?:   string;
  page?:       number;
  size?:       number;
}

// ─── Query key factory ────────────────────────────────────────────────────────

export const clientAuditKeys = {
  all:  ["clientAudit"] as const,
  list: (params: AuditLogParams) => ["clientAudit", "list", params] as const,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

function toAuditParams(params: AuditLogParams, includePagination = true) {
  const {
    search = "",
    actionType = "",
    category = "",
    severity = "",
    startDate = "",
    endDate = "",
    userEmail = "",
    entityId = "",
    page = 0,
    size = 20,
  } = params;

  return {
    ...(includePagination ? { page, size } : {}),
    ...(search.trim()     ? { search: search.trim() }         : {}),
    ...(actionType || category ? { actionType: actionType || category } : {}),
    ...(severity          ? { severity }                      : {}),
    ...(startDate         ? { startDate }                     : {}),
    ...(endDate           ? { endDate }                       : {}),
    ...(userEmail.trim()  ? { userEmail: userEmail.trim() }   : {}),
    ...(entityId.trim()   ? { entityId: entityId.trim() }     : {}),
  };
}

function exportFilename(contentDisposition?: string): string {
  const encoded = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = contentDisposition?.match(/filename="?([^";]+)"?/i)?.[1];
  return decodeURIComponent(encoded ?? plain ?? "audit-logs.csv");
}

export function useClientAuditLogs(params: AuditLogParams = {}, enabled = true) {
  const normalized = {
    search: params.search ?? "",
    actionType: params.actionType ?? "",
    category: params.category ?? "",
    severity: params.severity ?? "",
    startDate: params.startDate ?? "",
    endDate: params.endDate ?? "",
    userEmail: params.userEmail ?? "",
    entityId: params.entityId ?? "",
    page: params.page ?? 0,
    size: params.size ?? 20,
  };

  return useQuery({
    queryKey: clientAuditKeys.list(normalized),
    enabled,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<AuditLogsResponse>>(
        "/api/v1/client/audit-logs",
        { params: toAuditParams(normalized) }
      );
      return res.data.data;
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev, // keep previous page visible during refetch
  });
}

export async function exportClientAuditLogs(params: AuditLogParams) {
  const res = await apiClient.get<Blob>("/api/v1/client/audit-logs/export", {
    params: toAuditParams(params, false),
    responseType: "blob",
  });
  return {
    blob: res.data,
    filename: exportFilename(res.headers["content-disposition"]),
  };
}

export async function exportSelectedClientAuditLogs(ids: string[]) {
  const res = await apiClient.post<Blob>(
    "/api/v1/client/audit-logs/export",
    ids,
    { responseType: "blob" }
  );
  return {
    blob: res.data,
    filename: exportFilename(res.headers["content-disposition"]),
  };
}
