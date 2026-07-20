"use client";
/**
 * ProxiesSection — proxy register & reporting on the Vote Records page (AGM #5).
 *
 * All client roles can view (VIEWER read-only); only CLIENT_ADMIN/ADMIN can
 * mark a proxy attended (`canMark`). Marking attended is independent of
 * offline vote totals — the toast reminds the admin of that.
 * ACCEPTED status exists in the API model but nothing sets it yet; the tab
 * renders only if the backend sends it with a non-zero count.
 */
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Search, Loader2, CheckCircle2 } from "lucide-react";
import { useEventProxies, useMarkProxyAttended, type ProxyStatus } from "@/api/client-proxies";

const STATUS_STYLE: Record<string, string> = {
  PENDING:  "bg-amber-100 text-amber-700",
  ACCEPTED: "bg-blue-100 text-blue-700",
  ATTENDED: "bg-green-100 text-green-700",
};

function fmtWhen(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ProxiesSection({ eventId, canMark }: { eventId: string; canMark: boolean }) {
  const [tab,         setTab]         = useState("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [search,      setSearch]      = useState("");
  const [page,        setPage]        = useState(0);
  const size = 20;

  // Debounce the search input so we don't refetch per keystroke
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(0); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isFetching } = useEventProxies(eventId, {
    search,
    status: tab === "ALL" ? "" : tab,
    page,
    size,
  });
  const markMutation = useMarkProxyAttended();

  const tabs = (data?.tabs?.length
    ? data.tabs
    : [{ key: "ALL", label: "All", count: data?.totalCount ?? 0 }]
  ).filter((t) => t.key !== "ACCEPTED" || t.count > 0); // hide unreachable status until backend uses it

  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / size)) : 1;

  return (
    <Card className="attend-card mt-6">
      <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2 flex-wrap">
        <Users className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        <h2 className="font-semibold text-[hsl(var(--foreground))]">Proxy Register</h2>
        {data && (
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {data.summary.total} total · {data.summary.pending} pending · {data.summary.attended} attended
          </span>
        )}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search proxy, grantor, email…"
            className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] w-56 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
          />
        </div>
      </div>

      {/* Status tabs */}
      <div className="px-5 pt-3 flex items-center gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setPage(0); }}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              tab === t.key
                ? "bg-[hsl(var(--primary))] text-white"
                : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {t.label} <span className="opacity-70">({t.count})</span>
          </button>
        ))}
        {isFetching && !isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[hsl(var(--muted-foreground))]" />}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center gap-2 p-5 text-sm text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading proxies…
        </div>
      ) : (data?.proxies ?? []).length === 0 ? (
        <p className="px-5 py-8 text-sm text-[hsl(var(--muted-foreground))] text-center italic">
          No proxies{search ? " match your search" : " assigned for this event yet"}.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
                <th className="px-5 py-2.5 font-semibold">Proxy</th>
                <th className="px-3 py-2.5 font-semibold">On behalf of</th>
                <th className="px-3 py-2.5 font-semibold text-right">Shares</th>
                <th className="px-3 py-2.5 font-semibold">Assigned</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                {canMark && <th className="px-5 py-2.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {(data?.proxies ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-[hsl(var(--foreground))]">{p.proxyName}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {[p.proxyEmail, p.proxyPhone].filter(Boolean).join(" · ")}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-[hsl(var(--foreground))]">{p.grantorName}</p>
                    {p.grantorEmail && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{p.grantorEmail}</p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-[hsl(var(--foreground))]">
                    {p.sharesRepresented != null ? p.sharesRepresented.toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-3 text-xs text-[hsl(var(--muted-foreground))]">{fmtWhen(p.assignedAt)}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[p.status] ?? "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"}`}>
                      {p.status === "ATTENDED" && <CheckCircle2 className="h-3 w-3" />}
                      {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                    </span>
                    {p.status === "ATTENDED" && p.attendedAt && (
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">{fmtWhen(p.attendedAt)}</p>
                    )}
                  </td>
                  {canMark && (
                    <td className="px-5 py-3 text-right">
                      {p.status !== "ATTENDED" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={markMutation.isPending}
                          onClick={() => markMutation.mutate({ eventId, proxyId: p.id })}
                        >
                          Mark Attended
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && data.totalCount > size && (
        <div className="px-5 py-3 border-t border-[hsl(var(--border))] flex items-center justify-between">
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            Page {page + 1} of {totalPages} · {data.totalCount} proxies
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
