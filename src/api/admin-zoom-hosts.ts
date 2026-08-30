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

/** One licensed Zoom host account in the shared pool. */
export interface ZoomHostRow {
  /** Stable id if the backend provides one; falls back to the email (which is the natural key). */
  id:          string;
  email:       string;
  /** Per-host concurrent-meeting capacity. Defaults to 2 (§7d). */
  capacity:    number;
  /** Slots this host is currently using (0 when the backend doesn't report it). */
  activeCount: number;
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
  /** Sum of per-host capacity — the real pool ceiling. null when the pool is empty. */
  totalCapacity: number | null;
  /** Sum of per-host active meetings, when reported. null when unknown. */
  totalActive:   number | null;
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
  return {
    id:          String(id || email),
    email:       String(email || id),
    // Per §7d capacity defaults to 2 when the backend omits it.
    capacity:    numOrNull(r.capacity ?? r.maxConcurrent ?? r.max_concurrent ?? r.slots ?? r.maxSlots) ?? 2,
    // NB: avoid the bare `active` key here — it's ambiguous with an enabled flag.
    activeCount: numOrNull(
      r.activeCount ?? r.active_count ?? r.activeMeetings ?? r.inUse ?? r.in_use ?? r.used ?? r.usedSlots ?? r.slotsInUse,
    ) ?? 0,
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

  const totalCapacity = hosts.length ? hosts.reduce((sum, h) => sum + h.capacity, 0) : null;
  // Only surface a total-active if the backend actually reported per-host usage.
  const reportedActive = hosts.some(
    (h) => numOrNull(h.raw?.activeCount ?? h.raw?.active_count ?? h.raw?.activeMeetings ?? h.raw?.inUse ?? h.raw?.used) != null,
  );
  const totalActive = reportedActive ? hosts.reduce((sum, h) => sum + h.activeCount, 0) : null;

  return { available: true, hosts, totalCapacity, totalActive, raw: p };
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
          return { available: false, hosts: [], totalCapacity: null, totalActive: null, raw: null };
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
    mutationFn: async ({ email, capacity }: { email: string; capacity?: number }) => {
      const body: Record<string, unknown> = { email: email.trim() };
      if (capacity != null) body.capacity = capacity;
      const res = await apiClient.post<ApiResponse<any>>(`/api/v1/admin/zoom-hosts`, body);
      return (res.data as any)?.data ?? res.data;
    },
    onSuccess: () => {
      invalidatePoolViews(queryClient);
      popup.success("Host added", "The licensed Zoom host was added to the pool — capacity is available now.", 3000);
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
