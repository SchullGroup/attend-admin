"use client";

/**
 * client-walk-ins.ts — Walk-in check-in at the gate (2026-10-22)
 *
 * All under /api/v1/client/events/{eventId}. CLIENT_ADMIN / ADMIN / EVENT_MANAGER can do
 * everything; VIEWER can search, list and export only (writes return 403). Check-ins on a
 * VIRTUAL event are refused with 400.
 *
 *   GET    register/search?q=&page&size          → find a shareholder on the event's register
 *   POST   walk-ins/shareholders                 → check in a walk-in shareholder (409 ALREADY_CHECKED_IN)
 *   DELETE walk-ins/shareholders/{walkInId}      → undo
 *   GET    walk-ins/shareholders?page&size&search
 *   GET    walk-ins/shareholders/export          → .xlsx
 *   POST   walk-ins/guests                       → regulator / guest
 *   PUT    walk-ins/guests/{guestId}             → correct (replaces every field)
 *   DELETE walk-ins/guests/{guestId}             → undo
 *   GET    walk-ins/guests?page&size&search&category
 *   GET    walk-ins/guests/export                → .xlsx
 *
 * Verification happens at the gate (staff sight a photo ID). Attend stores no ID details.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

const base = (eventId: string) => `/api/v1/client/events/${eventId}`;

export type CheckInMethod = "QR_SCAN" | "SELF" | "WALK_IN" | "UNRECORDED" | null;

export interface RegisterSearchResult {
  shareholderId: string;
  fullName:      string;
  chn?:          string | null;
  units?:        number | null;
  checkedIn:     boolean;
  checkedInAt?:  string | null;
  method?:       CheckInMethod;
  /** Only when method is WALK_IN — lets the UI offer Undo. */
  walkInId?:     string | null;
}

export interface WalkInShareholder {
  id:               string;
  shareholderId:    string;
  fullName:         string;
  chn?:             string | null;
  units?:           number | null;
  registeredOnline: boolean;
  notes?:           string | null;
  checkedInAt:      string;
  checkedInById?:   string;
  checkedInByName?: string;
  checkedInByEmail?: string;
}

export type GuestCategory = "REGULATOR" | "AUDITOR" | "DIRECTOR" | "PRESS" | "OTHER";
export const GUEST_CATEGORIES: { value: GuestCategory; label: string }[] = [
  { value: "REGULATOR", label: "Regulator" },
  { value: "AUDITOR",   label: "Auditor" },
  { value: "DIRECTOR",  label: "Director" },
  { value: "PRESS",     label: "Press" },
  { value: "OTHER",     label: "Other" },
];

export interface WalkInGuestInput {
  fullName:     string;
  category:     GuestCategory;
  organisation: string;
  designation?: string;
  phone?:       string;
  email?:       string;
  notes?:       string;
}

export interface WalkInGuest extends WalkInGuestInput {
  id:               string;
  checkedInAt:      string;
  checkedInById?:   string;
  checkedInByName?: string;
  checkedInByEmail?: string;
}

export interface Paged<T> {
  content:       T[];
  page:          number;
  size:          number;
  totalElements: number;
  totalPages:    number;
  last?:         boolean;
}

function paged<T>(raw: any, page: number, size: number): Paged<T> {
  const d = raw?.data ?? raw;
  const content: T[] = d?.content ?? d?.items ?? (Array.isArray(d) ? d : []);
  return {
    content,
    page:          d?.page ?? page,
    size:          d?.size ?? size,
    totalElements: d?.totalElements ?? d?.totalCount ?? content.length,
    totalPages:    d?.totalPages ?? 1,
    last:          d?.last,
  };
}

export const walkInKeys = {
  all:          (eventId: string) => ["walk-ins", eventId] as const,
  search:       (eventId: string, q: string, page: number) => ["walk-ins", eventId, "search", q, page] as const,
  shareholders: (eventId: string, page: number, size: number, search: string) =>
    ["walk-ins", eventId, "shareholders", { page, size, search }] as const,
  guests:       (eventId: string, page: number, size: number, search: string, category: string) =>
    ["walk-ins", eventId, "guests", { page, size, search, category }] as const,
};

// ── Register search ────────────────────────────────────────────────────────

export function useRegisterSearch(eventId: string, q: string, page = 0, size = 20) {
  const term = q.trim();
  return useQuery({
    queryKey: walkInKeys.search(eventId, term, page),
    queryFn: async () => {
      const res = await apiClient.get(`${base(eventId)}/register/search`, { params: { q: term, page, size } });
      return paged<RegisterSearchResult>(res.data, page, size);
    },
    enabled: !!eventId && term.length >= 2,
    staleTime: 5_000,
    placeholderData: (prev) => prev,
  });
}

// ── Walk-in shareholders ───────────────────────────────────────────────────

