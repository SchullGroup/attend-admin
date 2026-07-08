"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CheckCircle2, XCircle, Radio,
  Users, Share2, ChevronDown, ChevronUp, Timer,
  Download, PlusCircle, X, ToggleLeft, ToggleRight,
} from "lucide-react";
import {
  useVoteResults,
  useRecordOfflineVotes,
  useOpenResolutionVoting,
  useCloseResolutionVoting,
  useAddResolution,
  useExportResolutions,
  useSetShareWeightedTallies,
  ResolutionResult,
} from "@/api/client-votes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/Loader";
import { formatDate } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolutionStatusStyle(status: string) {
  const s = status?.toUpperCase();
  if (s === "OPEN")   return { bg: "#dcfce7", color: "#16a34a", dot: "#16a34a" };
  if (s === "CLOSED") return { bg: "#f3f4f6", color: "#6b7280", dot: "#6b7280" };
  if (s === "PASSED") return { bg: "#dbeafe", color: "#2563eb", dot: "#2563eb" };
  if (s === "FAILED") return { bg: "#fee2e2", color: "#dc2626", dot: "#dc2626" };
  return { bg: "#fef3c7", color: "#b45309", dot: "#b45309" };
}

function VoteBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
    </div>
  );
}

function StatCell({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div>
      <div className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">{label}</div>
      <div className="text-base font-bold tabular-nums text-[hsl(var(--foreground))]">{typeof value === "number" ? value.toLocaleString() : value}</div>
      {sub && <div className="text-[11px] text-[hsl(var(--muted-foreground))]">{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Offline vote entry form
// ---------------------------------------------------------------------------
function OfflineVoteForm({
  eventId, resolutionId, initial, onSaved,
}: {
  eventId: string;
  resolutionId: string;
  initial: ResolutionResult;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    forCount:      initial.offlineForCount      ?? 0,
    againstCount:  initial.offlineAgainstCount  ?? 0,
    abstainCount:  initial.offlineAbstainCount  ?? 0,
    forShares:     initial.offlineForShares     ?? 0,
    againstShares: initial.offlineAgainstShares ?? 0,
    abstainShares: initial.offlineAbstainShares ?? 0,
  });

  const { mutate, isPending } = useRecordOfflineVotes();

  function field(k: keyof typeof form, label: string) {
    return (
      <div>
        <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">{label}</label>
        <Input
          type="number"
          min={0}
          className="h-8 text-sm"
          value={form[k]}
          onChange={(e) => setForm((f) => ({ ...f, [k]: Number(e.target.value) }))}
        />
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-[hsl(var(--border))]">
      <p className="text-xs font-semibold text-[hsl(var(--foreground))] mb-3">In-room (offline) votes</p>
      <div className="grid grid-cols-3 gap-3 mb-3">
        {field("forCount",      "For (count)")}
        {field("againstCount",  "Against (count)")}
        {field("abstainCount",  "Abstain (count)")}
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {field("forShares",     "For (shares)")}
        {field("againstShares", "Against (shares)")}
        {field("abstainShares", "Abstain (shares)")}
      </div>
      <Button
        size="sm"
        disabled={isPending}
        onClick={() =>
          mutate(
            { eventId, resolutionId, data: form },
            { onSuccess: onSaved }
          )
        }
      >
        {isPending ? "Saving…" : "Save Offline Votes"}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resolution card
// ---------------------------------------------------------------------------
function ResolutionCard({
  res,
  eventId,
  isLive,
}: {
  res: ResolutionResult;
  eventId: string;
  isLive: boolean;
}) {
  const [expanded,     setExpanded]     = useState(false);
  const [showOffline,  setShowOffline]  = useState(false);
  const [duration,     setDuration]     = useState<string>("");

  const openMutation  = useOpenResolutionVoting();
  const closeMutation = useCloseResolutionVoting();

  const ss   = resolutionStatusStyle(res.status);
  const pct  = Math.round(res.percentageFor ?? 0);
  const isOpen = res.status?.toUpperCase() === "OPEN";

  const totalCombined = (res.combinedForCount ?? 0) + (res.combinedAgainstCount ?? 0) + (res.combinedAbstainCount ?? 0);

  return (
    <Card className="attend-card overflow-hidden">
      {/* Header row */}
      <div
        className="px-5 py-4 flex items-start gap-4 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Order badge */}
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold mt-0.5"
          style={{ backgroundColor: ss.bg, color: ss.color }}
        >
          {res.order}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">
              {res.title}
            </span>
            {res.specialResolution && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700">
                Special
              </span>
            )}
          </div>

          {/* Pass / fail */}
          <div className="flex items-center gap-3 mt-1.5">
            {res.passed ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> Passed
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-semibold text-red-500">
                <XCircle className="h-3.5 w-3.5" /> Failed
              </span>
            )}
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {pct}% for
            </span>
          </div>

          {/* Percentage bar */}
          <div className="mt-2 grid grid-cols-3 gap-1">
            <div className="col-span-3">
              <div className="h-2 w-full rounded-full bg-[hsl(var(--muted))] overflow-hidden flex">
                <div className="h-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
                <div
                  className="h-full bg-red-400 transition-all"
                  style={{
                    width: `${Math.round(
                      (res.combinedAgainstCount / Math.max(totalCombined, 1)) * 100
                    )}%`,
                  }}
                />
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                <span className="text-green-600 font-medium">For {res.combinedForCount}</span>
                <span className="text-yellow-600">Abstain {res.combinedAbstainCount}</span>
                <span className="text-red-500 font-medium">Against {res.combinedAgainstCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Status badge + expand */}
        <div className="flex items-center gap-3 shrink-0">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
            style={{ backgroundColor: ss.bg, color: ss.color }}
          >
            {isOpen && <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />}
            {res.status}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-[hsl(var(--muted-foreground))]" /> : <ChevronDown className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-[hsl(var(--border))]">
          {/* Online / Offline / Combined breakdown */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            {/* Online */}
            <div className="rounded-xl bg-[hsl(var(--muted)/0.4)] p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Radio className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                <span className="text-xs font-semibold text-[hsl(var(--foreground))]">Online</span>
              </div>
              <div className="flex flex-col gap-2">
                <StatCell label="For"     value={res.votesFor}     />
                <StatCell label="Against" value={res.votesAgainst} />
                <StatCell label="Abstain" value={res.abstentions}  />
              </div>
              <div className="mt-3 pt-3 border-t border-[hsl(var(--border))]">
                <div className="flex items-center gap-1.5 mb-2">
                  <Share2 className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                  <span className="text-[11px] text-[hsl(var(--muted-foreground))]">Shares</span>
                </div>
                <StatCell label="For"     value={res.sharesFor}      />
                <StatCell label="Against" value={res.sharesAgainst}  />
                <StatCell label="Abstain" value={res.sharesAbstain}  />
              </div>
            </div>

            {/* Offline */}
            <div className="rounded-xl bg-[hsl(var(--muted)/0.4)] p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Users className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-[hsl(var(--foreground))]">In-room</span>
              </div>
              <div className="flex flex-col gap-2">
                <StatCell label="For"     value={res.offlineForCount}     />
                <StatCell label="Against" value={res.offlineAgainstCount} />
                <StatCell label="Abstain" value={res.offlineAbstainCount} />
              </div>
              <div className="mt-3 pt-3 border-t border-[hsl(var(--border))]">
                <div className="flex items-center gap-1.5 mb-2">
                  <Share2 className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                  <span className="text-[11px] text-[hsl(var(--muted-foreground))]">Shares</span>
                </div>
                <StatCell label="For"     value={res.offlineForShares}     />
                <StatCell label="Against" value={res.offlineAgainstShares} />
                <StatCell label="Abstain" value={res.offlineAbstainShares} />
              </div>
            </div>

            {/* Combined */}
            <div className="rounded-xl bg-[hsl(var(--muted)/0.4)] p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs font-semibold text-[hsl(var(--foreground))]">Combined</span>
              </div>
              <div className="flex flex-col gap-2">
                <StatCell label="For"     value={res.combinedForCount}     />
                <StatCell label="Against" value={res.combinedAgainstCount} />
                <StatCell label="Abstain" value={res.combinedAbstainCount} />
              </div>
              <div className="mt-3 pt-3 border-t border-[hsl(var(--border))]">
                <div className="flex items-center gap-1.5 mb-2">
                  <Share2 className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                  <span className="text-[11px] text-[hsl(var(--muted-foreground))]">Shares</span>
                </div>
                <StatCell label="For"     value={res.combinedForShares}     />
                <StatCell label="Against" value={res.combinedAgainstShares} />
                <StatCell label="Abstain" value={res.combinedAbstainShares} />
              </div>
            </div>
          </div>

          {/* Open / Close controls (only for LIVE events) */}
          {isLive && (
            <div className="mt-4 pt-4 border-t border-[hsl(var(--border))] flex items-center gap-3 flex-wrap">
              {!isOpen ? (
                <>
                  <div className="flex items-center gap-2">
                    <Timer className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                    <Input
                      type="number"
                      min={0}
                      placeholder="Duration (secs, optional)"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="h-8 w-44 text-sm"
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={openMutation.isPending}
                    onClick={() =>
                      openMutation.mutate({
                        eventId,
                        resolutionId: res.id,
                        durationSeconds: duration ? Number(duration) : undefined,
                      })
                    }
                  >
                    Open Voting
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={closeMutation.isPending}
                  onClick={() => closeMutation.mutate({ eventId, resolutionId: res.id })}
                >
                  Close Voting
                </Button>
              )}
            </div>
          )}

          {/* Offline vote entry */}
          <button
            className="mt-4 text-xs text-[hsl(var(--primary))] underline underline-offset-2"
            onClick={() => setShowOffline((v) => !v)}
          >
            {showOffline ? "Hide" : "Enter in-room votes…"}
          </button>
          {showOffline && (
            <OfflineVoteForm
              eventId={eventId}
              resolutionId={res.id}
              initial={res}
              onSaved={() => setShowOffline(false)}
            />
          )}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Add Resolution inline form
// ---------------------------------------------------------------------------
function AddResolutionForm({ eventId, onDone }: { eventId: string; onDone: () => void }) {
  const [form, setForm] = useState({
    title:            "",
    description:      "",
    specialResolution: false,
    votingDeadline:   "",
  });
  const { mutate, isPending } = useAddResolution();

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <Card className="attend-card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Add Resolution</p>
        <button onClick={onDone} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">Title *</label>
          <Input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Resolution title"
            className="h-9 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Optional description or context"
            rows={2}
            className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">Voting Deadline</label>
            <Input
              type="datetime-local"
              value={form.votingDeadline}
              onChange={(e) => set("votingDeadline", e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="flex items-center gap-2 mt-5">
            <input
              id="special-resolution"
              type="checkbox"
              checked={form.specialResolution}
              onChange={(e) => set("specialResolution", e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <label htmlFor="special-resolution" className="text-sm text-[hsl(var(--foreground))]">
              Special Resolution
            </label>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            disabled={isPending || !form.title.trim()}
            onClick={() =>
              mutate(
                {
                  eventId,
                  data: {
                    title:            form.title.trim(),
                    description:      form.description.trim() || undefined,
                    specialResolution: form.specialResolution,
                    votingDeadline:   form.votingDeadline || undefined,
                  },
                },
                { onSuccess: onDone }
              )
            }
          >
            {isPending ? "Adding…" : "Add Resolution"}
          </Button>
          <Button size="sm" variant="outline" onClick={onDone}>Cancel</Button>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// CSV export helper
// ---------------------------------------------------------------------------
function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function VoteDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const router      = useRouter();
  const [showAddForm, setShowAddForm] = useState(false);
  const [exporting,   setExporting]   = useState(false);

  const { data, isLoading }         = useVoteResults(eventId);
  const { refetch: fetchExport }    = useExportResolutions(eventId);
  const shareWeightedTallies        = useSetShareWeightedTallies();

  async function handleExport() {
    setExporting(true);
    try {
      const result = await fetchExport();
      const exp    = result.data;
      if (!exp) return;
      const header = ["Order", "Title", "Special", "Status", "For (count)", "Against (count)", "Abstain (count)", "For (shares)", "Against (shares)", "Abstain (shares)", "Total Votes", "Result"];
      const rows   = exp.resolutions.map((r) => [
        String(r.order),
        r.title,
        r.specialResolution ? "Yes" : "No",
        r.status,
        String(r.forCount),
        String(r.againstCount),
        String(r.abstainCount),
        String(r.forShares),
        String(r.againstShares),
        String(r.abstainShares),
        String(r.totalVotes),
        r.result,
      ]);
      downloadCsv(`${exp.eventTitle ?? eventId}-resolutions.csv`, [header, ...rows]);
    } finally {
      setExporting(false);
    }
  }

  if (isLoading) return <Loader variant="page" text="Loading results…" />;
  if (!data)     return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <p className="text-[hsl(var(--muted-foreground))]">No vote data found for this event.</p>
      <Button variant="outline" onClick={() => router.back()}>Go back</Button>
    </div>
  );

  const isLive       = data.status?.toUpperCase() === "LIVE";
  const resolutions  = [...(data.resolutions ?? [])].sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col gap-6">
      {/* Back + header */}
      <div>
        <button
          onClick={() => router.push("/votes")}
          className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-3 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All Votes
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{data.title}</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              {data.stakeholderName} · {formatDate(data.date)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLive && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" /> LIVE
              </span>
            )}
            <Button
              size="sm" variant="outline" className="gap-1.5"
              disabled={shareWeightedTallies.isPending}
              onClick={() =>
                shareWeightedTallies.mutate({
                  eventId,
                  enabled: !data.shareWeightedTalliesEnabled,
                })
              }
            >
              {data.shareWeightedTalliesEnabled
                ? <ToggleRight className="h-4 w-4 text-green-600" />
                : <ToggleLeft className="h-4 w-4" />}
              Share-Weighted Tallies {data.shareWeightedTalliesEnabled ? "On" : "Off"}
            </Button>
            <Button size="sm" variant="outline" disabled={exporting} onClick={handleExport}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {exporting ? "Exporting…" : "Export CSV"}
            </Button>
          </div>
        </div>
      </div>

      {/* Event summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="attend-card p-5">
          <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Total Votes Cast</div>
          <div className="text-2xl font-bold tabular-nums">{(data.totalVotesCast ?? 0).toLocaleString()}</div>
        </Card>
        <Card className="attend-card p-5">
          <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Quorum</div>
          <div className="text-2xl font-bold tabular-nums">{Math.round(data.quorumPercentage ?? 0)}%</div>
          <div className={`text-xs font-semibold mt-1 ${data.quorumMet ? "text-green-600" : "text-red-500"}`}>
            {data.quorumMet ? "Quorum met" : "Quorum not met"}
          </div>
        </Card>
        <Card className="attend-card p-5">
          <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Register</div>
          <div className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">{data.registerName || "—"}</div>
          <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{data.status}</div>
        </Card>
      </div>

      {/* Resolutions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">
            Resolutions ({resolutions.length})
          </h2>
          {!showAddForm && (
            <Button size="sm" variant="outline" onClick={() => setShowAddForm(true)}>
              <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Add Resolution
            </Button>
          )}
        </div>

        {showAddForm && (
          <div className="mb-3">
            <AddResolutionForm eventId={eventId} onDone={() => setShowAddForm(false)} />
          </div>
        )}

        <div className="flex flex-col gap-3">
          {resolutions.length === 0 ? (
            <div className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No resolutions found for this event.
            </div>
          ) : (
            resolutions.map((r) => (
              <ResolutionCard key={r.id} res={r} eventId={eventId} isLive={isLive} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
