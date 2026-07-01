"use client";
import { useState } from "react";
import { Radio, Star, Video, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useUpdateEvent,
  usePublishEvent,
  useGoLiveEvent,
  useEndEvent,
  useCancelEvent,
  useToggleEventFeatured,
  useCreateEventZoomMeeting,
  useUpdateStreamUrl,
  type ZoomMeetingDto,
} from "@/api/client-events";

// ── Label helper ──────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5">
      {children}
    </label>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  eventId:          string;
  title:            string;
  organiser:        string;
  description?:     string;
  format?:          string;
  date?:            string;
  startTime?:       string;
  venue?:           string;
  streamUrl?:       string;
  maximumCapacity?: number | null;
  currentStatus:    string;
  featured?:        boolean;
  zoomMeeting?:     ZoomMeetingDto | null;
  onStatusChange:   (status: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EventSettingsTab({
  eventId,
  title:            initialTitle,
  organiser,
  description:      initialDescription = "",
  format:           initialFormat       = "",
  date:             initialDate         = "",
  startTime:        initialStartTime    = "",
  venue:            initialVenue        = "",
  streamUrl:        initialStreamUrl    = "",
  maximumCapacity:  initialCapacity     = null,
  currentStatus,
  featured:         initialFeatured     = false,
  zoomMeeting:      initialZoomMeeting  = null,
  onStatusChange,
}: Props) {
  const [titleVal,         setTitleVal]         = useState(initialTitle ?? "");
  const [descVal,          setDescVal]          = useState(initialDescription ?? "");
  const [formatVal,        setFormatVal]        = useState(initialFormat ?? "");
  const [dateVal,          setDateVal]          = useState(initialDate ?? "");
  const [timeVal,          setTimeVal]          = useState(initialStartTime ?? "");
  const [venueVal,         setVenueVal]         = useState(initialVenue ?? "");
  // If a Zoom meeting exists, its joinUrl IS the stream URL — prefer it
  const effectiveStreamUrl = initialZoomMeeting?.joinUrl || initialStreamUrl || "";
  const [streamVal,    setStreamVal]    = useState(effectiveStreamUrl);
  const [capVal,       setCapVal]       = useState(initialCapacity != null ? String(initialCapacity) : "");
  const [featured,     setFeatured]     = useState(initialFeatured);
  const [zoomMeeting,  setZoomMeeting]  = useState<ZoomMeetingDto | null>(initialZoomMeeting ?? null);
  const [zoomDuration, setZoomDuration] = useState("120");
  const [copiedJoin,   setCopiedJoin]   = useState(false);

  const updateMutation         = useUpdateEvent();
  const publishMutation        = usePublishEvent();
  const goLiveMutation         = useGoLiveEvent();
  const endMutation            = useEndEvent();
  const cancelMutation         = useCancelEvent();
  const toggleFeaturedMutation = useToggleEventFeatured();
  const zoomMutation           = useCreateEventZoomMeeting();
  const updateStreamMutation   = useUpdateStreamUrl();

  function copyJoinUrl() {
    if (!zoomMeeting?.joinUrl) return;
    navigator.clipboard.writeText(zoomMeeting.joinUrl).then(() => {
      setCopiedJoin(true);
      setTimeout(() => setCopiedJoin(false), 2000);
    });
  }

  function handleCreateZoom() {
    zoomMutation.mutate(
      { eventId, durationMinutes: parseInt(zoomDuration, 10) || 120 },
      {
        onSuccess: (data) => {
          setZoomMeeting(data);
          // Automatically set the stream URL to the Zoom join URL
          if (data.joinUrl) {
            setStreamVal(data.joinUrl);
            updateStreamMutation.mutate({ eventId, streamUrl: data.joinUrl });
          }
        },
      }
    );
  }

  const anyLifecyclePending =
    publishMutation.isPending ||
    goLiveMutation.isPending  ||
    endMutation.isPending     ||
    cancelMutation.isPending;

  function handleLifecycle(
    status: "published" | "live" | "ended" | "cancelled",
    mutation: { mutate: (id: string, opts?: any) => void; isPending: boolean }
  ) {
    mutation.mutate(eventId, { onSuccess: () => onStatusChange(status) });
  }

  function handleSave() {
    const cap = parseInt(capVal, 10);
    updateMutation.mutate({
      id: eventId,
      data: {
        title:           titleVal.trim()   || undefined,
        description:     descVal.trim()    || undefined,
        format:          (formatVal as any) || undefined,
        date:            dateVal            || undefined,
        startTime:       timeVal            || undefined,
        venue:           venueVal.trim()    || undefined,
        streamUrl:       streamVal.trim()   || undefined,
        maximumCapacity: !isNaN(cap) && cap > 0 ? cap : undefined,
      },
    });
  }

  return (
    <div className="flex flex-col gap-5">

      {/* ── Event Details ── */}
      <Card className="attend-card p-5">
        <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4">Event Details</h2>
        <div className="flex flex-col gap-4">

          {/* Title */}
          <div>
            <FieldLabel>Event Title</FieldLabel>
            <Input
              value={titleVal}
              onChange={(e) => setTitleVal(e.target.value)}
              placeholder="Event title"
            />
          </div>

          {/* Description */}
          <div>
            <FieldLabel>Description</FieldLabel>
            <textarea
              value={descVal}
              onChange={(e) => setDescVal(e.target.value)}
              rows={3}
              placeholder="Event description (optional)"
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] resize-none"
            />
          </div>

          {/* Format */}
          <div>
            <FieldLabel>Format</FieldLabel>
            <select
              value={formatVal}
              onChange={(e) => setFormatVal(e.target.value)}
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
            >
              <option value="">— Select format —</option>
              <option value="VIRTUAL">Virtual</option>
              <option value="IN_PERSON">In Person</option>
              <option value="HYBRID">Hybrid</option>
            </select>
          </div>

          {/* Date + Start time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Date</FieldLabel>
              <Input
                type="date"
                value={dateVal}
                onChange={(e) => setDateVal(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Start Time</FieldLabel>
              <Input
                type="time"
                value={timeVal}
                onChange={(e) => setTimeVal(e.target.value)}
              />
            </div>
          </div>

          {/* Venue — hidden for virtual-only events */}
          {formatVal !== "VIRTUAL" && (
            <div>
              <FieldLabel>Venue / Location</FieldLabel>
              <Input
                value={venueVal}
                onChange={(e) => setVenueVal(e.target.value)}
                placeholder="e.g. Lagos Continental Hotel, Hall A"
              />
            </div>
          )}

          {/* Stream URL — only relevant for virtual / hybrid events */}
          {(formatVal === "VIRTUAL" || formatVal === "HYBRID") && (
            <div>
              <FieldLabel>Stream URL</FieldLabel>
              <Input
                value={streamVal}
                onChange={(e) => setStreamVal(e.target.value)}
                placeholder="YouTube, Zoom or any stream link"
              />
            </div>
          )}

          {/* Capacity */}
          <div>
            <FieldLabel>Maximum Capacity</FieldLabel>
            <Input
              type="number"
              min={1}
              value={capVal}
              onChange={(e) => setCapVal(e.target.value)}
              placeholder="Leave blank for unlimited"
            />
          </div>

          {/* Organiser — read-only */}
          <div>
            <FieldLabel>Organiser</FieldLabel>
            <Input value={organiser} readOnly className="opacity-70 cursor-not-allowed" />
          </div>

          <Button
            size="sm"
            className="self-start"
            disabled={updateMutation.isPending || !titleVal.trim()}
            onClick={handleSave}
          >
            {updateMutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </Card>

      {/* ── Featured ── */}
      <Card className="attend-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
              <Star className="h-4 w-4" />
              Featured Event
            </h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
              Featured events are highlighted to participants in the public view.
            </p>
          </div>
          <Button
            size="sm"
            variant={featured ? "default" : "outline"}
            disabled={toggleFeaturedMutation.isPending}
            className="gap-1.5 min-w-[110px]"
            onClick={() =>
              toggleFeaturedMutation.mutate(eventId, {
                onSuccess: () => setFeatured((f) => !f),
              })
            }
          >
            <Star className={`h-3.5 w-3.5 ${featured ? "fill-current" : ""}`} />
            {toggleFeaturedMutation.isPending ? "…" : featured ? "Unfeature" : "Set Featured"}
          </Button>
        </div>
      </Card>

      {/* ── Zoom Meeting ── */}
      <Card className="attend-card p-5">
        <h2 className="font-semibold text-[hsl(var(--foreground))] flex items-center gap-2 mb-4">
          <Video className="h-4 w-4 text-[#0B5CFF]" />
          Zoom Meeting
        </h2>

        {zoomMeeting ? (
          <div className="flex flex-col gap-3">
            {/* Info rows */}
            <div className="rounded-xl border border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))]">
              {[
                { label: "Meeting ID", value: String(zoomMeeting.meetingId) },
                { label: "Password",   value: zoomMeeting.password },
                { label: "Duration",   value: `${zoomMeeting.durationMinutes} min` },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-[hsl(var(--muted-foreground))] font-medium">{label}</span>
                  <span className="text-xs font-mono text-[hsl(var(--foreground))]">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <a
                href={zoomMeeting.joinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-[#0B5CFF] hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open Join URL
              </a>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs ml-auto"
                onClick={copyJoinUrl}
              >
                {copiedJoin ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copiedJoin ? "Copied!" : "Copy Join URL"}
              </Button>
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Join URL is automatically set as the stream URL for this event.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              No Zoom meeting yet. Create one below — the join URL will automatically become the stream URL.
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={30}
                max={480}
                value={zoomDuration}
                onChange={(e) => setZoomDuration(e.target.value)}
                placeholder="120"
                className="h-8 w-24 text-sm"
              />
              <span className="text-xs text-[hsl(var(--muted-foreground))]">min</span>
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs bg-[#0B5CFF] hover:bg-[#0B5CFF]/90 text-white ml-auto"
                disabled={zoomMutation.isPending}
                onClick={handleCreateZoom}
              >
                <Video className={`h-3.5 w-3.5 ${zoomMutation.isPending ? "animate-spin" : ""}`} />
                {zoomMutation.isPending ? "Creating…" : "Create Zoom Meeting"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ── Status Controls ── */}
      <Card className="attend-card p-5">
        <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4">Status Controls</h2>
        <div className="flex flex-col divide-y divide-[hsl(var(--border))]">
          {[
            {
              label:    "Publish Event",
              desc:     "Make event visible and open RSVPs",
              action:   "Publish",
              status:   "published" as const,
              mutation: publishMutation,
              disabled: ["PUBLISHED", "published", "LIVE", "live", "ENDED", "ended", "CANCELLED", "cancelled"].includes(currentStatus),
            },
            {
              label:    "Go Live",
              desc:     "Start the live stream and event",
              action:   "Go Live",
              status:   "live" as const,
              mutation: goLiveMutation,
              disabled: ["DRAFT", "draft", "LIVE", "live", "ENDED", "ended", "CANCELLED", "cancelled"].includes(currentStatus),
            },
            {
              label:    "End Event",
              desc:     "Mark event as concluded",
              action:   "End Event",
              status:   "ended" as const,
              mutation: endMutation,
              disabled: !["LIVE", "live"].includes(currentStatus),
            },
          ].map(({ label, desc, action, status, mutation, disabled }) => (
            <div key={label} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-[hsl(var(--foreground))]">{label}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{desc}</p>
              </div>
              <Button
                size="sm"
                variant={status === "live" ? "default" : "outline"}
                disabled={disabled || anyLifecyclePending}
                onClick={() => handleLifecycle(status, mutation)}
              >
                {status === "live" && <Radio className="h-3.5 w-3.5 mr-1.5" />}
                {mutation.isPending ? "…" : action}
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Danger Zone ── */}
      <Card className="attend-card p-5" style={{ borderColor: "#fecaca" }}>
        <h2 className="font-semibold text-red-600 mb-4">Danger Zone</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[hsl(var(--foreground))]">Cancel Event</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              This will notify all registered attendees.
            </p>
          </div>
          <Button
            size="sm"
            variant="destructive"
            disabled={
              ["CANCELLED", "cancelled", "ENDED", "ended"].includes(currentStatus) ||
              anyLifecyclePending
            }
            onClick={() => handleLifecycle("cancelled", cancelMutation)}
          >
            {cancelMutation.isPending ? "Cancelling…" : "Cancel Event"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
