"use client";
import { useState } from "react";
import { Radio, Star, Video, ExternalLink, Copy, Check, RefreshCw, Archive, Presentation, CalendarClock, AlertTriangle, Mic } from "lucide-react";
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
  useRetainEventData,
  type ZoomMeetingDto,
  useWebinarAvailability,
  type ZoomEntityType,
} from "@/api/client-events";
import { popup } from "@/lib/popup-store";
import { EventGuestAccessCard } from "./EventGuestAccessCard";
import { EventPanelistsCard } from "./EventPanelistsCard";
import { ImageUrlUpload } from "@/components/custom/image-url-upload";

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
  endDate?:        string | null;
  startTime?:       string;
  venue?:           string;
  streamUrl?:       string;
  maximumCapacity?: number | null;
  currentStatus:    string;
  isProductLaunch?: boolean;
  /**
   * Innovation Challenge / Hackathon. Challenge events accept the same optional `flyerUrl`
   * as product launches from the backend's 2026-09-14 change — before that, UpdateEventRequest
   * had the field but only ever applied it to launches.
   */
  isChallenge?:     boolean;
  flyerUrl?:        string;
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
  endDate:          initialEndDate      = "",
  startTime:        initialStartTime    = "",
  venue:            initialVenue        = "",
  streamUrl:        initialStreamUrl    = "",
  maximumCapacity:  initialCapacity     = null,
  currentStatus,
  isProductLaunch = false,
  isChallenge     = false,
  flyerUrl: initialFlyerUrl = "",
  featured:         initialFeatured     = false,
  zoomMeeting:      initialZoomMeeting  = null,
  onStatusChange,
}: Props) {
  // Every event type carries an optional flyer as of the backend's 2026-09-14 change —
  // it moved from the per-type config tables onto the event itself. `isProductLaunch` and
  // `isChallenge` are kept because other parts of this form still branch on them.
  const canHaveFlyer = true;

  const [titleVal,         setTitleVal]         = useState(initialTitle ?? "");
  const [descVal,          setDescVal]          = useState(initialDescription ?? "");
  const [formatVal,        setFormatVal]        = useState(initialFormat ?? "");
  const [dateVal,          setDateVal]          = useState(initialDate ?? "");
  const [endDateVal,       setEndDateVal]       = useState(initialEndDate ?? "");
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
  const [flyerUrl,     setFlyerUrl]     = useState(initialFlyerUrl);

  const updateMutation         = useUpdateEvent();
  const publishMutation        = usePublishEvent();
  const goLiveMutation         = useGoLiveEvent();
  const endMutation            = useEndEvent();
  const cancelMutation         = useCancelEvent();
  const toggleFeaturedMutation = useToggleEventFeatured();
  const zoomMutation           = useCreateEventZoomMeeting();
  const updateStreamMutation   = useUpdateStreamUrl();
  const retainDataMutation     = useRetainEventData();
  const [dataRetained, setDataRetained] = useState(false);

  function copyJoinUrl() {
    if (!zoomMeeting?.joinUrl) return;
    navigator.clipboard.writeText(zoomMeeting.joinUrl).then(() => {
      setCopiedJoin(true);
      setTimeout(() => setCopiedJoin(false), 2000);
    });
  }

  /**
   * `type` is deliberately optional. Omitting it tells the backend "keep whatever
   * this event already has", which is what a plain token refresh must do — sending
   * MEETING to refresh a webinar would come back as ZOOM_TYPE_MISMATCH.
   */
  function handleCreateZoom(forceNew = false, type?: ZoomEntityType) {
    zoomMutation.mutate(
      { eventId, durationMinutes: parseInt(zoomDuration, 10) || 120, forceNew, type },
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

  // §7f: a full regenerate mints a brand-new meeting on a (possibly different) pooled
  // host and REPLACES the current one — everyone already connected is disconnected and
  // the join URL changes. Guard it behind a confirm; plain "Refresh" (forceNew=false)
  // stays the safe, idempotent default.
  function handleRegenerateZoom() {
    popup.confirm(
      "Regenerate Zoom meeting?",
      "This creates a brand-new meeting (possibly on a different host account) and replaces the current one. Anyone already connected will be disconnected and the join URL will change. If you only need a fresh host token, use “Refresh” instead.",
      () => handleCreateZoom(true),
      undefined,
      "Regenerate",
      "Cancel",
    );
  }

  // ── Webinar availability ─────────────────────────────────────────────────
  // One licence, one webinar at a time, so the slot is reserved against the
  // event's own date and start time. We ask BEFORE the organiser commits —
  // the whole point of booking at scheduling time is that nobody discovers the
  // clash with shareholders already waiting.
  const durationMins = parseInt(zoomDuration, 10) || 120;
  const canCheckWebinar = !zoomMeeting && !!dateVal && !!timeVal;
  const { data: webinarSlot, isFetching: slotChecking } = useWebinarAvailability(
    dateVal, timeVal, durationMins, eventId, { enabled: canCheckWebinar },
  );

  /** "12:00" + 30 → "12:30". Used to tell the organiser when the licence frees up. */
  function addMinutes(hhmm: string, mins: number): string {
    const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
    const total = ((h * 60 + m + mins) % 1440 + 1440) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  const conflict      = webinarSlot?.conflict;
  const noWebinarHost = webinarSlot?.reason === "NO_WEBINAR_HOST";
  const webinarFree   = webinarSlot?.available === true;
  const isWebinar     = zoomMeeting?.type === "WEBINAR";

  function handleSwitchZoomType(to: ZoomEntityType) {
    const toWebinar = to === "WEBINAR";
    popup.confirm(
      toWebinar ? "Switch to a webinar?" : "Switch to a standard meeting?",
      toWebinar
        ? "This replaces the current Zoom meeting with a webinar and books the single webinar licence for this event's time slot. The join URL changes and anyone already connected is disconnected. Attendees will be view-only — only panelists can speak."
        : "This replaces the webinar with a standard Zoom meeting and releases the webinar licence. The join URL changes, anyone already connected is disconnected, and the panelist list is cleared. Every attendee will be able to unmute themselves.",
      () => handleCreateZoom(true, to),
      undefined,
      toWebinar ? "Switch to webinar" : "Switch to meeting",
      "Cancel",
    );
  }

  const anyLifecyclePending =
    publishMutation.isPending ||
    goLiveMutation.isPending  ||
    endMutation.isPending     ||
    cancelMutation.isPending;

  const normalizedStatus = currentStatus.toLowerCase();
  const isPublished = normalizedStatus === "published" || normalizedStatus === "live" || normalizedStatus === "ended";
  const isLive = normalizedStatus === "live";
  const flyerLocked = ["live", "ended", "cancelled"].includes(normalizedStatus);

  function handleLifecycle(
    status: "published" | "live" | "ended" | "cancelled",
    mutation: { mutate: (id: string, opts?: any) => void; isPending: boolean }
  ) {
    mutation.mutate(eventId, { onSuccess: () => onStatusChange(status) });
  }

  function confirmLifecycle(
    status: "published" | "live" | "ended" | "cancelled",
    mutation: { mutate: (id: string, opts?: any) => void; isPending: boolean }
  ) {
    if (status === "ended") {
      popup.confirm(
        "End Event",
        "End this live event for everyone? Attendee access will close and the linked Zoom meeting will also be ended when the backend completes the action.",
        () => handleLifecycle(status, mutation),
        undefined,
        "End Event"
      );
      return;
    }
    if (status === "cancelled") {
      popup.confirm(
        "Cancel Event",
        "Cancel this event? Registered attendees will be notified and the linked Zoom meeting will be ended if it is currently running.",
        () => handleLifecycle(status, mutation),
        undefined,
        "Cancel Event"
      );
      return;
    }
    handleLifecycle(status, mutation);
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
        // Sent only when there is one. Leaving it out keeps the current value;
        // sending it equal to `date` is how an event becomes single-day again,
        // which is what clearing the field below does.
        endDate:         endDateVal         || (dateVal || undefined),
        startTime:       timeVal            || undefined,
        venue:           venueVal.trim()    || undefined,
        streamUrl:       streamVal.trim()   || undefined,
        maximumCapacity: !isNaN(cap) && cap > 0 ? cap : undefined,
        flyerUrl:         canHaveFlyer ? flyerUrl : undefined,
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

          {/* Date + End date + Start time */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <FieldLabel>Date</FieldLabel>
              <Input
                type="date"
                value={dateVal}
                onChange={(e) => {
                  const next = e.target.value;
                  // Dragging the start past the end would be rejected by the
                  // API; carry the end along instead of failing on save.
                  if (endDateVal && endDateVal < next) setEndDateVal(next);
                  setDateVal(next);
                }}
              />
            </div>
            <div>
              <FieldLabel>End date</FieldLabel>
              <Input
                type="date"
                min={dateVal || undefined}
                value={endDateVal}
                onChange={(e) => setEndDateVal(e.target.value)}
              />
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                {endDateVal ? "Clear to make it a single day." : "Leave blank for a single-day event."}
              </p>
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

          {canHaveFlyer && (
            <ImageUrlUpload
              value={flyerUrl}
              onChange={setFlyerUrl}
              disabled={flyerLocked}
              helpText={flyerLocked ? "Flyers cannot be changed once an event is live, ended or cancelled." : undefined}
            />
          )}

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

      {/* ── Guest Access (AGM milestone #2) ── */}
      <EventGuestAccessCard eventId={eventId} />

      {/* ── Zoom Meeting ── */}
      <Card className="attend-card p-5">
        <h2 className="font-semibold text-[hsl(var(--foreground))] flex items-center gap-2 mb-4">
          {isWebinar
            ? <Presentation className="h-4 w-4 text-[#7c22c9]" />
            : <Video className="h-4 w-4 text-[#0B5CFF]" />}
          {isWebinar ? "Zoom Webinar" : "Zoom Meeting"}
          {isWebinar && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#7c22c9]/10 text-[#7c22c9]">
              View-only attendees
            </span>
          )}
        </h2>

        {zoomMeeting ? (
          <div className="flex flex-col gap-3">
            {/* Info rows */}
            <div className="rounded-xl border border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))]">
              {[
                { label: isWebinar ? "Webinar ID" : "Meeting ID", value: String(zoomMeeting.webinarId ?? zoomMeeting.meetingId) },
                { label: "Password",   value: zoomMeeting.password },
                { label: "Duration",   value: `${zoomMeeting.durationMinutes} min` },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-[hsl(var(--muted-foreground))] font-medium">{label}</span>
                  <span className="text-xs font-mono text-[hsl(var(--foreground))]">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={zoomMeeting.joinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-[#0B5CFF] hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open Join URL
              </a>
              {zoomMeeting.startUrl && (
                <a
                  href={zoomMeeting.startUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--foreground))] hover:underline"
                  title="Host start link — opens the meeting as host. Don't share this; the Join URL is for attendees."
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Start as Host
                </a>
              )}
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
              {zoomMeeting.startUrl && " The host start link is for the organiser only — share only the Join URL with attendees."}
            </p>

            {/* Refresh meeting — gets a fresh token (fixes expired ZAK / "code 200" errors) */}
            <div className="flex items-center gap-2 pt-2 border-t border-[hsl(var(--border))]">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[hsl(var(--foreground))]">Refresh {isWebinar ? "Webinar" : "Meeting"} Token</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Fix "Not support start meeting" or "already in progress" errors. Keeps the same {isWebinar ? "webinar" : "meeting"} and join URL.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs shrink-0"
                disabled={zoomMutation.isPending}
                onClick={() => handleCreateZoom(false)}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${zoomMutation.isPending ? "animate-spin" : ""}`} />
                {zoomMutation.isPending ? "Refreshing…" : "Refresh"}
              </Button>
            </div>

            {/* Regenerate meeting — brand-new meeting on a (possibly different) pooled
                host; strands anyone already connected, so it's confirm-guarded (§7f). */}
            <div className="flex items-center gap-2 pt-2 border-t border-[hsl(var(--border))]">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[hsl(var(--foreground))]">
                  Regenerate {isWebinar ? "Webinar" : "Meeting"}
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {isWebinar
                    ? "Book a fresh webinar for this slot. The new booking is taken before the old one is released, so a clash leaves your current link working. Panelists carry over."
                    : "Create a new meeting on a fresh host. Disconnects anyone already in the current meeting and changes the join URL."}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs shrink-0 text-[#dc2626] border-[#dc262640] hover:bg-[#dc262610]"
                disabled={zoomMutation.isPending}
                onClick={handleRegenerateZoom}
              >
                <Video className="h-3.5 w-3.5" />
                Regenerate
              </Button>
            </div>

            {/* Switch between the two kinds. Separate from Regenerate because the
                consequence is different in kind, not degree: a meeting lets every
                attendee unmute, a webinar does not. */}
            <div className="flex items-center gap-2 pt-2 border-t border-[hsl(var(--border))]">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[hsl(var(--foreground))]">
                  Switch to a {isWebinar ? "standard meeting" : "webinar"}
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {isWebinar
                    ? "Releases the webinar licence and clears the panelist list. Everyone will be able to unmute."
                    : "Books the single webinar licence for this slot. Attendees become view-only; only panelists can speak."}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs shrink-0"
                disabled={zoomMutation.isPending}
                onClick={() => handleSwitchZoomType(isWebinar ? "MEETING" : "WEBINAR")}
              >
                {isWebinar ? <Video className="h-3.5 w-3.5" /> : <Presentation className="h-3.5 w-3.5" />}
                Switch
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              No Zoom session yet. Pick a duration, then choose a meeting or a webinar — the join
              URL becomes this event's stream URL either way.
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
            </div>

            {/* The two choices, side by side, with the difference stated. An organiser
                should not have to know Zoom's vocabulary to pick correctly. */}
            <div className="grid sm:grid-cols-2 gap-3">
              {/* Standard meeting */}
              <div className="rounded-xl border border-[hsl(var(--border))] p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-[#0B5CFF]" />
                  <span className="text-sm font-semibold text-[hsl(var(--foreground))]">Zoom Meeting</span>
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))] flex-1">
                  Everyone can unmute and turn on video. Right for working sessions and smaller
                  meetings. Always available.
                </p>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 text-xs bg-[#0B5CFF] hover:bg-[#0B5CFF]/90 text-white w-full"
                  disabled={zoomMutation.isPending}
                  onClick={() => handleCreateZoom(false, "MEETING")}
                >
                  <Video className={`h-3.5 w-3.5 ${zoomMutation.isPending ? "animate-spin" : ""}`} />
                  {zoomMutation.isPending ? "Creating…" : "Create Zoom Meeting"}
                </Button>
              </div>

              {/* Webinar — one licence, one at a time */}
              <div className="rounded-xl border border-[hsl(var(--border))] p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Presentation className="h-4 w-4 text-[#7c22c9]" />
                  <span className="text-sm font-semibold text-[hsl(var(--foreground))]">Webinar</span>
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))] flex-1">
                  Attendees are view-only and ask questions through Q&amp;A. Only panelists you name
                  can speak. Right for an AGM. One event at a time across the whole platform.
                </p>
                {/* Panelists are keyed on a Zoom webinar id, so the list cannot exist
                    before the webinar does. Say so here rather than letting the card
                    appear out of nowhere later — it reads as a missing feature. */}
                <p className="text-xs text-[hsl(var(--muted-foreground))] flex items-start gap-1.5">
                  <Mic className="h-3.5 w-3.5 shrink-0 mt-px" />
                  A <strong>Panelists</strong> section appears on this tab once the webinar exists,
                  for naming who can speak.
                </p>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 text-xs bg-[#7c22c9] hover:bg-[#7c22c9]/90 text-white w-full disabled:opacity-50"
                  disabled={zoomMutation.isPending || slotChecking || !webinarFree}
                  onClick={() => handleCreateZoom(false, "WEBINAR")}
                >
                  <Presentation className={`h-3.5 w-3.5 ${zoomMutation.isPending ? "animate-spin" : ""}`} />
                  {zoomMutation.isPending ? "Creating…" : slotChecking ? "Checking…" : "Create Webinar"}
                </Button>
              </div>
            </div>

            {/* Why the webinar button is off. Never leave a disabled button unexplained. */}
            {!canCheckWebinar && (
              <p className="text-xs text-[hsl(var(--muted-foreground))] flex items-start gap-1.5">
                <CalendarClock className="h-3.5 w-3.5 shrink-0 mt-px" />
                Set this event's date and start time above and save, then the webinar slot can be
                checked. A webinar is booked against a specific time, unlike a meeting.
              </p>
            )}

            {canCheckWebinar && webinarFree && (
              <p className="text-xs text-green-700 flex items-start gap-1.5">
                <Check className="h-3.5 w-3.5 shrink-0 mt-px" />
                The webinar licence is free on {dateVal} at {timeVal} for {durationMins} minutes.
              </p>
            )}

            {canCheckWebinar && noWebinarHost && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-px" />
                <span>
                  No webinar licence is set up yet, so only standard meetings can be created. A super
                  admin needs to add a webinar-capable Zoom account under Zoom Sessions.
                </span>
              </div>
            )}

            {canCheckWebinar && conflict && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-px" />
                <div className="flex flex-col gap-1">
                  <span className="font-semibold">
                    The webinar licence is already booked {conflict.startTime}–{conflict.endsAt} on {conflict.date}
                    {conflict.endDate ? ` (ends ${conflict.endDate})` : ""}.
                  </span>
                  {/* A different registrar's booking is deliberately anonymous —
                      we only ever get the window back, never the event. */}
                  {conflict.sameOrganisation && conflict.eventTitle ? (
                    <span>
                      Held by your own event{" "}
                      {conflict.eventId
                        ? <a href={`/events/${conflict.eventId}`} className="underline font-medium">{conflict.eventTitle}</a>
                        : <span className="font-medium">{conflict.eventTitle}</span>}.
                    </span>
                  ) : (
                    <span>It is held by another organisation&apos;s event.</span>
                  )}
                  <span>
                    Webinars need {conflict.bufferMinutes ?? 30} minutes between them, so the licence is
                    free again from <strong>{addMinutes(conflict.endsAt, conflict.bufferMinutes ?? 30)}</strong>.
                  </span>
                  <span className="mt-0.5">
                    Move this event to a free time, contact a super admin about a second licence, or
                    create a standard Zoom meeting instead.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Panelists — webinars only ── */}
      {isWebinar && <EventPanelistsCard eventId={eventId} />}

      {/* ── Status Controls ── */}
      <Card className="attend-card p-5">
        <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4">Status Controls</h2>
        <div className="flex flex-col divide-y divide-[hsl(var(--border))]">
          {[
            {
              label:    isPublished ? "Published" : "Publish Event",
              desc:     isPublished ? "Event is visible and open for RSVPs" : "Make event visible and open RSVPs",
              action:   isPublished ? "Published" : "Publish",
              status:   "published" as const,
              mutation: publishMutation,
              completed: isPublished,
              disabled: ["published", "live", "ended", "cancelled"].includes(normalizedStatus),
            },
            {
              label:    isLive ? "Live" : "Go Live",
              desc:     isLive ? "Live stream and event are active" : "Start the live stream and event",
              action:   isLive ? "Live" : "Go Live",
              status:   "live" as const,
              mutation: goLiveMutation,
              completed: isLive,
              disabled: ["draft", "live", "ended", "cancelled"].includes(normalizedStatus),
            },
            {
              label:    "End Event",
              desc:     "Mark event as concluded",
              action:   "End Event",
              status:   "ended" as const,
              mutation: endMutation,
              completed: false,
              disabled: !isLive,
            },
          ].map(({ label, desc, action, status, mutation, completed, disabled }) => (
            <div key={label} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-[hsl(var(--foreground))]">{label}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{desc}</p>
              </div>
              <Button
                size="sm"
                variant={status === "live" ? "default" : "outline"}
                disabled={disabled || anyLifecyclePending}
                onClick={() => confirmLifecycle(status, mutation)}
              >
                {completed ? (
                  status === "live" ? <Radio className="h-3.5 w-3.5 mr-1.5" /> : <Check className="h-3.5 w-3.5 mr-1.5" />
                ) : status === "live" ? (
                  <Radio className="h-3.5 w-3.5 mr-1.5" />
                ) : null}
                {mutation.isPending ? "…" : action}
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Data Retention — only relevant once the event has ended ── */}
      {["ENDED", "ended"].includes(currentStatus) && (
        <Card className="attend-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
                <Archive className="h-4 w-4" />
                Retain Event Data
              </h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 max-w-md">
                Ended events are auto-purged after 7 days by default. Retain this event's data to keep it indefinitely.
              </p>
            </div>
            <Button
              size="sm"
              variant={dataRetained ? "default" : "outline"}
              disabled={retainDataMutation.isPending || dataRetained}
              className="gap-1.5 min-w-[110px] shrink-0"
              onClick={() =>
                retainDataMutation.mutate(eventId, {
                  onSuccess: () => setDataRetained(true),
                })
              }
            >
              <Archive className="h-3.5 w-3.5" />
              {retainDataMutation.isPending ? "…" : dataRetained ? "Retained" : "Retain Data"}
            </Button>
          </div>
        </Card>
      )}

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
            onClick={() => confirmLifecycle("cancelled", cancelMutation)}
          >
            {cancelMutation.isPending ? "Cancelling…" : "Cancel Event"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
