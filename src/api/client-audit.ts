"use client";

/**
 * client-audit.ts — Client Audit Log API
 *
 * Endpoint:
 *   GET /api/v1/client/audit-logs
 *   Params: search, category, severity, page, size
 *   Returns paginated activity history for the authenticated organisation.
 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ApiResponse } from "@/types/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditCategory = "AUTH" | "EVENTS" | "DOCUMENTS" | "TEAM" | "APPLICATIONS";
export type AuditSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface AuditLogEntry {
  id:           string;
  timestamp:    string;
  actorEmail:   string;
  actorIp:      string;
  action:       string;
  category:     string;   // AuditCategory — kept as string for forward-compat
  resourceName: string;
  resourceId:   string;
  details:      string;
  severity:     string;   // AuditSeverity — kept as string for forward-compat
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
  search?:   string;
  category?: string;
  severity?: string;
  page?:     number;
  size?:     number;
}

// ─── Query key factory ────────────────────────────────────────────────────────

export const clientAuditKeys = {
  all:  ["clientAudit"] as const,
  list: (params: AuditLogParams) => ["clientAudit", "list", params] as const,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useClientAuditLogs(params: AuditLogParams = {}) {
  const { search = "", category = "", severity = "", page = 0, size = 20 } = params;

  return useQuery({
    queryKey: clientAuditKeys.list({ search, category, severity, page, size }),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<AuditLogsResponse>>(
        "/api/v1/client/audit-logs",
        {
          params: {
            page,
            size,
            ...(search.trim()  ? { search:   search.trim()  } : {}),
            ...(category       ? { category                 } : {}),
            ...(severity       ? { severity                 } : {}),
          },
        }
      );
      return res.data.data;
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev, // keep previous page visible during refetch
  });
}
