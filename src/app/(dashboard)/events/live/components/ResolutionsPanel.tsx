"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Wifi, Vote, X, Clock, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useOpenResolutionVoting, useCloseResolutionVoting, } from "@/api/client-votes";
import type { LiveResolution } from "@/api/client-live";
import { VoteBar } from "./VoteBar";

export function ResolutionsPanel({
  resolutions,
  color,
  eventId,
}: {
  resolutions: LiveResolution[];
  color: string;
  eventId: string;
}) {
  const openVote  = useOpenResolutionVoting();
  const closeVote = useCloseResolutionVoting();
  // Track which resolution has the duration picker open
  const [durationFor, setDurationFor] = useState<string | null>(null);
  const [duration,    setDuration]    = useState("120");

  if (resolutions.length === 0) {
    return (
      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Session Segments</h2>
        </div>
        <div className="px-5 py-8 flex flex-col items-center gap-3 text-center">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
            <Wifi className="h-5 w-5" style={{ color }} />
          </div>
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">Presentation-mode session</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-xs">
            This event does not have formal voting resolutions. Monitor attendance and manage Q&amp;A from the panel on the right.
          </p>
        </div>
      </Card>
    );
  }

  const closed = resolutions.filter((r) => (r.status || "").toUpperCase() === "CLOSED").length;

  return (
    <Card className="attend-card overflow-hidden">
      <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
        <h2 className="font-semibold text-[hsl(var(--foreground))]">Resolutions</h2>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          {closed} / {resolutions.length} closed
        </span>
      </div>
      <div className="divide-y divide-[hsl(var(--border))]">
        {resolutions.map((res, i) => {
          const total    = res.forCount + res.againstCount + res.abstainCount;
          // Only "OPEN" and "CLOSED" are definitive states.
          // Everything else (null, "PENDING", "CREATED", "NOT_STARTED", etc.)
          // means the resolution is ready to be opened — show the Open Voting button.
          const statusUp  = (res.status ?? "").toUpperCase();
          const isOpen    = statusUp === "OPEN";
          const isClosed  = statusUp === "CLOSED";
          const isPending = !isOpen && !isClosed;
          const busy      = openVote.isPending || closeVote.isPending;

          return (
            <div key={res.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                    <span className="text-xs font-bold text-[hsl(var(--muted-foreground))]">
                      RES. {res.order ?? i + 1}
                    </span>
                    {isPending && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        Pending
                      </span>
                    )}
                    {isOpen && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                        Open
                      </span>
                    )}
                    {isClosed && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                        Closed
                      </span>
                    )}
                    {res.specialResolution ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                        <ShieldCheck className="h-3 w-3" /> Special
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 rounded-full px-2 py-0.5">
                        <CheckCircle2 className="h-3 w-3" /> Ordinary
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{res.title}</p>
                  {res.description && (
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{res.description}</p>
                  )}
                </div>

                {/* Timer countdown */}
                {isOpen && res.secondsRemaining != null && res.secondsRemaining > 0 && (
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border shrink-0 ${
                    res.secondsRemaining <= 10
                      ? "bg-red-50 border-red-200 animate-pulse"
                      : "bg-amber-50 border-amber-200"
                  }`}>
                    <Clock className={`h-3.5 w-3.5 ${res.secondsRemaining <= 10 ? "text-red-600" : "text-amber-600"}`} />
                    <span className={`text-base font-bold tabular-nums ${res.secondsRemaining <= 10 ? "text-red-700" : "text-amber-700"}`}>
                      {res.secondsRemaining}s
                    </span>
                  </div>
                )}
              </div>

              {/* Vote bars */}
              {(isOpen || isClosed) && total > 0 && (
                <div className="flex flex-col gap-2 mt-3 bg-[hsl(var(--muted)/0.4)] rounded-xl p-3">
                  <VoteBar label="For"     value={res.forCount}     total={total} color="#16a34a" />
                  <VoteBar label="Against" value={res.againstCount} total={total} color="#dc2626" />
                  <VoteBar label="Abstain" value={res.abstainCount} total={total} color="#9ca3af" />
                  <div className="pt-1 mt-1 border-t border-[hsl(var(--border))] flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
                    <span>Total votes: <span className="font-semibold text-[hsl(var(--foreground))]">{total.toLocaleString()}</span></span>
                    {(res.forShares + res.againstShares + res.abstainShares) > 0 && (
                      <span>
                        Total shares:{" "}
                        <span className="font-semibold text-[hsl(var(--foreground))]">
                          {(res.forShares + res.againstShares + res.abstainShares).toLocaleString()}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* ── Voting controls ── */}
              {isPending && (
                <div className="mt-3">
                  {durationFor === res.id ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">Duration (seconds):</span>
                      <input
                        type="number"
                        min={30}
                        max={3600}
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="h-8 w-24 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
                      />
                      <Button
                        size="sm"
                        className="h-8 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                        disabled={busy}
                        onClick={() => {
                          openVote.mutate(
                            { eventId, resolutionId: res.id, durationSeconds: Number(duration) },
                            { onSuccess: () => setDurationFor(null) }
                          );
                        }}
                      >
                        <Vote className="h-3.5 w-3.5" />
                        {openVote.isPending ? "Opening…" : "Open Voting"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => setDurationFor(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                      disabled={busy}
                      onClick={() => setDurationFor(res.id)}
                    >
                      <Vote className="h-3.5 w-3.5" /> Open Voting
                    </Button>
                  )}
                </div>
              )}

              {isOpen && (
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
                    disabled={busy}
                    onClick={() => closeVote.mutate({ eventId, resolutionId: res.id })}
                  >
                    <X className="h-3.5 w-3.5" />
                    {closeVote.isPending ? "Closing…" : "Close Voting"}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
