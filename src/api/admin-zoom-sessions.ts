"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import type { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Super-admin Zoom capacity  (backend spec: certificate.md §7c)
//
//   Live events share a small POOL of Zoom host accounts. Each live VIRTUAL/HYBRID
//   event holds one host "slot" for the duration of its meeting; when the pool is
//   exhausted, new meetings 503 ("no host capacity"). A slot can also become
//   STRANDED — still assigned to an event that has ended/cancelled — which leaks
//   capacity until it's released.
//
//   This module powers the super-admin operations view: list who holds a slot,
//   release a slot (frees a host — strands anyone still connected), and manually
//   assign a host to an event.
//
//   IMPORTANT: none of these endpoints is on staging yet (certificate.md: "Nothing
//   has been deployed to staging"). The list query therefore treats 404/501 as
//   "not deployed" and returns an `available: false` shape instead of throwing, so
//   the page renders a friendly "activates once deployed" state today and lights up
//   automatically when the backend ships.
// ---------------------------------------------------------------------------

/** One held Zoom host slot. */
export interface ZoomSessionRow {
  eventId:          string;
  eventTitle:       string;
  orgName?:         string;
  registrarName?:   string;
  /** The pooled Zoom host account this event is using (email / label). */
  pooledAccount?:   string;
  meetingId?:       number | string;
  joinUrl?:         string;
  startUrl?:        string;
  durationMinutes?: number;
  eventStatus?:     string;
  /** The meeting is currently in progress. */
  live:             boolean;
  /** The slot is still held by an event that has ended/cancelled — a capacity leak. */
  stranded:         boolean;
  assignedAt?:      string;
  expiresAt?:       string;
}

export interface ZoomSessionTotals {
  totalCapacity: number | null;
  slotsInUse:    number | null;
  slotsFree:     number | null;
  strandedSlots: number | null;
}

export interface AdminZoomSessionsData {
  /** False when the backend Zoom-capacity endpoints aren't deployed yet (404/501). */
  available: boolean;
  sessions:  ZoomSessionRow[];
  totals:    ZoomSessionTotals;
}

export const adminZoomSessionKeys = {
  all:  ["admin", "zoom-sessions"] as const,
  list: () => ["admin", "zoom-sessions", "list"] as const,
};

// --- parsing (tolerant of snake_case / field-name variants) -----------------

function emptyTotals(): ZoomSessionTotals {
  return { totalCapacity: null, slotsInUse: null, slotsFree: null, strandedSlots: null };
}

function toBool(v: any): boolean {
  return v === true || v === "true" || v === 1;
}

