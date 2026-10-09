"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Wifi, Vote, X, Clock, ShieldCheck, CheckCircle2, MonitorPlay } from "lucide-react";
import { useOpenResolutionVoting, useCloseResolutionVoting, } from "@/api/client-votes";
import type { LiveResolution } from "@/api/client-live";
import { VoteBar } from "./VoteBar";
import { ResultsPresenter } from "./ResultsPresenter";
import { popup } from "@/lib/popup-store";

export function ResolutionsPanel({
  resolutions,
  color,
  eventId,
  eventTitle,
  registerName,
  logoUrl,
}: {
  resolutions: LiveResolution[];
  color: string;
  eventId: string;
  /** Branding for the full-screen results view. */
  eventTitle?: string;
  registerName?: string | null;
  logoUrl?: string | null;
}) {
  const openVote  = useOpenResolutionVoting();
  const closeVote = useCloseResolutionVoting();
  // Track which resolution has the duration picker open
  const [durationFor, setDurationFor] = useState<string | null>(null);
  const [duration,    setDuration]    = useState("120");
  // Resolution currently shown in the full-screen results view (null = closed)
  const [presentingId, setPresentingId] = useState<string | null>(null);

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
          // Counts can be undefined on a just-opened resolution before its
          // first tally lands — coalesce so the bars render at zero, not crash.
          const forCount     = res.forCount ?? 0;
          const againstCount = res.againstCount ?? 0;
          const abstainCount = res.abstainCount ?? 0;
          const total        = forCount + againstCount + abstainCount;
          // Only "OPEN" and "CLOSED" are definitive states.
          // Everything else (null, "PENDING", "CREATED", "NOT_STARTED", etc.)
          // means the resolution is ready to be opened — show the Open Voting button.
          const statusUp  = (res.status ?? "").toUpperCase();
          const isOpen    = statusUp === "OPEN";
          const isClosed  = statusUp === "CLOSED";
          const isPending = !isOpen && !isClosed;
          const busy      = openVote.isPending || closeVote.isPending;
          const isCandidate = (res.resolutionType ?? "").toUpperCase() === "CANDIDATE"
            || (Array.isArray(res.candidates) && res.candidates.length > 0);

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
                    {isCandidate && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5">
                        Candidate Poll · {res.candidates?.length ?? 0} nominee{(res.candidates?.length ?? 0) !== 1 ? "s" : ""}
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

                {/* Full-screen results — for restreaming the tally to viewers */}
                {(isOpen || isClosed) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5 h-8"
                    onClick={() => setPresentingId(res.id)}
                    title="Show results full screen (for streaming)"
                  >
                    <MonitorPlay className="h-3.5 w-3.5" />
                    Present
                  </Button>
                )}
              </div>

              {/* Vote bars — shown the moment voting opens (even at zero, so the
                  host watches the count climb from the start) and kept once
                  closed so the result is visible here, not only in Vote Records.
                  Only a CLOSED resolution with no votes drops the bars, for the
                  plain-text line below. */}
              {!isCandidate && (isOpen || (isClosed && total > 0)) && (
                <div className="flex flex-col gap-2 mt-3 bg-[hsl(var(--muted)/0.4)] rounded-xl p-3">
                  {(() => {
                    const fS = res.forShares ?? 0, aS = res.againstShares ?? 0, bS = res.abstainShares ?? 0;
                    const tS = fS + aS + bS;
                    const showShares = tS > 0 || !!(res as any).shareWeightedTalliesEnabled;
                    return (
                      <>
                        <VoteBar label="For"     value={forCount}     total={total} color="#16a34a" shares={showShares ? fS : null} />
                        <VoteBar label="Against" value={againstCount} total={total} color="#dc2626" shares={showShares ? aS : null} />
                        <VoteBar label="Abstain" value={abstainCount} total={total} color="#9ca3af" shares={showShares ? bS : null} />
                        <div className="pt-1 mt-1 border-t border-[hsl(var(--border))] flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-[hsl(var(--muted-foreground))]">
                          <span>Total votes: <span className="font-semibold text-[hsl(var(--foreground))]">{total.toLocaleString()}</span></span>
                          {showShares && (
                            <span>
                              Total shares:{" "}
                              <span className="font-semibold text-[hsl(var(--foreground))]">{tS.toLocaleString()}</span>{" "}
                              (For <span className="font-semibold text-green-700">{fS.toLocaleString()}</span>
                              {" \u00b7 "}Against <span className="font-semibold text-red-600">{aS.toLocaleString()}</span>
                              {" \u00b7 "}Abstain <span className="font-semibold text-[hsl(var(--foreground))]">{bS.toLocaleString()}</span>)
                            </span>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* A closed resolution that no one voted on. Say it, rather than
                  leaving the card blank under the "Closed" badge. */}
              {!isCandidate && isClosed && total === 0 && (
                <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted)/0.4)] rounded-xl px-3 py-2.5">
                  No votes were cast on this resolution.
                </p>
              )}

              {/* Candidate poll — per-nominee tallies (the live snapshot sends a
                  tally per candidate). Shown while open and once closed. */}
              {isCandidate && (isOpen || isClosed) && (res.candidates?.length ?? 0) > 0 && (
                <div className="flex flex-col gap-3 mt-3">
                  {res.candidates!.map((c, ci) => {
                    const cTotal = (c.forCount ?? 0) + (c.againstCount ?? 0) + (c.abstainCount ?? 0);
                    return (
                      <div key={c.id ?? ci} className="bg-[hsl(var(--muted)/0.4)] rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-[hsl(var(--foreground))]">{c.name}</span>
                          <span className="text-[10px] font-bold text-[hsl(var(--muted-foreground))]">#{ci + 1}</span>
                          {cTotal === 0 && (
                            <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">No votes yet</span>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          {(() => {
                            const cS = (c.forShares ?? 0) + (c.againstShares ?? 0) + (c.abstainShares ?? 0);
                            const show = cS > 0 || !!(res as any).shareWeightedTalliesEnabled;
                            return (
                              <>
                                <VoteBar label="For"     value={c.forCount}     total={cTotal} color="#16a34a" shares={show ? (c.forShares ?? 0) : null} />
                                <VoteBar label="Against" value={c.againstCount} total={cTotal} color="#dc2626" shares={show ? (c.againstShares ?? 0) : null} />
                                <VoteBar label="Abstain" value={c.abstainCount} total={cTotal} color="#9ca3af" shares={show ? (c.abstainShares ?? 0) : null} />
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
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
                    onClick={() => popup.confirm(
                      "Close Voting",
                      `Close voting for “${res.title}”? Participants will no longer be able to submit votes.`,
                      () => closeVote.mutate({ eventId, resolutionId: res.id }),
                      undefined,
                      "Close Voting"
                    )}
                  >
                    <X className="h-3.5 w-3.5" />
                    {closeVote.isPending ? "Closing…" : "Close Voting"}
                  </Button>
                </div>
              )}

              {/* Reopen a closed resolution — the control room previously left a
                  closed resolution terminal, with no way to resume voting after
                  an accidental or premature close. Uses the same /open endpoint.
                  Confirm-guarded and worded as "resume" so it reads as continuing
                  the existing vote, not starting a fresh one. */}
              {isClosed && (
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    disabled={busy}
                    onClick={() => popup.confirm(
                      "Reopen voting",
                      `Reopen voting for “${res.title}”? Participants will be able to submit votes again. Votes already recorded are kept.`,
                      () => openVote.mutate({ eventId, resolutionId: res.id }),
                      undefined,
                      "Reopen voting",
                    )}
                  >
                    <Vote className="h-3.5 w-3.5" />
                    {openVote.isPending ? "Reopening…" : "Reopen voting"}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {presentingId && (
        <ResultsPresenter
          resolutions={resolutions}
          activeId={presentingId}
          onChangeActive={setPresentingId}
          onClose={() => setPresentingId(null)}
          eventTitle={eventTitle}
          registerName={registerName}
          logoUrl={logoUrl}
          accent={color}
        />
      )}
    </Card>
  );
}
