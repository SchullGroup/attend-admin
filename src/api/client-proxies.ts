"use client";

/**
 * client-proxies.ts — Proxy dashboard & reporting (AGM milestone #5)
 *
 *   GET   /api/v1/client/votes/{eventId}/proxies?search=&status=&page=&size=
 *         Roles: CLIENT_ADMIN / ADMIN / EVENT_MANAGER / VIEWER (read-only)
 *   PATCH /api/v1/client/votes/{eventId}/proxies/{proxyId}/attended
 *         Roles: CLIENT_ADMIN / ADMIN only
 *
 * Paper proxy forms (2026-11-20) — entered by staff for shareholders with no
 * Attend account. CLIENT_ADMIN / ADMIN / EVENT_MANAGER write; VIEWER reads.
 *   POST   …/proxies                      enter a form (409 PROXY_EXISTS)
 *   PUT    …/proxies/{proxyId}            correct a form (replaces every field)
 *   DELETE …/proxies/{proxyId}            remove a form
 *   GET    …/proxies/export               proxy register .xlsx
 * A form counts in the main quorum straight away, and as checked in once the
 * event is LIVE. A form supersedes an app proxy for the same holding.
 *
 * Notes from the backend handoff:
 * - status is only ever PENDING or ATTENDED in practice today; ACCEPTED is
 *   modeled for a future confirmation flow — don't build UI that assumes
 *   it's reachable.
 * - Marking attended does NOT adjust offline vote totals — that stays a
 *   separate manual admin action on the resolution cards.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import { ApiResponse } from "@/types/api";

export type ProxyStatus = "PENDING" | "ACCEPTED" | "ATTENDED" | "SUPERSEDED";
export type ProxySource = "APP" | "FORM";
export type ProxyType   = "CHAIRMAN" | "NAMED";

export interface EventProxy {
  id:                string;
  grantorName:       string;
  grantorEmail?:     string;
  proxyName:         string;
  proxyEmail?:       string;
  proxyPhone?:       string;
  status:            ProxyStatus;
  sharesRepresented?: number;
  assignedAt?:       string;
  attendedAt?:       string | null;
  /**
   * Virtual proxy code (AGM handoff #10) — a random 10-digit code the proxy
   * holder enters as a guest to self-service cast this vote. Backend confirmed
   * this on the *create*-proxy-assignment response; not confirmed on this list
   * endpoint yet, so it's optional here and only rendered when actually present.
   */
  proxyCode?:        string;
  // ── paper proxy forms (2026-11-20) ──
  source:            ProxySource;
  proxyType?:        ProxyType;
  shareholderId?:    string;
  chn?:              string | null;
  units?:            number | null;
  formReference?:    string | null;
  notes?:            string | null;
  enteredBy?:        string | null;
  enteredAt?:        string | null;
  editedBy?:         string | null;
  editedAt?:         string | null;
  supersededAt?:     string | null;
  /** How quorum counts the holding (2026-11-23). REGISTERED / WALK_IN = the holder covers it; the form is on file but adds nothing. */
  countedVia?:       "REGISTERED" | "WALK_IN" | "PROXY" | null;
  /** Resolutions the holder voted on themselves — the proxy can't vote those. */
  holderVotedResolutions?: number | null;
}

export interface ProxyTab {
  key:   string;
  label: string;
  count: number;
}

export interface ProxyListResponse {
  eventId:    string;
  eventTitle: string;
  summary:    { total: number; pending: number; accepted: number; attended: number; superseded?: number; forms?: number };
  tabs:       ProxyTab[];
  totalCount: number;
  page:       number;
  size:       number;
  proxies:    EventProxy[];
}

function normalize(raw: any): ProxyListResponse {
  const proxies: EventProxy[] = (raw?.proxies ?? raw?.content ?? raw?.items ?? []).map((p: any) => ({
    id:                String(p?.id ?? ""),
    grantorName:       p?.grantorName ?? "",
    grantorEmail:      p?.grantorEmail ?? undefined,
    proxyName:         p?.proxyName ?? "",
    proxyEmail:        p?.proxyEmail ?? undefined,
    proxyPhone:        p?.proxyPhone ?? undefined,
    status:            (String(p?.status ?? "PENDING").toUpperCase() as ProxyStatus),
    sharesRepresented: p?.sharesRepresented ?? undefined,
    assignedAt:        p?.assignedAt ?? undefined,
    attendedAt:        p?.attendedAt ?? null,
    proxyCode:         p?.proxyCode ?? undefined,
    source:            (String(p?.source ?? "APP").toUpperCase() as ProxySource),
    proxyType:         p?.proxyType ?? undefined,
    shareholderId:     p?.shareholderId ?? undefined,
    chn:               p?.chn ?? null,
    units:             p?.units ?? null,
    formReference:     p?.formReference ?? null,
    notes:             p?.notes ?? null,
    enteredBy:         p?.enteredBy ?? null,
    enteredAt:         p?.enteredAt ?? null,
    editedBy:          p?.editedBy ?? null,
    editedAt:          p?.editedAt ?? null,
    supersededAt:      p?.supersededAt ?? null,
    countedVia:        p?.countedVia ?? null,
    holderVotedResolutions: p?.holderVotedResolutions ?? null,
  }));
  return {
    eventId:    raw?.eventId ?? "",
    eventTitle: raw?.eventTitle ?? "",
    summary:    raw?.summary ?? { total: proxies.length, pending: 0, accepted: 0, attended: 0 },
    tabs:       raw?.tabs ?? [],
    totalCount: raw?.totalCount ?? raw?.totalElements ?? proxies.length,
    page:       raw?.page ?? 0,
    size:       raw?.size ?? proxies.length,
    proxies,
  };
}

