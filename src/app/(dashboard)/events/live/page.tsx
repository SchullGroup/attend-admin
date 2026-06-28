"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
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
  type LiveResolution,
  type LivePendingQuestion,
} from "@/api/client-live";
import { useOpenResolutionVoting, useCloseResolutionVoting } from "@/api/client-votes";
import { useClientEvents, useUpdateEvent, useClientEventDetail } from "@/api/client-events";

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

const MODULE_COLORS: Record<string, string> = {
  AGM:                  "#7c22c9",
  AGM_EGM:              "#7c22c9",
  LAUNCH:               "#ea6c00",
  PRODUCT_LAUNCH:       "#ea6c00",
  HACKATHON:            "#7c22c9",
  INNOVATION_CHALLENGE: "#7c22c9",
  GENERAL:              "#0891b2",
  GENERAL_EVENT:        "#0891b2",
};

function eventColor(eventType: string) {
  return MODULE_COLORS[eventType] ?? "#7c22c9";
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

  const closed = resolutions.filter((r) => r.status === "CLOSED").length;

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
          const total     = res.forCount + res.againstCount + res.abstainCount;
          const isPending = res.status === "PENDING";
          const isOpen    = res.status === "OPEN";
          const isClosed  = res.status === "CLOSED";
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

function parseStreamUrl(url: string): string {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/))([A-Za-z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=0&controls=1&rel=0&modestbranding=1`;
  return url;
}

// ── Session detail ─────────────────────────────────────────────────────────────

function SessionDetail({ eventId, onBack }: { eventId: string; onBack: () => void }) {
  const [streamInput, setStreamInput] = useState("");
  const [streamUrl,   setStreamUrl]   = useState("");
  const [streamSaved, setStreamSaved] = useState(false);
  // Keep approved questions visible after approval (they leave the pending list on refetch)
  const [approvedQuestions, setApprovedQuestions] = useState<LivePendingQuestion[]>([]);

  const { data: room, isLoading } = useLiveRoomDetail(eventId);
  const { data: eventDetail      } = useClientEventDetail(eventId ?? "", { enabled: !!eventId });
  const { data: attendance = []  } = useLiveAttendance(eventId);
  const approveMutation            = useApproveQuestion();
  const rejectMutation             = useRejectQuestion();
  const updateEventMutation        = useUpdateEvent();

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

  const color       = eventColor(room.eventType);
  const pending     = room.pendingQuestions ?? [];
  const recentAtt   = attendance.length > 0 ? attendance : (room.recentAttendance ?? []);
  const isStreaming = room.format?.toLowerCase() !== "in_person";

  function applyStream() {
    if (!room) return;
    const parsed = parseStreamUrl(streamInput);
    setStreamUrl(parsed);
    setStreamSaved(false);
    // Persist new URL to backend so all viewers see it
    if (streamInput.trim()) {
      updateEventMutation.mutate(
        { id: room.eventId, data: { streamUrl: streamInput.trim() } },
        {
          onSuccess: () => setStreamSaved(true),
        }
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

      {/* Stream preview — only for virtual / hybrid events */}
      {isStreaming && <Card className="attend-card overflow-hidden">
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
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="rounded-2xl bg-[#0B5CFF]/15 p-4">
                  <svg viewBox="0 0 40 40" className="h-10 w-10 fill-[#0B5CFF]">
                    <path d="M20 0C8.954 0 0 8.954 0 20s8.954 20 20 20 20-8.954 20-20S31.046 0 20 0zm9.714 25.714a1.429 1.429 0 0 1-1.428 1.429H9.286a1.429 1.429 0 0 1-1.429-1.429V16.43a1.429 1.429 0 0 1 1.429-1.429h2.857v5.714l5-3.571v7.142l-5-3.571v2.857h11.428v-8.571h2.143v8.714zm-2.857-12.857a2.857 2.857 0 1 1-5.714 0 2.857 2.857 0 0 1 5.714 0z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Zoom Meeting</p>
                  <p className="text-xs text-gray-400 mt-1">Cannot be previewed inline.</p>
                </div>
                <a
                  href={streamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0B5CFF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0B5CFF]/90"
                >
                  <ExternalLink className="h-4 w-4" /> Join Zoom Meeting
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
                placeholder="Paste YouTube or Zoom URL…"
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
                onKeyDown={(e) => e.key === "Enter" && applyStream()}
              />
            </div>
            <Button
              size="sm"
              onClick={applyStream}
              disabled={updateEventMutation.isPending}
              className="px-4 shrink-0"
            >
              {updateEventMutation.isPending ? "Saving…" : streamSaved ? "Saved ✓" : "Apply"}
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

          {/* Q&A Queue */}
          <Card className="attend-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Q&amp;A Queue</h2>
              <span className="ml-auto text-xs bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] rounded-full px-2 py-0.5 font-semibold">
                {pending.length} pending
              </span>
            </div>
            <div className="divide-y divide-[hsl(var(--border))]">
              {pending.length === 0 ? (
                <p className="px-5 py-6 text-sm text-[hsl(var(--muted-foreground))] text-center italic">
                  No pending questions.
                </p>
              ) : pending.map((q) => (
                <div key={q.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-[hsl(var(--foreground))]">
                      {q.anonymous ? "Anonymous" : q.askerName}
                    </span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      {formatTime(q.submittedAt)}
                    </span>
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3 leading-relaxed">
                    {q.content}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 text-xs flex-1 gap-1"
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      onClick={() =>
                        approveMutation.mutate(
                          { eventId, questionId: q.id },
                          { onSuccess: () => setApprovedQuestions((prev) => [...prev, q]) }
                        )
                      }
                    >
                      <Check className="h-3 w-3" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs flex-1 gap-1 text-red-600 border-red-200 hover:bg-red-50"
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      onClick={() => rejectMutation.mutate({ eventId, questionId: q.id })}
                    >
                      <X className="h-3 w-3" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Approved questions — stay visible after approval */}
            {approvedQuestions.length > 0 && (
              <>
                <div className="px-5 py-2.5 bg-green-50 border-t border-green-100 flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-xs font-semibold text-green-700">Approved ({approvedQuestions.length})</span>
                </div>
                <div className="divide-y divide-[hsl(var(--border))]">
                  {approvedQuestions.map((q) => (
                    <div key={q.id} className="px-5 py-3 bg-green-50/40">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-[hsl(var(--foreground))]">
                          {q.anonymous ? "Anonymous" : q.askerName}
                        </span>
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatTime(q.submittedAt)}</span>
                      </div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{q.content}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

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
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

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
