"use client";
import { Globe, Mail, Monitor, MapPin, Video } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Toggle, FormatPicker, ReviewRow, OrgChip } from "./shared";
import type { GeneralState } from "./state-hooks";

// ─── Shared validation helpers ───────────────────────────────────────────────

const MIN_CHARS = 30;

function WordCounter({ text, label }: { text: string; label: string }) {
  const count = text.length;
  const ok = count >= MIN_CHARS;
  return (
    <p className={cn("text-xs mt-1", ok ? "text-green-600" : "text-[hsl(var(--muted-foreground))]")}>
      {ok
        ? `✓ ${count} characters — looks good`
        : `${count} / ${MIN_CHARS} characters minimum for ${label}`}
    </p>
  );
}

// ─── Step 0 — Event Basics ────────────────────────────────────────────────────

export function GeneralStep0({ s, organiserName, showErrors = false }: { s: GeneralState; organiserName: string; showErrors?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label className="mb-2 block">Event Title <span className="text-red-500">*</span></Label>
        <Input placeholder="e.g. Q3 Investor Day 2025" value={s.title}
          onChange={(e) => s.setTitle(e.target.value)}
          className={cn(showErrors && !s.title.trim() && "border-red-400 focus-visible:ring-red-200")} />
        {showErrors && !s.title.trim() && <p className="text-xs text-red-500 mt-1">Event title is required.</p>}
      </div>

      <div>
        <Label className="mb-2 block">Description <span className="text-red-500">*</span></Label>
        <textarea rows={3} placeholder="Describe the event — agenda, speakers, what attendees should expect…"
          value={s.description} onChange={(e) => s.setDescription(e.target.value)}
          className={cn("flex w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none",
            showErrors && s.description.length < MIN_CHARS && "border-red-500")} />
        <WordCounter text={s.description} label="description" />
      </div>

      <OrgChip name={organiserName} />

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label className="mb-2 block">Date <span className="text-red-500">*</span></Label>
          <Input type="date" value={s.date} onChange={(e) => s.setDate(e.target.value)}
            className={cn(showErrors && !s.date && "border-red-400 focus-visible:ring-red-200")} />
          {showErrors && !s.date && <p className="text-xs text-red-500 mt-1">Date is required.</p>}
        </div>
        <div><Label className="mb-2 block">Start Time</Label><Input type="time" value={s.time} onChange={(e) => s.setTime(e.target.value)} /></div>
        <div><Label className="mb-2 block">End Time</Label><Input type="time" value={s.endTime} onChange={(e) => s.setEndTime(e.target.value)} /></div>
      </div>

      <FormatPicker value={s.format} onChange={s.setFormat} />

      {(s.format === "virtual" || s.format === "hybrid") && !s.enableZoomMeeting && (
        <div>
          <Label className="mb-2 block"><Monitor className="h-3.5 w-3.5 inline mr-1" />Stream URL</Label>
          <Input placeholder="https://youtube.com/live/... or https://zoom.us/j/..." value={s.streamUrl} onChange={(e) => s.setStreamUrl(e.target.value)} />
        </div>
      )}
      {(s.format === "virtual" || s.format === "hybrid") && s.enableZoomMeeting && (
        <div className="rounded-lg border border-[#0B5CFF]/30 bg-[#0B5CFF]/05 px-4 py-3 flex items-center gap-2">
          <Video className="h-4 w-4 text-[#0B5CFF] shrink-0" />
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Stream URL will be set automatically from the Zoom meeting join link after creation.
          </p>
        </div>
      )}
      {(s.format === "in_person" || s.format === "hybrid") && (
        <div><Label className="mb-2 block"><MapPin className="h-3.5 w-3.5 inline mr-1" />Venue</Label>
          <Input placeholder="e.g. Four Points by Sheraton, Oniru" value={s.venue} onChange={(e) => s.setVenue(e.target.value)} /></div>
      )}

      <div><Label className="mb-2 block">Capacity</Label>
        <Input type="number" placeholder="e.g. 500" value={s.capacity} onChange={(e) => s.setCapacity(e.target.value)} /></div>

      <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Featured Event</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Highlight this event on the homepage and discovery feeds</p>
        </div>
        <Toggle checked={s.featured} onChange={s.setFeatured} color="#0f766e" />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-[hsl(var(--foreground))] flex items-center gap-1.5">
            <Video className="h-3.5 w-3.5 text-[#0B5CFF]" /> Auto-Create Zoom Meeting
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Backend creates a Zoom meeting and provides a join link automatically</p>
        </div>
        <Toggle checked={s.enableZoomMeeting} onChange={s.setEnableZoomMeeting} color="#0B5CFF" />
      </div>

      {s.enableZoomMeeting && (
        <div>
          <Label className="mb-2 block">Zoom Meeting Duration (minutes)</Label>
          <Input
            type="number"
            min={30}
            max={480}
            placeholder="120"
            value={s.zoomDurationMinutes}
            onChange={(e) => s.setZoomDurationMinutes(e.target.value)}
          />
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Default is 120 minutes (2 hours).</p>
        </div>
      )}
    </div>
  );
}

// ─── Step 1 — Audience & Settings ────────────────────────────────────────────

export function GeneralAudienceStep({ s }: { s: GeneralState }) {
  return (
    <div className="flex flex-col gap-4">
      <Label className="block">Audience Targeting</Label>
      {([
        ["open",   Globe, "Open registration",  "Anyone can register for this event"],
        ["invite", Mail,  "Invite only",         "Only users you explicitly invite can register"],
      ] as const).map(([val, Icon, lbl, desc]) => (
        <label key={val} className={cn("flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
          s.audienceMode === val ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.04)]" : "border-[hsl(var(--border))]")}>
          <input type="radio" name="audience" value={val} checked={s.audienceMode === val}
            onChange={() => s.setAudienceMode(val)} className="mt-0.5 accent-[hsl(var(--primary))]" />
          <div>
            <p className="text-sm font-semibold text-[hsl(var(--foreground))] flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />{lbl}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{desc}</p>
          </div>
        </label>
      ))}
    </div>
  );
}

// ─── Review ───────────────────────────────────────────────────────────────────

export function GeneralReview({ s, organiserName }: { s: GeneralState; organiserName: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div><p className="attend-section-title mb-2">Event Details</p>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 divide-y divide-[hsl(var(--border))]">
          <ReviewRow label="Title"      value={s.title} />
          {s.description && <ReviewRow label="Description" value={s.description} />}
          <ReviewRow label="Organiser"  value={organiserName} />
          <ReviewRow label="Date"       value={s.date} />
          <ReviewRow label="Start Time" value={s.time || "—"} />
          {s.endTime && <ReviewRow label="End Time" value={s.endTime} />}
          <ReviewRow label="Format"     value={s.format} />
          <ReviewRow label="Capacity"   value={s.capacity || "Unlimited"} />
          <ReviewRow label="Audience"   value={s.audienceMode === "invite" ? "Invite only" : "Open registration"} />
          {s.featured && <ReviewRow label="Featured" value="Yes" />}
        </div>
      </div>
    </div>
  );
}
