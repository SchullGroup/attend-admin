"use client";
/**
 * PollsPanel — live event polls in the Live Control Room (F1).
 *
 * Client admin: create + open a poll (one open at a time, enforced server-side
 * with a 409), watch results update live over the websocket, close manually,
 * delete mistakes. Super admin: same panel, read-only (`readOnly` prop) —
 * queries the /admin endpoint via the parent's hook choice.
 *
 * Live updates: the parent (SessionDetail) owns the single websocket
 * connection and forwards POLL_* messages into this component via
 * `wsMessage` (latest poll message, monotonic `seq` so repeats of the same
 * object are never missed). Query data is the snapshot; websocket patches it.
 */
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Plus, X, Trash2, Loader2, Lock } from "lucide-react";
import type { LiveWsMessage } from "@/hooks/use-live-websocket";
import {
  useCreatePoll,
  useClosePoll,
  useDeletePoll,
  type Poll,
  type PollOptionResult,
} from "@/api/client-polls";

export type PollWsMessage = Extract<
  LiveWsMessage,
  { type: "POLL_OPENED" | "POLL_RESULTS_UPDATED" | "POLL_CLOSED" }
>;

const MAX_OPTIONS = 6;

function ResultsBars({ poll }: { poll: Poll }) {
  return (
    <div className="flex flex-col gap-2">
      {poll.options.map((opt) => {
        const r: PollOptionResult | undefined = poll.results.find((x) => x.optionId === opt.id);
        const pct = Math.round(r?.percentage ?? 0);
        return (
          <div key={opt.id}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-[hsl(var(--foreground))]">{opt.label}</span>
              <span className="text-[hsl(var(--muted-foreground))] tabular-nums">
                {r?.votes ?? 0} · {pct}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
              <div
                className="h-full rounded-full bg-[hsl(var(--primary))] transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
        {poll.totalVotes} vote{poll.totalVotes === 1 ? "" : "s"}
        {poll.status === "OPEN" && poll.closesAt && (
          <> · closes {new Date(poll.closesAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>
        )}
      </p>
    </div>
  );
}

export function PollsPanel({
  eventId,
  polls: pollsFromQuery,
  isLoading,
  readOnly,
  wsMessage,
}: {
  eventId: string;
  polls: Poll[] | undefined;
  isLoading: boolean;
  readOnly: boolean;
  /** Latest POLL_* websocket message, with a monotonically increasing seq. */
  wsMessage: { seq: number; msg: PollWsMessage } | null;
}) {
  const createMutation = useCreatePoll();
  const closeMutation  = useClosePoll();
  const deleteMutation = useDeletePoll();

  // ── Live overlay: patch query snapshot with websocket updates ──
  const [wsPatches, setWsPatches] = useState<Record<string, Partial<Poll>>>({});
  const [wsNewPolls, setWsNewPolls] = useState<Poll[]>([]);

  useEffect(() => {
    if (!wsMessage) return;
    const { msg } = wsMessage;
    if (msg.type === "POLL_OPENED") {
      const p = msg.payload;
      setWsNewPolls((prev) =>
        prev.some((x) => x.id === p.pollId)
          ? prev
          : [...prev, {
              id: p.pollId, question: p.question,
              options: p.options.map((o) => ({ id: String(o.id), label: o.label })),
              status: "OPEN", type: p.type, closesAt: p.closesAt ?? null,
              totalVotes: 0, results: [],
            }]
      );
    } else if (msg.type === "POLL_RESULTS_UPDATED") {
      const p = msg.payload;
      setWsPatches((prev) => ({
        ...prev,
        [p.pollId]: { results: p.results.map((r) => ({ ...r, optionId: String(r.optionId) })), totalVotes: p.totalVotes },
      }));
    } else if (msg.type === "POLL_CLOSED") {
      const p = msg.payload;
      setWsPatches((prev) => ({
        ...prev,
        [p.pollId]: {
          ...prev[p.pollId],
          status: "CLOSED",
          ...(p.finalResults?.length
            ? { results: p.finalResults.map((r) => ({ ...r, optionId: String(r.optionId) })) }
            : {}),
        },
      }));
    }
  }, [wsMessage]);

  const polls: Poll[] = useMemo(() => {
    const base = pollsFromQuery ?? [];
    const merged = [
      ...base,
      // Polls announced over WS that the snapshot doesn't know yet
      ...wsNewPolls.filter((p) => !base.some((b) => b.id === p.id)),
    ].map((p) => (wsPatches[p.id] ? { ...p, ...wsPatches[p.id] } : p));
    return merged;
  }, [pollsFromQuery, wsNewPolls, wsPatches]);

  const openPoll    = polls.find((p) => p.status === "OPEN") ?? null;
  const closedPolls = polls.filter((p) => p.status === "CLOSED");

  // ── Create form state ──
  const [showForm, setShowForm] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions]   = useState<string[]>(["", ""]);
  const [closesAt, setClosesAt] = useState("");

  const validOptions = options.map((o) => o.trim()).filter(Boolean);
  const canSubmit = question.trim().length > 0 && validOptions.length >= 2 && !createMutation.isPending;

  function submit() {
    if (!canSubmit) return;
    createMutation.mutate(
      {
        eventId,
        question: question.trim(),
        options: validOptions,
        ...(closesAt ? { closesAt: new Date(closesAt).toISOString() } : {}),
      },
      {
        onSuccess: () => {
          setShowForm(false);
          setQuestion("");
          setOptions(["", ""]);
          setClosesAt("");
        },
      }
    );
  }

  return (
    <Card className="attend-card">
      <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        <h2 className="font-semibold text-[hsl(var(--foreground))]">Live Polls</h2>
        {openPoll && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" /> OPEN
          </span>
        )}
        {readOnly && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
            <Lock className="h-3 w-3" /> read-only
          </span>
        )}
        {!readOnly && !openPoll && !showForm && (
          <Button size="sm" className="ml-auto h-8 gap-1.5 text-xs" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5" /> New Poll
          </Button>
        )}
      </div>

      <div className="p-5 flex flex-col gap-5">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading polls…
          </div>
        )}

        {/* ── Create form ── */}
        {!readOnly && showForm && !openPoll && (
          <div className="rounded-xl border border-[hsl(var(--border))] p-4 flex flex-col gap-3">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Poll question — e.g. How would you rate today's session?"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
            />
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => setOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
                />
                {options.length > 2 && (
                  <button
                    onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                    className="text-[hsl(var(--muted-foreground))] hover:text-red-500"
                    aria-label={`Remove option ${i + 1}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setOptions((prev) => (prev.length < MAX_OPTIONS ? [...prev, ""] : prev))}
                disabled={options.length >= MAX_OPTIONS}
                className="text-xs text-[hsl(var(--primary))] hover:underline disabled:opacity-50 disabled:no-underline"
              >
                + Add option
              </button>
              <div className="flex items-center gap-2">
                <label className="text-xs text-[hsl(var(--muted-foreground))]">Auto-close</label>
                <input
                  type="datetime-local"
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                  className="px-2 py-1 text-xs rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" disabled={!canSubmit} onClick={submit}>
                {createMutation.isPending ? "Opening…" : "Open Poll"}
              </Button>
            </div>
          </div>
        )}

        {/* ── Open poll — live results ── */}
        {openPoll && (
          <div className="rounded-xl border border-green-300/60 bg-green-50/40 dark:bg-green-950/10 p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{openPoll.question}</p>
              {!readOnly && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  disabled={closeMutation.isPending}
                  onClick={() => closeMutation.mutate({ eventId, pollId: openPoll.id })}
                >
                  {closeMutation.isPending ? "Closing…" : "Close Poll"}
                </Button>
              )}
            </div>
            <ResultsBars poll={openPoll} />
          </div>
        )}

        {/* ── Empty state ── */}
        {!isLoading && !openPoll && !showForm && closedPolls.length === 0 && (
          <p className="text-sm text-[hsl(var(--muted-foreground))] text-center italic py-2">
            No polls yet{readOnly ? "." : " — open one to engage your audience."}
          </p>
        )}

        {/* ── History ── */}
        {closedPolls.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              Closed polls
            </p>
            {closedPolls.map((p) => (
              <div key={p.id} className="rounded-xl border border-[hsl(var(--border))] p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <p className="text-sm font-medium text-[hsl(var(--foreground))]">{p.question}</p>
                  {!readOnly && p.totalVotes === 0 && (
                    <button
                      onClick={() => deleteMutation.mutate({ eventId, pollId: p.id })}
                      disabled={deleteMutation.isPending}
                      className="text-[hsl(var(--muted-foreground))] hover:text-red-500 shrink-0"
                      title="Delete poll (no votes recorded)"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <ResultsBars poll={p} />
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
