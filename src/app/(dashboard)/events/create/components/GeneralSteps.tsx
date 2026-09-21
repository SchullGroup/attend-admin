"use client";
import { Globe, Mail, Monitor, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ImageUrlUpload } from "@/components/custom/image-url-upload";
import { Toggle, FormatPicker, ReviewRow, OrgChip, todayISO, nextEndTime, minStartTimeToday, startTimeTooSoon } from "./shared";
import { MAX_SHORT } from "./HackathonSteps";
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
        <Input maxLength={MAX_SHORT} placeholder="e.g. Q3 Investor Day 2025" value={s.title}
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
          <Input type="date" min={todayISO()} value={s.date} onChange={(e) => {
              const next = e.target.value;
              // Moving onto today can strand a start time that has already gone.
              if (next === todayISO() && s.time && s.time < minStartTimeToday()) {
                const earliest = minStartTimeToday();
                s.setEndTime(nextEndTime(s.time, earliest, s.endTime));
                s.setTime(earliest);
              }
              s.setDate(next);
            }}
            className={cn(showErrors && !s.date && "border-red-400 focus-visible:ring-red-200")} />
          {showErrors && !s.date && <p className="text-xs text-red-500 mt-1">Date is required.</p>}
        </div>
        <div><Label className="mb-2 block">Start Time</Label>
          {/* Moving the start carries the end with it, so nobody has to set the
              same thing twice. An end time the user chose themselves is kept. */}
          <Input type="time" min={s.date === todayISO() ? minStartTimeToday() : undefined}
            value={s.time} onChange={(e) => {
              const next = e.target.value;
              s.setEndTime(nextEndTime(s.time, next, s.endTime));
              s.setTime(next);
            }} />
          {startTimeTooSoon(s.date, s.time) && (
            <p className="text-xs text-amber-600 mt-1">Already passed — starts need about an hour&apos;s notice.</p>
          )}
        </div>
        <div><Label className="mb-2 block">End Time</Label>
          <Input type="time" min={s.time} value={s.endTime} onChange={(e) => s.setEndTime(e.target.value)} />
          {s.endTime && s.time && s.endTime <= s.time && (
            <p className="text-xs text-red-500 mt-1">End time must be after the start time.</p>
          )}
        </div>
      </div>

      <FormatPicker value={s.format} onChange={s.setFormat} />

      {(s.format === "virtual" || s.format === "hybrid") && (
        <div>
          <Label className="mb-2 block"><Monitor className="h-3.5 w-3.5 inline mr-1" />Stream URL <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">— optional</span></Label>
          <Input maxLength={MAX_SHORT} placeholder="https://youtube.com/live/... or https://zoom.us/j/..." value={s.streamUrl} onChange={(e) => s.setStreamUrl(e.target.value)} />
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Optional — paste a link now, or add one (or generate a Zoom meeting) later from the event&apos;s Settings tab.</p>
        </div>
      )}
      {(s.format === "in_person" || s.format === "hybrid") && (
        <div><Label className="mb-2 block"><MapPin className="h-3.5 w-3.5 inline mr-1" />Venue</Label>
          <Input maxLength={MAX_SHORT} placeholder="e.g. Four Points by Sheraton, Oniru" value={s.venue} onChange={(e) => s.setVenue(e.target.value)} /></div>
      )}

      <div><Label className="mb-2 block">Capacity</Label>
        <Input type="number" placeholder="e.g. 500" value={s.capacity} onChange={(e) => s.setCapacity(e.target.value)} /></div>

      {/* Optional flyer — top-level field on the event, every type (2026-09-14 §5.2). */}
      <div className="border-t border-[hsl(var(--border))] pt-5">
        <ImageUrlUpload
          value={s.flyerUrl}
          onChange={s.setFlyerUrl}
          folder="event-flyers"
          label="Event flyer (optional)"
          helpText="JPG, PNG or WebP. Shown on the event page — you can add it later from Settings."
        />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Featured Event</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Highlight this event on the homepage and discovery feeds</p>
        </div>
        <Toggle checked={s.featured} onChange={s.setFeatured} color="#0f766e" />
      </div>
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
          {s.flyerUrl && <ReviewRow label="Flyer" value="Uploaded" />}
          <ReviewRow label="Audience"   value={s.audienceMode === "invite" ? "Invite only" : "Open registration"} />
          {s.featured && <ReviewRow label="Featured" value="Yes" />}
        </div>
      </div>
    </div>
  );
}
