"use client";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/custom/status-badge";
import { Check, X, Clock, Users, Vote, MessageSquare, UserCheck } from "lucide-react";

function VoteBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[hsl(var(--muted-foreground))] w-16 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-semibold tabular-nums w-10 text-right">{pct}%</span>
      <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums w-16 text-right">{value.toLocaleString()}</span>
    </div>
  );
}

const RECENT_JOINS = [
  { name: "Ngozi Okafor", time: "just now", method: "Virtual" },
  { name: "Emeka Eze", time: "1m ago", method: "Virtual" },
  { name: "Chidera Obi", time: "2m ago", method: "In-person" },
  { name: "Tolu Adeyemi", time: "3m ago", method: "Virtual" },
  { name: "Biodun Adeola", time: "4m ago", method: "Virtual" },
];

export default function LiveControlPage() {
  const { liveVotes, liveQaQueue, liveAttendees, openVoting, closeVoting, approveQA, rejectQA } = useStore();

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Live Session — Zenith Bank 2026 AGM</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-600">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Session elapsed: <span className="font-semibold text-[hsl(var(--foreground))]">1h 23m</span></p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums text-[hsl(var(--foreground))]">{liveAttendees.toLocaleString()}</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">Attendees Connected</div>
          </div>
        </div>
        <div className="flex-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center">
            <UserCheck className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums text-[hsl(var(--foreground))]">58.4%</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">Quorum Achieved</div>
          </div>
        </div>
        <div className="flex-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center">
            <Vote className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums text-[hsl(var(--foreground))]">2 / 4</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">Resolutions Closed</div>
          </div>
        </div>
        <div className="flex-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center">
            <Clock className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums text-[hsl(var(--foreground))]">1h 23m</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">Elapsed Time</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 flex flex-col gap-5">
          <Card className="attend-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Resolutions</h2>
            </div>
            <div className="divide-y divide-[hsl(var(--border))]">
              {liveVotes.map((v, i) => {
                const total = v.for + v.against + v.abstain;
                return (
                  <div key={v.resolutionId} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2.5 mb-1">
                          <span className="text-xs font-bold text-[hsl(var(--muted-foreground))]">RES. {i + 1}</span>
                          <StatusBadge status={v.status} />
                        </div>
                        <div className="text-sm font-semibold text-[hsl(var(--foreground))]">{v.title}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {v.status === "pending" && (
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => openVoting(v.resolutionId)}
                          >
                            Open Voting
                          </Button>
                        )}
                        {v.status === "open" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs"
                            onClick={() => closeVoting(v.resolutionId)}
                          >
                            Close Voting
                          </Button>
                        )}
                      </div>
                    </div>
                    {(v.status === "open" || v.status === "closed") && total > 0 && (
                      <div className="flex flex-col gap-2 mt-3 bg-[hsl(var(--muted)/0.4)] rounded-xl p-3">
                        <VoteBar label="For" value={v.for} total={total} color="#16a34a" />
                        <VoteBar label="Against" value={v.against} total={total} color="#dc2626" />
                        <VoteBar label="Abstain" value={v.abstain} total={total} color="#9ca3af" />
                        <div className="pt-1 mt-1 border-t border-[hsl(var(--border))] text-xs text-[hsl(var(--muted-foreground))]">
                          Total votes cast: <span className="font-semibold text-[hsl(var(--foreground))]">{total.toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                    {v.status === "pending" && (
                      <div className="text-xs text-[hsl(var(--muted-foreground))] mt-2 italic">Voting not yet opened for this resolution.</div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="col-span-1 flex flex-col gap-5">
          <Card className="attend-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Q&A Queue</h2>
              <span className="ml-auto text-xs bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] rounded-full px-2 py-0.5 font-semibold">
                {liveQaQueue.filter((q) => q.approved === null).length} pending
              </span>
            </div>
            <div className="divide-y divide-[hsl(var(--border))]">
              {liveQaQueue.map((q) => (
                <div key={q.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-[hsl(var(--foreground))]">{q.name}</span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{q.time}</span>
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3 leading-relaxed">{q.question}</p>
                  {q.approved === null ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-7 text-xs flex-1 gap-1"
                        onClick={() => approveQA(q.id)}
                      >
                        <Check className="h-3 w-3" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs flex-1 gap-1 text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => rejectQA(q.id)}
                      >
                        <X className="h-3 w-3" />
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${q.approved ? "text-green-600" : "text-red-500"}`}>
                      {q.approved ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {q.approved ? "Approved" : "Rejected"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card className="attend-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Attendance Log</h2>
            </div>
            <div className="divide-y divide-[hsl(var(--border))]">
              {RECENT_JOINS.map((join, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-6 w-6 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-[hsl(var(--primary))] text-[10px] font-bold">
                      {join.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[hsl(var(--foreground))]">{join.name}</div>
                      <div className="text-[11px] text-[hsl(var(--muted-foreground))]">{join.method}</div>
                    </div>
                  </div>
                  <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{join.time}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