function numOrNull(v: any): number | null {
  if (typeof v === "number") return Number.isNaN(v) ? null : v;
  if (v != null && v !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function parseZoomSessionRow(raw: any): ZoomSessionRow | null {
  const r = raw ?? {};
  const eventId = r.eventId ?? r.event_id ?? r.id ?? "";
  if (!eventId) return null;
  return {
    eventId:         String(eventId),
    eventTitle:      r.eventTitle ?? r.event_title ?? r.title ?? r.eventName ?? "Untitled event",
    orgName:         r.orgName ?? r.organisationName ?? r.organizationName ?? r.org_name ?? undefined,
    registrarName:   r.registrarName ?? r.registrar ?? r.registrar_name ?? r.registrarEmail ?? undefined,
    pooledAccount:   r.pooledAccount ?? r.hostAccount ?? r.hostEmail ?? r.account ?? r.pooled_account ?? undefined,
    meetingId:       r.meetingId ?? r.meeting_id ?? r.zoomMeetingId ?? undefined,
    joinUrl:         r.joinUrl ?? r.join_url ?? undefined,
    startUrl:        r.startUrl ?? r.start_url ?? undefined,
    durationMinutes: numOrNull(r.durationMinutes ?? r.duration_minutes) ?? undefined,
    eventStatus:     r.eventStatus ?? r.status ?? undefined,
    live:            toBool(r.live ?? r.isLive ?? r.inProgress ?? r.active),
    stranded:        toBool(r.stranded ?? r.isStranded ?? r.orphaned),
    assignedAt:      r.assignedAt ?? r.assigned_at ?? undefined,
    expiresAt:       r.expiresAt ?? r.expires_at ?? undefined,
  };
}

function parseZoomSessions(payload: any): AdminZoomSessionsData {
  const p = payload ?? {};
  const rawRows: any[] =
    Array.isArray(p.sessions) ? p.sessions :
    Array.isArray(p.content)  ? p.content  :
    Array.isArray(p)          ? p          : [];
  const sessions = rawRows
    .map(parseZoomSessionRow)
    .filter((x): x is ZoomSessionRow => !!x);

  const t = p.totals ?? p.summary ?? {};
  const totalCapacity = numOrNull(t.totalCapacity ?? t.capacity ?? t.total);
  // Derive from rows whatever the backend didn't spell out, so the summary is never blank.
  const slotsInUse = numOrNull(t.slotsInUse ?? t.inUse ?? t.used) ?? sessions.length;
  const strandedSlots = numOrNull(t.strandedSlots ?? t.stranded) ?? sessions.filter((s) => s.stranded).length;
  const slotsFree = numOrNull(t.slotsFree ?? t.free ?? t.available) ??
    (totalCapacity != null ? Math.max(0, totalCapacity - slotsInUse) : null);

  return { available: true, sessions, totals: { totalCapacity, slotsInUse, slotsFree, strandedSlots } };
}

// --- reads ------------------------------------------------------------------

/**
 * GET /api/v1/admin/zoom-sessions
 * Every currently-held Zoom host slot + pool totals. Returns an `available: false`
 * shape (rather than throwing) when the endpoint isn't deployed yet (404/501).
 */
export function useAdminZoomSessions(enabled = true) {
  return useQuery({
    queryKey: adminZoomSessionKeys.list(),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 15_000,
    queryFn: async (): Promise<AdminZoomSessionsData> => {
      try {
        const res = await apiClient.get<ApiResponse<any>>(`/api/v1/admin/zoom-sessions`);
        return parseZoomSessions((res.data as any)?.data ?? res.data);
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 404 || status === 501) {
          return { available: false, sessions: [], totals: emptyTotals() };
        }
        throw err;
      }
    },
  });
}

// --- writes -----------------------------------------------------------------

/**
 * DELETE /api/v1/admin/zoom-sessions/{eventId}
 * Frees the pooled host slot this event holds. STRANDS anyone still connected to
 * the meeting, so the call site must confirm-guard it.
 */
export function useReleaseZoomSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId }: { eventId: string }) => {
      const res = await apiClient.delete<ApiResponse<any>>(`/api/v1/admin/zoom-sessions/${eventId}`);
      return (res.data as any)?.data ?? res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminZoomSessionKeys.all });
      popup.success("Slot released", "The Zoom host slot was freed for reuse.", 3000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to release the Zoom session."),
  });
}

/**
 * POST /api/v1/admin/zoom-sessions/{eventId}/assign?durationMinutes=120
 * Manually assigns a pooled Zoom host to an event. 503 when the pool is exhausted.
 */
export function useAssignZoomSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, durationMinutes = 120 }: { eventId: string; durationMinutes?: number }) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/admin/zoom-sessions/${eventId}/assign`,
        null,
        { params: { durationMinutes } }
      );
      return (res.data as any)?.data ?? res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminZoomSessionKeys.all });
      popup.success("Host assigned", "A pooled Zoom host was assigned to the event.", 3000);
    },
    onError: (error: any) => {
      // The shared host pool can be exhausted — surface the real capacity message.
      if (error?.response?.status === 503) {
        const serverMsg =
          (typeof error?.response?.data?.message === "string" && error.response.data.message) ||
          (typeof error?.response?.data?.error === "string" && error.response.data.error) ||
          "";
        popup.error(
          "No Zoom host capacity",
          serverMsg || "All shared Zoom host accounts are in use right now. Release a stranded slot or try again shortly.",
          6000
        );
        return;
      }
      parseAndToastApiError(error, "Failed to assign a Zoom host.");
    },
  });
}
