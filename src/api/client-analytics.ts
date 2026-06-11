"use client";

/**
 * client-analytics.ts — Client Analytics API
 *
 * All endpoints: GET /api/v1/client/analytics/*
 * Requires authenticated client/stakeholder token.
 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Types — aligned with swagger schemas
// ---------------------------------------------------------------------------

export interface AnalyticsStatsResponse {
  totalEvents:       number;
  totalRsvps:        number;
  totalAttendees:    number;
  avgFillRate:       number;
  totalDocuments:    number;
}

export interface ByTypeItem {
  eventType:  string;
  count:      number;
  percentage: number;
}

export interface ByTypeResponse {
  items: ByTypeItem[];
}

export interface FillRateOverviewResponse {
  averageFillRate: number;
  fullyBooked:     number;
  overHalfFull:    number;
  underHalfFull:   number;
  empty:           number;
}

export interface RsvpsByEventItem {
  eventId:    string;
  eventTitle: string;
  rsvpCount:  number;
  capacity:   number;
  fillRate:   number;
}

export interface RsvpsByEventResponse {
  events: RsvpsByEventItem[];
}

export interface EventPerformanceItem {
  eventId:       string;
  eventTitle:    string;
  eventType:     string;
  date:          string;
  rsvpCount:     number;
  capacity:      number;
  fillRate:      number;
  attendeeCount: number;
  status:        string;
}

export interface EventPerformanceResponse {
  totalCount:  number;
  page:        number;
  size:        number;
  events:      EventPerformanceItem[];
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const clientAnalyticsKeys = {
  all:             ["clientAnalytics"] as const,
  stats:           ["clientAnalytics", "stats"] as const,
  byType:          ["clientAnalytics", "byType"] as const,
  fillRateOverview:["clientAnalytics", "fillRateOverview"] as const,
  rsvpsByEvent:    ["clientAnalytics", "rsvpsByEvent"] as const,
  performance:     (page: number, size: number) =>
                     ["clientAnalytics", "performance", { page, size }] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Summary stats: totals for events, RSVPs, attendees, fill rate, documents. */
export function useAnalyticsStats() {
  return useQuery({
    queryKey: clientAnalyticsKeys.stats,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<AnalyticsStatsResponse>>(
        "/api/v1/client/analytics/stats"
      );
      return res.data.data;
    },
    staleTime: 60_000,
  });
}

/** Events grouped by type with counts and percentages. */
export function useAnalyticsByType() {
  return useQuery({
    queryKey: clientAnalyticsKeys.byType,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ByTypeResponse>>(
        "/api/v1/client/analytics/by-type"
      );
      return res.data.data;
    },
    staleTime: 60_000,
  });
}

/** Fill-rate overview: buckets (fully booked, over 50%, under 50%, empty). */
export function useAnalyticsFillRateOverview() {
  return useQuery({
    queryKey: clientAnalyticsKeys.fillRateOverview,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<FillRateOverviewResponse>>(
        "/api/v1/client/analytics/fill-rate-overview"
      );
      return res.data.data;
    },
    staleTime: 60_000,
  });
}

/** RSVPs broken down per event (for bar/pie charts). */
export function useAnalyticsRsvpsByEvent() {
  return useQuery({
    queryKey: clientAnalyticsKeys.rsvpsByEvent,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<RsvpsByEventResponse>>(
        "/api/v1/client/analytics/rsvps-by-event"
      );
      return res.data.data;
    },
    staleTime: 60_000,
  });
}

/** Paginated event-performance table: RSVP, capacity, fill rate, attendee count per event. */
export function useAnalyticsEventPerformance(page = 0, size = 10) {
  return useQuery({
    queryKey: clientAnalyticsKeys.performance(page, size),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<EventPerformanceResponse>>(
        "/api/v1/client/analytics/event-performance",
        { params: { page, size } }
      );
      return res.data.data;
    },
    staleTime: 60_000,
  });
}
