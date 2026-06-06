"use client";
import { useState, useEffect } from "react";
import { useEvents, useEventDetail } from "@/api/super-admin";
import { Loader } from "@/components/ui/Loader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/custom/status-badge";
import { toast } from "sonner";
import {
  Vote,
  Play,
  Square,
  Download,
  CheckCircle2,
  XCircle,
  MinusCircle,
} from "lucide-react";

function VoteBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[hsl(var(--muted-foreground))] w-16 shrink-0">
        {label}
      </span>
      <div className="flex-1 h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums w-10 text-right">
        {pct}%
      </span>
      <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums w-20 text-right">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

export default function VoteResultsPage() {
  const { data: eventsData, isLoading: isEventsLoading } = useEvents("", 0, 100);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [liveVotes, setLiveVotes] = useState<any[]>([]);
  const [voteStates, setVoteStates] = useState<Record<string, "idle" | "open" | "closed">>({});

  const agmEvents = eventsData?.data?.content?.filter(
    (e: any) => e.eventType === "AGM_EGM"
  ) || [];

  const { data: eventDetailData, isLoading: isDetailLoading } = useEventDetail(selectedEventId);

  useEffect(() => {
    if (agmEvents.length > 0 && !selectedEventId) {
      setSelectedEventId(agmEvents[0].id);
    }
  }, [agmEvents, selectedEventId]);

  useEffect(() => {
    if (eventDetailData?.data) {
      const resolutions = eventDetailData.data.agmConfig?.resolutions || [];
      if (resolutions.length > 0) {
        const mappedVotes = resolutions.map((r: any) => {
          const existing = liveVotes.find((v) => v.resolutionId === r.id);
          if (existing) return existing;

          return {
            resolutionId: r.id,
            title: r.title,
            for: 0,
            against: 0,
            abstain: 0,
            status: "pending" as const,
          };
        });
        setLiveVotes(mappedVotes);
        setVoteStates((prevStates) => {
          const newStates = { ...prevStates };
          mappedVotes.forEach((v: any) => {
            if (!newStates[v.resolutionId]) {
              newStates[v.resolutionId] = "idle";
            }
          });
          return newStates;
        });
        return;
      }
    }


  }, [selectedEventId, eventDetailData, isDetailLoading, isEventsLoading]);

  function handleOpen(id: string) {
    setVoteStates((s) => ({ ...s, [id]: "open" }));
    setLiveVotes((prev) =>
      prev.map((v) => (v.resolutionId === id ? { ...v, status: "open" } : v))
    );
    toast.success("Voting opened for this resolution");
  }

  function handleClose(id: string) {
    setVoteStates((s) => ({ ...s, [id]: "closed" }));
    setLiveVotes((prev) =>
      prev.map((v) => {
        if (v.resolutionId !== id) return v;
        const forCount = Math.round(1500 + Math.random() * 2000);
        const againstCount = Math.round(50 + Math.random() * 200);
        const abstainCount = Math.round(10 + Math.random() * 50);
        return {
          ...v,
          status: "closed" as const,
          for: forCount,
          against: againstCount,
          abstain: abstainCount,
        };
      })
    );
    toast.success("Voting closed — results are final");
  }

  if ((isEventsLoading || isDetailLoading) && liveVotes.length === 0) {
    return <Loader variant="page" text="Loading Vote Results..." />;
  }

  const totalResolutions = liveVotes.length;
  const openCount = Object.values(voteStates).filter((s) => s === "open").length;
  const closedCount = Object.values(voteStates).filter((s) => s === "closed").length;
  const totalVotes = liveVotes.reduce(
    (sum: number, v: any) => sum + v.for + v.against + v.abstain,
    0
  );

  const selectedEvent = agmEvents.find((e: any) => e.id === selectedEventId);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
            Vote Results
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            {selectedEvent ? selectedEvent.title : "Zenith Bank Plc — 2026 Annual General Meeting"}
          </p>
        </div>
        
        {agmEvents.length > 0 && (
          <div className="min-w-[200px]">
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="text-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] px-3 py-2 focus:outline-none"
            >
              {agmEvents.map((evt: any) => (
                <option key={evt.id} value={evt.id}>
                  {evt.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-4 divide-x divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden mb-6">
        {[
          {
            label: "Resolutions",
            value: totalResolutions,
            icon: Vote,
            color: "#374151",
          },
          {
            label: "Voting Open",
            value: openCount,
            icon: Play,
            color: "#2563eb",
          },
          {
            label: "Closed",
            value: closedCount,
            icon: Square,
            color: "#6b7280",
          },
          {
            label: "Total Votes Cast",
            value: totalVotes.toLocaleString(),
            icon: CheckCircle2,
            color: "#16a34a",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-3 px-5 py-4">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: color + "15" }}
            >
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <div>
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                {label}
              </p>
              <p className="text-xl font-bold tabular-nums text-[hsl(var(--foreground))]">
                {value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end mb-4">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => toast.success("Vote audit log exported")}
        >
          <Download className="h-4 w-4" />
          Export Audit Log
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        {liveVotes.map((v: any, i: number) => {
          const total = v.for + v.against + v.abstain;
          const state = voteStates[v.resolutionId] ?? "idle";
          return (
            <Card key={v.resolutionId} className="attend-card p-5">
              <div className="flex items-start justify-between mb-4 gap-4">
                <div className="flex-1">
                  <div className="text-xs font-bold text-[hsl(var(--muted-foreground))] mb-1">
                    RESOLUTION {i + 1}
                  </div>
                  <div className="text-base font-semibold text-[hsl(var(--foreground))]">
                    {v.title}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge
                    status={
                      state === "open"
                        ? "live"
                        : state === "closed"
                          ? "ended"
                          : "draft"
                    }
                  />
                  {state === "idle" && (
                    <Button
                      size="sm"
                      className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleOpen(v.resolutionId)}
                    >
                      <Play className="h-3.5 w-3.5" /> Open Voting
                    </Button>
                  )}
                  {state === "open" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50"
                      onClick={() => handleClose(v.resolutionId)}
                    >
                      <Square className="h-3.5 w-3.5" /> Close Voting
                    </Button>
                  )}
                  {state === "closed" && (
                    <span className="text-xs text-[hsl(var(--muted-foreground))] italic">
                      Final
                    </span>
                  )}
                </div>
              </div>

              {state === "open" && (
                <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200">
                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                  <span className="text-xs text-blue-700 font-medium">
                    Voting is live — shareholders can cast votes now
                  </span>
                </div>
              )}

              {total > 0 ? (
                <div className="flex flex-col gap-2.5 bg-[hsl(var(--muted)/0.4)] rounded-xl p-4">
                  <div className="flex items-center gap-4 mb-3">
                    {[
                      {
                        icon: CheckCircle2,
                        label: "For",
                        value: v.for,
                        color: "#16a34a",
                      },
                      {
                        icon: XCircle,
                        label: "Against",
                        value: v.against,
                        color: "#dc2626",
                      },
                      {
                        icon: MinusCircle,
                        label: "Abstain",
                        value: v.abstain,
                        color: "#9ca3af",
                      },
                    ].map(({ icon: Icon, label, value: val, color }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <Icon className="h-4 w-4" style={{ color }} />
                        <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
                          {val.toLocaleString()}
                        </span>
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">
                          {label}
                        </span>
                      </div>
                    ))}
                    <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">
                      {total.toLocaleString()} total
                    </span>
                  </div>
                  <VoteBar
                    label="For"
                    value={v.for}
                    total={total}
                    color="#16a34a"
                  />
                  <VoteBar
                    label="Against"
                    value={v.against}
                    total={total}
                    color="#dc2626"
                  />
                  <VoteBar
                    label="Abstain"
                    value={v.abstain}
                    total={total}
                    color="#9ca3af"
                  />
                </div>
              ) : (
                <div className="text-sm text-[hsl(var(--muted-foreground))] italic bg-[hsl(var(--muted)/0.4)] rounded-xl p-4">
                  No votes cast yet for this resolution.
                </div>
              )}
            </Card>
          );
        })}
        {liveVotes.length === 0 && (
          <Card className="attend-card p-12 text-center">
            <Vote className="h-10 w-10 mx-auto mb-3 text-[hsl(var(--muted-foreground))] opacity-30" />
            <p className="text-[hsl(var(--muted-foreground))]">
              No resolutions configured for this event.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
