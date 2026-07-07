"use client";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ZoomEmbed, { type ZoomEmbedHandle } from "@/components/zoom-embed";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import {
  Check, X, Users, Vote, MessageSquare, UserCheck, Clock,
  Wifi, Radio, Building2, Tv2, Link2, ShieldCheck, CheckCircle2,
  ChevronRight, ExternalLink, Pencil,
} from "lucide-react";
import {
  useLiveRoomDetail,
  useLiveAttendance,
  useApproveQuestion,
  useRejectQuestion,
  useAnswerQuestion,
  type LiveResolution,
  type LiveQuestion,
} from "@/api/client-live";
import { useLiveWebSocket, type LiveWsMessage } from "@/hooks/use-live-websocket";
import { useOpenResolutionVoting, useCloseResolutionVoting } from "@/api/client-votes";
import { useClientEvents, useUpdateStreamUrl, useClientEventDetail, type ZoomMeetingDto } from "@/api/client-events";
import { toEventModule, MODULE_COLORS } from "@/lib/event-module";
import { useGetMe } from "@/api/auth/hooks";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function eventColor(eventType?: string | null): string {
  return MODULE_COLORS[toEventModule(eventType)];
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// ── Vote bar ──────────────────────────────────────────────────────────────────

function VoteBar({
  label, value, total, color,
}: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-[hsl(var(--muted-foreground))] w-16 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-sm font-semibold tabular-nums w-10 text-right">{pct}%</span>
      <span className="text-sm text-[hsl(var(--muted-foreground))] tabular-nums w-20 text-right">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

// ── Resolutions panel ─────────────────────────────────────────────────────────

function ResolutionsPanel({
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

// ── Stream helpers ────────────────────────────────────────────────────────────

function isZoomUrl(url: string) {
  return /zoom\.us\/j\/|zoomus\.cn\/j\//.test(url);
}

function isGoogleMeetUrl(url: string) {
  return /meet\.google\.com\//.test(url);
}

function parseStreamUrl(url: string): string {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/))([A-Za-z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=0&controls=1&rel=0&modestbranding=1`;
  return url;
}

// ── Q&A Panel ─────────────────────────────────────────────────────────────────

function QAPanel({
  questions,
  qaBadgeFlash,
  eventId,
  approveMutation,
  rejectMutation,
  answerMutation,
  onStatusChange,
}: {
  questions:      LiveQuestion[];
  qaBadgeFlash:   boolean;
  eventId:        string;
  approveMutation: ReturnType<typeof useApproveQuestion>;
  rejectMutation:  ReturnType<typeof useRejectQuestion>;
  answerMutation:  ReturnType<typeof useAnswerQuestion>;
  onStatusChange?: (questionId: string, status: LiveQuestion["status"]) => void;
}) {
  const [answerDraft, setAnswerDraft] = useState<Record<string, string>>({});

  const pending  = questions.filter((q) => q.status === "PENDING");
  const approved = questions.filter((q) => q.status === "APPROVED");
  const answered = questions.filter((q) => q.status === "ANSWERED");

  return (
    <Card className="attend-card overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2 shrink-0">
        <MessageSquare className={`h-4 w-4 transition-colors ${qaBadgeFlash ? "text-red-500" : "text-[hsl(var(--muted-foreground))]"}`} />
        <h2 className="font-semibold text-[hsl(var(--foreground))]">Q&amp;A</h2>
        {pending.length > 0 && (
          <span className={`ml-auto text-xs rounded-full px-2 py-0.5 font-semibold transition-all duration-300 ${
            qaBadgeFlash ? "bg-red-500 text-white animate-pulse" : "bg-amber-100 text-amber-700"
          }`}>
            {pending.length} pending
          </span>
        )}
      </div>

      <div className="overflow-y-auto flex-1">

        {/* ── Moderation queue ── */}
        {pending.length > 0 && (
          <div>
            <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-600" />
              <span className="text-xs font-semibold text-amber-700">Awaiting moderation ({pending.length})</span>
            </div>
            <div className="divide-y divide-[hsl(var(--border))]">
              {pending.map((q) => (
                <div key={q.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-[hsl(var(--foreground))]">
                      {q.anonymous ? "Anonymous" : q.askerName}
                    </span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatTime(q.submittedAt)}</span>
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3 leading-relaxed">{q.content}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 text-xs flex-1 gap-1 bg-green-600 hover:bg-green-700 text-white"
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      onClick={() => approveMutation.mutate(
                        { eventId, questionId: q.id },
                        { onSuccess: () => onStatusChange?.(q.id, "APPROVED") }
                      )}
                    >
                      <Check className="h-3 w-3" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs flex-1 gap-1 text-red-600 border-red-200 hover:bg-red-50"
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      onClick={() => rejectMutation.mutate(
                        { eventId, questionId: q.id },
                        { onSuccess: () => onStatusChange?.(q.id, "REJECTED") }
                      )}
                    >
                      <X className="h-3 w-3" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Approved — awaiting answer ── */}
        {approved.length > 0 && (
          <div>
            <div className="px-5 py-2 bg-blue-50 border-t border-b border-blue-100 flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-xs font-semibold text-blue-700">Approved — answer these ({approved.length})</span>
            </div>
            <div className="divide-y divide-[hsl(var(--border))]">
              {approved.map((q) => (
                <div key={q.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-[hsl(var(--foreground))]">
                      {q.anonymous ? "Anonymous" : q.askerName}
                    </span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatTime(q.submittedAt)}</span>
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3 leading-relaxed">{q.content}</p>
                  <div className="flex flex-col gap-2">
                    <textarea
                      rows={2}
                      value={answerDraft[q.id] ?? ""}
                      onChange={(e) => setAnswerDraft((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder="Type your answer…"
                      className="w-full text-xs rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
                    />
                    <Button
                      size="sm"
                      className="h-7 text-xs self-end gap-1"
                      disabled={!answerDraft[q.id]?.trim() || answerMutation.isPending}
                      onClick={() =>
                        answerMutation.mutate(
                          { eventId, questionId: q.id, answer: answerDraft[q.id]!.trim() },
                          { onSuccess: () => setAnswerDraft((prev) => { const n = { ...prev }; delete n[q.id]; return n; }) }
                        )
                      }
                    >
                      <Check className="h-3 w-3" /> Post Answer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Answered ── */}
        {answered.length > 0 && (
          <div>
            <div className="px-5 py-2 bg-green-50 border-t border-green-100 flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-green-600" />
              <span className="text-xs font-semibold text-green-700">Answered ({answered.length})</span>
            </div>
            <div className="divide-y divide-[hsl(var(--border))]">
              {answered.map((q) => (
                <div key={q.id} className="px-5 py-3 bg-green-50/30">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-[hsl(var(--foreground))]">
                      {q.anonymous ? "Anonymous" : q.askerName}
                    </span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatTime(q.submittedAt)}</span>
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2 leading-relaxed">{q.content}</p>
                  <div className="rounded-lg bg-green-100/60 border border-green-200 px-3 py-2">
                    <p className="text-xs font-semibold text-green-800 mb-0.5">
                      {q.answeredBy ?? "Host"}{q.answeredAt ? ` · ${formatTime(q.answeredAt)}` : ""}
                    </p>
                    <p className="text-xs text-green-900 leading-relaxed">{q.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {questions.length === 0 && (
          <p className="px-5 py-8 text-sm text-[hsl(var(--muted-foreground))] text-center italic">
            No questions yet.
          </p>
        )}
      </div>
    </Card>
  );
}

// ── Session detail ─────────────────────────────────────────────────────────────

// ── Chime helper (Web Audio API — no audio file required) ────────────────────
function playChime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
    osc.onended = () => ctx.close();
  } catch {
    // AudioContext blocked (e.g. no user gesture yet) — fail silently
  }
}

function SessionDetail({ eventId, onBack }: { eventId: string; onBack: () => void }) {
  const [streamInput, setStreamInput] = useState("");
  const [streamUrl,   setStreamUrl]   = useState("");
  const [streamSaved, setStreamSaved] = useState(false);
  // Local questions state — seeded from server snapshot, kept live by WS
  const [questions, setQuestions] = useState<LiveQuestion[]>([]);
  // Flash the Q&A badge when new PENDING questions arrive
  const [qaBadgeFlash, setQaBadgeFlash] = useState(false);
  const prevPendingCount = useRef<number | null>(null);
  // Ref to ZoomEmbed (reserved for future SDK chat integration)
  const zoomEmbedRef = useRef<ZoomEmbedHandle>(null);
  // Floating Q&A toasts overlaid on the Zoom panel
  const [zoomToasts, setZoomToasts] = useState<{ id: string; name: string; text: string }[]>([]);

  const { data: room, isLoading } = useLiveRoomDetail(eventId);
  // Prefer zoom meeting data from the live-room snapshot (no extra network call).
  // Fall back to the full event detail only when the live snapshot doesn't include it.
  const roomHasZoom = !!room?.zoomMeeting?.meetingId;
  const { data: eventDetail } = useClientEventDetail(eventId ?? "", {
    enabled: !!eventId && !roomHasZoom,
  });
  const zoomMeeting: ZoomMeetingDto | null =
    (room?.zoomMeeting ?? (eventDetail as any)?.zoomMeeting) ?? null;
  const { data: attendance = []  } = useLiveAttendance(eventId);
  const approveMutation            = useApproveQuestion();
  const rejectMutation             = useRejectQuestion();
  const answerMutation             = useAnswerQuestion();
  const updateStreamUrlMutation    = useUpdateStreamUrl();
  const { data: meData           } = useGetMe();
  const hostName = meData?.data?.fullName ?? meData?.data?.firstName ?? "Host";

  // Seed local questions from server snapshot (merge so WS additions aren't lost)
  useEffect(() => {
    if (room?.questions) {
      setQuestions((prev) => {
        const byId = new Map(prev.map((q) => [q.id, q]));
        for (const q of room.questions) byId.set(q.id, { ...byId.get(q.id), ...q });
        return Array.from(byId.values());
      });
    }
  }, [room?.questions]);

  // Real-time updates via WebSocket
  useLiveWebSocket(eventId, (msg: LiveWsMessage) => {
    if (msg.type === "QUESTION_SUBMITTED") {
      const { questionId, content, askerName, anonymous, submittedAt } = msg.payload;
      setQuestions((prev) => {
        if (prev.find((q) => q.id === questionId)) return prev;
        playChime();
        setQaBadgeFlash(true);
        setTimeout(() => setQaBadgeFlash(false), 2000);
        // Show a floating toast on the Zoom panel so the host sees the question while in-call
        const displayName = anonymous ? "Anonymous" : (askerName || "Attendee");
        zoomEmbedRef.current?.sendChat(`[Q&A] ${displayName}: ${content}`);
        setZoomToasts((prev) => [...prev, { id: questionId, name: displayName, text: content }]);
        setTimeout(() => setZoomToasts((prev) => prev.filter((t) => t.id !== questionId)), 8000);
        return [...prev, {
          id: questionId, content, askerName,
          anonymous: anonymous ?? false,
          submittedAt: submittedAt ?? new Date().toISOString(),
          status: "PENDING",
        }];
      });
    } else if (msg.type === "QUESTION_MODERATED") {
      const { questionId, status } = msg.payload;
      setQuestions((prev) => prev.map((q) => q.id === questionId ? { ...q, status } : q));
    } else if (msg.type === "QUESTION_ANSWERED") {
      const { questionId, status, answer, answeredBy, answeredAt } = msg.payload;
      setQuestions((prev) =>
        prev.map((q) => q.id === questionId ? { ...q, status, answer, answeredBy, answeredAt } : q)
      );
    }
  });

  // Initialise stream URL — prefer live room data, fall back to event detail
  const rawStreamUrl = room?.streamUrl ?? (eventDetail as any)?.streamUrl ?? "";
  useEffect(() => {
    if (rawStreamUrl && !streamUrl) {
      const parsed = parseStreamUrl(rawStreamUrl);
      setStreamUrl(parsed);
      setStreamInput(rawStreamUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawStreamUrl]);

  // Flash badge on new pending from polling (fallback when WS not connected)
  const currentPending = questions.filter((q) => q.status === "PENDING").length;
  useEffect(() => {
    if (prevPendingCount.current !== null && currentPending > prevPendingCount.current) {
      playChime();
      setQaBadgeFlash(true);
      const t = setTimeout(() => setQaBadgeFlash(false), 2000);
      return () => clearTimeout(t);
    }
    prevPendingCount.current = currentPending;
  }, [currentPending]);

  if (isLoading) return <Loader variant="page" text="Loading live room…" />;

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Radio className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Could not load live room data.</p>
        <Button size="sm" variant="outline" onClick={onBack}>Go back</Button>
      </div>
    );
  }

  const color           = eventColor(room.eventType);
  const recentAtt       = attendance.length > 0 ? attendance : (room.recentAttendance ?? []);
  const isStreaming     = room.format?.toLowerCase() !== "in_person";
  const hasZoomMeeting  = !!zoomMeeting?.meetingId;
  const zak             = zoomMeeting?.startUrl ? (() => {
    try { return new URL(zoomMeeting.startUrl).searchParams.get("zak") ?? ""; } catch { return ""; }
  })() : "";

  function applyStream() {
    if (!room) return;
    const parsed = parseStreamUrl(streamInput);
    setStreamUrl(parsed);
    setStreamSaved(false);
    // Use the dedicated stream-url endpoint — works even while the event is LIVE
    if (streamInput.trim()) {
      updateStreamUrlMutation.mutate(
        { eventId: room.eventId, streamUrl: streamInput.trim() },
        { onSuccess: () => setStreamSaved(true) }
      );
    }
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Back + edit */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
            Back to Live Sessions
          </button>
          <Link href={`/events/${room.eventId}`}>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Pencil className="h-3.5 w-3.5" /> Edit Event
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{room.organiserName}</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-600">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </span>
        </div>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{room.title}</p>
      </div>

      {/* Gradient header card */}
      <div
        className="rounded-2xl p-5 text-white"
        style={{ background: `linear-gradient(135deg, ${color}ee, ${color}bb)` }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 opacity-70" />
              <span className="text-sm font-medium opacity-80">{room.organiserName}</span>
              <span className="text-xs bg-white/20 rounded-full px-2 py-0.5 font-semibold uppercase tracking-wide">
                {room.eventType}
              </span>
            </div>
            <h2 className="text-lg font-bold leading-snug">{room.title}</h2>
            <p className="text-sm opacity-70 mt-1">
              {[room.venue, room.format].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-white/15 rounded-xl px-3 py-2 shrink-0">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            <span className="text-sm font-bold">LIVE</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          {[
            {
              icon:  Users,
              label: "Attendees",
              value: room.attendeeCount.toLocaleString(),
              sub:   room.capacity ? `of ${room.capacity.toLocaleString()} cap` : "connected",
            },
            {
              icon:  UserCheck,
              label: "Checked In",
              value: room.checkedInCount.toLocaleString(),
              sub:   room.attendeeCount > 0
                ? `${Math.round((room.checkedInCount / room.attendeeCount) * 100)}% of attendees`
                : "check-ins",
            },
            {
              icon:  Vote,
              label: "Resolutions",
              value: room.resolutions.length > 0
                ? `${room.resolutions.filter((r) => r.status === "CLOSED").length} / ${room.resolutions.length}`
                : "—",
              sub:   room.resolutions.length > 0 ? "closed" : "no votes",
            },
            {
              icon:  Clock,
              label: "Elapsed",
              value: formatElapsed(room.elapsedMinutes),
              sub:   "session time",
            },
          ].map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="bg-white/15 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className="h-3.5 w-3.5 opacity-70" />
                <span className="text-xs font-medium opacity-70">{label}</span>
              </div>
              <div className="text-xl font-bold tabular-nums">{value}</div>
              <div className="text-xs opacity-60 mt-0.5">{sub}</div>
            </div>
          ))}
        </div>

        {/* Quorum bar (AGM only) */}
        {room.quorumPct != null && (
          <div className="mt-4 bg-white/10 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2 text-xs font-medium opacity-80">
              <span>Quorum Progress</span>
              <span className="tabular-nums">
                {room.quorumPct}%
                {room.requiredQuorumPct != null && ` / ${room.requiredQuorumPct}% required`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(room.quorumPct, 100)}%`,
                  backgroundColor:
                    room.requiredQuorumPct != null && room.quorumPct >= room.requiredQuorumPct
                      ? "#4ade80"
                      : "#fbbf24",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Zoom Meeting — full width */}
      {hasZoomMeeting && (
        <Card className="attend-card">
          <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
            <svg viewBox="0 0 40 40" className="h-4 w-4 shrink-0" fill="none">
              <rect width="40" height="40" rx="8" fill="#0B5CFF"/>
              <path d="M7 14a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v5.5l6-4v9l-6-4V26a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3V14z" fill="white"/>
            </svg>
            <h2 className="font-semibold text-[hsl(var(--foreground))]">Zoom Meeting</h2>
            <span className="text-xs text-[hsl(var(--muted-foreground))] ml-1">#{zoomMeeting!.meetingId}</span>
            <div className="ml-auto flex items-center gap-2">
              <a
                href={zoomMeeting!.joinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:underline"
              >
                <ExternalLink className="h-3 w-3" /> Open in Zoom
              </a>
            </div>
          </div>
          <div className="relative overflow-visible">
            <ZoomEmbed
              ref={zoomEmbedRef}
              meetingNumber={zoomMeeting!.meetingId}
              password={zoomMeeting!.password}
              zak={zak}
              eventId={eventId}
              userName={hostName}
              height={640}
            />
            {/* Q&A toasts — float over the meeting when new questions arrive */}
            {zoomToasts.length > 0 && (
              <div className="absolute bottom-12 left-3 right-3 z-50 flex flex-col gap-2 pointer-events-none">
                {zoomToasts.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-start gap-2.5 rounded-xl bg-black/80 backdrop-blur-sm border border-white/10 px-3.5 py-2.5 shadow-lg animate-in slide-in-from-bottom-2 duration-300"
                  >
                    <div className="h-5 w-5 rounded-full bg-[#0B5CFF] flex items-center justify-center shrink-0 mt-0.5">
                      <MessageSquare className="h-3 w-3 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white leading-none mb-1">{t.name}</p>
                      <p className="text-xs text-gray-300 leading-snug line-clamp-2">{t.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Stream preview — only for virtual / hybrid events without a native Zoom meeting */}
      {isStreaming && !hasZoomMeeting && <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
          <Tv2 className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Stream Preview</h2>
          <span
            className="ml-auto text-xs font-semibold px-2.5 py-0.5 rounded-full"
            style={{ backgroundColor: color + "18", color }}
          >
            {room.eventType}
          </span>
        </div>
        <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
          {streamUrl ? (
            isZoomUrl(streamUrl) ? (
              <ZoomEmbed streamUrl={streamUrl} userName={hostName} height={480} />
            ) : isGoogleMeetUrl(streamUrl) ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="rounded-2xl bg-[#1A73E8]/15 p-4">
                  {/* Google Meet icon */}
                  <svg viewBox="0 0 40 40" className="h-10 w-10" fill="none">
                    <rect width="40" height="40" rx="8" fill="#1A73E8"/>
                    <path d="M23 20c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3z" fill="white"/>
                    <path d="M28 15l-5 3.5V15h-9a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h9v-3.5l5 3.5V15z" fill="white"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Google Meet</p>
                  <p className="text-xs text-gray-400 mt-1">Cannot be previewed inline. Use the Q&amp;A panel to manage attendee questions.</p>
                </div>
                <a
                  href={streamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1A73E8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1A73E8]/90"
                >
                  <ExternalLink className="h-4 w-4" /> Join Google Meet
                </a>
              </div>
            ) : (
              <iframe
                key={streamUrl}
                src={streamUrl}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Tv2 className="h-12 w-12 text-gray-600" />
              <p className="text-sm text-gray-400">No stream configured</p>
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-[hsl(var(--border))]">
          <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-2 uppercase tracking-wide">
            Stream URL
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <input
                type="text"
                value={streamInput}
                onChange={(e) => setStreamInput(e.target.value)}
                placeholder="Paste YouTube, Zoom, or Google Meet URL…"
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
                onKeyDown={(e) => e.key === "Enter" && applyStream()}
              />
            </div>
            <Button
              size="sm"
              onClick={applyStream}
              disabled={updateStreamUrlMutation.isPending}
              className="px-4 shrink-0"
            >
              {updateStreamUrlMutation.isPending ? "Saving…" : streamSaved ? "Saved ✓" : "Apply"}
            </Button>
          </div>
          {streamSaved && (
            <p className="text-xs text-green-600 mt-1.5">Stream URL saved — all viewers will see this link.</p>
          )}
        </div>
      </Card>}

      {/* Content grid */}
      <div className="grid grid-cols-3 gap-5">
        {/* Left: Resolutions */}
        <div className="col-span-2">
          <ResolutionsPanel resolutions={room.resolutions} color={color} eventId={eventId} />
        </div>

        {/* Right: Q&A + Attendance */}
        <div className="col-span-1 flex flex-col gap-5">

          <QAPanel
            questions={questions}
            qaBadgeFlash={qaBadgeFlash}
            eventId={eventId}
            approveMutation={approveMutation}
            rejectMutation={rejectMutation}
            answerMutation={answerMutation}
            onStatusChange={(questionId, status) =>
              setQuestions((prev) =>
                prev.map((q) => q.id === questionId ? { ...q, status } : q)
              )
            }
          />

          {/* Attendance log */}
          <Card className="attend-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Recent Check-ins</h2>
              <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">live</span>
            </div>
            <div className="divide-y divide-[hsl(var(--border))]">
              {recentAtt.length === 0 ? (
                <p className="px-5 py-6 text-sm text-[hsl(var(--muted-foreground))] text-center italic">
                  No recent check-ins.
                </p>
              ) : recentAtt.map((entry, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {entry.initials || initials(entry.name)}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[hsl(var(--foreground))]">{entry.name}</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))] capitalize">{entry.mode}</div>
                    </div>
                  </div>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatTime(entry.joinedAt)}</span>
                </div>
              ))}
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}

// ── Session list ──────────────────────────────────────────────────────────────

function SessionList({ onSelect }: { onSelect: (eventId: string) => void }) {
  const { data, isLoading } = useClientEvents("ALL", 0, 100);
  const sessions = (data?.events ?? []).filter((e) => e.status?.toLowerCase() === "live");

  if (isLoading) return <Loader variant="page" text="Loading live sessions…" />;

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Radio className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">No live sessions at the moment.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Live Control Room</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-600">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              {sessions.length} LIVE
            </span>
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Select an event to open its control room
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active Sessions", value: sessions.length,                                               icon: Radio,  color: "#dc2626" },
          { label: "AGM/EGM Events",  value: sessions.filter((s) => s.eventType?.includes("AGM")).length,  icon: Vote,   color: "#7c22c9" },
          { label: "Other Events",    value: sessions.filter((s) => !s.eventType?.includes("AGM")).length, icon: Users,  color: "#0891b2" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="attend-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}18` }}>
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <div>
              <p className="text-lg font-bold text-[hsl(var(--foreground))]">{value}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Live Events</h2>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{sessions.length} sessions running</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left">Event</th>
                <th className="px-5 py-3 text-left">Type</th>
                <th className="px-5 py-3 text-left">Format</th>
                <th className="px-5 py-3 text-right">RSVP</th>
                <th className="px-5 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((sess) => {
                const color = eventColor(sess.eventType);
                return (
                  <tr key={sess.id} className="attend-table-row">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-9 w-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: color }}
                        >
                          {initials(sess.registerName ?? sess.title)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate max-w-[220px]">
                            {sess.title}
                          </p>
                          {sess.registerName && (
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">{sess.registerName}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: color }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                        {sess.eventType}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-[hsl(var(--foreground))] capitalize">
                        {sess.format?.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Users className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                        <span className="text-sm font-semibold tabular-nums">{sess.rsvpCount.toLocaleString()}</span>
                        {sess.capacity > 0 && (
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">/ {sess.capacity.toLocaleString()}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Button
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => onSelect(sess.id)}
                      >
                        Manage <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LiveControlPage() {
  const searchParams                           = useSearchParams();
  const urlEventId                             = searchParams.get("eventId");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(urlEventId);

  // If the URL param changes (e.g. back-button then new link), sync state
  useEffect(() => {
    if (urlEventId) setSelectedEventId(urlEventId);
  }, [urlEventId]);

  if (selectedEventId) {
    return (
      <SessionDetail
        eventId={selectedEventId}
        onBack={() => setSelectedEventId(null)}
      />
    );
  }

  return <SessionList onSelect={setSelectedEventId} />;
}
