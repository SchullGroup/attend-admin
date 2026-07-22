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
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users, Search, Loader2, CheckCircle2, Copy, Check,
  Upload, X, FileText, AlertCircle,
} from "lucide-react";
import {
  useEventProxies, useMarkProxyAttended, useUploadProxyVotes,
  type ProxyStatus, type ProxyVoteInput,
} from "@/api/client-proxies";
import type { ResolutionResult } from "@/api/client-votes";
import Papa from "papaparse";

// ── Bulk proxy-vote CSV row ─────────────────────────────────────────────────

interface ProxyVoteCsvRow {
  email:   string;
  choice:  "FOR" | "AGAINST" | "ABSTAIN" | "";
  _error?: string;
}

function nk(k: string) { return k.toLowerCase().replace(/[\s_\-.]/g, ""); }

function mapProxyVoteCsvRow(raw: Record<string, string>): ProxyVoteCsvRow {
  const norm: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) norm[nk(k)] = (v ?? "").trim();

  const email = norm["email"] ?? norm["referreremail"] ?? norm["shareholderemail"] ?? "";
  const choiceRaw = (norm["choice"] ?? norm["vote"] ?? "").toUpperCase();
  const choice: ProxyVoteCsvRow["choice"] =
    choiceRaw === "FOR" || choiceRaw === "AGAINST" || choiceRaw === "ABSTAIN" ? choiceRaw : "";

  const missingEmail = !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return {
    email, choice,
    _error: missingEmail ? "Invalid email" : !choice ? "Choice must be For/Against/Abstain" : undefined,
  };
}

// ── Copyable code chip (proxyCode, F10) ─────────────────────────────────────

function CopyableCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 font-mono text-xs bg-[hsl(var(--muted))] hover:bg-[hsl(var(--muted)/0.7)] px-2 py-0.5 rounded-md transition-colors"
      title="Copy proxy code"
    >
      {code}
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />}
    </button>
  );
}

const STATUS_STYLE: Record<string, string> = {
  PENDING:  "bg-amber-100 text-amber-700",
  ACCEPTED: "bg-blue-100 text-blue-700",
  ATTENDED: "bg-green-100 text-green-700",
};

