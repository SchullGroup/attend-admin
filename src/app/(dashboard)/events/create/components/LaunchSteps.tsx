"use client";
import { Plus, Trash2, Lock, Globe, Mail, Monitor, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Toggle, FormatPicker, ReviewRow, OrgChip } from "./shared";
import type { LaunchState } from "./state-hooks";

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

export function LaunchStep0({ s, organiserName, showErrors = false }: { s: LaunchState; organiserName: string; showErrors?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label className="mb-2 block">Event Title <span className="text-red-500">*</span></Label>
        <Input placeholder="e.g. ZenithDirect 3.0 — Official Product Launch" value={s.title}
          onChange={(e) => s.setTitle(e.target.value)}
          className={cn(showErrors && !s.title.trim() && "border-red-400 focus-visible:ring-red-200")} />
        {showErrors && !s.title.trim() && <p className="text-xs text-red-500 mt-1">Event title is required.</p>}
      </div>

      <div>
        <Label className="mb-2 block">Description <span className="text-red-500">*</span></Label>
        <textarea rows={3} placeholder="Describe the launch event — what's happening, who's invited, and what attendees should expect…"
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

      {(s.format === "virtual" || s.format === "hybrid") && (
        <div>
          <Label className="mb-2 block"><Monitor className="h-3.5 w-3.5 inline mr-1" />Stream URL</Label>
          <Input placeholder="https://youtube.com/live/... or https://zoom.us/j/..." value={s.streamUrl} onChange={(e) => s.setStreamUrl(e.target.value)} />
        </div>
      )}
      {(s.format === "in_person" || s.format === "hybrid") && (
        <div><Label className="mb-2 block"><MapPin className="h-3.5 w-3.5 inline mr-1" />Venue</Label>
          <Input placeholder="e.g. Eko Hotels, Victoria Island" value={s.venue} onChange={(e) => s.setVenue(e.target.value)} /></div>
      )}

      <div><Label className="mb-2 block">Capacity</Label>
        <Input type="number" placeholder="e.g. 2000" value={s.capacity} onChange={(e) => s.setCapacity(e.target.value)} /></div>

      <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Featured Event</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Highlight this event on the homepage and discovery feeds</p>
        </div>
        <Toggle checked={s.featured} onChange={s.setFeatured} color="#b45309" />
      </div>
    </div>
  );
}

// ─── Step 1 — Product Details ─────────────────────────────────────────────────

export function LaunchStep1({ s, showErrors = false }: { s: LaunchState; showErrors?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label className="mb-2 block">Product Name <span className="text-red-500">*</span></Label>
        <Input placeholder="e.g. ZenithDirect 3.0" value={s.productName} onChange={(e) => s.setProductName(e.target.value)}
          className={cn(showErrors && !s.productName.trim() && "border-red-400 focus-visible:ring-red-200")} />
        {showErrors && !s.productName.trim() && <p className="text-xs text-red-500 mt-1">Product name is required.</p>}
      </div>
      <div><Label className="mb-2 block">Tagline</Label>
        <Input placeholder="e.g. Banking beyond boundaries." value={s.tagline} onChange={(e) => s.setTagline(e.target.value)} /></div>
      <div>
        <Label className="mb-2 block">Product Description</Label>
        <textarea rows={4} placeholder="Describe the product — what it does, who it's for, and why it matters."
          value={s.productDesc} onChange={(e) => s.setProductDesc(e.target.value)}
          className="flex w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none" />
      </div>
      <div>
        <Label className="mb-2 block">Microsite Slug</Label>
        <div className="flex items-center rounded-lg border border-[hsl(var(--border))] overflow-hidden">
          <span className="px-3 py-2 text-sm text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] border-r border-[hsl(var(--border))] shrink-0 whitespace-nowrap">attend.ng/launch/</span>
          <Input placeholder="zenith-direct-3" value={s.slug} onChange={(e) => s.setSlug(e.target.value)} className="border-0 rounded-none focus-visible:ring-0" />
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Public microsite URL auto-generated from your event</p>
      </div>
    </div>
  );
}

// ─── Step 2 — Speakers ────────────────────────────────────────────────────────

