"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import { adminZoomSessionKeys } from "@/api/admin-zoom-sessions";
import type { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Super-admin Zoom host pool  (backend spec: certificate.md §7d, host-pool doc §3a/§6.1)
//
//   Live VIRTUAL/HYBRID meetings are spread across a POOL of licensed Zoom host
//   accounts. Each host contributes `capacity` concurrent slots (default 2 — a
//   seat without Zoom's "simultaneous meetings" setting only delivers 1). Adding a
//   licensed email raises total capacity IMMEDIATELY, "no deploy, no dev
//   involvement" (§7d) — this module is the self-service UI half of that promise.
//
//   Endpoints (RESTful, per §7c "the existing GET /api/v1/admin/zoom-hosts" and §7d
//   "POST /api/v1/admin/zoom-hosts with the new licensed email … PATCH its real
//   capacity"):
//     GET    /api/v1/admin/zoom-hosts            list the pool + per-host capacity/usage
//     POST   /api/v1/admin/zoom-hosts            { email, capacity? }  add a licensed host
//     PATCH  /api/v1/admin/zoom-hosts/{id}       { capacity }          correct a seat's capacity
//     DELETE /api/v1/admin/zoom-hosts/{id}                             remove a host from the pool
//
//   Contract caveats (logged for backend confirmation in the host-pool doc §11):
//   the PATCH/DELETE path key (host id vs. email) and exact field names aren't
//   pinned in the handoff. Reads are field-name tolerant (snake_case friendly) and
//   the list query treats 404/501 as "not deployed" → `available: false` instead of
//   throwing, so the UI degrades gracefully and lights up when the backend ships —
//   the same pattern as admin-zoom-sessions.ts.
// ---------------------------------------------------------------------------

export type ZoomHostType = "MEETING" | "WEBINAR";

/** One licensed Zoom host account in the shared pool. */
export interface ZoomHostRow {
  /** Stable id if the backend provides one; falls back to the email (which is the natural key). */
  id:          string;
  email:       string;
  /**
   * What this account is allowed to run. A webinar licence is a different,
   * scarcer thing from a meeting seat: webinar hosts never get meetings and
   * meeting hosts never get webinars, so the two are counted separately
   * everywhere. Absent on pre-webinar responses — treated as MEETING.
   */
  type:        ZoomHostType;
  /**
   * Per-host concurrent capacity. Meeting seats default to 2 (§7d); a webinar
   * licence is 1 and should stay 1 — a second licence is a second host row,
   * not a bigger number here.
   */
  capacity:    number;
  /**
   * Webinar hosts only: bookings not yet ended or cancelled, INCLUDING future
   * dates. `activeCount` is what is live this second; this is what the licence
   * is committed to. Always 0 for meeting hosts.
   */
  bookedCount?: number;
  /**
   * Slots held: a meeting row exists and its event is neither ENDED nor CANCELLED.
   * As of the backend's 2026-09-14 fix this is derived from the meeting rows themselves
   * rather than from the pool's own counter, and `/admin/zoom-sessions` totals come from
   * the same derivation — so the two screens can no longer disagree.
   */
  activeCount: number;
  /** Slots held for events that have ended or been cancelled — cancel these to reclaim capacity. */
  strandedCount?: number;
  /** capacity − activeCount, as the server computes it. */
  freeSlots?:     number;
  /** What the pool's denormalised counter believes it is holding. */
  ledgerActiveCount?: number;
  /**
   * True when the counter and the meeting rows disagree. Left uncorrected this drifts low,
   * and assignment reads the counter — so a drifting pool believes it has room it does not
   * have and over-assigns. Surfaced rather than hidden.
   */
  ledgerDrift?:   boolean;
  /** Optional human label / display name. */
  label?:      string;
  /** Optional enabled flag, if the backend soft-disables hosts rather than deleting them. */
  enabled?:    boolean;
  /** The raw row, for the diagnostic "show raw response" toggle. */
  raw?:        any;
}

export interface AdminZoomHostsData {
  /** False when the backend zoom-hosts endpoint isn't deployed yet (404/501). */
  available:     boolean;
  hosts:         ZoomHostRow[];
  /** `hosts` split by type, so the UI can render its two sections directly. */
  meetingHosts:  ZoomHostRow[];
  webinarHosts:  ZoomHostRow[];
  /** How many webinars can run at once across the platform. Usually 0 or 1. */
  webinarCapacity: number;
  /** Sum of per-host capacity — the real pool ceiling. null when the pool is empty. */
  totalCapacity: number | null;
  /** Sum of per-host active meetings, when reported. null when unknown. */
  totalActive:   number | null;
  /**
   * True when the backend actually reported per-host usage. When false, every row's
   * `activeCount` is a 0 placeholder, NOT a measurement — the host-pool table would
   * then show "0 / 2" for every seat while the overview cards say slots are in use.
   * Callers should derive per-host usage from the sessions list instead.
   */
  usageReported: boolean;
  raw?:          any;
}

export const adminZoomHostKeys = {
  all:  ["admin", "zoom-hosts"] as const,
  list: () => ["admin", "zoom-hosts", "list"] as const,
};

// --- parsing (tolerant of snake_case / field-name variants) -----------------

function numOrNull(v: any): number | null {
  if (typeof v === "number") return Number.isNaN(v) ? null : v;
  if (v != null && v !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function parseZoomHostRow(raw: any): ZoomHostRow | null {
  const r = raw ?? {};
  const email = r.email ?? r.hostEmail ?? r.host_email ?? r.userEmail ?? r.user_email ?? r.account ?? "";
  const id = r.id ?? r.hostId ?? r.host_id ?? r.userId ?? r.user_id ?? email;
  if (!id && !email) return null;
  const type: ZoomHostType =
    String(r.type ?? r.hostType ?? r.host_type ?? "").toUpperCase() === "WEBINAR" ? "WEBINAR" : "MEETING";
  return {
    id:          String(id || email),
    email:       String(email || id),
    type,
    // Per §7d meeting capacity defaults to 2 when omitted; a webinar licence is 1.
    capacity:    numOrNull(r.capacity ?? r.maxConcurrent ?? r.max_concurrent ?? r.slots ?? r.maxSlots)
                   ?? (type === "WEBINAR" ? 1 : 2),
    bookedCount: numOrNull(r.bookedCount ?? r.booked_count ?? r.bookings) ?? undefined,
    // NB: avoid the bare `active` key here — it's ambiguous with an enabled flag.
    activeCount: numOrNull(
      r.activeCount ?? r.active_count ?? r.activeMeetings ?? r.inUse ?? r.in_use ?? r.used ?? r.usedSlots ?? r.slotsInUse,
    ) ?? 0,
    strandedCount:     numOrNull(r.strandedCount ?? r.stranded_count ?? r.stranded) ?? undefined,
    freeSlots:         numOrNull(r.freeSlots ?? r.free_slots ?? r.free) ?? undefined,
    ledgerActiveCount: numOrNull(r.ledgerActiveCount ?? r.ledger_active_count) ?? undefined,
    ledgerDrift:       typeof (r.ledgerDrift ?? r.ledger_drift) === "boolean" ? (r.ledgerDrift ?? r.ledger_drift) : undefined,
    label:       r.label ?? r.name ?? r.displayName ?? undefined,
    enabled:     typeof (r.enabled ?? r.isEnabled ?? r.active) === "boolean" ? (r.enabled ?? r.isEnabled ?? r.active) : undefined,
    raw:         r,
  };
}

function parseZoomHosts(payload: any): AdminZoomHostsData {
  const p = payload ?? {};
  const rawRows: any[] =
    Array.isArray(p.hosts)   ? p.hosts   :
    Array.isArray(p.content) ? p.content :
    Array.isArray(p.data)    ? p.data    :
    Array.isArray(p.pool)    ? p.pool    :
    Array.isArray(p)         ? p         : [];
  const hosts = rawRows
    .map(parseZoomHostRow)
    .filter((x): x is ZoomHostRow => !!x);

  const meetingHosts = hosts.filter((h) => h.type === "MEETING");
  const webinarHosts = hosts.filter((h) => h.type === "WEBINAR");

  // Meetings only. The backend's own pool totals on /admin/zoom-sessions count
  // meetings only as of 2026-09-26, and folding a webinar licence into the
  // meeting ceiling would tell a super admin they have a spare meeting slot
  // that does not exist.
  const totalCapacity = meetingHosts.length
    ? meetingHosts.reduce((sum, h) => sum + h.capacity, 0)
    : null;
  // Only surface a total-active if the backend actually reported per-host usage.
  const reportedActive = hosts.some(
    (h) => numOrNull(h.raw?.activeCount ?? h.raw?.active_count ?? h.raw?.activeMeetings ?? h.raw?.inUse ?? h.raw?.used) != null,
  );
  const totalActive = reportedActive ? meetingHosts.reduce((sum, h) => sum + h.activeCount, 0) : null;

  return {
    available: true, hosts, meetingHosts, webinarHosts,
    webinarCapacity: webinarHosts.reduce((sum, h) => sum + h.capacity, 0),
    totalCapacity, totalActive, usageReported: reportedActive, raw: p,
  };
}

// --- reads ------------------------------------------------------------------

/**
 * GET /api/v1/admin/zoom-hosts
 * The licensed host pool + per-host capacity. Returns `available: false` (rather
 * than throwing) when the endpoint isn't deployed yet (404/501), so the UI can
 * render a friendly "activates once deployed" state.
 */
export function useAdminZoomHosts(enabled = true) {
  return useQuery({
    queryKey: adminZoomHostKeys.list(),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 15_000,
    queryFn: async (): Promise<AdminZoomHostsData> => {
      try {
        const res = await apiClient.get<ApiResponse<any>>(`/api/v1/admin/zoom-hosts`);
        return parseZoomHosts((res.data as any)?.data ?? res.data);
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 404 || status === 501) {
          return { available: false, hosts: [], meetingHosts: [], webinarHosts: [], webinarCapacity: 0, totalCapacity: null, totalActive: null, usageReported: false, raw: null };
        }
        throw err;
      }
    },
  });
}

// --- writes -----------------------------------------------------------------

/** Capacity changes shift the pool ceiling, so refresh the sessions view too. */
function invalidatePoolViews(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: adminZoomHostKeys.all });
  queryClient.invalidateQueries({ queryKey: adminZoomSessionKeys.all });
}

