"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { Radio, UserCheck, ChevronRight, Pencil } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useLiveRoomDetail,
  useLiveAttendance,
  useApproveQuestion,
  useRejectQuestion,
  useAnswerQuestion,
  liveKeys,
  type LiveQuestion,
} from "@/api/client-live";
import { useLiveWebSocket, type LiveWsMessage } from "@/hooks/use-live-websocket";
import { useClientEventDetail, useUpdateStreamUrl, clientEventKeys, type ZoomMeetingDto } from "@/api/client-events";
import { useGetMe } from "@/api/auth/hooks";
import { useEventPolls, useAdminEventPolls } from "@/api/client-polls";
import { resolveRole, isSuperAdminRole } from "@/lib/utils";
import type { ZoomEmbedHandle } from "@/components/zoom-embed";
import { eventColor, formatTime, initials, playChime } from "./helpers";
import { parseStreamUrl } from "./stream-helpers";
import { LiveHeaderCard } from "./LiveHeaderCard";
import { ZoomMeetingCard } from "./ZoomMeetingCard";
import { StreamPreviewCard } from "./StreamPreviewCard";
import { ResolutionsPanel } from "./ResolutionsPanel";
import { PollsPanel, type PollWsMessage } from "./PollsPanel";
import { QAPanel } from "./QAPanel";

export function SessionDetail({ eventId, onBack }: { eventId: string; onBack: () => void }) {
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

  const queryClient = useQueryClient();
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
  const isSuperAdmin = isSuperAdminRole(resolveRole(meData?.data));

  // ── Live polls (F1) — super admin reads the /admin endpoint, read-only ──
  const clientPolls = useEventPolls(eventId, { enabled: !isSuperAdmin });
  const adminPolls  = useAdminEventPolls(eventId, { enabled: isSuperAdmin });
  const pollsQuery  = isSuperAdmin ? adminPolls : clientPolls;
  // Latest POLL_* websocket message, seq-stamped so PollsPanel never misses repeats
  const [pollWsMessage, setPollWsMessage] = useState<{ seq: number; msg: PollWsMessage } | null>(null);
  const pollWsSeq = useRef(0);

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
    } else if (
      msg.type === "POLL_OPENED" ||
      msg.type === "POLL_RESULTS_UPDATED" ||
      msg.type === "POLL_CLOSED"
    ) {
      pollWsSeq.current += 1;
      setPollWsMessage({ seq: pollWsSeq.current, msg });
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

      <LiveHeaderCard room={room} color={color} />

      {/* Zoom Meeting — full width */}
      {hasZoomMeeting && zoomMeeting && (
        <ZoomMeetingCard
          zoomMeeting={zoomMeeting}
          zak={zak}
          eventId={eventId}
          hostName={hostName}
          zoomEmbedRef={zoomEmbedRef}
          zoomToasts={zoomToasts}
          // The backend may ROTATE the meeting (new meetingId/joinUrl) when
          // the embed refreshes an expired ZAK. Invalidate everything holding
          // zoomMeeting/streamUrl so the card header, joinUrl and attendee
          // link reflect the meeting the host actually joined — previously
          // this drift was only resolved by a full page reload.
          onMeetingRefreshed={() => {
            queryClient.invalidateQueries({ queryKey: liveKeys.detail(eventId) });
            queryClient.invalidateQueries({ queryKey: clientEventKeys.detail(eventId) });
          }}
        />
      )}

      {/* Stream preview — only for virtual / hybrid events without a native Zoom meeting */}
      {isStreaming && !hasZoomMeeting && (
        <StreamPreviewCard
          color={color}
          eventType={room.eventType}
          streamUrl={streamUrl}
          streamInput={streamInput}
          setStreamInput={setStreamInput}
          streamSaved={streamSaved}
          applyStream={applyStream}
          updateStreamUrlMutation={updateStreamUrlMutation}
          hostName={hostName}
        />
      )}

      {/* Content grid */}
      <div className="grid grid-cols-3 gap-5">
        {/* Left: Resolutions + Live Polls */}
        <div className="col-span-2 flex flex-col gap-5">
          <ResolutionsPanel resolutions={room.resolutions} color={color} eventId={eventId} />
          <PollsPanel
            eventId={eventId}
            polls={pollsQuery.data}
            isLoading={pollsQuery.isLoading}
            readOnly={isSuperAdmin}
            wsMessage={pollWsMessage}
          />
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