function fmtWhen(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ProxiesSection({
  eventId, canMark, resolutions = [],
}: {
  eventId: string;
  canMark: boolean;
  /** Event's resolutions (from useVoteResults) — powers the bulk proxy-vote upload's resolution/candidate picker. */
  resolutions?: ResolutionResult[];
}) {
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
  const uploadVotes   = useUploadProxyVotes();

  // ── Bulk in-person proxy vote upload (F10) ─────────────────────────────────
  const [showUpload,      setShowUpload]      = useState(false);
  const [resolutionId,    setResolutionId]    = useState("");
  const [candidateId,     setCandidateId]     = useState("");
  const [csvRows,         setCsvRows]         = useState<ProxyVoteCsvRow[]>([]);
  const [csvFileName,     setCsvFileName]     = useState("");
  const [showCsvPreview,  setShowCsvPreview]  = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);

  const selectedResolution = resolutions.find((r) => r.id === resolutionId);
  const isCandidateRes     = selectedResolution?.resolutionType === "CANDIDATE";
  const candidates          = selectedResolution?.candidates ?? [];

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (result) => {
        setCsvRows(result.data.map(mapProxyVoteCsvRow));
        setShowCsvPreview(true);
      },
    });
    e.target.value = "";
  }

  function resetUpload() {
    setCsvRows([]);
    setCsvFileName("");
    setShowCsvPreview(false);
    setResolutionId("");
    setCandidateId("");
  }

  function handleCsvImport() {
    if (!resolutionId || (isCandidateRes && !candidateId)) return;
    const valid = csvRows.filter((r) => !r._error);
    if (!valid.length) return;
    const proxyVotes: ProxyVoteInput[] = valid.map((r) => ({
      referrerEmail: r.email.toLowerCase(),
      resolutionId,
      candidateId: isCandidateRes ? candidateId : undefined,
      choice: r.choice as "FOR" | "AGAINST" | "ABSTAIN",
    }));
    uploadVotes.mutate(
      { eventId, proxyVotes },
      { onSuccess: () => { resetUpload(); setShowUpload(false); } }
    );
  }

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
        {canMark && resolutions.length > 0 && (
          <Button
            size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
            onClick={() => setShowUpload((v) => !v)}
          >
            {showUpload ? <X className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
            {showUpload ? "Cancel" : "Bulk Upload Proxy Votes"}
          </Button>
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

      {/* ── Bulk proxy-vote upload panel ── */}
      {canMark && showUpload && (
        <div className="px-5 py-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] flex flex-col gap-3">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Record in-person (paper ballot) votes cast by proxy holders for one resolution at a time.
            Each row is attributed to the <span className="font-semibold">grantor's</span> email — the
            shareholder who assigned the proxy, not the proxy holder.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">Resolution</label>
              <select
                value={resolutionId}
                onChange={(e) => { setResolutionId(e.target.value); setCandidateId(""); }}
                className="w-full h-9 text-sm rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              >
                <option value="">Select a resolution…</option>
                {resolutions.map((r) => (
                  <option key={r.id} value={r.id}>{r.order ? `${r.order}. ` : ""}{r.title}</option>
                ))}
              </select>
            </div>
            {isCandidateRes && (
              <div>
                <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">Candidate</label>
                <select
                  value={candidateId}
                  onChange={(e) => setCandidateId(e.target.value)}
                  className="w-full h-9 text-sm rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                >
                  <option value="">Select a candidate…</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm" variant="outline" className="gap-1.5"
              disabled={!resolutionId || (isCandidateRes && !candidateId)}
              onClick={() => csvRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" /> Upload CSV
            </Button>
            <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFile} />
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              Columns: Email, Choice (For/Against/Abstain)
            </span>
          </div>

          {showCsvPreview && csvRows.length > 0 && (
            <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden bg-[hsl(var(--background))]">
              <div className="px-4 py-3 border-b border-[hsl(var(--border))] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[hsl(var(--primary))]" />
                  <div>
                    <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{csvFileName}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {csvRows.filter((r) => !r._error).length} valid · {csvRows.filter((r) => r._error).length} with errors
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-[hsl(var(--muted-foreground))]" onClick={resetUpload}>
                    <X className="h-3.5 w-3.5 mr-1" /> Discard
                  </Button>
                  <Button
                    size="sm" className="h-7 gap-1.5 text-xs"
                    disabled={uploadVotes.isPending || csvRows.filter((r) => !r._error).length === 0}
                    onClick={handleCsvImport}
                  >
                    {uploadVotes.isPending
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Recording…</>
                      : <><Check className="h-3.5 w-3.5" /> Record {csvRows.filter((r) => !r._error).length} votes</>
                    }
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto max-h-56 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="attend-table-header">
                      <th className="px-4 py-2 text-left">#</th>
                      <th className="px-4 py-2 text-left">Email</th>
                      <th className="px-4 py-2 text-left">Choice</th>
                      <th className="px-4 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.map((row, i) => (
                      <tr key={i} className={row._error ? "bg-red-50" : undefined}>
                        <td className="px-4 py-2 text-[hsl(var(--muted-foreground))] tabular-nums">{i + 1}</td>
                        <td className="px-4 py-2 text-[hsl(var(--foreground))]">{row.email || "—"}</td>
                        <td className="px-4 py-2 text-[hsl(var(--foreground))]">{row.choice || "—"}</td>
                        <td className="px-4 py-2">
                          {row._error
                            ? <span className="flex items-center gap-1 text-xs text-red-600 font-semibold"><AlertCircle className="h-3.5 w-3.5" />{row._error}</span>
                            : <span className="flex items-center gap-1 text-xs text-green-600 font-semibold"><Check className="h-3.5 w-3.5" />Ready</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

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
                <th className="px-3 py-2.5 font-semibold">Proxy Code</th>
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
                    {p.proxyCode
                      ? <CopyableCode code={p.proxyCode} />
                      : <span className="text-xs text-[hsl(var(--muted-foreground))] italic">—</span>
                    }
                  </td>
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
