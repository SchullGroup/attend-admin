"use client";
import { useState } from "react";
import { Vote, CheckCircle2, XCircle, Radio, Users, Share2, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/custom/status-badge";
import type { ResolutionResult, VoteResultsResponse } from "@/api/client-votes";

function VoteBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[hsl(var(--muted-foreground))] w-16 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-semibold tabular-nums w-10 text-right">{pct}%</span>
      <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums w-20 text-right">{value.toLocaleString()}</span>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] text-[hsl(var(--muted-foreground))] mb-0.5">{label}</div>
      <div className="text-sm font-bold tabular-nums">{value.toLocaleString()}</div>
    </div>
  );
}

function ResolutionCard({ res, index }: { res: ResolutionResult; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const total = (res.combinedForCount ?? 0) + (res.combinedAgainstCount ?? 0) + (res.combinedAbstainCount ?? 0);
  const pct   = Math.round(res.percentageFor ?? 0);

  return (
    <Card className="attend-card overflow-hidden">
      <div className="px-5 py-4 flex items-start gap-4 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        {/* Order badge */}
        <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] mt-0.5">
          {res.order ?? index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[hsl(var(--foreground))]">{res.title}</span>
            {res.specialResolution && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700">
                Special
              </span>
            )}
          </div>

          {/* Pass / fail + percentage */}
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
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{pct}% for</span>
          </div>

          {/* Bar */}
          {total > 0 && (
            <div className="mt-2 flex flex-col gap-1.5">
              <div className="h-2 w-full rounded-full bg-[hsl(var(--muted))] overflow-hidden flex">
                <div className="h-full bg-green-500" style={{ width: `${pct}%` }} />
                <div
                  className="h-full bg-red-400"
                  style={{ width: `${Math.round(((res.combinedAgainstCount ?? 0) / total) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[hsl(var(--muted-foreground))]">
                <span className="text-green-600 font-medium">For {res.combinedForCount ?? 0}</span>
                <span className="text-yellow-600">Abstain {res.combinedAbstainCount ?? 0}</span>
                <span className="text-red-500 font-medium">Against {res.combinedAgainstCount ?? 0}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={res.status} />
          {expanded ? <ChevronUp className="h-4 w-4 text-[hsl(var(--muted-foreground))]" /> : <ChevronDown className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />}
        </div>
      </div>

      {/* Expanded: online / offline / combined breakdown */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-[hsl(var(--border))]">
          <div className="grid grid-cols-3 gap-4 mt-4">
            {/* Online */}
            <div className="rounded-xl bg-[hsl(var(--muted)/0.4)] p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Radio className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                <span className="text-xs font-semibold">Online</span>
              </div>
              <div className="flex flex-col gap-2">
                <StatCell label="For"     value={res.votesFor ?? 0}     />
                <StatCell label="Against" value={res.votesAgainst ?? 0} />
                <StatCell label="Abstain" value={res.abstentions ?? 0}  />
              </div>
              <div className="mt-3 pt-3 border-t border-[hsl(var(--border))]">
                <div className="flex items-center gap-1 mb-2 text-[10px] text-[hsl(var(--muted-foreground))]">
                  <Share2 className="h-3 w-3" /> Shares
                </div>
                <StatCell label="For"     value={res.sharesFor ?? 0}     />
                <StatCell label="Against" value={res.sharesAgainst ?? 0} />
                <StatCell label="Abstain" value={res.sharesAbstain ?? 0} />
              </div>
            </div>

            {/* Offline */}
            <div className="rounded-xl bg-[hsl(var(--muted)/0.4)] p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Users className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-semibold">In-room</span>
              </div>
              <div className="flex flex-col gap-2">
                <StatCell label="For"     value={res.offlineForCount ?? 0}     />
                <StatCell label="Against" value={res.offlineAgainstCount ?? 0} />
                <StatCell label="Abstain" value={res.offlineAbstainCount ?? 0} />
              </div>
              <div className="mt-3 pt-3 border-t border-[hsl(var(--border))]">
                <div className="flex items-center gap-1 mb-2 text-[10px] text-[hsl(var(--muted-foreground))]">
                  <Share2 className="h-3 w-3" /> Shares
                </div>
                <StatCell label="For"     value={res.offlineForShares ?? 0}     />
                <StatCell label="Against" value={res.offlineAgainstShares ?? 0} />
                <StatCell label="Abstain" value={res.offlineAbstainShares ?? 0} />
              </div>
            </div>

            {/* Combined */}
            <div className="rounded-xl bg-[hsl(var(--muted)/0.4)] p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs font-semibold">Combined</span>
              </div>
              <div className="flex flex-col gap-2">
                <StatCell label="For"     value={res.combinedForCount ?? 0}     />
                <StatCell label="Against" value={res.combinedAgainstCount ?? 0} />
                <StatCell label="Abstain" value={res.combinedAbstainCount ?? 0} />
              </div>
              <div className="mt-3 pt-3 border-t border-[hsl(var(--border))]">
                <div className="flex items-center gap-1 mb-2 text-[10px] text-[hsl(var(--muted-foreground))]">
                  <Share2 className="h-3 w-3" /> Shares
                </div>
                <StatCell label="For"     value={res.combinedForShares ?? 0}     />
                <StatCell label="Against" value={res.combinedAgainstShares ?? 0} />
                <StatCell label="Abstain" value={res.combinedAbstainShares ?? 0} />
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

interface Props {
  voteResults: VoteResultsResponse | null | undefined;
}

export function EventVoteResultsTab({ voteResults }: Props) {
  const resolutions = [...(voteResults?.resolutions ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (resolutions.length === 0) {
    return (
      <Card className="attend-card p-12 text-center">
        <Vote className="h-10 w-10 mx-auto mb-3 text-[hsl(var(--muted-foreground))] opacity-30" />
        <p className="text-[hsl(var(--muted-foreground))]">No vote results available yet.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary: quorum */}
      {voteResults && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="attend-card p-4">
            <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Total Votes Cast</div>
            <div className="text-xl font-bold tabular-nums">{(voteResults.totalVotesCast ?? 0).toLocaleString()}</div>
          </Card>
          <Card className="attend-card p-4">
            <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Quorum</div>
            <div className="text-xl font-bold tabular-nums">{Math.round(voteResults.quorumPercentage ?? 0)}%</div>
            <div className={`text-xs font-semibold mt-0.5 ${voteResults.quorumMet ? "text-green-600" : "text-red-500"}`}>
              {voteResults.quorumMet ? "Quorum met" : "Quorum not met"}
            </div>
          </Card>
          <Card className="attend-card p-4">
            <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Resolutions Passed</div>
            <div className="text-xl font-bold tabular-nums">
              {resolutions.filter((r) => r.passed).length} / {resolutions.length}
            </div>
          </Card>
        </div>
      )}

      {/* Resolution cards */}
      {resolutions.map((r, i) => (
        <ResolutionCard key={r.id} res={r} index={i} />
      ))}
    </div>
  );
}