export function LaunchSpeakersStep({ s }: { s: LaunchState }) {
  return (
    <div className="flex flex-col gap-4">
      {s.speakers.map((sp, idx) => (
        <div key={sp.id} className="rounded-xl border border-[hsl(var(--border))] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Speaker {idx + 1}</span>
            {s.speakers.length > 1 && (
              <button type="button" onClick={() => s.removeSpeaker(sp.id)} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                <Trash2 className="h-3 w-3" /> Remove
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="mb-1.5 block">Name</Label><Input placeholder="Dr. Jane Smith" value={sp.name} onChange={(e) => s.updateSpeaker(sp.id, "name", e.target.value)} /></div>
            <div><Label className="mb-1.5 block">Role / Title</Label><Input placeholder="CEO" value={sp.role} onChange={(e) => s.updateSpeaker(sp.id, "role", e.target.value)} /></div>
          </div>
          <div>
            <Label className="mb-1.5 block">Bio <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></Label>
            <textarea rows={2} placeholder="Brief speaker biography..." value={sp.bio}
              onChange={(e) => s.updateSpeaker(sp.id, "bio", e.target.value)}
              className="flex w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none" />
          </div>
        </div>
      ))}
      <button type="button" onClick={s.addSpeaker} className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--primary))] hover:opacity-70">
        <Plus className="h-4 w-4" /> Add speaker
      </button>
    </div>
  );
}

// ─── Step 3 — Embargo & Audience ─────────────────────────────────────────────

export function LaunchEmbargoStep({ s }: { s: LaunchState }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-semibold text-[hsl(var(--foreground))] mb-1 flex items-center gap-2">
          <Lock className="h-4 w-4 text-[#b45309]" /> Document Embargo
        </p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">Lock documents until a release moment. They unlock automatically when the event goes live.</p>
        <div className="flex items-center justify-between p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] mb-3">
          <div>
            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Enable embargo</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Lock press release, product specs until release time</p>
          </div>
          <Toggle checked={s.embargoEnabled} onChange={s.setEmbargoEnabled} color="#b45309" />
        </div>
        {s.embargoEnabled && (
          <div><Label className="mb-2 block">Release at</Label>
            <Input type="datetime-local" value={s.embargoAt} onChange={(e) => s.setEmbargoAt(e.target.value)} className="max-w-xs" />
          </div>
        )}
      </div>
      <div className="border-t border-[hsl(var(--border))] pt-5">
        <Label className="mb-3 block">Audience Targeting</Label>
        {([["open", Globe, "Open registration", "Anyone can register for this event"], ["invite", Mail, "Invite only", "Only users you explicitly invite can register"]] as const).map(([val, Icon, lbl, desc]) => (
          <label key={val} className={cn("flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all mb-2",
            s.audienceMode === val ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.04)]" : "border-[hsl(var(--border))]")}>
            <input type="radio" name="audience" value={val} checked={s.audienceMode === val} onChange={() => s.setAudienceMode(val)} className="mt-0.5 accent-[hsl(var(--primary))]" />
            <div>
              <p className="text-sm font-semibold text-[hsl(var(--foreground))] flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />{lbl}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{desc}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Review ───────────────────────────────────────────────────────────────────

export function LaunchReview({ s, organiserName }: { s: LaunchState; organiserName: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div><p className="attend-section-title mb-2">Event Details</p>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 divide-y divide-[hsl(var(--border))]">
          <ReviewRow label="Title" value={s.title} />
          {s.description && <ReviewRow label="Description" value={s.description} />}
          <ReviewRow label="Company" value={organiserName} />
          <ReviewRow label="Date" value={s.date} />
          <ReviewRow label="Start Time" value={s.time || "—"} />
          {s.endTime && <ReviewRow label="End Time" value={s.endTime} />}
          <ReviewRow label="Format" value={s.format} />
          <ReviewRow label="Capacity" value={s.capacity || "Unlimited"} />
          {s.featured && <ReviewRow label="Featured" value="Yes" />}
        </div>
      </div>
      <div><p className="attend-section-title mb-2">Product</p>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 divide-y divide-[hsl(var(--border))]">
          <ReviewRow label="Product Name" value={s.productName} />
          <ReviewRow label="Tagline" value={s.tagline} />
          <ReviewRow label="Microsite" value={s.slug ? `attend.ng/launch/${s.slug}` : ""} />
          <ReviewRow label="Embargo" value={s.embargoEnabled ? `Enabled — ${s.embargoAt}` : "Disabled"} />
        </div>
      </div>
    </div>
  );
}