/**
 * POST /api/v1/admin/zoom-hosts  { email, capacity? }
 * Add a licensed Zoom host to the pool. Capacity rises immediately (§7d).
 */
export function useAddZoomHost() {
  const queryClient = useQueryClient();
  return useMutation({
    // `type` is fixed at creation — PATCH will not change it later, so getting it
    // right here matters more than the other fields.
    mutationFn: async ({ email, capacity, type = "MEETING" }: { email: string; capacity?: number; type?: ZoomHostType }) => {
      const body: Record<string, unknown> = { email: email.trim(), type };
      if (capacity != null) body.capacity = capacity;
      const res = await apiClient.post<ApiResponse<any>>(`/api/v1/admin/zoom-hosts`, body);
      return (res.data as any)?.data ?? res.data;
    },
    onSuccess: (_, { type = "MEETING" }) => {
      invalidatePoolViews(queryClient);
      popup.success(
        type === "WEBINAR" ? "Webinar host added" : "Host added",
        type === "WEBINAR"
          ? "Organisers can now create webinars. One webinar runs at a time per licence — add another host for a second licence."
          : "The licensed Zoom host was added to the pool — capacity is available now.",
        4000,
      );
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to add the Zoom host."),
  });
}

/**
 * PATCH /api/v1/admin/zoom-hosts/{id}  { capacity }
 * Correct a seat's real per-host capacity (a seat without the "simultaneous
 * meetings" setting only delivers 1, not the default 2 — §7d).
 */
export function useUpdateZoomHostCapacity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ hostId, capacity }: { hostId: string; capacity: number }) => {
      const res = await apiClient.patch<ApiResponse<any>>(
        `/api/v1/admin/zoom-hosts/${encodeURIComponent(hostId)}`,
        { capacity },
      );
      return (res.data as any)?.data ?? res.data;
    },
    onSuccess: () => {
      invalidatePoolViews(queryClient);
      popup.success("Capacity updated", "The host's concurrent-meeting capacity was updated.", 3000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to update the host capacity."),
  });
}

/**
 * DELETE /api/v1/admin/zoom-hosts/{id}
 * Remove a host from the pool (lowers total capacity). Confirm-guard at the call site.
 */
export function useRemoveZoomHost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ hostId }: { hostId: string }) => {
      const res = await apiClient.delete<ApiResponse<any>>(`/api/v1/admin/zoom-hosts/${encodeURIComponent(hostId)}`);
      return (res.data as any)?.data ?? res.data;
    },
    onSuccess: () => {
      invalidatePoolViews(queryClient);
      popup.success("Host removed", "The Zoom host was removed from the pool.", 3000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to remove the Zoom host."),
  });
}
