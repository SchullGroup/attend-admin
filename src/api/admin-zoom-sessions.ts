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
  /** True when the backend actually reported pool capacity (vs. FE deriving in-use from rows). */
  capacityReported: boolean;
  /** The raw unwrapped payload, for the super-admin "show raw response" diagnostic. */
  raw?: any;
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

/**
 * Coax a display string out of a value that may be a plain string OR a nested
 * object. A Spring backend commonly returns `organisation: { name }` /
 * `registrar: { fullName, email }` rather than a flat `orgName` string, so a
 * flat-only read shows "—" even though the data is present. Tries the usual
 * label-ish sub-keys before giving up.
 */
function asText(v: any): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return v.trim() || undefined;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    const s =
      v.name ?? v.fullName ?? v.displayName ?? v.title ?? v.label ?? v.email ?? v.username ?? v.value;
    if (typeof s === "string") return s.trim() || undefined;
    if (typeof s === "number") return String(s);
  }
  return undefined;
}

/** Like asText, but for a host *account* prefer the email/username identifier over a display name. */
function asAccount(v: any): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return v.trim() || undefined;
  if (typeof v === "object") {
    const s =
      v.email ?? v.hostEmail ?? v.username ?? v.account ?? v.name ?? v.displayName ?? v.label ?? v.value;
    if (typeof s === "string") return s.trim() || undefined;
  }
  return undefined;
}

/** First candidate that yields a usable string (skips empty strings and label-less objects). */
function pick(fn: (v: any) => string | undefined, ...cands: any[]): string | undefined {
  for (const c of cands) {
    const s = fn(c);
    if (s) return s;
  }
  return undefined;
}

function parseZoomSessionRow(raw: any): ZoomSessionRow | null {
  const r = raw ?? {};
  const eventId = r.eventId ?? r.event_id ?? r.id ?? "";
  if (!eventId) return null;
  return {
    eventId:         String(eventId),
    eventTitle:      r.eventTitle ?? r.event_title ?? r.title ?? r.eventName ?? "Untitled event",
    // Organiser identity: the owning organisation, plus the registrar/creator as a sub-line.
    // Tolerant of flat strings AND nested {name}/{email} objects (see asText).
    orgName:         pick(asText, r.orgName, r.organisationName, r.organizationName, r.org_name, r.organisation, r.organization, r.org, r.client, r.clientName),
    registrarName:   pick(asText, r.registrarName, r.registrar, r.registrar_name, r.registrarEmail, r.organizerName, r.organiserName, r.ownerName, r.createdByName, r.createdBy, r.owner, r.organizer, r.organiser),
    // The assigned pooled host — email preferred (asAccount). §3b persists event→hostEmail,
    // so it exists server-side; cover the likely flat + nested shapes it might arrive under.
    pooledAccount:   pick(asAccount, r.pooledAccount, r.hostAccount, r.hostEmail, r.host_email, r.account, r.pooled_account, r.host, r.assignedHost, r.assigned_host, r.hostUser, r.hostUserEmail, r.host_user, r.zoomHost, r.zoomHostEmail, r.zoom_host, r.hostName),
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
    Array.isArray(p.data)     ? p.data     :
    Array.isArray(p)          ? p          : [];
  const sessions = rawRows
    .map(parseZoomSessionRow)
    .filter((x): x is ZoomSessionRow => !!x);

  // Pool totals can arrive under several shapes — a `totals`/`summary`/`pool`/`stats`
  // object, or only implied by a per-host list. Look everywhere before giving up.
  const t = p.totals ?? p.summary ?? p.pool ?? p.stats ?? p.capacity ?? {};
  const hosts: any[] =
    (Array.isArray(p.hosts) && p.hosts) ||
    (Array.isArray(p.pool?.hosts) && p.pool.hosts) ||
    (Array.isArray(t?.hosts) && t.hosts) ||
    [];

  // From a host list we can sum a real capacity/in-use even if no totals object exists.
  const hostCapacity = hosts.length
    ? hosts.reduce((sum, h) => sum + (numOrNull(h?.capacity ?? h?.maxConcurrent ?? h?.slots) ?? 2), 0)
    : null;
  const hostInUse = hosts.length
    ? hosts.reduce((sum, h) => sum + (numOrNull(h?.activeCount ?? h?.active ?? h?.inUse ?? h?.used) ?? 0), 0)
    : null;

  const reportedCapacity = numOrNull(
    t.totalCapacity ?? t.capacity ?? t.poolCapacity ?? t.maxConcurrent ?? t.totalSlots ?? t.total ?? t.max,
  );
  const totalCapacity = reportedCapacity ?? hostCapacity;

  const reportedInUse = numOrNull(
    t.slotsInUse ?? t.inUse ?? t.used ?? t.active ?? t.activeMeetings ?? t.usedSlots ?? t.occupied,
  );
  // Derive from rows whatever the backend didn't spell out, so the summary is never blank.
  const slotsInUse = reportedInUse ?? hostInUse ?? sessions.length;

  const strandedSlots =
    numOrNull(t.strandedSlots ?? t.stranded ?? t.leaked ?? t.orphaned) ??
    sessions.filter((s) => s.stranded).length;

  const slotsFree =
    numOrNull(t.slotsFree ?? t.free ?? t.available ?? t.freeSlots ?? t.remaining) ??
    (totalCapacity != null ? Math.max(0, totalCapacity - slotsInUse) : null);

  return {
    available: true,
    sessions,
    totals: { totalCapacity, slotsInUse, slotsFree, strandedSlots },
    // "Reported" = the backend actually told us a ceiling (either directly or via hosts).
    capacityReported: reportedCapacity != null || hostCapacity != null,
    raw: p,
  };
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
          return { available: false, sessions: [], totals: emptyTotals(), capacityReported: false, raw: null };
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
 * Release many slots at once. The backend has no bulk endpoint yet (requested in the
 * host-pool doc), so we fan out DELETEs in small batches to avoid hammering the API,
 * then report a single aggregated result. Partial failures are surfaced, not swallowed.
 */
export function useReleaseZoomSessionsBulk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventIds }: { eventIds: string[] }) => {
      const ids = Array.from(new Set(eventIds.filter(Boolean)));
      let released = 0;
      const failed: string[] = [];
      const BATCH = 5;
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map((id) => apiClient.delete<ApiResponse<any>>(`/api/v1/admin/zoom-sessions/${id}`)),
        );
        results.forEach((r, idx) => {
          if (r.status === "fulfilled") released += 1;
          else failed.push(batch[idx]);
        });
      }
      return { released, failed, total: ids.length };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: adminZoomSessionKeys.all });
      if (res.failed.length === 0) {
        popup.success("Slots released", `Freed ${res.released} Zoom host slot(s) for reuse.`, 3000);
      } else {
        popup.error(
          "Some slots not released",
          `Released ${res.released} of ${res.total}. ${res.failed.length} could not be released — refresh and try again.`,
          6000,
        );
      }
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to release the selected Zoom sessions."),
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
