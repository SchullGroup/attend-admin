"use client";
import { Vote } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/custom/status-badge";

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

interface Props { liveVotes: any[] }

export function EventVoteResultsTab({ liveVotes }: Props) {
  if (liveVotes.length === 0) {
    return (
      <Card className="attend-card p-12 text-center">
        <Vote className="h-10 w-10 mx-auto mb-3 text-[hsl(var(--muted-foreground))] opacity-30" />
        <p className="text-[hsl(var(--muted-foreground))]">No vote results available yet.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {liveVotes.map((v, i) => {
        const total = v.for + v.against + v.abstain;
        return (
          <Card key={v.resolutionId} className="attend-card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs font-bold text-[hsl(var(--muted-foreground))] mb-1">RESOLUTION {i + 1}</div>
                <div className="text-base font-semibold text-[hsl(var(--foreground))]">{v.title}</div>
              </div>
              <StatusBadge status={v.status} />
            </div>
            {total > 0 ? (
              <div className="flex flex-col gap-2.5 bg-[hsl(var(--muted)/0.4)] rounded-xl p-4">
                <VoteBar label="For"     value={v.for}     total={total} color="#16a34a" />
                <VoteBar label="Against" value={v.against} total={total} color="#dc2626" />
                <VoteBar label="Abstain" value={v.abstain} total={total} color="#9ca3af" />
                <div className="mt-2 pt-2 border-t border-[hsl(var(--border))] text-xs text-[hsl(var(--muted-foreground))]">
                  Total votes: <span className="font-semibold text-[hsl(var(--foreground))]">{total.toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-[hsl(var(--muted-foreground))] italic">Voting has not commenced for this resolution.</div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
