"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CheckCircle2, XCircle, Radio,
  Users, Share2, ChevronDown, ChevronUp, Timer,
  Download, PlusCircle, X, ToggleLeft, ToggleRight, Pencil, Check, Lock,
} from "lucide-react";
import {
  useVoteResults,
  useRecordOfflineVotes,
  useOpenResolutionVoting,
  useCloseResolutionVoting,
  useAddResolution,
  useExportResolutions,
  useSetResolutionShareWeightedTallies,
  useSetQuorum,
  ResolutionResult,
} from "@/api/client-votes";
import type { ResolutionType, CandidateInput, CandidateResult } from "@/api/client-votes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/Loader";
import { formatDate, resolveRole } from "@/lib/utils";
import { useGetMe } from "@/api/auth/hooks";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line import/order
import { ProxiesSection } from "./ProxiesSection";

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
/** Shared shape between a resolution's own offline tallies and one candidate's. */
interface OfflineVoteInitial {
  offlineForCount?:      number;
  offlineAgainstCount?:  number;
  offlineAbstainCount?:  number;
  offlineForShares?:     number;
  offlineAgainstShares?: number;
  offlineAbstainShares?: number;
}

function OfflineVoteForm({
  eventId, resolutionId, initial, candidateId, onSaved,
}: {
  eventId: string;
  resolutionId: string;
  initial: OfflineVoteInitial;
  /** Present only when this form is scoped to one nominee on a CANDIDATE resolution. */
  candidateId?: string;
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
            { eventId, resolutionId, data: candidateId ? { ...form, candidateId } : form },
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
// Candidate block — one nominee's breakdown inside a CANDIDATE resolution card
// ---------------------------------------------------------------------------
function CandidateBlock({
  c, eventId, resolutionId, readOnly,
}: {
  c: CandidateResult;
  eventId: string;
  resolutionId: string;
  readOnly: boolean;
}) {
  const [showOffline, setShowOffline] = useState(false);
  const cTotal = (c.combinedForCount ?? 0) + (c.combinedAgainstCount ?? 0) + (c.combinedAbstainCount ?? 0);
  const cPct   = cTotal > 0 ? Math.round(((c.combinedForCount ?? 0) / cTotal) * 100) : 0;

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">
            {c.name}
            {typeof c.rank === "number" && (
              <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]">
                #{c.rank}
              </span>
            )}
          </p>
          {c.bio && <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{c.bio}</p>}
        </div>
        {c.passed ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-green-600 shrink-0">
            <CheckCircle2 className="h-3.5 w-3.5" /> Passed
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-semibold text-red-500 shrink-0">
            <XCircle className="h-3.5 w-3.5" /> Failed
          </span>
        )}
      </div>

      <VoteBar pct={cPct} color="#16a34a" />
      <div className="flex justify-between mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
        <span className="text-green-600 font-medium">For {c.combinedForCount}</span>
        <span className="text-yellow-600">Abstain {c.combinedAbstainCount}</span>
        <span className="text-red-500 font-medium">Against {c.combinedAgainstCount}</span>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-3">
        <div className="rounded-lg bg-[hsl(var(--muted)/0.4)] p-3">
          <div className="text-[11px] font-semibold text-[hsl(var(--foreground))] mb-1.5">Online</div>
          <div className="flex flex-col gap-1.5">
            <StatCell label="For"     value={c.votesFor} />
            <StatCell label="Against" value={c.votesAgainst} />
            <StatCell label="Abstain" value={c.abstentions} />
          </div>
        </div>
        <div className="rounded-lg bg-[hsl(var(--muted)/0.4)] p-3">
          <div className="text-[11px] font-semibold text-[hsl(var(--foreground))] mb-1.5">In-room</div>
          <div className="flex flex-col gap-1.5">
            <StatCell label="For"     value={c.offlineForCount} />
            <StatCell label="Against" value={c.offlineAgainstCount} />
            <StatCell label="Abstain" value={c.offlineAbstainCount} />
          </div>
        </div>
        <div className="rounded-lg bg-[hsl(var(--muted)/0.4)] p-3">
          <div className="text-[11px] font-semibold text-[hsl(var(--foreground))] mb-1.5">Combined</div>
          <div className="flex flex-col gap-1.5">
            <StatCell label="For"     value={c.combinedForCount} />
            <StatCell label="Against" value={c.combinedAgainstCount} />
            <StatCell label="Abstain" value={c.combinedAbstainCount} />
          </div>
        </div>
      </div>

      {!readOnly && (
        <button
          className="mt-3 text-xs text-[hsl(var(--primary))] underline underline-offset-2"
          onClick={() => setShowOffline((v) => !v)}
        >
          {showOffline ? "Hide" : "Enter in-room votes…"}
        </button>
      )}
      {!readOnly && showOffline && (
        <OfflineVoteForm
          eventId={eventId}
          resolutionId={resolutionId}
          candidateId={c.id}
          initial={c}
          onSaved={() => setShowOffline(false)}
        />
      )}
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
  readOnly = false,
}: {
  res: ResolutionResult;
  eventId: string;
  isLive: boolean;
  readOnly?: boolean;
}) {
  const [expanded,     setExpanded]     = useState(false);
  const [showOffline,  setShowOffline]  = useState(false);
  const [duration,     setDuration]     = useState<string>("");

  const openMutation           = useOpenResolutionVoting();
  const closeMutation          = useCloseResolutionVoting();
  const shareWeightedTallies   = useSetResolutionShareWeightedTallies();

  const ss   = resolutionStatusStyle(res.status);
  const pct  = Math.round(res.percentageFor ?? 0);
  const isOpen = res.status?.toUpperCase() === "OPEN";

  const totalCombined = (res.combinedForCount ?? 0) + (res.combinedAgainstCount ?? 0) + (res.combinedAbstainCount ?? 0);

  // Candidate Poll (F8) — a slate of nominees voted for/against/abstain independently,
  // sharing one open/close lifecycle and quorum context. See `candidates` below.
  const isCandidatePoll = res.resolutionType === "CANDIDATE";
  const candidates      = res.candidates ?? [];
  const leadingCandidate = candidates.length > 0
    ? [...candidates].sort((a, b) => (b.combinedForCount ?? 0) - (a.combinedForCount ?? 0))[0]
    : null;

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
            {isCandidatePoll && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]">
                Candidate Poll · {candidates.length} nominee{candidates.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {isCandidatePoll ? (
            /* Candidate Poll summary — per-nominee breakdown lives in the expanded section below */
            <div className="flex items-center gap-3 mt-1.5">
              {leadingCandidate && (
                <span className="text-xs font-semibold text-[hsl(var(--foreground))]">
                  Leading: {leadingCandidate.name}
                </span>
              )}
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                {totalCombined.toLocaleString()} total votes cast
              </span>
            </div>
          ) : (
            <>
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
            </>
          )}
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
          {isCandidatePoll ? (
            /* Candidate Poll — one breakdown block per nominee, voted independently */
            <div className="flex flex-col gap-3 mt-4">
              {candidates.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))] py-4 text-center">No candidates on this slate.</p>
              ) : (
                [...candidates]
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((c) => (
                    <CandidateBlock key={c.id} c={c} eventId={eventId} resolutionId={res.id} readOnly={readOnly} />
                  ))
              )}
            </div>
          ) : (
          /* Online / Offline / Combined breakdown */
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
          )}

          {/* Per-resolution share-weighted tallies toggle — default OFF, locked while OPEN */}
          <div className="mt-4 pt-4 border-t border-[hsl(var(--border))] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Share2 className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              <div>
                <p className="text-xs font-semibold text-[hsl(var(--foreground))]">Share-Weighted Tallies</p>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                  {isOpen ? "Locked while voting is open" : "Show share totals alongside headcount for this resolution"}
                </p>
              </div>
            </div>
            {readOnly ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                {res.shareWeightedTalliesEnabled
                  ? <ToggleRight className="h-4 w-4 text-green-600" />
                  : <ToggleLeft className="h-4 w-4" />}
                {res.shareWeightedTalliesEnabled ? "On" : "Off"}
              </span>
            ) : (
              <Button
                size="sm" variant="outline" className="gap-1.5 h-8"
                disabled={isOpen || shareWeightedTallies.isPending}
                onClick={() =>
                  shareWeightedTallies.mutate({
                    eventId,
                    resolutionId: res.id,
                    enabled: !res.shareWeightedTalliesEnabled,
                  })
                }
              >
                {isOpen
                  ? <Lock className="h-3.5 w-3.5" />
                  : res.shareWeightedTalliesEnabled
                    ? <ToggleRight className="h-4 w-4 text-green-600" />
                    : <ToggleLeft className="h-4 w-4" />}
                {res.shareWeightedTalliesEnabled ? "On" : "Off"}
              </Button>
            )}
          </div>

          {/* Open / Close controls (only for LIVE events) — hidden for Viewer (read-only) */}
          {isLive && !readOnly && (
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

          {/* Offline vote entry — single-subject resolutions only; a Candidate Poll's
              in-room votes are entered per-nominee inside each CandidateBlock above.
              Hidden for Viewer (read-only). */}
          {!isCandidatePoll && !readOnly && (
            <button
              className="mt-4 text-xs text-[hsl(var(--primary))] underline underline-offset-2"
              onClick={() => setShowOffline((v) => !v)}
            >
              {showOffline ? "Hide" : "Enter in-room votes…"}
            </button>
          )}
          {!isCandidatePoll && !readOnly && showOffline && (
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
let _candUid = 0;
const candUid = () => `cand_${++_candUid}`;

interface NewCandidateRow {
  id:   string; // local key, not a server id
  name: string;
  bio:  string;
}

function AddResolutionForm({ eventId, onDone }: { eventId: string; onDone: () => void }) {
  const [form, setForm] = useState({
    title:            "",
    description:      "",
    specialResolution: false,
    votingDeadline:   "",
  });
  const [resolutionType, setResolutionType] = useState<ResolutionType>("STANDARD");
  const [candidateRows,  setCandidateRows]  = useState<NewCandidateRow[]>([]);
  const { mutate, isPending } = useAddResolution();

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function setType(type: ResolutionType) {
    setResolutionType(type);
    if (type === "CANDIDATE" && candidateRows.length < 2) {
      setCandidateRows((prev) => [
        ...prev,
        ...Array.from({ length: 2 - prev.length }, () => ({ id: candUid(), name: "", bio: "" })),
      ]);
    }
  }
  function addCandidateRow() {
    setCandidateRows((prev) => [...prev, { id: candUid(), name: "", bio: "" }]);
  }
  function removeCandidateRow(id: string) {
    setCandidateRows((prev) => prev.filter((c) => c.id !== id));
  }
  function updateCandidateRow(id: string, field: "name" | "bio", val: string) {
    setCandidateRows((prev) => prev.map((c) => c.id === id ? { ...c, [field]: val } : c));
  }

  function handleSubmit() {
    const isCandidatePoll = resolutionType === "CANDIDATE";
    let candidates: CandidateInput[] | undefined;
    if (isCandidatePoll) {
      candidates = candidateRows
        .map((c) => ({ name: c.name.trim(), bio: c.bio.trim() || undefined }))
        .filter((c) => c.name);
      if (candidates.length < 2) return;
    }
    mutate(
      {
        eventId,
        data: {
          title:             form.title.trim(),
          description:       form.description.trim() || undefined,
          specialResolution: form.specialResolution,
          votingDeadline:    form.votingDeadline || undefined,
          resolutionType:    isCandidatePoll ? "CANDIDATE" : undefined,
          candidates,
        },
      },
      { onSuccess: onDone }
    );
  }

  const isCandidatePoll = resolutionType === "CANDIDATE";
  const validCandidateCount = candidateRows.filter((c) => c.name.trim()).length;
  const canSubmit = !isPending && !!form.title.trim() && (!isCandidatePoll || validCandidateCount >= 2);

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

        <div>
          <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">Resolution type</label>
          <div className="inline-flex rounded-lg border border-[hsl(var(--border))] p-0.5 bg-[hsl(var(--muted)/0.3)]">
            <button
              type="button"
              onClick={() => setType("STANDARD")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                resolutionType === "STANDARD"
                  ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))]"
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setType("CANDIDATE")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                resolutionType === "CANDIDATE"
                  ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))]"
              }`}
            >
              Candidate Poll
            </button>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            Candidate Poll lets shareholders vote For/Against/Abstain on each nominee independently, under one open/close window — e.g. &quot;Election of President&quot;.
          </p>
        </div>

        {isCandidatePoll && (
          <div className="flex flex-col gap-2 rounded-lg border border-[hsl(var(--border))] p-3">
            <div className="flex items-center justify-between">
              <label className="text-xs text-[hsl(var(--muted-foreground))]">
                Candidates * <span className="opacity-70">(min. 2)</span>
              </label>
              <button
                type="button"
                onClick={addCandidateRow}
                className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline"
              >
                + Add candidate
              </button>
            </div>
            {candidateRows.map((c, ci) => (
              <div key={c.id} className="flex items-center gap-2">
                <span className="text-xs text-[hsl(var(--muted-foreground))] w-4 shrink-0">{ci + 1}.</span>
                <Input
                  placeholder="Candidate name"
                  value={c.name}
                  onChange={(e) => updateCandidateRow(c.id, "name", e.target.value)}
                  className="h-8 text-sm flex-1"
                />
                <Input
                  placeholder="Bio (optional)"
                  value={c.bio}
                  onChange={(e) => updateCandidateRow(c.id, "bio", e.target.value)}
                  className="h-8 text-sm flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeCandidateRow(c.id)}
                  className="text-[hsl(var(--muted-foreground))] hover:text-red-500 transition-colors shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {candidateRows.length === 0 && (
              <p className="text-xs text-[hsl(var(--muted-foreground))] italic">No candidates added yet.</p>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button size="sm" disabled={!canSubmit} onClick={handleSubmit}>
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

  const [editingQuorum, setEditingQuorum] = useState(false);
  const [quorumInput,   setQuorumInput]   = useState("");

  const { data, isLoading }         = useVoteResults(eventId);
  const { refetch: fetchExport }    = useExportResolutions(eventId);
  const setQuorum                   = useSetQuorum();

  // Viewer role — read-only vote records. No quorum edit, add resolution,
  // open/close vote, offline vote entry, or share-weighted tallies toggle.
  const { data: userResponse } = useGetMe();
  const isViewer = resolveRole(userResponse?.data) === "viewer";
  // Only the org owner and team-Admin may mark proxies attended (backend-enforced too)
  const roleForProxies = resolveRole(userResponse?.data);
  const canMarkProxies = roleForProxies === "client_admin" || roleForProxies === "admin";

  async function handleExport() {
    setExporting(true);
    try {
      const result = await fetchExport();
      const exp    = result.data;
      if (!exp) return;
      const header = ["Order", "Title", "Special", "Status", "For (count)", "Against (count)", "Abstain (count)", "For (shares)", "Against (shares)", "Abstain (shares)", "Total Votes", "Result"];
      // Candidate Poll resolutions export one row per nominee (title suffixed with
      // the nominee's name) instead of a single flat row, mirroring the UI breakdown.
      const rows: string[][] = [];
      exp.resolutions.forEach((r) => {
        if (r.resolutionType === "CANDIDATE" && r.candidates && r.candidates.length > 0) {
          r.candidates.forEach((c) => {
            rows.push([
              String(r.order),
              `${r.title} — ${c.name}`,
              r.specialResolution ? "Yes" : "No",
              r.status,
              String(c.forCount),
              String(c.againstCount),
              String(c.abstainCount),
              String(c.forShares),
              String(c.againstShares),
              String(c.abstainShares),
              String(c.totalVotes),
              c.result,
            ]);
          });
        } else {
          rows.push([
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
        }
      });
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
  const votingStarted = resolutions.some((r) => ["OPEN", "CLOSED"].includes(r.status?.toUpperCase()));
  const quorumLocked  = isLive && votingStarted;

  function startEditQuorum() {
    setQuorumInput(String(Math.round(data!.requiredQuorumPercentage ?? data!.quorumPercentage ?? 0)));
    setEditingQuorum(true);
  }

  function saveQuorum() {
    const val = Number(quorumInput);
    if (Number.isNaN(val) || val < 0 || val > 100) return;
    setQuorum.mutate(
      { eventId, quorumPercentage: val },
      { onSuccess: () => setEditingQuorum(false) }
    );
  }

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
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-[hsl(var(--muted-foreground))]">Quorum</div>
            {!editingQuorum && !quorumLocked && !isViewer && (
              <button
                onClick={startEditQuorum}
                className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                title="Edit required quorum %"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {quorumLocked && (
              <span title="Locked — voting has started on a resolution">
                <Lock className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              </span>
            )}
          </div>

          {editingQuorum ? (
            <div className="flex items-center gap-1.5">
              <Input
                type="number" min={0} max={100}
                value={quorumInput}
                onChange={(e) => setQuorumInput(e.target.value)}
                className="h-8 w-20 text-sm"
                autoFocus
              />
              <span className="text-sm text-[hsl(var(--muted-foreground))]">%</span>
              <Button size="sm" className="h-8 w-8 p-0" disabled={setQuorum.isPending} onClick={saveQuorum}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingQuorum(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <>
              <div className="text-2xl font-bold tabular-nums">{Math.round(data.quorumPercentage ?? 0)}%</div>
              <div className={`text-xs font-semibold mt-1 ${data.quorumMet ? "text-green-600" : "text-red-500"}`}>
                {data.quorumMet ? "Quorum met" : "Quorum not met"}
                {data.requiredQuorumPercentage != null && ` · required ${Math.round(data.requiredQuorumPercentage)}%`}
              </div>
            </>
          )}
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
          {!showAddForm && !isViewer && (
            <Button size="sm" variant="outline" onClick={() => setShowAddForm(true)}>
              <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Add Resolution
            </Button>
          )}
        </div>

        {!isViewer && showAddForm && (
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
              <ResolutionCard key={r.id} res={r} eventId={eventId} isLive={isLive} readOnly={isViewer} />
            ))
          )}
        </div>

        {/* ── Proxy Register (AGM milestone #5) ── */}
        <ProxiesSection eventId={eventId} canMark={canMarkProxies} resolutions={resolutions} />
      </div>
    </div>
  );
}
