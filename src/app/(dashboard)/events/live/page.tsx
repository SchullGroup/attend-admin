"use client";
import { useState, useEffect, useRef } from "react";
import { useEvents, useEventDetail, useGoLive, useEndEvent, useCancelEvent } from "@/api/super-admin";
import { useQueryClient } from "@tanstack/react-query";
import { Loader } from "@/components/ui/Loader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/custom/status-badge";
import { toast } from "sonner";
import {
  Check,
  X,
  Users,
  Vote,
  MessageSquare,
  UserCheck,
  Clock,
  Wifi,
  Radio,
  Building2,
  Tv2,
  Link2,
  ListOrdered,
  BarChart2,
  Trophy,
  Package,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import type { LiveSession, LivePoll, EventModule } from "@/types/mock";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

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
      <span className="text-sm text-[hsl(var(--muted-foreground))] w-16 shrink-0">
        {label}
      </span>
      <div className="flex-1 h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-sm font-semibold tabular-nums w-10 text-right">
        {pct}%
      </span>
      <span className="text-sm text-[hsl(var(--muted-foreground))] tabular-nums w-20 text-right">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

// ── Poll option bar ───────────────────────────────────────────────────────────

function PollOptionBar({
  text,
  votes,
  total,
  color,
}: {
  text: string;
  votes: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[hsl(var(--foreground))] font-medium truncate max-w-[70%]">
          {text}
        </span>
        <span className="text-[hsl(var(--muted-foreground))] tabular-nums font-semibold">
          {pct}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums">
        {votes.toLocaleString()} votes
      </span>
    </div>
  );
}

// ── Session tab pill ──────────────────────────────────────────────────────────

function SessionTab({
  session,
  active,
  onClick,
}: {
  session: LiveSession;
  active: boolean;
  onClick: () => void;
}) {
  const isLive = session.status === "LIVE";
  const dotColor = isLive 
    ? (active ? "#ffffff" : "#dc2626") 
    : (active ? "#ffffff" : "#94a3b8");

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border whitespace-nowrap ${
        active
          ? "text-white shadow-sm border-transparent"
          : "bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:border-[hsl(var(--foreground)/0.2)] hover:text-[hsl(var(--foreground))]"
      }`}
      style={
        active
          ? { backgroundColor: session.color, borderColor: session.color }
          : {}
      }
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {isLive && (
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: dotColor }}
          />
        )}
        <span
          className="relative inline-flex rounded-full h-2 w-2"
          style={{ backgroundColor: dotColor }}
        />
      </span>
      <span className="max-w-[180px] truncate">{session.organiser}</span>
      <span
        className={`text-xs px-1.5 py-0.5 rounded-md font-semibold ${active ? "bg-white/20 text-white" : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"}`}
      >
        {session.attendees.toLocaleString()}
      </span>
    </button>
  );
}

// ── Resolution panel ──────────────────────────────────────────────────────────

function ResolutionsPanel({
  session,
  onOpen,
  onClose,
}: {
  session: LiveSession;
  onOpen: (resId: string) => void;
  onClose: (resId: string) => void;
}) {
  if (session.votes.length === 0) {
    return (
      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">
            Session Segments
          </h2>
        </div>
        <div className="px-5 py-8 flex flex-col items-center gap-3 text-center">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${session.color}18` }}
          >
            <Wifi className="h-5 w-5" style={{ color: session.color }} />
          </div>
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">
            Presentation-mode session
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-xs">
            This event does not have formal voting resolutions. Monitor
            attendance and manage Q&amp;A from the panel on the right.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="attend-card overflow-hidden">
      <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
        <h2 className="font-semibold text-[hsl(var(--foreground))]">
          Resolutions
        </h2>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          {session.votes.filter((v) => v.status === "closed").length} /{" "}
          {session.votes.length} closed
        </span>
      </div>
      <div className="divide-y divide-[hsl(var(--border))]">
        {session.votes.map((v, i) => {
          const total = v.for + v.against + v.abstain;
          return (
            <div key={v.resolutionId} className="px-5 py-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="text-xs font-bold text-[hsl(var(--muted-foreground))]">
                      RES. {i + 1}
                    </span>
                    <StatusBadge status={v.status} />
                  </div>
                  <div className="text-sm font-semibold text-[hsl(var(--foreground))]">
                    {v.title}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {v.status === "pending" && (
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onOpen(v.resolutionId)}
                    >
                      Open Voting
                    </Button>
                  )}
                  {v.status === "open" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs"
                      onClick={() => onClose(v.resolutionId)}
                    >
                      Close Voting
                    </Button>
                  )}
                </div>
              </div>
              {(v.status === "open" || v.status === "closed") && total > 0 && (
                <div className="flex flex-col gap-2 mt-3 bg-[hsl(var(--muted)/0.4)] rounded-xl p-3">
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
                  <div className="pt-1 mt-1 border-t border-[hsl(var(--border))] text-xs text-[hsl(var(--muted-foreground))]">
                    Total votes cast:{" "}
                    <span className="font-semibold text-[hsl(var(--foreground))]">
                      {total.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
              {v.status === "pending" && (
                <div className="text-xs text-[hsl(var(--muted-foreground))] mt-2 italic">
                  Voting not yet opened for this resolution.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Poll Management Panel ─────────────────────────────────────────────────────

function PollManagementPanel({
  session,
  onLaunch,
  onClose,
}: {
  session: LiveSession;
  onLaunch: (pollId: string) => void;
  onClose: (pollId: string) => void;
}) {
  if (session.module === "AGM") return null;
  if (session.polls.length === 0) return null;

  const statusBadge = (status: LivePoll["status"]) => {
    if (status === "active")
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          Active
        </span>
      );
    if (status === "closed")
      return (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
          Closed
        </span>
      );
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
        Draft
      </span>
    );
  };

  return (
    <Card className="attend-card overflow-hidden">
      <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
        <BarChart2 className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        <h2 className="font-semibold text-[hsl(var(--foreground))]">
          Poll Management
        </h2>
        <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">
          {session.polls.filter((p) => p.status === "active").length} active
        </span>
      </div>
      <div className="divide-y divide-[hsl(var(--border))]">
        {session.polls.map((poll) => {
          const total = poll.options.reduce((s, o) => s + o.votes, 0);
          return (
            <div key={poll.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {statusBadge(poll.status)}
                  </div>
                  <p className="text-sm font-semibold text-[hsl(var(--foreground))] leading-snug">
                    {poll.question}
                  </p>
                </div>
                <div className="shrink-0">
                  {poll.status === "draft" && (
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      style={{ backgroundColor: session.color, color: "white" }}
                      onClick={() => {
                        onLaunch(poll.id);
                        toast.success("Poll launched successfully");
                      }}
                    >
                      Launch Poll
                    </Button>
                  )}
                  {poll.status === "active" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs"
                      onClick={() => {
                        onClose(poll.id);
                        toast.success("Poll closed");
                      }}
                    >
                      Close Poll
                    </Button>
                  )}
                </div>
              </div>
              {(poll.status === "active" || poll.status === "closed") && (
                <div className="bg-[hsl(var(--muted)/0.4)] rounded-xl p-3 flex flex-col gap-3">
                  {poll.options.map((opt) => (
                    <PollOptionBar
                      key={opt.id}
                      text={opt.text}
                      votes={opt.votes}
                      total={total}
                      color={session.color}
                    />
                  ))}
                  {total > 0 && (
                    <div className="pt-1 mt-1 border-t border-[hsl(var(--border))] text-xs text-[hsl(var(--muted-foreground))]">
                      Total responses:{" "}
                      <span className="font-semibold text-[hsl(var(--foreground))]">
                        {total.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {poll.status === "draft" && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] italic mt-1">
                  Poll not yet launched to attendees.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Live Agenda Tracker ───────────────────────────────────────────────────────

function LiveAgendaTracker({ session }: { session: LiveSession }) {
  if (session.agendaItems.length === 0) return null;

  return (
    <Card className="attend-card overflow-hidden">
      <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
        <ListOrdered className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        <h2 className="font-semibold text-[hsl(var(--foreground))]">
          Live Agenda
        </h2>
      </div>
      <div className="divide-y divide-[hsl(var(--border))]">
        {session.agendaItems.map((item) => (
          <div
            key={item.id}
            className="px-4 py-3 flex items-center gap-3"
            style={
              item.isCurrent ? { backgroundColor: `${session.color}10` } : {}
            }
          >
            <div className="shrink-0">
              {item.isCurrent ? (
                <span
                  className="inline-flex items-center gap-1 text-xs font-bold"
                  style={{ color: session.color }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full animate-pulse"
                    style={{ backgroundColor: session.color }}
                  />
                  LIVE
                </span>
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-xs font-medium truncate ${item.isCurrent ? "font-semibold" : "text-[hsl(var(--muted-foreground))]"}`}
                style={item.isCurrent ? { color: session.color } : {}}
              >
                {item.title}
              </p>
            </div>
            <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums shrink-0">
              {item.durationMinutes}m
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Press Kit Release Card ────────────────────────────────────────────────────

function PressKitCard({
  session,
  onRelease,
}: {
  session: LiveSession;
  onRelease: () => void;
}) {
  if (session.module !== "LAUNCH") return null;
  const released = session.pressKitReleased ?? false;

  return (
    <Card className="attend-card overflow-hidden">
      <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
        <Package className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        <h2 className="font-semibold text-[hsl(var(--foreground))]">
          Press Kit Release
        </h2>
      </div>
      <div className="px-5 py-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: released ? "#16a34a18" : "#ea6c0018" }}
          >
            <Package
              className="h-5 w-5"
              style={{ color: released ? "#16a34a" : "#ea6c00" }}
            />
          </div>
          <div>
            <p
              className="text-sm font-semibold"
              style={{ color: released ? "#16a34a" : "#ea6c00" }}
            >
              {released ? "Released ✓" : "Embargoed — Not Yet Released"}
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              {released
                ? "Press kit has been distributed to media contacts."
                : "Press kit will be sent to all registered media contacts."}
            </p>
          </div>
        </div>
        <Button
          disabled={released}
          onClick={() => {
            onRelease();
            toast.success("Press kit released to media contacts");
          }}
          className="w-full text-sm"
          style={
            !released ? { backgroundColor: session.color, color: "white" } : {}
          }
        >
          {released ? "Press Kit Released" : "Release Press Kit Now"}
        </Button>
      </div>
    </Card>
  );
}

// ── Winner Announcement Card ──────────────────────────────────────────────────

function WinnerCard({
  session,
  onDeclare,
}: {
  session: LiveSession;
  onDeclare: (team: string) => void;
}) {
  const [teamInput, setTeamInput] = useState("");
  if (session.module !== "HACKATHON") return null;

  const declared = !!session.winnerTeam;

  return (
    <Card className="attend-card overflow-hidden">
      <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
        <Trophy className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        <h2 className="font-semibold text-[hsl(var(--foreground))]">
          Winner Announcement
        </h2>
      </div>
      <div className="px-5 py-5">
        {declared ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="text-3xl">🏆</div>
            <p className="text-base font-bold" style={{ color: "#b45309" }}>
              {session.winnerTeam} declared winner!
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Winner has been announced to all attendees.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Enter the winning team name and declare the winner to all
              attendees.
            </p>
            <Input
              placeholder="Team Name"
              value={teamInput}
              onChange={(e) => setTeamInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && teamInput.trim()) {
                  onDeclare(teamInput.trim());
                  toast.success(`${teamInput.trim()} declared as winner!`);
                }
              }}
            />
            <Button
              disabled={!teamInput.trim()}
              onClick={() => {
                if (teamInput.trim()) {
                  onDeclare(teamInput.trim());
                  toast.success(`${teamInput.trim()} declared as winner!`);
                }
              }}
              className="w-full"
              style={{ backgroundColor: "#7c22c9", color: "white" }}
            >
              <Trophy className="h-4 w-4 mr-2" />
              Declare Winner
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Stream preview URLs (keyed by session id) ────────────────────────────────

function isZoomUrl(url: string) {
  return /zoom\.us\/j\/|zoomus\.cn\/j\//.test(url);
}

function parseStreamUrl(url: string): string {
  const ytMatch = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/))([A-Za-z0-9_-]{11})/,
  );
  if (ytMatch)
    return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=0&controls=1&rel=0&modestbranding=1`;
  return url;
}

// ── Main page ─────────────────────────────────────────────────────────────────



function getEventColor(mod: string) {
  if (mod === "AGM") return "#1a6b3c";
  if (mod === "LAUNCH") return "#f97316";
  if (mod === "HACKATHON") return "#9333ea";
  return "#2563eb";
}

function getModuleFromEvent(event: any): EventModule {
  if (event.eventType === "AGM_EGM") return "AGM";
  if (event.eventType === "PRODUCT_LAUNCH") return "LAUNCH";
  if (event.eventType === "INNOVATION_CHALLENGE" || event.eventType === "HACKATHON") {
    return "HACKATHON";
  }
  return "GENERAL";
}

export default function LiveControlPage() {
  const { data: eventsData, isLoading } = useEvents("", 0, 100);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [streamInputs, setStreamInputs] = useState<Record<string, string>>({});
  const [streamUrls, setStreamUrls] = useState<Record<string, string>>({});

  const { data: detailRes } = useEventDetail(selectedSessionId);
  const detailData = detailRes?.data;

  const queryClient = useQueryClient();
  const goLiveMutation = useGoLive();
  const endMutation = useEndEvent();
  const cancelMutation = useCancelEvent();

  const isMutating =
    goLiveMutation.isPending ||
    endMutation.isPending ||
    cancelMutation.isPending;

  const sessionsRef = useRef(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  // Merge detailed API data into the selected session
  useEffect(() => {
    if (!detailData || !selectedSessionId) return;

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== selectedSessionId) return s;

        // Only initialize votes if they are empty (to preserve local simulation state if already interacting)
        const votes = s.votes.length > 0
          ? s.votes
          : (detailData.agmConfig?.resolutions?.map((r: any) => ({
              resolutionId: r.id,
              title: r.title,
              for: 0,
              against: 0,
              abstain: 0,
              status: "pending",
            })) || []);

        const agendaItems = s.agendaItems.length > 0
          ? s.agendaItems
          : (detailData.agenda?.map((a: any) => ({
              id: a.id,
              title: a.title,
              durationMinutes: a.durationMinutes || 15,
              isCurrent: a.isCurrent || false,
            })) || []);

        return {
          ...s,
          venue: detailData.location || s.venue,
          capacity: detailData.maximumCapacity || s.capacity,
          votes,
          agendaItems,
        };
      })
    );

    if (detailData.streamUrl) {
      setStreamUrls((prev) => ({
        ...prev,
        [selectedSessionId]: parseStreamUrl(detailData.streamUrl!),
      }));
    }
  }, [detailData, selectedSessionId]);

  useEffect(() => {
    // Generate/sync sessions list
    const apiEvents = eventsData?.data?.content || [];
    const liveApiEvents = apiEvents.filter(
      (e: any) => e.status === "LIVE" || e.status === "PUBLISHED"
    );

    const apiSessions: LiveSession[] = liveApiEvents.map((e: any) => {
      const existing = sessionsRef.current.find((s) => s.eventId === e.id);
      if (existing) {
        return { ...existing, status: e.status };
      }

      const mod = getModuleFromEvent(e);
      const color = getEventColor(mod);
      const deliveryFormat = (e.format || "VIRTUAL").toLowerCase() as any;

      return {
        id: e.id,
        eventId: e.id,
        eventTitle: e.title,
        organiser: e.organizerName || "Platform Stakeholder",
        module: mod,
        color: color,
        format: deliveryFormat,
        venue: e.location || "Virtual (no physical venue)",
        attendees: e.registrationCount || 0,
        capacity: e.maximumCapacity || 5000,
        elapsedMinutes: 0,
        quorumPct: mod === "AGM" ? 0 : null,
        status: e.status,
        votes: e.agmConfig?.resolutions?.map((r: any) => ({
          resolutionId: r.id,
          title: r.title,
          for: 0,
          against: 0,
          abstain: 0,
          status: "pending",
        })) || [],
        polls: [],
        agendaItems: e.agenda?.map((a: any) => ({
          id: a.id,
          title: a.title,
          durationMinutes: a.durationMinutes || 15,
          isCurrent: a.isCurrent || false,
        })) || [],
        pressKitReleased: false,
        qaQueue: [],
        recentJoins: [],
      };
    });

    setSessions(apiSessions);
    if (!selectedSessionId && apiSessions[0]) {
      setSelectedSessionId(apiSessions[0].id);
    }
  }, [eventsData, selectedSessionId]);

  const handleGoLive = (eventId: string) => {
    goLiveMutation.mutate(eventId, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["super-admin", "events"] });
      },
    });
  };

  const handleEndEvent = (eventId: string) => {
    endMutation.mutate(eventId, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["super-admin", "events"] });
      },
    });
  };

  const handleCancelEvent = (eventId: string) => {
    cancelMutation.mutate(eventId, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["super-admin", "events"] });
      },
    });
  };

  function getStreamInput(sessionId: string) {
    return streamInputs[sessionId] ?? streamUrls[sessionId] ?? "";
  }
  function applyStream(sessionId: string) {
    const raw = streamInputs[sessionId] ?? streamUrls[sessionId] ?? "";
    setStreamUrls((prev) => ({ ...prev, [sessionId]: parseStreamUrl(raw) }));
  }

  const openVoting = (sessId: string, resId: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessId) return s;
        return {
          ...s,
          votes: s.votes.map((v) =>
            v.resolutionId === resId ? { ...v, status: "open" } : v
          ),
        };
      })
    );
    toast.success("Voting opened for this resolution");
  };

  const closeVoting = (sessId: string, resId: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessId) return s;
        return {
          ...s,
          votes: s.votes.map((v) => {
            if (v.resolutionId !== resId) return v;
            const total = s.attendees || 1000;
            const forCount = Math.round(total * 0.82);
            const againstCount = Math.round((total - forCount) * 0.4);
            const abstainCount = total - forCount - againstCount;
            return {
              ...v,
              status: "closed",
              for: forCount,
              against: againstCount,
              abstain: abstainCount,
            };
          }),
        };
      })
    );
    toast.success("Voting closed — results are final");
  };

  const approveQA = (sessId: string, qaId: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessId) return s;
        return {
          ...s,
          qaQueue: s.qaQueue.map((q) =>
            q.id === qaId ? { ...q, approved: true } : q
          ),
        };
      })
    );
    toast.success("Question approved");
  };

  const rejectQA = (sessId: string, qaId: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessId) return s;
        return {
          ...s,
          qaQueue: s.qaQueue.map((q) =>
            q.id === qaId ? { ...q, approved: false } : q
          ),
        };
      })
    );
    toast.success("Question rejected");
  };

  const launchPoll = (sessId: string, pollId: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessId) return s;
        return {
          ...s,
          polls: s.polls.map((p) =>
            p.id === pollId ? { ...p, status: "active" } : p
          ),
        };
      })
    );
    toast.success("Poll launched successfully");
  };

  const closePoll = (sessId: string, pollId: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessId) return s;
        return {
          ...s,
          polls: s.polls.map((p) => {
            if (p.id !== pollId) return p;
            const total = Math.round(s.attendees * 0.45);
            return {
              ...p,
              status: "closed",
              options: p.options.map((o, idx) => {
                const votes =
                  idx === 0
                    ? Math.round(total * 0.58)
                    : idx === 1
                      ? Math.round(total * 0.32)
                      : total - Math.round(total * 0.58) - Math.round(total * 0.32);
                return { ...o, votes };
              }),
            };
          }),
        };
      })
    );
    toast.success("Poll closed");
  };

  const releasePressKit = (sessId: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessId) return s;
        return { ...s, pressKitReleased: true };
      })
    );
    toast.success("Press kit released to media contacts");
  };

  const declareWinner = (sessId: string, team: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessId) return s;
        return { ...s, winnerTeam: team };
      })
    );
  };

  if (isLoading && sessions.length === 0) {
    return <Loader variant="page" text="Loading Control Room Sessions..." />;
  }

  const liveSessions = sessions;
  const session = liveSessions.find((s: LiveSession) => s.id === selectedSessionId) ?? liveSessions[0];
  const totalAttendees = liveSessions.reduce((sum: number, s: LiveSession) => sum + s.attendees, 0);
  const setSelectedLiveSession = setSelectedSessionId;

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Radio className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          No live sessions at the moment.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {isMutating && <Loader variant="overlay" text="Updating event status..." />}
      <div className="flex flex-col gap-6">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
              Live Control Room
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-600">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              {liveSessions.length} LIVE
            </span>
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {totalAttendees.toLocaleString()} total attendees connected across
            all sessions
          </p>
        </div>
      </div>

      {/* ── Session tabs ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {liveSessions.map((sess: LiveSession) => (
          <SessionTab
            key={sess.id}
            session={sess}
            active={sess.id === session.id}
            onClick={() => setSelectedLiveSession(sess.id)}
          />
        ))}
      </div>

      {/* ── Selected session header card ── */}
      <div
        className="rounded-2xl p-5 text-white"
        style={{
          background: `linear-gradient(135deg, ${session.color}ee, ${session.color}bb)`,
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 opacity-70" />
              <span className="text-sm font-medium opacity-80">
                {session.organiser}
              </span>
              <span className="text-xs bg-white/20 rounded-full px-2 py-0.5 font-semibold uppercase tracking-wide">
                {session.module}
              </span>
            </div>
            <h2 className="text-lg font-bold leading-snug">
              {session.eventTitle}
            </h2>
            {session.venue && (
              <p className="text-sm opacity-70 mt-1">
                {session.venue} · {session.format}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-1.5 bg-white/15 rounded-xl px-3 py-2">
              {session.status === "LIVE" ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  <span className="text-sm font-bold">LIVE</span>
                </>
              ) : (
                <span className="text-sm font-bold">PUBLISHED</span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {session.status === "PUBLISHED" && (
                <Button
                  size="sm"
                  className="bg-white text-[hsl(var(--foreground))] hover:bg-white/90 gap-1.5 text-xs h-8 px-3"
                  onClick={() => handleGoLive(session.eventId)}
                  disabled={isMutating}
                >
                  <Radio className="h-3.5 w-3.5" /> Go Live
                </Button>
              )}
              {session.status === "LIVE" && (
                <>
                  <Button
                    size="sm"
                    className="bg-white text-[hsl(var(--foreground))] hover:bg-white/90 gap-1.5 text-xs h-8 px-3"
                    onClick={() => handleEndEvent(session.eventId)}
                    disabled={isMutating}
                  >
                    End Event
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/40 text-white hover:bg-white/10 hover:text-white gap-1.5 text-xs h-8 px-3"
                    onClick={() => handleCancelEvent(session.eventId)}
                    disabled={isMutating}
                  >
                    Cancel Event
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          {[
            {
              icon: Users,
              label: "Attendees",
              value: session.attendees.toLocaleString(),
              sub: session.capacity
                ? `of ${session.capacity.toLocaleString()} cap`
                : "connected",
            },
            {
              icon: UserCheck,
              label: "Quorum",
              value:
                session.quorumPct != null ? `${session.quorumPct}%` : "N/A",
              sub:
                session.quorumPct != null ? "of required" : "non-voting event",
            },
            {
              icon: Vote,
              label: "Resolutions",
              value:
                session.votes.length > 0
                  ? `${session.votes.filter((v: any) => v.status === "closed").length} / ${session.votes.length}`
                  : "—",
              sub: session.votes.length > 0 ? "closed" : "no votes",
            },
            {
              icon: Clock,
              label: "Elapsed",
              value: formatElapsed(session.elapsedMinutes),
              sub: "session time",
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
      </div>

      {/* ── Stream preview ── */}
      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
          <Tv2 className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <h2 className="font-semibold text-[hsl(var(--foreground))]">
            Stream Preview
          </h2>
          <span
            className="ml-auto text-xs font-semibold px-2.5 py-0.5 rounded-full"
            style={{
              backgroundColor: session.color + "18",
              color: session.color,
            }}
          >
            {session.module}
          </span>
        </div>
        <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
          {streamUrls[session.id] ? (
            isZoomUrl(streamUrls[session.id]) ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="rounded-2xl bg-[#0B5CFF]/15 p-4">
                  <svg viewBox="0 0 40 40" className="h-10 w-10 fill-[#0B5CFF]">
                    <path d="M20 0C8.954 0 0 8.954 0 20s8.954 20 20 20 20-8.954 20-20S31.046 0 20 0zm9.714 25.714a1.429 1.429 0 0 1-1.428 1.429H9.286a1.429 1.429 0 0 1-1.429-1.429V16.43a1.429 1.429 0 0 1 1.429-1.429h2.857v5.714l5-3.571v7.142l-5-3.571v2.857h11.428v-8.571h2.143v8.714zm-2.857-12.857a2.857 2.857 0 1 1-5.714 0 2.857 2.857 0 0 1 5.714 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Zoom Meeting
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    This AGM is hosted on Zoom — cannot be previewed inline.
                  </p>
                </div>
                <a
                  href={streamUrls[session.id]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0B5CFF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0B5CFF]/90"
                >
                  <ExternalLink className="h-4 w-4" /> Join Zoom Meeting
                </a>
              </div>
            ) : (
              <iframe
                key={streamUrls[session.id]}
                src={streamUrls[session.id]}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Tv2 className="h-12 w-12 text-gray-600" />
              <p className="text-sm text-gray-400">
                No stream configured for this session
              </p>
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
                value={getStreamInput(session.id)}
                onChange={(e) =>
                  setStreamInputs((prev) => ({
                    ...prev,
                    [session.id]: e.target.value,
                  }))
                }
                placeholder="Paste YouTube or Zoom URL…"
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
                onKeyDown={(e) => e.key === "Enter" && applyStream(session.id)}
              />
            </div>
            <Button
              size="sm"
              onClick={() => applyStream(session.id)}
              className="px-4 shrink-0"
            >
              Apply
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Content grid ── */}
      <div className="grid grid-cols-3 gap-5">
        {/* Left col: Resolutions + Polls + Press Kit + Winner */}
        <div className="col-span-2 flex flex-col gap-5">
          <ResolutionsPanel
            session={session}
            onOpen={(resId) => openVoting(session.id, resId)}
            onClose={(resId) => closeVoting(session.id, resId)}
          />
          <PollManagementPanel
            session={session}
            onLaunch={(pollId) => launchPoll(session.id, pollId)}
            onClose={(pollId) => closePoll(session.id, pollId)}
          />
          <PressKitCard
            session={session}
            onRelease={() => releasePressKit(session.id)}
          />
          <WinnerCard
            session={session}
            onDeclare={(team) => declareWinner(session.id, team)}
          />
        </div>

        {/* Right: Q&A + Agenda + attendance */}
        <div className="col-span-1 flex flex-col gap-5">
          {/* Q&A Queue */}
          <Card className="attend-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <h2 className="font-semibold text-[hsl(var(--foreground))]">
                Q&A Queue
              </h2>
              <span className="ml-auto text-xs bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] rounded-full px-2 py-0.5 font-semibold">
                {session.qaQueue.filter((q: any) => q.approved === null).length}{" "}
                pending
              </span>
            </div>
            <div className="divide-y divide-[hsl(var(--border))]">
              {session.qaQueue.length === 0 ? (
                <p className="px-5 py-6 text-sm text-[hsl(var(--muted-foreground))] text-center italic">
                  No questions yet.
                </p>
              ) : (
                session.qaQueue.map((q: any) => (
                  <div key={q.id} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-[hsl(var(--foreground))]">
                        {q.name}
                      </span>
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        {q.time}
                      </span>
                    </div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3 leading-relaxed">
                      {q.question}
                    </p>
                    {q.approved === null ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs flex-1 gap-1"
                          onClick={() => approveQA(session.id, q.id)}
                        >
                          <Check className="h-3 w-3" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs flex-1 gap-1 text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => rejectQA(session.id, q.id)}
                        >
                          <X className="h-3 w-3" /> Reject
                        </Button>
                      </div>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium ${q.approved ? "text-green-600" : "text-red-500"}`}
                      >
                        {q.approved ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                        {q.approved ? "Approved" : "Rejected"}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Live Agenda Tracker */}
          <LiveAgendaTracker session={session} />

          {/* Attendance log */}
          <Card className="attend-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
              <h2 className="font-semibold text-[hsl(var(--foreground))]">
                Attendance Log
              </h2>
            </div>
            <div className="divide-y divide-[hsl(var(--border))]">
              {session.recentJoins.map((join: any, i: number) => (
                <div
                  key={i}
                  className="px-5 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: session.color }}
                    >
                      {initials(join.name)}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[hsl(var(--foreground))]">
                        {join.name}
                      </div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">
                        {join.method}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    {join.time}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
    </div>
  );
}