export function useCheckInWalkInShareholder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, shareholderId, notes }: { eventId: string; shareholderId: string; notes?: string }) => {
      const res = await apiClient.post(`${base(eventId)}/walk-ins/shareholders`, {
        shareholderId,
        ...(notes?.trim() ? { notes: notes.trim() } : {}),
      });
      return { message: (res.data as any)?.message as string | undefined, data: ((res.data as any)?.data ?? res.data) as WalkInShareholder };
    },
    onSettled: (_d, _e, { eventId }) => qc.invalidateQueries({ queryKey: walkInKeys.all(eventId) }),
  });
}

export function useUndoWalkInShareholder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, walkInId }: { eventId: string; walkInId: string }) => {
      await apiClient.delete(`${base(eventId)}/walk-ins/shareholders/${walkInId}`);
    },
    onSettled: (_d, _e, { eventId }) => qc.invalidateQueries({ queryKey: walkInKeys.all(eventId) }),
  });
}

export function useWalkInShareholders(eventId: string, page = 0, size = 50, search = "", opts?: { enabled?: boolean }) {
  const s = search.trim().length >= 2 ? search.trim() : "";
  return useQuery({
    queryKey: walkInKeys.shareholders(eventId, page, size, s),
    queryFn: async () => {
      const res = await apiClient.get(`${base(eventId)}/walk-ins/shareholders`, {
        params: { page, size, ...(s ? { search: s } : {}) },
      });
      return paged<WalkInShareholder>(res.data, page, size);
    },
    enabled: !!eventId && (opts?.enabled ?? true),
    placeholderData: (prev) => prev,
  });
}

// ── Walk-in guests ─────────────────────────────────────────────────────────

function cleanGuest(body: WalkInGuestInput) {
  const opt = (v?: string) => (v && v.trim() ? v.trim() : undefined);
  return {
    fullName:     body.fullName.trim(),
    category:     body.category,
    organisation: body.organisation.trim(),
    designation:  opt(body.designation),
    phone:        opt(body.phone),
    email:        opt(body.email)?.toLowerCase(),
    notes:        opt(body.notes),
  };
}

export function useCreateWalkInGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, body }: { eventId: string; body: WalkInGuestInput }) => {
      const res = await apiClient.post(`${base(eventId)}/walk-ins/guests`, cleanGuest(body));
      return ((res.data as any)?.data ?? res.data) as WalkInGuest;
    },
    onSettled: (_d, _e, { eventId }) => qc.invalidateQueries({ queryKey: walkInKeys.all(eventId) }),
  });
}

/** PUT replaces every field — always send the whole form. */
export function useUpdateWalkInGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, guestId, body }: { eventId: string; guestId: string; body: WalkInGuestInput }) => {
      const res = await apiClient.put(`${base(eventId)}/walk-ins/guests/${guestId}`, cleanGuest(body));
      return ((res.data as any)?.data ?? res.data) as WalkInGuest;
    },
    onSettled: (_d, _e, { eventId }) => qc.invalidateQueries({ queryKey: walkInKeys.all(eventId) }),
  });
}

export function useDeleteWalkInGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, guestId }: { eventId: string; guestId: string }) => {
      await apiClient.delete(`${base(eventId)}/walk-ins/guests/${guestId}`);
    },
    onSettled: (_d, _e, { eventId }) => qc.invalidateQueries({ queryKey: walkInKeys.all(eventId) }),
  });
}

export function useWalkInGuests(
  eventId: string, page = 0, size = 50, search = "", category = "", opts?: { enabled?: boolean },
) {
  const s = search.trim().length >= 2 ? search.trim() : "";
  return useQuery({
    queryKey: walkInKeys.guests(eventId, page, size, s, category),
    queryFn: async () => {
      const res = await apiClient.get(`${base(eventId)}/walk-ins/guests`, {
        params: { page, size, ...(s ? { search: s } : {}), ...(category ? { category } : {}) },
      });
      return paged<WalkInGuest>(res.data, page, size);
    },
    enabled: !!eventId && (opts?.enabled ?? true),
    placeholderData: (prev) => prev,
  });
}

// ── Exports (.xlsx) ────────────────────────────────────────────────────────

export async function exportWalkIns(eventId: string, kind: "shareholders" | "guests") {
  try {
    const res = await apiClient.get<Blob>(`${base(eventId)}/walk-ins/${kind}/export`, { responseType: "blob" });
    const cd: string | undefined = res.headers["content-disposition"];
    const encoded = cd?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const plain   = cd?.match(/filename="?([^";]+)"?/i)?.[1];
    const filename = decodeURIComponent(encoded ?? plain ?? `walk-in-${kind}.xlsx`);
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err: any) {
    const data = err?.response?.data;
    if (data instanceof Blob) {
      let msg = "Export failed";
      try { const j = JSON.parse(await data.text()); msg = j?.message ?? j?.error ?? msg; } catch { /* not JSON */ }
      throw new Error(msg);
    }
    throw err;
  }
}

/** Pull `{ code, message, data }` out of an axios error. */
export function apiErrorOf(err: any): { status?: number; code?: string; message?: string; data?: any } {
  const r = err?.response;
  return { status: r?.status, code: r?.data?.code, message: r?.data?.message ?? r?.data?.error, data: r?.data?.data };
}
