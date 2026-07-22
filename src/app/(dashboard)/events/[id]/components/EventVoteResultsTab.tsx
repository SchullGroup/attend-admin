"use client";
import { Vote } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/custom/status-badge";
import type { ResolutionResult, VoteResultsResponse } from "@/api/client-votes";

function VoteRow({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-[hsl(var(--muted-foreground))] w-16 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-sm font-semibold tabular-nums w-10 text-right">{pct}%</span>
      <span className="text-sm text-[hsl(var(--foreground))] tabular-nums w-24 text-right">{value.toLocaleString()}</span>
    </div>
  );
}

function CandidateResultRow({ c }: { c: NonNullable<ResolutionResult["candidates"]>[number] }) {
  const total = (c.combinedForCount ?? 0) + (c.combinedAgainstCount ?? 0) + (c.combinedAbstainCount ?? 0);
  const pctOf = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
          {c.name}
          {typeof c.rank === "number" && (
            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]">
              #{c.rank}
            </span>
          )}
        </p>
        <span className={`text-xs font-semibold ${c.passed ? "text-green-600" : "text-red-500"}`}>
          {total > 0 ? (c.passed ? "Passed" : "Failed") : "No votes"}
        </span>
      </div>
      {c.bio && <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">{c.bio}</p>}
      <div className="flex flex-col gap-2">
        <VoteRow label="For"     value={c.combinedForCount ?? 0}     pct={pctOf(c.combinedForCount ?? 0)}     color="#16a34a" />
        <VoteRow label="Against" value={c.combinedAgainstCount ?? 0} pct={pctOf(c.combinedAgainstCount ?? 0)} color="#dc2626" />
        <VoteRow label="Abstain" value={c.combinedAbstainCount ?? 0} pct={pctOf(c.combinedAbstainCount ?? 0)} color="#9ca3af" />
      </div>
    </div>
  );
}

function ResolutionCard({ res, index }: { res: ResolutionResult; index: number }) {
  const status = (res.status ?? "PENDING").toUpperCase();
  const hasVotes = status === "OPEN" || status === "CLOSED";

  // Candidate Poll (F8) — a slate of nominees voted for/against/abstain
  // independently. The flat combinedFor/Against/Abstain fields below stay 0
  // for these; all real data lives in `candidates[]`.
  const isCandidatePoll = res.resolutionType === "CANDIDATE";
  const candidates      = res.candidates ?? [];

  const total = (res.combinedForCount ?? 0) + (res.combinedAgainstCount ?? 0) + (res.combinedAbstainCount ?? 0);
  const pctOf = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

  return (
    <Card className="attend-card p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Resolution {res.order ?? index + 1}
          </p>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <h3 className="text-base font-bold text-[hsl(var(--foreground))]">{res.title}</h3>
            {res.specialResolution && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700">
                Special
              </span>
            )}
            {res.shareWeightedTalliesEnabled && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">
                Share-Weighted
              </span>
            )}
            {isCandidatePoll && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]">
                Candidate Poll · {candidates.length} nominees
              </span>
            )}
          </div>
        </div>
        <StatusBadge status={res.status} />
      </div>

      {hasVotes ? (
        isCandidatePoll ? (
          <div className="flex flex-col gap-3">
            {candidates.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))] italic">No candidates on this slate.</p>
            ) : (
              [...candidates]
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((c) => <CandidateResultRow key={c.id} c={c} />)
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <VoteRow label="For"      value={res.combinedForCount ?? 0}     pct={pctOf(res.combinedForCount ?? 0)}     color="#16a34a" />
              <VoteRow label="Against"  value={res.combinedAgainstCount ?? 0} pct={pctOf(res.combinedAgainstCount ?? 0)} color="#dc2626" />
              <VoteRow label="Abstain"  value={res.combinedAbstainCount ?? 0} pct={pctOf(res.combinedAbstainCount ?? 0)} color="#9ca3af" />
            </div>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-4">
              Total votes: <span className="font-semibold text-[hsl(var(--foreground))]">{total.toLocaleString()}</span>
            </p>
            {res.shareWeightedTalliesEnabled && (
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                Total shares: <span className="font-semibold text-[hsl(var(--foreground))]">
                  {((res.combinedForShares ?? 0) + (res.combinedAgainstShares ?? 0) + (res.combinedAbstainShares ?? 0)).toLocaleString()}
                </span>
                {" "}(For {res.combinedForShares?.toLocaleString() ?? 0} · Against {res.combinedAgainstShares?.toLocaleString() ?? 0} · Abstain {res.combinedAbstainShares?.toLocaleString() ?? 0})
              </p>
            )}
          </>
        )
      ) : (
        <p className="text-sm italic text-[hsl(var(--muted-foreground))]">
          Voting has not commenced for this resolution.
        </p>
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
            {(() => {
              // Pass/fail only applies cleanly to single-subject resolutions —
              // a Candidate Poll evaluates each nominee independently instead.
              const standard = resolutions.filter((r) => r.resolutionType !== "CANDIDATE");
              return (
                <div className="text-xl font-bold tabular-nums">
                  {standard.filter((r) => r.passed).length} / {standard.length}
                </div>
              );
            })()}
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
