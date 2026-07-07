"use client";

/**
 * client-search.ts — Client Global Search
 *
 * GET /api/v1/client/search?q=<term>
 * Returns up to 5 results per section.
 * Min query length: 2 characters.
 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchEvent {
  id:        string;
  title:     string;
  date:      string;
  status:    string;
  eventType: string;
}

export interface SearchTeamMember {
  id:       string;
  fullName: string;
  email:    string;
  role:     string;
}

export interface SearchDocument {
  id:       string;
  title:    string;
  fileType: string;
  eventId?: string;
}

export interface ClientSearchResponse {
  query:       string;
  events:      SearchEvent[];
  teamMembers: SearchTeamMember[];
  documents:   SearchDocument[];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useClientSearch(q: string, limit = 5) {
  return useQuery({
    queryKey: ["clientSearch", q, limit],
    queryFn: async () => {
      const res = await apiClient.get<ClientSearchResponse>(
        "/api/v1/client/search",
        { params: { q, limit } }
      );
      // API may wrap in { data: ... } or return directly
      return (res.data as any).data ?? res.data;
    },
    enabled: q.trim().length >= 2,
    staleTime: 30_000,
    gcTime: 60_000,
    placeholderData: (prev) => prev,
  });
}
