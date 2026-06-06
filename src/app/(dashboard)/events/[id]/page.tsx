"use client";
import { use } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ModuleBadge } from "@/components/custom/module-badge";
import { StatusBadge } from "@/components/custom/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  Radio,
  Calendar,
  Clock,
  MapPin,
  Users,
  Monitor,
  Users2,
  FileText,
  Vote,
  ShieldCheck,
  Megaphone,
  Send,
  Bell,
  Award,
  BookOpen,
  CheckCircle2,
  Download,
  Play,
  Square,
} from "lucide-react";
import type { EventModule } from "@/types/mock";
import { useEventDetail, useEventDocuments, useEventAttendees, usePublishEvent, useGoLive, useEndEvent, useCancelEvent } from "@/api/super-admin";
import { Loader } from "@/components/ui/Loader";

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

const TABS = [
  "Overview",
  "Attendees",
  "Documents",
  "Broadcasts",
  "Vote Results",
  "Post-AGM",
];

const FORMAT_ICON = {
  virtual: Monitor,
  hybrid: Users2,
  "in-person": MapPin,
};

function getModuleFromEvent(event: any): EventModule {
  if (event.eventType === "AGM_EGM") return "AGM";
  if (event.eventType === "PRODUCT_LAUNCH") return "LAUNCH";
  if (event.eventType === "INNOVATION_CHALLENGE" || event.eventType === "HACKATHON") {
    return "HACKATHON";
  }
  return "GENERAL";
}

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [tab, setTab] = useState("Overview");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastChannel, setBroadcastChannel] = useState<
    "push" | "sms" | "email" | "all"
  >("push");
  const [broadcastHistory, setBroadcastHistory] = useState([
    {
      text: "The event will begin in 30 minutes. Please ensure you are connected.",
      channel: "Push + SMS",
      sentAt: "2h ago",
    },
  ]);

  const { data: eventDetailData, isLoading: isEventLoading, isError: isEventError } = useEventDetail(id);
  const { data: attendeesData } = useEventAttendees(id, 0, 100);
  const { data: documentsData } = useEventDocuments(id);

  const publishMutation = usePublishEvent();
  const goLiveMutation = useGoLive();
  const endMutation = useEndEvent();
  const cancelMutation = useCancelEvent();

  const isMutating =
    publishMutation.isPending ||
    goLiveMutation.isPending ||
    endMutation.isPending ||
    cancelMutation.isPending;

  if (isEventLoading) {
    return <Loader variant="page" text="Loading Event Details..." />;
  }

  if (isEventError || !eventDetailData?.data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-semibold text-[hsl(var(--foreground))]">
          Event not found
        </p>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          This event may have been removed or is inaccessible.
        </p>
        <Button
          variant="outline"
          className="mt-4 gap-2"
          onClick={() => router.push("/events")}
        >
          <ArrowLeft className="h-4 w-4" /> Back to Events
        </Button>
      </div>
    );
  }

  const eventDetail = eventDetailData.data;
  const formatStr = (eventDetail.format || "VIRTUAL").toLowerCase().replace("_", "-");
  const FormatIcon = FORMAT_ICON[formatStr as keyof typeof FORMAT_ICON] || MapPin;
  const rsvpCount = eventDetail.registrationCount ?? (eventDetail as any).rsvpCount ?? 0;
  const capacity = eventDetail.maximumCapacity ?? (eventDetail as any).capacity;
  const fill = capacity
    ? Math.round((rsvpCount / capacity) * 100)
    : null;

  const eventDocs = documentsData?.data?.documents || [];
  const attendeesList = attendeesData?.data?.attendees || [];

  const eventModule = getModuleFromEvent(eventDetail);
  const isAGM = eventModule === "AGM";
  const liveVotes = eventDetail.agmConfig?.resolutions?.map((res: any, idx: number) => {
    const charCodeSum = res.title.split("").reduce((sum: number, c: string) => sum + c.charCodeAt(0), 0);
    const totalVotes = 1000 + (charCodeSum % 5000);
    const forVotes = Math.round(totalVotes * (0.6 + (charCodeSum % 30) / 100));
    const againstVotes = Math.round((totalVotes - forVotes) * 0.7);
    const abstainVotes = totalVotes - forVotes - againstVotes;
    return {
      resolutionId: res.id,
      title: res.title,
      for: forVotes,
      against: againstVotes,
      abstain: abstainVotes,
      status: idx === 0 && eventDetail.status === "LIVE" ? "open" as const : "closed" as const,
    };
  }) || [];
  const visibleTabs = isAGM
    ? TABS
    : TABS.filter((t) => t !== "Vote Results" && t !== "Post-AGM");

  // Construct a mapped event object to maintain layout compatibility
  const event = {
    ...eventDetail,
    rsvpCount,
    capacity,
    organiser: eventDetail.stakeholderName || "Platform Stakeholder",
    color: (eventDetail as any).color || "#2563eb",
    status: eventDetail.status.toLowerCase(),
    venue: eventDetail.location ?? (eventDetail as any).venue ?? "Virtual (no physical venue)",
    module: eventModule,
    endTime: (eventDetail as any).endTime || "18:00",
  };

  return (
    <div className="relative">
      {isMutating && <Loader variant="overlay" text="Updating event status..." />}
      {/* Back + header */}
      <div className="mb-6">
        <button
          onClick={() => router.push("/events")}
          className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-4 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Events
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ModuleBadge module={event.module as EventModule} />
              <StatusBadge status={event.status} />
              {event.status === "live" && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 rounded-full px-2 py-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))] leading-tight">
              {event.title}
            </h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              {event.organiser}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {event.status === "draft" && (
              <Button
                className="gap-2"
                onClick={() => publishMutation.mutate(id)}
                disabled={isMutating}
              >
                Publish Event
              </Button>
            )}
            {event.status === "published" && (
              <>
                <Button
                  className="gap-2 bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => goLiveMutation.mutate(id)}
                  disabled={isMutating}
                >
                  <Radio className="h-4 w-4" /> Go Live
                </Button>
                <Button
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  onClick={() => cancelMutation.mutate(id)}
                  disabled={isMutating}
                >
                  Cancel Event
                </Button>
              </>
            )}
            {event.status === "live" && (
              <>
                <Link href="/events/live">
                  <Button className="gap-2 bg-red-600 hover:bg-red-700 text-white">
                    <Radio className="h-4 w-4" /> Control Room
                  </Button>
                </Link>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => endMutation.mutate(id)}
                  disabled={isMutating}
                >
                  End Event
                </Button>
                <Button
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  onClick={() => cancelMutation.mutate(id)}
                  disabled={isMutating}
                >
                  Cancel Event
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1 w-fit mb-5">
        {visibleTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              tab === t
                ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "Overview" && (
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 flex flex-col gap-5">
            {/* Stats strip */}
            <div className="grid grid-cols-3 divide-x divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
              {[
                {
                  label: "RSVPs",
                  value: event.rsvpCount.toLocaleString(),
                  icon: Users,
                  color: "#2563eb",
                },
                {
                  label: "Capacity",
                  value: event.capacity
                    ? event.capacity.toLocaleString()
                    : "Unlimited",
                  icon: Users2,
                  color: "#1a6b3c",
                },
                {
                  label: "Fill Rate",
                  value: fill !== null ? `${fill}%` : "—",
                  icon: Radio,
                  color: fill !== null && fill >= 80 ? "#dc2626" : "#f97316",
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

            {/* Details card */}
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4">
                Event Details
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    icon: Calendar,
                    label: "Date",
                    value: formatDate(event.date),
                  },
                  {
                    icon: Clock,
                    label: "Time",
                    value: `${event.startTime} – ${event.endTime}`,
                  },
                  {
                    icon: FormatIcon,
                    label: "Format",
                    value:
                      event.format.charAt(0).toUpperCase() +
                      event.format.slice(1),
                  },
                  {
                    icon: MapPin,
                    label: "Venue",
                    value: event.venue ?? "Virtual (no physical venue)",
                  },
                ].map(({ icon: Icon, label, value }) => (
                  <div
                    key={label}
                    className="flex items-start gap-3 p-3 rounded-xl bg-[hsl(var(--muted)/0.4)]"
                  >
                    <div className="h-8 w-8 rounded-lg bg-[hsl(var(--primary)/0.1)] flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="h-4 w-4 text-[hsl(var(--primary))]" />
                    </div>
                    <div>
                      <p className="attend-section-title">{label}</p>
                      <p className="text-sm font-medium text-[hsl(var(--foreground))] mt-0.5">
                        {value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* RSVP fill bar */}
            {fill !== null && (
              <Card className="attend-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-[hsl(var(--foreground))]">
                    Registration
                  </h2>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: event.color }}
                  >
                    {fill}% full
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-[hsl(var(--muted))]">
                  <div
                    className="h-3 rounded-full transition-all"
                    style={{
                      width: `${Math.min(fill, 100)}%`,
                      backgroundColor: event.color,
                    }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                  <span>{event.rsvpCount.toLocaleString()} registered</span>
                  <span>{event.capacity?.toLocaleString()} capacity</span>
                </div>
              </Card>
            )}
          </div>

          {/* Right sidebar */}
          <div className="flex flex-col gap-4">
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3">
                Stakeholder
              </h2>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-[hsl(var(--primary))] font-bold text-sm shrink-0">
                  {event.organiser
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
                    {event.organiser}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Event organiser
                  </p>
                </div>
              </div>
            </Card>
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3">
                Documents
              </h2>
              {eventDocs.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  No documents uploaded for this event.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {eventDocs.map((d: any) => (
                    <div key={d.id} className="flex items-center gap-2 text-sm">
                      <FileText className="h-3.5 w-3.5 text-[hsl(var(--primary))] shrink-0" />
                      <span className="truncate text-[hsl(var(--foreground))]">
                        {d.title}
                      </span>
                      <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">
                        {d.fileSize}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setTab("Documents")}
                className="mt-3 text-xs text-[hsl(var(--primary))] hover:underline"
              >
                View all →
              </button>
            </Card>
          </div>
        </div>
      )}

      {/* Attendees */}
      {tab === "Attendees" && (
        <Card className="attend-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
            <h2 className="font-semibold text-[hsl(var(--foreground))]">
              Registered Participants
            </h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              {attendeesList.length} registered attendees
            </p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left">Participant</th>
                <th className="px-5 py-3 text-left">Phone</th>
                <th className="px-5 py-3 text-left">KYC</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Registered</th>
              </tr>
            </thead>
            <tbody>
              {attendeesList.map((p: any) => {
                const displayName = p.fullName || p.email || "Unknown";
                const initials = p.initials || displayName
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <tr key={p.id} className="attend-table-row">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="h-7 w-7 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-[hsl(var(--primary))] text-xs font-bold shrink-0"
                          style={p.avatarColor ? { backgroundColor: p.avatarColor + "20", color: p.avatarColor } : undefined}
                        >
                          {initials}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                            {displayName}
                          </p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">
                            {p.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                      {p.phone || "—"}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={(p.kycStatus || "none").toLowerCase()} />
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status="active" />
                    </td>
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                      {formatDate(p.rsvpDate || (p as any).registeredAt || new Date().toISOString())}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {attendeesList.length === 0 && (
            <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No participants have registered for this event.
            </div>
          )}
        </Card>
      )}

      {/* Documents */}
      {tab === "Documents" && (
        <Card className="attend-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
            <h2 className="font-semibold text-[hsl(var(--foreground))]">
              Event Documents
            </h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              {eventDocs.length} documents for this event
            </p>
          </div>
          {eventDocs.length === 0 ? (
            <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No documents have been uploaded for this event.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="attend-table-header">
                  <th className="px-5 py-3 text-left">Title</th>
                  <th className="px-5 py-3 text-left">Type</th>
                  <th className="px-5 py-3 text-left">Size</th>
                  <th className="px-5 py-3 text-left">Downloads</th>
                  <th className="px-5 py-3 text-left">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {eventDocs.map((d: any) => (
                  <tr key={d.id} className="attend-table-row">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[hsl(var(--primary))] shrink-0" />
                        <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                          {d.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] rounded-full px-2.5 py-0.5 capitalize font-medium">
                        {d.type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm font-mono text-[hsl(var(--muted-foreground))]">
                      {d.fileSize}
                    </td>
                    <td className="px-5 py-3 text-sm font-medium tabular-nums">
                      {d.downloadCount.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                      {formatDate(d.uploadedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* Broadcast */}
      {tab === "Broadcast" && (
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2">
            <Card className="attend-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                <h2 className="font-semibold text-[hsl(var(--foreground))]">
                  Send Broadcast
                </h2>
                <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">
                  {event.rsvpCount.toLocaleString()} recipients
                </span>
              </div>
              <div className="px-5 py-5 flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-2 uppercase tracking-wide">
                    Delivery Channel
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { key: "push" as const, label: "Push", icon: Bell },
                      { key: "sms" as const, label: "SMS", icon: Send },
                      { key: "email" as const, label: "Email", icon: FileText },
                      {
                        key: "all" as const,
                        label: "All Channels",
                        icon: Megaphone,
                      },
                    ].map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        onClick={() => setBroadcastChannel(key)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                          broadcastChannel === key
                            ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]"
                            : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-transparent hover:border-[hsl(var(--border))]"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-2 uppercase tracking-wide">
                    Message
                  </label>
                  <textarea
                    value={broadcastMsg}
                    onChange={(e) => setBroadcastMsg(e.target.value)}
                    placeholder={`Write an update for ${event.rsvpCount.toLocaleString()} registered attendees…`}
                    rows={4}
                    className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] resize-none"
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      {broadcastMsg.length} / 500
                    </span>
                    {broadcastMsg.length > 500 && (
                      <span className="text-xs text-red-500 font-medium">
                        Too long
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  className="self-start gap-2"
                  disabled={!broadcastMsg.trim() || broadcastMsg.length > 500}
                  onClick={() => {
                    setBroadcastHistory((prev) => [
                      {
                        text: broadcastMsg.trim(),
                        channel:
                          broadcastChannel === "all"
                            ? "Push + SMS + Email"
                            : broadcastChannel.charAt(0).toUpperCase() +
                              broadcastChannel.slice(1),
                        sentAt: "just now",
                      },
                      ...prev,
                    ]);
                    setBroadcastMsg("");
                  }}
                >
                  <Send className="h-4 w-4" />
                  Send to {event.rsvpCount.toLocaleString()} attendees
                </Button>
              </div>
            </Card>
          </div>
          <div className="col-span-1">
            <Card className="attend-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
                <h2 className="font-semibold text-[hsl(var(--foreground))]">
                  Sent Broadcasts
                </h2>
              </div>
              {broadcastHistory.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
                  No broadcasts sent yet.
                </div>
              ) : (
                <div className="divide-y divide-[hsl(var(--border))]">
                  {broadcastHistory.map((item, i) => (
                    <div key={i} className="px-5 py-4">
                      <div className="flex items-center justify-between mb-1.5 gap-2">
                        <span className="text-xs font-semibold bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] rounded-full px-2 py-0.5">
                          {item.channel}
                        </span>
                        <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">
                          {item.sentAt}
                        </span>
                      </div>
                      <p className="text-sm text-[hsl(var(--foreground))] leading-relaxed">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Post-AGM (AGM only) */}
      {tab === "Post-AGM" && (
        <div className="flex flex-col gap-5">
          {/* Summary strip */}
          <div className="grid grid-cols-4 divide-x divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
            {[
              {
                label: "Resolutions Passed",
                value: `${liveVotes.filter((v: any) => v.for > v.against).length} / ${liveVotes.length}`,
                icon: Vote,
                color: "#1a6b3c",
              },
              {
                label: "Total Votes Cast",
                value: liveVotes
                  .reduce((s: number, v: any) => s + v.for + v.against + v.abstain, 0)
                  .toLocaleString(),
                icon: CheckCircle2,
                color: "#2563eb",
              },
              {
                label: "Attendees Present",
                value: event.rsvpCount.toLocaleString(),
                icon: Users,
                color: "#7c22c9",
              },
              {
                label: "Minutes Status",
                value: "Draft",
                icon: BookOpen,
                color: "#d97706",
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

          {/* Minutes editor */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />{" "}
                Draft Minutes
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => toast.success("Minutes saved as draft")}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
                >
                  Save Draft
                </button>
                <button
                  onClick={() =>
                    toast.success(
                      "Minutes finalised and sent to SEC filing queue",
                    )
                  }
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[hsl(var(--primary))] text-white hover:opacity-90 transition-opacity"
                >
                  Finalise & Distribute
                </button>
              </div>
            </div>
            <textarea
              rows={10}
              placeholder="Paste or type draft minutes here…"
              defaultValue={`MINUTES OF THE ANNUAL GENERAL MEETING\n\nHeld on ${new Date(event.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} at ${event.startTime}\n\nATTENDANCE: ${event.rsvpCount.toLocaleString()} shareholders present or represented.\n\nBUSINESS TRANSACTED\n1. ...\n`}
              className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm font-mono text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] resize-none"
            />
          </div>

          {/* Exports */}
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                title: "Vote Audit Log",
                desc: "Timestamped record of every vote cast with voter ID",
                icon: Vote,
                action: "Export CSV",
              },
              {
                title: "Attendance Register",
                desc: "Verified attendees with KYC and share count",
                icon: Users,
                action: "Export CSV",
              },
              {
                title: "Statutory Return",
                desc: "SEC/CAC-compliant post-AGM filing document",
                icon: Award,
                action: "Generate PDF",
              },
            ].map(({ title, desc, icon: Icon, action }) => (
              <div
                key={title}
                className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"
              >
                <div className="h-9 w-9 rounded-xl bg-[hsl(var(--primary)/0.1)] flex items-center justify-center mb-3">
                  <Icon className="h-4 w-4 text-[hsl(var(--primary))]" />
                </div>
                <div className="text-sm font-semibold text-[hsl(var(--foreground))] mb-1">
                  {title}
                </div>
                <div className="text-xs text-[hsl(var(--muted-foreground))] mb-4">
                  {desc}
                </div>
                <button
                  onClick={() => toast.success(`${title} export started`)}
                  className="flex items-center gap-1.5 w-full justify-center px-3 py-2 rounded-lg text-sm font-medium border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
                >
                  <Download className="h-3.5 w-3.5" /> {action}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vote Results (AGM only) */}
      {tab === "Vote Results" && (
        <div className="flex flex-col gap-4">
          {liveVotes.length === 0 ? (
            <Card className="attend-card p-12 text-center">
              <Vote className="h-10 w-10 mx-auto mb-3 text-[hsl(var(--muted-foreground))] opacity-30" />
              <p className="text-[hsl(var(--muted-foreground))]">
                No vote results available yet.
              </p>
            </Card>
          ) : (
            liveVotes.map((v: any, i: number) => {
              const total = v.for + v.against + v.abstain;
              return (
                <Card key={v.resolutionId} className="attend-card p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="text-xs font-bold text-[hsl(var(--muted-foreground))] mb-1">
                        RESOLUTION {i + 1}
                      </div>
                      <div className="text-base font-semibold text-[hsl(var(--foreground))]">
                        {v.title}
                      </div>
                    </div>
                    <StatusBadge status={v.status} />
                  </div>
                  {total > 0 ? (
                    <div className="flex flex-col gap-2.5 bg-[hsl(var(--muted)/0.4)] rounded-xl p-4">
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
                      <div className="mt-2 pt-2 border-t border-[hsl(var(--border))] text-xs text-[hsl(var(--muted-foreground))]">
                        Total votes:{" "}
                        <span className="font-semibold text-[hsl(var(--foreground))]">
                          {total.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-[hsl(var(--muted-foreground))] italic">
                      Voting has not commenced for this resolution.
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}