export const proxyKeys = {
  list: (eventId: string, search: string, status: string, page: number, size: number, source = "") =>
    ["proxies", "list", eventId, { search, status, page, size, source }] as const,
};

export function useEventProxies(
  eventId: string | null | undefined,
  { search = "", status = "", page = 0, size = 20, source = "", enabled = true }:
    { search?: string; status?: string; page?: number; size?: number; source?: string; enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: proxyKeys.list(eventId ?? "", search, status, page, size, source),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status && status !== "ALL") params.set("status", status);
      if (source) params.set("source", source);
      params.set("page", String(page));
      params.set("size", String(size));
      const res = await apiClient.get<ApiResponse<any>>(
        `/api/v1/client/votes/${eventId}/proxies?${params.toString()}`
      );
      return normalize(res.data.data);
    },
    enabled: !!eventId && enabled,
    staleTime: 10_000,
    placeholderData: (prev) => prev, // keep the table stable while refetching
  });
}

export function useMarkProxyAttended() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, proxyId }: { eventId: string; proxyId: string }) => {
      const res = await apiClient.patch<ApiResponse<any>>(
        `/api/v1/client/votes/${eventId}/proxies/${proxyId}/attended`, {}
      );
      return res.data.data;
    },
    onSuccess: () => {
      // Invalidate every cached page/filter combination for proxies
      queryClient.invalidateQueries({ queryKey: ["proxies", "list"] });
      popup.success(
        "Proxy Marked Attended",
        "Note: this does not adjust offline vote totals — record those on the resolution if needed.",
        3500
      );
    },
    onError: (e) => parseAndToastApiError(e, "Failed to mark proxy as attended."),
  });
}

/**
 * DELETE /api/v1/client/votes/{eventId}/proxies/{proxyId}/attended (2026-11-11)
 * Undo "Mark Attended" — back to PENDING, attendedAt cleared, their shares leave
 * quorum straight away. Votes already cast are not touched. Safe to repeat.
 */
export function useUnmarkProxyAttended() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, proxyId }: { eventId: string; proxyId: string }) => {
      const res = await apiClient.delete<ApiResponse<any>>(
        `/api/v1/client/votes/${eventId}/proxies/${proxyId}/attended`
      );
      return res.data.data;
    },
    onSuccess: (_d, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["proxies", "list"] });
      queryClient.invalidateQueries({ queryKey: ["live", "detail", eventId] });
      popup.success("Attendance Undone", "The proxy is no longer marked as attended. Their shares no longer count toward quorum.", 3000);
    },
    onError: (e) => parseAndToastApiError(e, "Failed to undo the proxy's attendance."),
  });
}

// ---------------------------------------------------------------------------
// Bulk in-person proxy vote upload (AGM handoff #10)
//
//   POST /api/v1/client/votes/{eventId}/proxy-votes   (CLIENT_ADMIN / ADMIN)
//
// Each row upserts a Vote attributed to the *grantor* (the shareholder who
// assigned a proxy — referrerEmail), flows through the same tallying as a
// self-cast vote, and marks that grantor's ProxyAssignment ATTENDED. Once
// recorded, the grantor's own later vote attempt on that resolution/candidate
// is rejected (409) — proxy precedence.
// ---------------------------------------------------------------------------

export interface ProxyVoteInput {
  /** The grantor's (shareholder's) email — not the proxy holder's. */
  referrerEmail: string;
  resolutionId:  string;
  /** Only for CANDIDATE-type resolutions (F8) — omit for STANDARD. */
  candidateId?:  string;
  choice:        "FOR" | "AGAINST" | "ABSTAIN";
}

