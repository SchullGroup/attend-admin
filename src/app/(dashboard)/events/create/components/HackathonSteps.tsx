"use client";
import { Plus, Trash2, Monitor, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ImageUrlUpload } from "@/components/custom/image-url-upload";
import { Toggle, FormatPicker, ReviewRow, OrgChip } from "./shared";
import type { HackState } from "./state-hooks";

const MIN_CHARS = 30;

/**
 * Backend rejects any of these short text fields over 200 characters with
 * "size must be between 0 and 200" — a message that names no field, so the
 * user cannot tell which one to shorten. Capping the inputs means the error
 * is never reached; the counter appears only as the limit approaches, so the
 * form stays quiet in normal use.
 */
export const MAX_SHORT = 200;

function LimitCounter({ value }: { value: string }) {
  const n = value.length;
  if (n < MAX_SHORT - 20) return null;
  return (
    <p className={cn("text-xs mt-1", n >= MAX_SHORT ? "text-red-500" : "text-amber-600")}>
      {n} / {MAX_SHORT} characters{n >= MAX_SHORT ? " — limit reached" : ""}
    </p>
  );
}

/** Earliest selectable submission deadline: tomorrow, 09:00 local. */
function minDeadline(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Judging weights must total exactly 100 before the step can be left.
 * Blank-weight rows are counted as 0 so an unfinished row cannot pass.
 */
export function judgingWeightsTotal(criteria: { weight: string }[]): number {
  return criteria.reduce((sum, c) => {
    const n = parseFloat(String(c.weight).replace(/[^0-9.]/g, ""));
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

export function judgingWeightsValid(criteria: { weight: string }[]): boolean {
  return Math.round(judgingWeightsTotal(criteria) * 100) / 100 === 100;
}
function WordCounter({ text, label }: { text: string; label: string }) {
  const count = text.length;
  const ok    = count >= MIN_CHARS;
  return (
    <p className={cn("text-xs mt-1", ok ? "text-green-600" : "text-[hsl(var(--muted-foreground))]")}>
      {ok
        ? `✓ ${count} characters — looks good`
        : `${count} / ${MIN_CHARS} characters minimum for ${label}`}
    </p>
  );
}

// ─── Step 0 — Challenge Basics ────────────────────────────────────────────────

export function HackStep0({ s, organiserName, showErrors = false }: { s: HackState; organiserName: string; showErrors?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label className="mb-2 block">Challenge Title <span className="text-red-500">*</span></Label>
        <Input maxLength={MAX_SHORT} placeholder="e.g. AccessFinTech Innovation Challenge 2025" value={s.title}
          onChange={(e) => s.setTitle(e.target.value)}
          className={cn(showErrors && !s.title.trim() && "border-red-400 focus-visible:ring-red-200")} />
        {showErrors && !s.title.trim() && <p className="text-xs text-red-500 mt-1">Title is required.</p>}
      </div>

      <div>
        <Label className="mb-2 block">Description <span className="text-red-500">*</span></Label>
        <textarea rows={3} placeholder="Overview of the challenge — purpose, expected impact, who should apply…"
          value={s.description} onChange={(e) => s.setDescription(e.target.value)}
          className={cn(
            "flex w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none",
            showErrors && s.description.length < MIN_CHARS && "border-red-400 focus:ring-red-200"
          )} />
        {s.description.trim()
          ? <WordCounter text={s.description} label="description" />
          : showErrors && <p className="text-xs text-red-500 mt-1">Description is required (min {MIN_CHARS} characters).</p>}
        {s.description.trim() && showErrors && s.description.length < MIN_CHARS && (
          <p className="text-xs text-red-500 mt-0.5">Please add at least {MIN_CHARS - s.description.length} more character{MIN_CHARS - s.description.length !== 1 ? "s" : ""}.</p>
        )}
      </div>

      <OrgChip name={organiserName} />

      <div>
        <Label className="mb-2 block">Theme / Tracks <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">— comma-separated</span></Label>
        <Input maxLength={MAX_SHORT} placeholder="e.g. Payments, Lending, InsurTech" value={s.theme} onChange={(e) => s.setTheme(e.target.value)} />
        <LimitCounter value={s.theme} />
        {(() => {
          const parts  = s.theme.split(",").map((t) => t.trim()).filter(Boolean);
          const seen   = new Set<string>();
          const dups   = parts.filter((t) => { const k = t.toLowerCase(); if (seen.has(k)) return true; seen.add(k); return false; });
          return dups.length > 0
            ? <p className="text-xs text-red-500 mt-1">Duplicate track{dups.length > 1 ? "s" : ""}: <strong>{dups.join(", ")}</strong> — each track name must be unique.</p>
            : <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Each comma-separated value becomes a selectable track for participants</p>;
        })()}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="mb-2 block">Start Date <span className="text-red-500">*</span></Label>
          <Input type="date" value={s.startDate} onChange={(e) => s.setStartDate(e.target.value)}
            className={cn(showErrors && !s.startDate && "border-red-400 focus-visible:ring-red-200")} />
          {showErrors && !s.startDate && <p className="text-xs text-red-500 mt-1">Start date is required.</p>}
        </div>
        <div>
          <Label className="mb-2 block">End Date</Label>
          <Input type="date" value={s.endDate} onChange={(e) => s.setEndDate(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div><Label className="mb-2 block">Start Time</Label><Input type="time" value={s.time} onChange={(e) => s.setTime(e.target.value)} /></div>
        <div><Label className="mb-2 block">End Time</Label><Input type="time" value={s.endTime} onChange={(e) => s.setEndTime(e.target.value)} /></div>
      </div>

      <FormatPicker value={s.format} onChange={s.setFormat} />

      {(s.format === "virtual" || s.format === "hybrid") && (
        <div>
          <Label className="mb-2 block"><Monitor className="h-3.5 w-3.5 inline mr-1" />Stream URL <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">— optional</span></Label>
          <Input maxLength={MAX_SHORT} placeholder="https://youtube.com/live/..." value={s.streamUrl} onChange={(e) => s.setStreamUrl(e.target.value)} />
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Optional — paste a link now, or add one (or generate a Zoom meeting) later from the event&apos;s Settings tab.</p>
        </div>
      )}
      {(s.format === "in_person" || s.format === "hybrid") && (
        <div><Label className="mb-2 block"><MapPin className="h-3.5 w-3.5 inline mr-1" />Venue</Label>
          <Input maxLength={MAX_SHORT} placeholder="e.g. CcHub, Yaba, Lagos" value={s.venue} onChange={(e) => s.setVenue(e.target.value)} /></div>
      )}

      <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Featured Event</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Highlight this challenge on the homepage and discovery feeds</p>
        </div>
        <Toggle checked={s.featured} onChange={s.setFeatured} color="#7c22c9" />
      </div>
    </div>
  );
}

// ─── Step 1 — Brief & Rules ───────────────────────────────────────────────────

export function HackBriefStep({ s, showErrors = false }: { s: HackState; showErrors?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label className="mb-2 block">Problem Statement <span className="text-red-500">*</span></Label>
        <textarea rows={4} placeholder="Describe the core problem participants should solve…"
          value={s.problemStatement} onChange={(e) => s.setProblemStatement(e.target.value)}
          className={cn(
            "flex w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none",
            showErrors && s.problemStatement.length < MIN_CHARS && "border-red-400 focus:ring-red-200"
          )} />
        {s.problemStatement.trim()
          ? <WordCounter text={s.problemStatement} label="problem statement" />
          : showErrors && <p className="text-xs text-red-500 mt-1">Problem statement is required (min {MIN_CHARS} characters).</p>}
        {s.problemStatement.trim() && showErrors && s.problemStatement.length < MIN_CHARS && (
          <p className="text-xs text-red-500 mt-0.5">Please add at least {MIN_CHARS - s.problemStatement.length} more character{MIN_CHARS - s.problemStatement.length !== 1 ? "s" : ""}.</p>
        )}
      </div>
      <div>
        <Label className="mb-2 block">Expected Deliverable</Label>
        <textarea rows={3} placeholder="What should teams submit? e.g. A working prototype + a 3-minute pitch video"
          value={s.deliverable} onChange={(e) => s.setDeliverable(e.target.value)}
          className="flex w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none" />
      </div>
      <div>
        <Label className="mb-2 block">Submission Deadline</Label>
        {/* A deadline of today is never meaningful for a challenge that has not
            opened yet, and the picker offered it. Earliest is tomorrow. */}
        <Input type="datetime-local" min={minDeadline()}
          value={s.submissionDeadline} onChange={(e) => s.setSubmissionDeadline(e.target.value)} className="max-w-xs" />
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Must be a future date — today is not selectable.</p>
      </div>
      <div>
        <Label className="mb-2 block">Allowed Tech Stack <span className="font-normal text-[hsl(var(--muted-foreground))] text-xs">(optional)</span></Label>
        <Input maxLength={MAX_SHORT} placeholder="e.g. React, Node.js, Python — or 'Any'" value={s.techStack} onChange={(e) => s.setTechStack(e.target.value)} />
        <LimitCounter value={s.techStack} />
      </div>
      {/* Optional flyer — the same plain-URL upload product launches use. */}
      <div className="border-t border-[hsl(var(--border))] pt-5">
        <ImageUrlUpload
          value={s.flyerUrl}
          onChange={s.setFlyerUrl}
          folder="event-flyers"
          label="Challenge flyer (optional)"
          helpText="JPG, PNG or WebP · max 5 MB. Shown on the challenge page — leave empty if you don't have artwork yet."
        />
      </div>
    </div>
  );
}

// ─── Step 2 — Teams & Eligibility ────────────────────────────────────────────

export function HackTeamsStep({ s }: { s: HackState }) {
  const showTeam = s.participationType === "team" || s.participationType === "both";
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Label className="mb-3 block">Participation Type</Label>
        <div className="flex flex-col gap-2">
          {([
            ["solo", "Solo only", "Individuals participate independently"],
            ["team", "Team only", "Participants must form teams"],
            ["both", "Solo & Team", "Both individual and team entries allowed"],
          ] as const).map(([val, lbl, desc]) => (
            <label key={val} className={cn("flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all",
              s.participationType === val ? "border-[#7c22c9] bg-[#faf5ff]" : "border-[hsl(var(--border))]")}>
              <input type="radio" name="participationType" value={val} checked={s.participationType === val}
                onChange={() => s.setParticipationType(val)} className="mt-0.5 accent-[#7c22c9]" />
              <div>
                <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{lbl}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {showTeam && (
        <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)]">
          <div>
            <Label className="mb-2 block">Min Team Size</Label>
            <Input type="number" min="1" value={s.minTeam} onChange={(e) => s.setMinTeam(e.target.value)} />
          </div>
          <div>
            <Label className="mb-2 block">Max Team Size</Label>
            <Input type="number" min="1" value={s.maxTeam} onChange={(e) => s.setMaxTeam(e.target.value)} />
          </div>
        </div>
      )}

      <div>
        <Label className="mb-2 block">Eligibility Criteria <span className="font-normal text-[hsl(var(--muted-foreground))] text-xs">(optional)</span></Label>
        <textarea rows={3} placeholder="e.g. Must be a registered Nigerian startup with less than 5 years of operation"
          value={s.eligibility} onChange={(e) => s.setEligibility(e.target.value)}
          className="flex w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none" />
      </div>

      <div>
        <Label className="mb-2 block">Maximum Entries <span className="font-normal text-[hsl(var(--muted-foreground))] text-xs">(optional)</span></Label>
        <Input type="number" placeholder="Leave blank for unlimited" value={s.capacity} onChange={(e) => s.setCapacity(e.target.value)} />
      </div>
    </div>
  );
}

// ─── Step 3 — Prizes & Judging ────────────────────────────────────────────────

export function HackPrizesStep({ s }: { s: HackState }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label>Prize Tiers</Label>
          <button type="button" onClick={s.addPrize} className="flex items-center gap-1.5 text-xs font-medium text-[#7c22c9] hover:opacity-70">
            <Plus className="h-3.5 w-3.5" /> Add tier
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {s.prizes.map((p, idx) => (
            <div key={p.id} className="flex items-center gap-2">
              <Input maxLength={MAX_SHORT} placeholder="e.g. 1st Place" value={p.place} onChange={(e) => s.updatePrize(p.id, "place", e.target.value)} className="w-40 shrink-0" />
              <Input maxLength={MAX_SHORT} placeholder="e.g. ₦5,000,000 + mentorship" value={p.reward} onChange={(e) => s.updatePrize(p.id, "reward", e.target.value)} className="flex-1" />
              {s.prizes.length > 1 && (
                <button type="button" onClick={() => s.removePrize(p.id)} className="text-red-400 hover:text-red-600 shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[hsl(var(--border))] pt-5">
        <div className="flex items-center justify-between mb-3">
          <Label>Judging Criteria</Label>
          <button type="button" onClick={s.addCriterion} className="flex items-center gap-1.5 text-xs font-medium text-[#7c22c9] hover:opacity-70">
            <Plus className="h-3.5 w-3.5" /> Add criterion
          </button>
        </div>
        {(() => {
          const total = judgingWeightsTotal(s.criteria);
          const ok    = judgingWeightsValid(s.criteria);
          return (
            <p className={cn("text-xs mb-3", ok ? "text-green-600" : "text-amber-600")}>
              {ok
                ? "✓ Weights total 100%"
                : `Weights must total 100% — currently ${Math.round(total * 100) / 100}%${
                    total < 100 ? ` (${Math.round((100 - total) * 100) / 100}% left to assign)` : " (over by " + Math.round((total - 100) * 100) / 100 + "%)"
                  }`}
            </p>
          );
        })()}
        <div className="flex flex-col gap-2">
          {s.criteria.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <Input maxLength={MAX_SHORT} placeholder="e.g. Innovation" value={c.label} onChange={(e) => s.updateCriterion(c.id, "label", e.target.value)} className="flex-1" />
              <Input placeholder="30%" value={c.weight} onChange={(e) => s.updateCriterion(c.id, "weight", e.target.value)} className="w-24 shrink-0" />
              {s.criteria.length > 1 && (
                <button type="button" onClick={() => s.removeCriterion(c.id)} className="text-red-400 hover:text-red-600 shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Review ───────────────────────────────────────────────────────────────────

export function HackReview({ s, organiserName }: { s: HackState; organiserName: string }) {
  const ptLabel = s.participationType === "both" ? "Solo & Team" : s.participationType === "solo" ? "Solo" : "Team";
  return (
    <div className="flex flex-col gap-4">
      <div><p className="attend-section-title mb-2">Challenge Details</p>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 divide-y divide-[hsl(var(--border))]">
          <ReviewRow label="Title"         value={s.title} />
          {s.description && <ReviewRow label="Description" value={s.description} />}
          <ReviewRow label="Organiser"     value={organiserName} />
          <ReviewRow label="Start Date"    value={s.startDate} />
          {s.endDate && <ReviewRow label="End Date" value={s.endDate} />}
          {s.theme && <ReviewRow label="Tracks"    value={s.theme} />}
          <ReviewRow label="Format"        value={s.format} />
          {s.featured && <ReviewRow label="Featured" value="Yes" />}
        </div>
      </div>
      <div><p className="attend-section-title mb-2">Brief</p>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 divide-y divide-[hsl(var(--border))]">
          {s.problemStatement && <ReviewRow label="Problem"     value={s.problemStatement} />}
          {s.deliverable      && <ReviewRow label="Deliverable" value={s.deliverable} />}
          {s.submissionDeadline && <ReviewRow label="Deadline"  value={s.submissionDeadline} />}
          {s.techStack        && <ReviewRow label="Tech Stack"  value={s.techStack} />}
          {s.flyerUrl         && <ReviewRow label="Flyer"       value="Uploaded" />}
        </div>
      </div>
      <div><p className="attend-section-title mb-2">Teams & Prizes</p>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 divide-y divide-[hsl(var(--border))]">
          <ReviewRow label="Participation" value={ptLabel} />
          {(s.participationType !== "solo") && <ReviewRow label="Team Size" value={`${s.minTeam}–${s.maxTeam}`} />}
          {s.capacity && <ReviewRow label="Max Entries" value={s.capacity} />}
          <ReviewRow label="Prize Tiers"   value={s.prizes.filter((p) => p.reward).map((p) => `${p.place}: ${p.reward}`).join(" · ") || "—"} />
        </div>
      </div>
    </div>
  );
}