export interface ProxyVoteUploadResult {
  recorded:          number;
  skipped:           number;
  referrersNotified: number;
  errors:            string[];
}

export function useUploadProxyVotes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      eventId,
      proxyVotes,
    }: {
      eventId:    string;
      proxyVotes: ProxyVoteInput[];
    }) => {
      const res = await apiClient.post<ApiResponse<ProxyVoteUploadResult>>(
        `/api/v1/client/votes/${eventId}/proxy-votes`,
        { proxyVotes }
      );
      return res.data.data;
    },
    onSuccess: (data, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["proxies", "list"] });
      queryClient.invalidateQueries({ queryKey: ["clientVotes", "results", eventId] });
      const recorded = data?.recorded ?? 0;
      const skipped  = data?.skipped ?? 0;
      // Rows for a holding that already has a counted vote are skipped, not
      // overwritten (2026-11-23) — say why, so staff don't re-upload them.
      const reasons  = (data?.errors ?? []).slice(0, 3).join(" ");
      const more     = (data?.errors?.length ?? 0) > 3 ? ` …and ${(data!.errors.length - 3)} more.` : "";
      popup.success(
        "Proxy Votes Recorded",
        `${recorded} vote${recorded === 1 ? "" : "s"} recorded${skipped ? ` · ${skipped} skipped` : ""}.` +
          (skipped && reasons ? ` ${reasons}${more}` : ""),
        skipped ? 8000 : 3500
      );
    },
    onError: (e) => parseAndToastApiError(e, "Failed to upload proxy votes."),
  });
}

// ---------------------------------------------------------------------------
// Paper proxy forms (2026-11-20)
// ---------------------------------------------------------------------------

export interface ProxyFormInput {
  shareholderId:  string;
  proxyType:      ProxyType;
  proxy?:         { fullName: string; email?: string; phone?: string };
  formReference?: string;
  notes?:         string;
}

export interface ProxyFormSaved {
  message?:   string;
  proxy:      EventProxy;
  superseded: { proxyId: string; proxyName: string; source: "APP" } | null;
}

function cleanForm(body: ProxyFormInput) {
  const opt = (v?: string) => (v && v.trim() ? v.trim() : undefined);
  return {
    shareholderId: body.shareholderId,
    proxyType:     body.proxyType,
    proxy: body.proxyType === "NAMED" && body.proxy
      ? { fullName: body.proxy.fullName.trim(), email: opt(body.proxy.email)?.toLowerCase(), phone: opt(body.proxy.phone) }
      : undefined,
    formReference: opt(body.formReference),
    notes:         opt(body.notes),
  };
}

/** Create (no proxyId) or correct (with proxyId) a paper proxy form. Errors are left to the caller (409 PROXY_EXISTS carries data.proxy). */
export function useSaveProxyForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, proxyId, body }: { eventId: string; proxyId?: string; body: ProxyFormInput }): Promise<ProxyFormSaved> => {
      const url = `/api/v1/client/votes/${eventId}/proxies${proxyId ? `/${proxyId}` : ""}`;
      const res = proxyId
        ? await apiClient.put<ApiResponse<any>>(url, cleanForm(body))
        : await apiClient.post<ApiResponse<any>>(url, cleanForm(body));
      const d = (res.data as any)?.data ?? {};
      return {
        message:    (res.data as any)?.message,
        proxy:      normalize({ proxies: [d.proxy ?? d] }).proxies[0],
        superseded: d.superseded ?? null,
      };
    },
    onSettled: (_d, _e, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["proxies", "list"] });
      queryClient.invalidateQueries({ queryKey: ["live", "detail", eventId] });
    },
  });
}

export function useDeleteProxyForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, proxyId }: { eventId: string; proxyId: string }) => {
      await apiClient.delete(`/api/v1/client/votes/${eventId}/proxies/${proxyId}`);
    },
    onSuccess: (_d, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["proxies", "list"] });
      queryClient.invalidateQueries({ queryKey: ["live", "detail", eventId] });
      popup.success("Proxy Form Removed", "Its shares no longer count toward quorum through this form.", 2500);
    },
    onError: (e) => parseAndToastApiError(e, "Failed to remove the proxy form."),
  });
}

export async function exportProxyRegister(eventId: string) {
  try {
    const res = await apiClient.get<Blob>(`/api/v1/client/votes/${eventId}/proxies/export`, { responseType: "blob" });
    const cd: string | undefined = (res.headers as any)["content-disposition"];
    const encoded = cd?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const plain   = cd?.match(/filename="?([^";]+)"?/i)?.[1];
    const filename = decodeURIComponent(encoded ?? plain ?? `proxy-register-${eventId}.xlsx`);
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    parseAndToastApiError(e, "Couldn't export the proxy register.");
  }
}
