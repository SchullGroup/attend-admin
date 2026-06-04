"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Vote, Rocket, Lightbulb, CalendarDays, MapPin, Monitor, Users2,
  Plus, Trash2, GripVertical, Check, ChevronRight, ChevronLeft, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ─── Module definitions ──────────────────────────────────────────────────────

type ModuleId = "AGM" | "LAUNCH" | "HACKATHON" | "GENERAL";

const MODULES: {
  id: ModuleId; label: string; desc: string; detail: string;
  icon: React.ElementType; color: string; bg: string; border: string;
}[] = [
  {
    id: "AGM",
    label: "AGM",
    desc: "Annual General Meeting",
    detail: "Proxy voting, resolutions, shareholder register, quorum tracking",
    icon: Vote,
    color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe",
  },
  {
    id: "LAUNCH",
    label: "Product Launch",
    desc: "Product Launch Event",
    detail: "Microsite generation, press kit, speaker profiles, RSVP",
    icon: Rocket,
    color: "#b45309", bg: "#fffbeb", border: "#fde68a",
  },
  {
    id: "HACKATHON",
    label: "Innovation Challenge",
    desc: "Tech challenge or competition",
    detail: "Team registration, judging criteria, prize tiers, submission portal",
    icon: Lightbulb,
    color: "#7c22c9", bg: "#faf5ff", border: "#ddd6fe",
  },
  {
    id: "GENERAL",
    label: "General Event",
    desc: "Conference, workshop, seminar or any custom event",
    detail: "Agenda, speakers, capacity, live streaming, certificate",
    icon: CalendarDays,
    color: "#0f766e", bg: "#f0fdfa", border: "#99f6e4",
  },
];

const FORMATS = ["virtual", "hybrid", "in-person"] as const;
type Format = typeof FORMATS[number];

// ─── Step definitions per module ─────────────────────────────────────────────

const STEPS: Record<ModuleId, { label: string; optional?: true }[]> = {
  AGM: [
    { label: "Meeting Basics" },
    { label: "Notice & Agenda" },
    { label: "Proxy & Voting" },
    { label: "Shareholders" },
    { label: "Review" },
  ],
  LAUNCH: [
    { label: "Event Basics" },
    { label: "Product Details" },
    { label: "Speakers & Press", optional: true },
    { label: "Settings" },
    { label: "Review" },
  ],
  HACKATHON: [
    { label: "Challenge Basics" },
    { label: "Challenge Brief" },
    { label: "Teams & Eligibility" },
    { label: "Prizes & Judging" },
    { label: "Review" },
  ],
  GENERAL: [
    { label: "Event Basics" },
    { label: "Agenda", optional: true },
    { label: "Speakers", optional: true },
    { label: "Settings" },
    { label: "Review" },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _uid = 0;
const uid = () => ++_uid;

interface AgendaItem { id: number; time: string; topic: string; desc: string; }
interface Speaker    { id: number; name: string; title: string; company: string; bio: string; }
interface Resolution { id: number; number: string; text: string; }
interface Prize      { id: number; place: string; reward: string; }
interface Criterion  { id: number; label: string; weight: string; }

// ─── Step progress bar ────────────────────────────────────────────────────────

function StepBar({ steps, current, moduleId }: {
  steps: { label: string; optional?: true }[];
  current: number;
  moduleId: ModuleId;
}) {
  const mod = MODULES.find((m) => m.id === moduleId)!;
  const pct = Math.round(((current + 1) / steps.length) * 100);
  return (
    <div className="mb-6 rounded-2xl border border-[hsl(var(--border))] bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: mod.bg }}>
            <mod.icon className="h-4 w-4" style={{ color: mod.color }} />
          </div>
          <div>
            <span className="text-xl font-black text-[hsl(var(--foreground))] tabular-nums">
              {String(current + 1).padStart(2, "0")}
            </span>
            <span className="text-base font-bold text-[hsl(var(--muted-foreground))]">
              /{String(steps.length).padStart(2, "0")}
            </span>
            <span className="ml-2 text-base font-semibold text-[hsl(var(--foreground))]">
              {steps[current].label}
            </span>
            {steps[current].optional && (
              <span className="ml-2 text-xs bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] px-2 py-0.5 rounded-full font-medium">
                Optional
              </span>
            )}
          </div>
        </div>
        <span className="text-sm font-bold" style={{ color: mod.color }}>{pct}%</span>
      </div>

      <div className="h-2 w-full bg-[hsl(var(--border))] rounded-full overflow-hidden mb-4">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: mod.color }}
        />
      </div>

      <nav className="flex items-center gap-0 overflow-x-auto no-scrollbar">
        {steps.map((s, i) => {
          const done   = i < current;
          const active = i === current;
          return (
            <div key={i} className="flex items-center shrink-0">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                    done    ? "text-white border-transparent"
                    : active ? "bg-white text-[hsl(var(--foreground))]"
                              : "bg-white border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
                  )}
                  style={
                    done    ? { backgroundColor: mod.color, borderColor: mod.color }
                    : active ? { borderColor: mod.color }
                              : {}
                  }
                >
                  {done ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <p className={cn(
                  "text-[10px] font-medium whitespace-nowrap max-w-[68px] text-center leading-tight",
                  active ? "font-semibold" : "text-[hsl(var(--muted-foreground))]"
                )}
                style={active ? { color: mod.color } : {}}>
                  {s.label}
                </p>
              </div>
              {i < steps.length - 1 && (
                <div
                  className="h-0.5 w-6 md:w-12 mx-1 mb-3.5 flex-shrink-0 rounded-full transition-all"
                  style={done ? { backgroundColor: mod.color } : { backgroundColor: "hsl(var(--border))" }}
                />
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

function SectionHead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6 pb-5 border-b border-[hsl(var(--border))]">
      <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">{title}</h2>
      <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{subtitle}</p>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[hsl(var(--border))] last:border-0">
      <p className="text-xs text-[hsl(var(--muted-foreground))] w-36 shrink-0 pt-0.5">{label}</p>
      <p className="text-sm text-[hsl(var(--foreground))] font-medium">{value || "—"}</p>
    </div>
  );
}

function FormatPicker({ value, onChange }: { value: Format; onChange: (f: Format) => void }) {
  const icons = { virtual: Monitor, hybrid: Users2, "in-person": MapPin };
  return (
    <div>
      <Label className="mb-2 block">Format</Label>
      <div className="flex gap-2">
        {FORMATS.map((f) => {
          const Icon = icons[f];
          return (
            <button
              key={f}
              type="button"
              onClick={() => onChange(f)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium capitalize transition-all",
                value === f
                  ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.06)] text-[hsl(var(--primary))]"
                  : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--ring)/0.3)]"
              )}
            >
              <Icon className="h-3.5 w-3.5" />{f}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0",
        checked ? "bg-[hsl(var(--primary))]" : "bg-[hsl(var(--muted-foreground)/0.3)]"
      )}
    >
      <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-6" : "translate-x-1")} />
    </button>
  );
}

// ─── Module-specific step renderers ──────────────────────────────────────────

// ── AGM ─────────────────────────────────────────────────────────────────────

function AgmStep0({ f }: { f: AgmFields }) {
  return (
    <FieldRow>
      <div>
        <Label htmlFor="agm-title" className="mb-2 block">Meeting Title</Label>
        <Input id="agm-title" placeholder="e.g. Zenith Bank Plc — 2026 Annual General Meeting"
          value={f.title} onChange={(e) => f.setTitle(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="mb-2 block">Company / Organiser</Label>
          <Input placeholder="e.g. Zenith Bank Plc" value={f.company} onChange={(e) => f.setCompany(e.target.value)} />
        </div>
        <div>
          <Label className="mb-2 block">RC Number</Label>
          <Input placeholder="e.g. RC 6271" value={f.rc} onChange={(e) => f.setRc(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label className="mb-2 block">Date</Label>
          <Input type="date" value={f.date} onChange={(e) => f.setDate(e.target.value)} />
        </div>
        <div>
          <Label className="mb-2 block">Start Time</Label>
          <Input type="time" value={f.startTime} onChange={(e) => f.setStartTime(e.target.value)} />
        </div>
        <div>
          <Label className="mb-2 block">End Time</Label>
          <Input type="time" value={f.endTime} onChange={(e) => f.setEndTime(e.target.value)} />
        </div>
      </div>
      <FormatPicker value={f.format} onChange={f.setFormat} />
      {(f.format === "hybrid" || f.format === "in-person") && (
        <div>
          <Label className="mb-2 block"><MapPin className="h-3.5 w-3.5 inline mr-1" />Venue Address</Label>
          <Input placeholder="e.g. Civic Centre, Victoria Island, Lagos" value={f.venue} onChange={(e) => f.setVenue(e.target.value)} />
        </div>
      )}
    </FieldRow>
  );
}

function AgmStep1({ f }: { f: AgmFields }) {
  return (
    <FieldRow>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="mb-2 block">Notice Period (days)</Label>
          <Input type="number" placeholder="21" value={f.noticeDays} onChange={(e) => f.setNoticeDays(e.target.value)} />
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Minimum 21 days per CAMA</p>
        </div>
        <div>
          <Label className="mb-2 block">Quorum (%)</Label>
          <Input type="number" placeholder="e.g. 25" value={f.quorum} onChange={(e) => f.setQuorum(e.target.value)} />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label>Resolutions / Agenda Items</Label>
          <button type="button" onClick={f.addResolution}
            className="flex items-center gap-1 text-sm font-medium text-[hsl(var(--primary))] hover:opacity-70">
            <Plus className="h-3.5 w-3.5" /> Add resolution
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {f.resolutions.map((r, i) => (
            <div key={r.id} className="flex items-center gap-2">
              <span className="text-xs font-bold text-[hsl(var(--muted-foreground))] w-8 shrink-0 text-center">
                {String(i + 1).padStart(2, "0")}
              </span>
              <Input
                placeholder={`e.g. To re-elect ${i === 0 ? "Mrs. A. Okonkwo" : "a director"} as director`}
                value={r.text}
                onChange={(e) => f.updateResolution(r.id, e.target.value)}
                className="flex-1"
              />
              <button type="button" onClick={() => f.removeResolution(r.id)}
                disabled={f.resolutions.length === 1}
                className="h-9 w-9 flex items-center justify-center rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-30 disabled:pointer-events-none transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </FieldRow>
  );
}

function AgmStep2({ f }: { f: AgmFields }) {
  return (
    <FieldRow>
      <div className="flex items-center justify-between p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)]">
        <div>
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Allow Proxy Voting</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Shareholders may appoint a proxy to vote on their behalf</p>
        </div>
        <Toggle checked={f.allowProxy} onChange={f.setAllowProxy} />
      </div>
      {f.allowProxy && (
        <div>
          <Label className="mb-2 block">Proxy Submission Deadline</Label>
          <Input type="date" value={f.proxyDeadline} onChange={(e) => f.setProxyDeadline(e.target.value)} />
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Typically 48 hours before the meeting</p>
        </div>
      )}
      <div>
        <Label className="mb-3 block">Voting Method</Label>
        <div className="flex flex-col gap-2">
          {[
            { id: "e-voting",       label: "E-Voting",         desc: "Shareholders vote electronically via the Attend app" },
            { id: "show-of-hands",  label: "Show of Hands",    desc: "Traditional in-room hand-raise counted by secretary" },
            { id: "poll",           label: "Poll",             desc: "Formal poll: each share carries one vote" },
          ].map((v) => (
            <label key={v.id}
              className={cn(
                "flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                f.votingMethod === v.id
                  ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.04)]"
                  : "border-[hsl(var(--border))] hover:border-[hsl(var(--ring)/0.3)]"
              )}>
              <input type="radio" className="mt-0.5 accent-[hsl(var(--primary))]"
                checked={f.votingMethod === v.id} onChange={() => f.setVotingMethod(v.id)} />
              <div>
                <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{v.label}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{v.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    </FieldRow>
  );
}

function AgmStep3({ f }: { f: AgmFields }) {
  return (
    <FieldRow>
      <div>
        <Label className="mb-2 block">Total Shareholders</Label>
        <Input type="number" placeholder="e.g. 25000" value={f.totalShareholders} onChange={(e) => f.setTotalShareholders(e.target.value)} />
      </div>
      <div className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)]">
        <p className="text-sm font-semibold text-[hsl(var(--foreground))] mb-1">Shareholder Register</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">Upload your CSCS/NGX shareholder register (CSV or Excel). Used for identity verification and e-voting eligibility.</p>
        <label className="cursor-pointer inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg border border-[hsl(var(--border))] bg-white hover:bg-[hsl(var(--muted))] transition-colors">
          {f.registerFile ? `${f.registerFile} ✓` : "Choose file…"}
          <input type="file" accept=".csv,.xlsx,.xls" className="hidden"
            onChange={(e) => f.setRegisterFile(e.target.files?.[0]?.name ?? "")} />
        </label>
      </div>
      <div>
        <Label className="mb-2 block">Eligibility Cut-off Date</Label>
        <Input type="date" value={f.eligibilityCutoff} onChange={(e) => f.setEligibilityCutoff(e.target.value)} />
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Shareholders who held shares on or before this date are eligible to vote</p>
      </div>
    </FieldRow>
  );
}

// ── Launch ───────────────────────────────────────────────────────────────────

function LaunchStep0({ f }: { f: LaunchFields }) {
  return (
    <FieldRow>
      <div>
        <Label className="mb-2 block">Event Title</Label>
        <Input placeholder="e.g. MeriSave 2.0 — Official Product Launch"
          value={f.title} onChange={(e) => f.setTitle(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="mb-2 block">Organising Company</Label>
          <Input placeholder="e.g. Meristem Securities" value={f.company} onChange={(e) => f.setCompany(e.target.value)} />
        </div>
        <div>
          <Label className="mb-2 block">Industry / Sector</Label>
          <Input placeholder="e.g. Fintech, FMCG, Healthcare" value={f.sector} onChange={(e) => f.setSector(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div><Label className="mb-2 block">Date</Label><Input type="date" value={f.date} onChange={(e) => f.setDate(e.target.value)} /></div>
        <div><Label className="mb-2 block">Start Time</Label><Input type="time" value={f.startTime} onChange={(e) => f.setStartTime(e.target.value)} /></div>
        <div><Label className="mb-2 block">End Time</Label><Input type="time" value={f.endTime} onChange={(e) => f.setEndTime(e.target.value)} /></div>
      </div>
      <FormatPicker value={f.format} onChange={f.setFormat} />
      {(f.format === "hybrid" || f.format === "in-person") && (
        <div>
          <Label className="mb-2 block"><MapPin className="h-3.5 w-3.5 inline mr-1" />Venue</Label>
          <Input placeholder="e.g. Eko Hotel, Victoria Island, Lagos" value={f.venue} onChange={(e) => f.setVenue(e.target.value)} />
        </div>
      )}
    </FieldRow>
  );
}

function LaunchStep1({ f }: { f: LaunchFields }) {
  return (
    <FieldRow>
      <div>
        <Label className="mb-2 block">Product Name</Label>
        <Input placeholder="e.g. MeriSave 2.0" value={f.productName} onChange={(e) => f.setProductName(e.target.value)} />
      </div>
      <div>
        <Label className="mb-2 block">Tagline</Label>
        <Input placeholder="e.g. Save smarter. Earn more." value={f.tagline} onChange={(e) => f.setTagline(e.target.value)} />
      </div>
      <div>
        <Label className="mb-2 block">Product Description</Label>
        <textarea
          rows={4}
          placeholder="Describe the product being launched — what it does, who it's for, and why it matters."
          value={f.productDesc}
          onChange={(e) => f.setProductDesc(e.target.value)}
          className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="mb-2 block">Product Category</Label>
          <Input placeholder="e.g. Investment App, SaaS, Consumer Device" value={f.category} onChange={(e) => f.setCategory(e.target.value)} />
        </div>
        <div>
          <Label className="mb-2 block">Microsite Slug</Label>
          <div className="flex items-center rounded-lg border border-[hsl(var(--border))] overflow-hidden">
            <span className="px-3 py-2 text-sm text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] border-r border-[hsl(var(--border))] shrink-0">attend.ng/launch/</span>
            <Input placeholder="merisave-2" value={f.slug} onChange={(e) => f.setSlug(e.target.value)} className="border-0 rounded-none focus-visible:ring-0" />
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Public microsite URL for this launch</p>
        </div>
      </div>
    </FieldRow>
  );
}

function LaunchStep2({ f }: { f: LaunchFields }) {
  return (
    <FieldRow>
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label>Speakers</Label>
          <button type="button" onClick={f.addSpeaker} className="flex items-center gap-1 text-sm font-medium text-[hsl(var(--primary))] hover:opacity-70">
            <Plus className="h-3.5 w-3.5" /> Add speaker
          </button>
        </div>
        {f.speakers.map((sp) => (
          <div key={sp.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 mb-3 items-end">
            <div><Label className="mb-2 block">Name</Label><Input placeholder="Adaeze Umeoji" value={sp.name} onChange={(e) => f.updateSpeaker(sp.id, "name", e.target.value)} /></div>
            <div><Label className="mb-2 block">Title</Label><Input placeholder="CEO" value={sp.title} onChange={(e) => f.updateSpeaker(sp.id, "title", e.target.value)} /></div>
            <div><Label className="mb-2 block">Company</Label><Input placeholder="Zenith Bank" value={sp.company} onChange={(e) => f.updateSpeaker(sp.id, "company", e.target.value)} /></div>
            <button type="button" onClick={() => f.removeSpeaker(sp.id)} disabled={f.speakers.length === 1}
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-30 disabled:pointer-events-none transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="border-t border-[hsl(var(--border))] pt-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Include Press Kit</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Generate a downloadable press kit badge on the microsite</p>
        </div>
        <Toggle checked={f.pressKit} onChange={f.setPressKit} />
      </div>
    </FieldRow>
  );
}

function LaunchStep3({ f }: { f: LaunchFields }) {
  return (
    <FieldRow>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="mb-2 block">Maximum Capacity</Label>
          <Input type="number" placeholder="e.g. 2000" value={f.capacity} onChange={(e) => f.setCapacity(e.target.value)} />
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Leave blank for unlimited</p>
        </div>
        <div>
          <Label className="mb-2 block">RSVP Deadline</Label>
          <Input type="date" value={f.rsvpDeadline} onChange={(e) => f.setRsvpDeadline(e.target.value)} />
        </div>
      </div>
      <div>
        <Label className="mb-2 block">Live Stream URL <span className="text-[hsl(var(--muted-foreground))] font-normal text-xs">(optional)</span></Label>
        <Input placeholder="Paste YouTube or Zoom URL…" value={f.streamUrl} onChange={(e) => f.setStreamUrl(e.target.value)} />
      </div>
      <div className="flex items-center justify-between p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)]">
        <div>
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Open Registration Immediately</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Allow RSVPs as soon as this event is published</p>
        </div>
        <Toggle checked={f.registrationOpen} onChange={f.setRegistrationOpen} />
      </div>
    </FieldRow>
  );
}

// ── Hackathon ────────────────────────────────────────────────────────────────

function HackStep0({ f }: { f: HackFields }) {
  return (
    <FieldRow>
      <div>
        <Label className="mb-2 block">Challenge Title</Label>
        <Input placeholder="e.g. Meristem FinTech Innovation Challenge 2026"
          value={f.title} onChange={(e) => f.setTitle(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label className="mb-2 block">Organiser</Label><Input placeholder="Meristem Securities" value={f.organiser} onChange={(e) => f.setOrganiser(e.target.value)} /></div>
        <div><Label className="mb-2 block">Theme / Track</Label><Input placeholder="e.g. Open Banking, AgriTech" value={f.theme} onChange={(e) => f.setTheme(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label className="mb-2 block">Start Date</Label><Input type="date" value={f.startDate} onChange={(e) => f.setStartDate(e.target.value)} /></div>
        <div><Label className="mb-2 block">End Date</Label><Input type="date" value={f.endDate} onChange={(e) => f.setEndDate(e.target.value)} /></div>
      </div>
      <FormatPicker value={f.format} onChange={f.setFormat} />
      {(f.format === "hybrid" || f.format === "in-person") && (
        <div>
          <Label className="mb-2 block"><MapPin className="h-3.5 w-3.5 inline mr-1" />Venue</Label>
          <Input placeholder="e.g. Co-creation Hub, Yaba" value={f.venue} onChange={(e) => f.setVenue(e.target.value)} />
        </div>
      )}
    </FieldRow>
  );
}

function HackStep1({ f }: { f: HackFields }) {
  return (
    <FieldRow>
      <div>
        <Label className="mb-2 block">Problem Statement</Label>
        <textarea rows={3} placeholder="What problem are participants solving? Be specific."
          value={f.problemStatement} onChange={(e) => f.setProblemStatement(e.target.value)}
          className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]" />
      </div>
      <div>
        <Label className="mb-2 block">Expected Deliverable</Label>
        <Input placeholder="e.g. Working prototype + 3-min pitch deck" value={f.deliverable} onChange={(e) => f.setDeliverable(e.target.value)} />
      </div>
      <div>
        <Label className="mb-2 block">Submission Deadline</Label>
        <Input type="date" value={f.submissionDeadline} onChange={(e) => f.setSubmissionDeadline(e.target.value)} />
      </div>
      <div>
        <Label className="mb-2 block">Allowed Tech Stack <span className="text-[hsl(var(--muted-foreground))] font-normal text-xs">(optional — leave blank for open)</span></Label>
        <Input placeholder="e.g. React, Python, any blockchain" value={f.techStack} onChange={(e) => f.setTechStack(e.target.value)} />
      </div>
    </FieldRow>
  );
}

function HackStep2({ f }: { f: HackFields }) {
  return (
    <FieldRow>
      <div>
        <Label className="mb-3 block">Participation Type</Label>
        <div className="flex gap-3">
          {(["solo", "team", "both"] as const).map((t) => (
            <label key={t} className={cn(
              "flex-1 flex flex-col items-center gap-1 p-4 rounded-xl border-2 cursor-pointer transition-all text-center",
              f.participationType === t ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.04)]" : "border-[hsl(var(--border))]"
            )}>
              <input type="radio" className="hidden" checked={f.participationType === t} onChange={() => f.setParticipationType(t)} />
              <span className="text-sm font-semibold capitalize">{t === "both" ? "Solo & Team" : t}</span>
            </label>
          ))}
        </div>
      </div>
      {(f.participationType === "team" || f.participationType === "both") && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-2 block">Min Team Size</Label>
            <Input type="number" placeholder="2" value={f.minTeamSize} onChange={(e) => f.setMinTeamSize(e.target.value)} />
          </div>
          <div>
            <Label className="mb-2 block">Max Team Size</Label>
            <Input type="number" placeholder="5" value={f.maxTeamSize} onChange={(e) => f.setMaxTeamSize(e.target.value)} />
          </div>
        </div>
      )}
      <div>
        <Label className="mb-2 block">Eligibility Criteria</Label>
        <textarea rows={3} placeholder="e.g. Open to Nigerian residents 18+. Students and professionals welcome."
          value={f.eligibility} onChange={(e) => f.setEligibility(e.target.value)}
          className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]" />
      </div>
      <div>
        <Label className="mb-2 block">Maximum Participants / Teams</Label>
        <Input type="number" placeholder="e.g. 200" value={f.capacity} onChange={(e) => f.setCapacity(e.target.value)} />
      </div>
    </FieldRow>
  );
}

function HackStep3({ f }: { f: HackFields }) {
  return (
    <FieldRow>
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label>Prize Tiers</Label>
          <button type="button" onClick={f.addPrize} className="flex items-center gap-1 text-sm font-medium text-[hsl(var(--primary))] hover:opacity-70">
            <Plus className="h-3.5 w-3.5" /> Add tier
          </button>
        </div>
        {f.prizes.map((p, i) => (
          <div key={p.id} className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-[hsl(var(--muted-foreground))] w-8 text-center shrink-0">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i+1}`}</span>
            <Input placeholder={i === 0 ? "1st Place" : i === 1 ? "2nd Place" : "3rd Place"} value={p.place} onChange={(e) => f.updatePrize(p.id, "place", e.target.value)} className="flex-1" />
            <Input placeholder={i === 0 ? "₦5,000,000" : i === 1 ? "₦2,000,000" : "₦1,000,000"} value={p.reward} onChange={(e) => f.updatePrize(p.id, "reward", e.target.value)} className="flex-1" />
            <button type="button" onClick={() => f.removePrize(p.id)} disabled={f.prizes.length === 1}
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-30 disabled:pointer-events-none transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="border-t border-[hsl(var(--border))] pt-4">
        <div className="flex items-center justify-between mb-3">
          <Label>Judging Criteria</Label>
          <button type="button" onClick={f.addCriterion} className="flex items-center gap-1 text-sm font-medium text-[hsl(var(--primary))] hover:opacity-70">
            <Plus className="h-3.5 w-3.5" /> Add criterion
          </button>
        </div>
        {f.criteria.map((c) => (
          <div key={c.id} className="flex items-center gap-2 mb-2">
            <Input placeholder="e.g. Innovation" value={c.label} onChange={(e) => f.updateCriterion(c.id, "label", e.target.value)} className="flex-1" />
            <Input placeholder="30%" value={c.weight} onChange={(e) => f.updateCriterion(c.id, "weight", e.target.value)} className="w-24" />
            <button type="button" onClick={() => f.removeCriterion(c.id)} disabled={f.criteria.length === 1}
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-30 disabled:pointer-events-none transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </FieldRow>
  );
}

// ── General ──────────────────────────────────────────────────────────────────

function GeneralStep0({ f }: { f: GeneralFields }) {
  return (
    <FieldRow>
      <div>
        <Label className="mb-2 block">Event Title</Label>
        <Input placeholder="e.g. Meristem Capital Markets Summit 2026"
          value={f.title} onChange={(e) => f.setTitle(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label className="mb-2 block">Organiser</Label><Input placeholder="e.g. Meristem Securities" value={f.organiser} onChange={(e) => f.setOrganiser(e.target.value)} /></div>
        <div><Label className="mb-2 block">Description</Label><Input placeholder="Brief description of the event" value={f.description} onChange={(e) => f.setDescription(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div><Label className="mb-2 block">Date</Label><Input type="date" value={f.date} onChange={(e) => f.setDate(e.target.value)} /></div>
        <div><Label className="mb-2 block">Start Time</Label><Input type="time" value={f.startTime} onChange={(e) => f.setStartTime(e.target.value)} /></div>
        <div><Label className="mb-2 block">End Time</Label><Input type="time" value={f.endTime} onChange={(e) => f.setEndTime(e.target.value)} /></div>
      </div>
      <FormatPicker value={f.format} onChange={f.setFormat} />
      {(f.format === "hybrid" || f.format === "in-person") && (
        <div>
          <Label className="mb-2 block"><MapPin className="h-3.5 w-3.5 inline mr-1" />Venue</Label>
          <Input placeholder="e.g. Civic Centre, Victoria Island, Lagos" value={f.venue} onChange={(e) => f.setVenue(e.target.value)} />
        </div>
      )}
    </FieldRow>
  );
}

function GeneralStep1({ f }: { f: GeneralFields }) {
  return (
    <FieldRow>
      <div className="flex flex-col gap-3">
        {f.agenda.map((item, idx) => (
          <div key={item.id} className="grid grid-cols-[auto_1fr] gap-3 rounded-xl border border-[hsl(var(--border))] p-4 bg-[hsl(var(--muted)/0.3)]">
            <div className="flex flex-col items-center gap-2 pt-0.5">
              <GripVertical className="h-4 w-4 text-[hsl(var(--muted-foreground)/0.5)] cursor-grab" />
              <span className="text-xs font-bold tabular-nums text-[hsl(var(--muted-foreground))]">
                {String(idx + 1).padStart(2, "0")}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[120px_1fr_auto] gap-2 items-end">
                <div><Label className="mb-1.5 block">Time</Label><Input type="time" value={item.time} onChange={(e) => f.updateAgenda(item.id, "time", e.target.value)} /></div>
                <div><Label className="mb-1.5 block">Topic</Label><Input placeholder="e.g. Opening Remarks" value={item.topic} onChange={(e) => f.updateAgenda(item.id, "topic", e.target.value)} /></div>
                <button type="button" onClick={() => f.removeAgenda(item.id)} disabled={f.agenda.length === 1}
                  className="h-9 w-9 flex items-center justify-center rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-30 disabled:pointer-events-none transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        <button type="button" onClick={f.addAgenda} className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--primary))] hover:opacity-70 mt-1">
          <Plus className="h-4 w-4" /> Add agenda item
        </button>
      </div>
    </FieldRow>
  );
}

function GeneralStep2({ f }: { f: GeneralFields }) {
  return (
    <FieldRow>
      {f.speakers.map((sp) => (
        <div key={sp.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
          <div><Label className="mb-2 block">Full Name</Label><Input placeholder="Adaeze Umeoji" value={sp.name} onChange={(e) => f.updateSpeaker(sp.id, "name", e.target.value)} /></div>
          <div><Label className="mb-2 block">Job Title</Label><Input placeholder="GMD / CEO" value={sp.title} onChange={(e) => f.updateSpeaker(sp.id, "title", e.target.value)} /></div>
          <div><Label className="mb-2 block">Organisation</Label><Input placeholder="Zenith Bank Plc" value={sp.company} onChange={(e) => f.updateSpeaker(sp.id, "company", e.target.value)} /></div>
          <button type="button" onClick={() => f.removeSpeaker(sp.id)} disabled={f.speakers.length === 1}
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-30 disabled:pointer-events-none transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={f.addSpeaker} className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--primary))] hover:opacity-70">
        <Plus className="h-4 w-4" /> Add speaker
      </button>
    </FieldRow>
  );
}

function GeneralStep3({ f }: { f: GeneralFields }) {
  return (
    <FieldRow>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="mb-2 block">Maximum Capacity</Label>
          <Input type="number" placeholder="e.g. 1000" value={f.capacity} onChange={(e) => f.setCapacity(e.target.value)} />
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Leave blank for unlimited</p>
        </div>
        <div>
          <Label className="mb-2 block">RSVP Deadline</Label>
          <Input type="date" value={f.rsvpDeadline} onChange={(e) => f.setRsvpDeadline(e.target.value)} />
        </div>
      </div>
      <div>
        <Label className="mb-2 block">Live Stream URL <span className="text-[hsl(var(--muted-foreground))] font-normal text-xs">(optional)</span></Label>
        <Input placeholder="Paste YouTube or Zoom URL…" value={f.streamUrl} onChange={(e) => f.setStreamUrl(e.target.value)} />
      </div>
      <div className="flex items-center justify-between p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)]">
        <div>
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Open Registration Immediately</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Allow RSVPs as soon as this event is published</p>
        </div>
        <Toggle checked={f.registrationOpen} onChange={f.setRegistrationOpen} />
      </div>
    </FieldRow>
  );
}

// ─── Field type aliases (just for prop typing) ────────────────────────────────

type AgmFields = ReturnType<typeof useAgmFields>;
type LaunchFields = ReturnType<typeof useLaunchFields>;
type HackFields = ReturnType<typeof useHackFields>;
type GeneralFields = ReturnType<typeof useGeneralFields>;

function useAgmFields() {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [rc, setRc] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [format, setFormat] = useState<Format>("virtual");
  const [venue, setVenue] = useState("");
  const [noticeDays, setNoticeDays] = useState("");
  const [quorum, setQuorum] = useState("");
  const [resolutions, setResolutions] = useState<Resolution[]>([{ id: uid(), number: "1", text: "" }]);
  const [allowProxy, setAllowProxy] = useState(true);
  const [proxyDeadline, setProxyDeadline] = useState("");
  const [votingMethod, setVotingMethod] = useState("e-voting");
  const [totalShareholders, setTotalShareholders] = useState("");
  const [registerFile, setRegisterFile] = useState("");
  const [eligibilityCutoff, setEligibilityCutoff] = useState("");
  const addResolution = () => setResolutions((r) => [...r, { id: uid(), number: "", text: "" }]);
  const removeResolution = (id: number) => setResolutions((r) => r.filter((x) => x.id !== id));
  const updateResolution = (id: number, text: string) => setResolutions((r) => r.map((x) => x.id === id ? { ...x, text } : x));
  return { title, setTitle, company, setCompany, rc, setRc, date, setDate, startTime, setStartTime, endTime, setEndTime, format, setFormat, venue, setVenue, noticeDays, setNoticeDays, quorum, setQuorum, resolutions, addResolution, removeResolution, updateResolution, allowProxy, setAllowProxy, proxyDeadline, setProxyDeadline, votingMethod, setVotingMethod, totalShareholders, setTotalShareholders, registerFile, setRegisterFile, eligibilityCutoff, setEligibilityCutoff };
}

function useLaunchFields() {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [sector, setSector] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [format, setFormat] = useState<Format>("virtual");
  const [venue, setVenue] = useState("");
  const [productName, setProductName] = useState("");
  const [tagline, setTagline] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [category, setCategory] = useState("");
  const [slug, setSlug] = useState("");
  const [speakers, setSpeakers] = useState<Speaker[]>([{ id: uid(), name: "", title: "", company: "", bio: "" }]);
  const [pressKit, setPressKit] = useState(true);
  const [capacity, setCapacity] = useState("");
  const [rsvpDeadline, setRsvpDeadline] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const addSpeaker = () => setSpeakers((s) => [...s, { id: uid(), name: "", title: "", company: "", bio: "" }]);
  const removeSpeaker = (id: number) => setSpeakers((s) => s.filter((x) => x.id !== id));
  const updateSpeaker = (id: number, field: keyof Omit<Speaker, "id">, value: string) => setSpeakers((s) => s.map((x) => x.id === id ? { ...x, [field]: value } : x));
  return { title, setTitle, company, setCompany, sector, setSector, date, setDate, startTime, setStartTime, endTime, setEndTime, format, setFormat, venue, setVenue, productName, setProductName, tagline, setTagline, productDesc, setProductDesc, category, setCategory, slug, setSlug, speakers, addSpeaker, removeSpeaker, updateSpeaker, pressKit, setPressKit, capacity, setCapacity, rsvpDeadline, setRsvpDeadline, streamUrl, setStreamUrl, registrationOpen, setRegistrationOpen };
}

function useHackFields() {
  const [title, setTitle] = useState("");
  const [organiser, setOrganiser] = useState("");
  const [theme, setTheme] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [format, setFormat] = useState<Format>("virtual");
  const [venue, setVenue] = useState("");
  const [problemStatement, setProblemStatement] = useState("");
  const [deliverable, setDeliverable] = useState("");
  const [submissionDeadline, setSubmissionDeadline] = useState("");
  const [techStack, setTechStack] = useState("");
  const [participationType, setParticipationType] = useState<"solo" | "team" | "both">("both");
  const [minTeamSize, setMinTeamSize] = useState("");
  const [maxTeamSize, setMaxTeamSize] = useState("");
  const [eligibility, setEligibility] = useState("");
  const [capacity, setCapacity] = useState("");
  const [prizes, setPrizes] = useState<Prize[]>([{ id: uid(), place: "1st Place", reward: "" }, { id: uid(), place: "2nd Place", reward: "" }, { id: uid(), place: "3rd Place", reward: "" }]);
  const [criteria, setCriteria] = useState<Criterion[]>([{ id: uid(), label: "Innovation", weight: "30%" }, { id: uid(), label: "Impact", weight: "30%" }, { id: uid(), label: "Execution", weight: "40%" }]);
  const addPrize = () => setPrizes((p) => [...p, { id: uid(), place: "", reward: "" }]);
  const removePrize = (id: number) => setPrizes((p) => p.filter((x) => x.id !== id));
  const updatePrize = (id: number, field: "place" | "reward", value: string) => setPrizes((p) => p.map((x) => x.id === id ? { ...x, [field]: value } : x));
  const addCriterion = () => setCriteria((c) => [...c, { id: uid(), label: "", weight: "" }]);
  const removeCriterion = (id: number) => setCriteria((c) => c.filter((x) => x.id !== id));
  const updateCriterion = (id: number, field: "label" | "weight", value: string) => setCriteria((c) => c.map((x) => x.id === id ? { ...x, [field]: value } : x));
  return { title, setTitle, organiser, setOrganiser, theme, setTheme, startDate, setStartDate, endDate, setEndDate, format, setFormat, venue, setVenue, problemStatement, setProblemStatement, deliverable, setDeliverable, submissionDeadline, setSubmissionDeadline, techStack, setTechStack, participationType, setParticipationType, minTeamSize, setMinTeamSize, maxTeamSize, setMaxTeamSize, eligibility, setEligibility, capacity, setCapacity, prizes, addPrize, removePrize, updatePrize, criteria, addCriterion, removeCriterion, updateCriterion };
}

function useGeneralFields() {
  const [title, setTitle] = useState("");
  const [organiser, setOrganiser] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [format, setFormat] = useState<Format>("virtual");
  const [venue, setVenue] = useState("");
  const [agenda, setAgenda] = useState<AgendaItem[]>([{ id: uid(), time: "", topic: "", desc: "" }]);
  const [speakers, setSpeakers] = useState<Speaker[]>([{ id: uid(), name: "", title: "", company: "", bio: "" }]);
  const [capacity, setCapacity] = useState("");
  const [rsvpDeadline, setRsvpDeadline] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const addAgenda = () => setAgenda((a) => [...a, { id: uid(), time: "", topic: "", desc: "" }]);
  const removeAgenda = (id: number) => setAgenda((a) => a.filter((x) => x.id !== id));
  const updateAgenda = (id: number, field: "time" | "topic", value: string) => setAgenda((a) => a.map((x) => x.id === id ? { ...x, [field]: value } : x));
  const addSpeaker = () => setSpeakers((s) => [...s, { id: uid(), name: "", title: "", company: "", bio: "" }]);
  const removeSpeaker = (id: number) => setSpeakers((s) => s.filter((x) => x.id !== id));
  const updateSpeaker = (id: number, field: keyof Omit<Speaker, "id">, value: string) => setSpeakers((s) => s.map((x) => x.id === id ? { ...x, [field]: value } : x));
  return { title, setTitle, organiser, setOrganiser, description, setDescription, date, setDate, startTime, setStartTime, endTime, setEndTime, format, setFormat, venue, setVenue, agenda, addAgenda, removeAgenda, updateAgenda, speakers, addSpeaker, removeSpeaker, updateSpeaker, capacity, setCapacity, rsvpDeadline, setRsvpDeadline, streamUrl, setStreamUrl, registrationOpen, setRegistrationOpen };
}

// ─── Review steps ─────────────────────────────────────────────────────────────

function AgmReview({ f }: { f: AgmFields }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="attend-section-title mb-2">Meeting Details</p>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 divide-y divide-[hsl(var(--border))]">
          <ReviewRow label="Title" value={f.title} />
          <ReviewRow label="Company" value={f.company} />
          <ReviewRow label="RC Number" value={f.rc} />
          <ReviewRow label="Date" value={f.date} />
          <ReviewRow label="Time" value={f.startTime && f.endTime ? `${f.startTime} – ${f.endTime}` : ""} />
          <ReviewRow label="Format" value={f.format} />
          {f.venue && <ReviewRow label="Venue" value={f.venue} />}
        </div>
      </div>
      <div>
        <p className="attend-section-title mb-2">Notice & Resolutions</p>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 divide-y divide-[hsl(var(--border))]">
          <ReviewRow label="Notice Period" value={f.noticeDays ? `${f.noticeDays} days` : ""} />
          <ReviewRow label="Quorum" value={f.quorum ? `${f.quorum}%` : ""} />
          <ReviewRow label="Resolutions" value={`${f.resolutions.filter(r => r.text).length} item(s)`} />
        </div>
      </div>
      <div>
        <p className="attend-section-title mb-2">Voting</p>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 divide-y divide-[hsl(var(--border))]">
          <ReviewRow label="Method" value={f.votingMethod} />
          <ReviewRow label="Proxy" value={f.allowProxy ? "Allowed" : "Not allowed"} />
          {f.allowProxy && <ReviewRow label="Proxy Deadline" value={f.proxyDeadline} />}
          <ReviewRow label="Shareholders" value={f.totalShareholders || "—"} />
        </div>
      </div>
    </div>
  );
}

function LaunchReview({ f }: { f: LaunchFields }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="attend-section-title mb-2">Event Details</p>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 divide-y divide-[hsl(var(--border))]">
          <ReviewRow label="Title" value={f.title} />
          <ReviewRow label="Company" value={f.company} />
          <ReviewRow label="Date" value={f.date} />
          <ReviewRow label="Format" value={f.format} />
          {f.venue && <ReviewRow label="Venue" value={f.venue} />}
        </div>
      </div>
      <div>
        <p className="attend-section-title mb-2">Product</p>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 divide-y divide-[hsl(var(--border))]">
          <ReviewRow label="Product Name" value={f.productName} />
          <ReviewRow label="Tagline" value={f.tagline} />
          <ReviewRow label="Category" value={f.category} />
          <ReviewRow label="Microsite Slug" value={f.slug ? `attend.ng/launch/${f.slug}` : ""} />
          <ReviewRow label="Press Kit" value={f.pressKit ? "Enabled" : "Disabled"} />
        </div>
      </div>
      <div>
        <p className="attend-section-title mb-2">Settings</p>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 divide-y divide-[hsl(var(--border))]">
          <ReviewRow label="Capacity" value={f.capacity || "Unlimited"} />
          <ReviewRow label="Registration" value={f.registrationOpen ? "Opens immediately" : "Closed"} />
          {f.streamUrl && <ReviewRow label="Stream URL" value={f.streamUrl} />}
        </div>
      </div>
    </div>
  );
}

function HackReview({ f }: { f: HackFields }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="attend-section-title mb-2">Challenge Details</p>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 divide-y divide-[hsl(var(--border))]">
          <ReviewRow label="Title" value={f.title} />
          <ReviewRow label="Organiser" value={f.organiser} />
          <ReviewRow label="Theme" value={f.theme} />
          <ReviewRow label="Dates" value={f.startDate && f.endDate ? `${f.startDate} → ${f.endDate}` : ""} />
          <ReviewRow label="Submission" value={f.submissionDeadline} />
        </div>
      </div>
      <div>
        <p className="attend-section-title mb-2">Participation</p>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 divide-y divide-[hsl(var(--border))]">
          <ReviewRow label="Type" value={f.participationType === "both" ? "Solo & Team" : f.participationType} />
          {f.participationType !== "solo" && <ReviewRow label="Team Size" value={f.minTeamSize && f.maxTeamSize ? `${f.minTeamSize} – ${f.maxTeamSize}` : ""} />}
          <ReviewRow label="Max Entries" value={f.capacity || "Unlimited"} />
        </div>
      </div>
      <div>
        <p className="attend-section-title mb-2">Prizes & Judging</p>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 divide-y divide-[hsl(var(--border))]">
          {f.prizes.filter(p => p.place || p.reward).map((p, i) => (
            <ReviewRow key={p.id} label={p.place || `Prize ${i + 1}`} value={p.reward} />
          ))}
        </div>
      </div>
    </div>
  );
}

function GeneralReview({ f }: { f: GeneralFields }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="attend-section-title mb-2">Event Details</p>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 divide-y divide-[hsl(var(--border))]">
          <ReviewRow label="Title" value={f.title} />
          <ReviewRow label="Organiser" value={f.organiser} />
          <ReviewRow label="Date" value={f.date} />
          <ReviewRow label="Time" value={f.startTime && f.endTime ? `${f.startTime} – ${f.endTime}` : ""} />
          <ReviewRow label="Format" value={f.format} />
          {f.venue && <ReviewRow label="Venue" value={f.venue} />}
        </div>
      </div>
      <div>
        <p className="attend-section-title mb-2">Settings</p>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 divide-y divide-[hsl(var(--border))]">
          <ReviewRow label="Capacity" value={f.capacity || "Unlimited"} />
          <ReviewRow label="RSVP Deadline" value={f.rsvpDeadline || "None"} />
          <ReviewRow label="Registration" value={f.registrationOpen ? "Opens immediately" : "Closed"} />
          {f.streamUrl && <ReviewRow label="Stream URL" value={f.streamUrl} />}
        </div>
      </div>
    </div>
  );
}

// ─── Step titles per module ───────────────────────────────────────────────────

const STEP_META: Record<ModuleId, { title: string; subtitle: string }[]> = {
  AGM: [
    { title: "Meeting Basics",     subtitle: "Core details for your Annual General Meeting" },
    { title: "Notice & Agenda",    subtitle: "Set the statutory notice period and list all resolutions" },
    { title: "Proxy & Voting",     subtitle: "Configure how shareholders will vote" },
    { title: "Shareholders",       subtitle: "Upload your shareholder register and set eligibility" },
    { title: "Review & Publish",   subtitle: "Confirm all details before creating the meeting" },
  ],
  LAUNCH: [
    { title: "Event Basics",       subtitle: "Core details for your product launch event" },
    { title: "Product Details",    subtitle: "Tell us about the product being launched" },
    { title: "Speakers & Press",   subtitle: "Add presenters and press kit options" },
    { title: "Settings",           subtitle: "Capacity, registration and streaming" },
    { title: "Review & Publish",   subtitle: "Confirm all details before creating the launch" },
  ],
  HACKATHON: [
    { title: "Challenge Basics",   subtitle: "Core details for your Innovation Challenge" },
    { title: "Challenge Brief",    subtitle: "Define the problem and expected output" },
    { title: "Teams & Eligibility",subtitle: "Who can participate and how" },
    { title: "Prizes & Judging",   subtitle: "Set up prize tiers and judging criteria" },
    { title: "Review & Publish",   subtitle: "Confirm all details before creating the challenge" },
  ],
  GENERAL: [
    { title: "Event Basics",       subtitle: "Core details for your event" },
    { title: "Agenda",             subtitle: "Add the programme of activities" },
    { title: "Speakers",           subtitle: "Add presenters or panellists" },
    { title: "Settings",           subtitle: "Capacity, RSVP and streaming options" },
    { title: "Review & Publish",   subtitle: "Confirm all details before creating the event" },
  ],
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreateEventPage() {
  const router = useRouter();
  const [selectedModule, setSelectedModule] = useState<ModuleId | null>(null);
  const [step, setStep] = useState(0);

  const agm     = useAgmFields();
  const launch  = useLaunchFields();
  const hack    = useHackFields();
  const general = useGeneralFields();

  const mod    = selectedModule ? MODULES.find((m) => m.id === selectedModule)! : null;
  const steps  = selectedModule ? STEPS[selectedModule] : [];
  const meta   = selectedModule ? STEP_META[selectedModule] : [];
  const isLast = step === steps.length - 1;
  const isOptional = steps[step]?.optional;

  function next() { setStep((s) => Math.min(s + 1, steps.length - 1)); }
  function back() { setStep((s) => Math.max(s - 1, 0)); }

  function handleSubmit() { router.push("/events"); }

  function selectModule(id: ModuleId) {
    setSelectedModule(id);
    setStep(0);
  }

  function resetModule() {
    setSelectedModule(null);
    setStep(0);
  }

  // ── Module selection screen ───────────────────────────────────────────────
  if (!selectedModule) {
    return (
      <div className="max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Create Event</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Choose an event type to begin. Each type has its own tailored setup flow.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {MODULES.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => selectModule(m.id as ModuleId)}
                className="text-left rounded-2xl border-2 border-[hsl(var(--border))] bg-white p-6 hover:border-[hsl(var(--ring)/0.5)] hover:shadow-sm transition-all group"
              >
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: m.bg }}
                >
                  <Icon className="h-6 w-6" style={{ color: m.color }} />
                </div>
                <p className="text-base font-bold text-[hsl(var(--foreground))] mb-0.5">{m.label}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">{m.desc}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{m.detail}</p>
                <div className="mt-4 flex items-center gap-1 text-xs font-semibold" style={{ color: m.color }}>
                  Start setup <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => router.push("/events")}
            className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to events
          </button>
        </div>
      </div>
    );
  }

  // ── Per-module multistep flow ─────────────────────────────────────────────
  const stepMeta = meta[step];

  function renderStep() {
    if (selectedModule === "AGM") {
      if (step === 0) return <AgmStep0 f={agm} />;
      if (step === 1) return <AgmStep1 f={agm} />;
      if (step === 2) return <AgmStep2 f={agm} />;
      if (step === 3) return <AgmStep3 f={agm} />;
      if (step === 4) return <AgmReview f={agm} />;
    }
    if (selectedModule === "LAUNCH") {
      if (step === 0) return <LaunchStep0 f={launch} />;
      if (step === 1) return <LaunchStep1 f={launch} />;
      if (step === 2) return <LaunchStep2 f={launch} />;
      if (step === 3) return <LaunchStep3 f={launch} />;
      if (step === 4) return <LaunchReview f={launch} />;
    }
    if (selectedModule === "HACKATHON") {
      if (step === 0) return <HackStep0 f={hack} />;
      if (step === 1) return <HackStep1 f={hack} />;
      if (step === 2) return <HackStep2 f={hack} />;
      if (step === 3) return <HackStep3 f={hack} />;
      if (step === 4) return <HackReview f={hack} />;
    }
    if (selectedModule === "GENERAL") {
      if (step === 0) return <GeneralStep0 f={general} />;
      if (step === 1) return <GeneralStep1 f={general} />;
      if (step === 2) return <GeneralStep2 f={general} />;
      if (step === 3) return <GeneralStep3 f={general} />;
      if (step === 4) return <GeneralReview f={general} />;
    }
    return null;
  }

  return (
    <div className="max-w-3xl">
      {/* Page header with change-type button */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Create Event</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            {mod!.label} — {mod!.desc}
          </p>
        </div>
        <button
          type="button"
          onClick={resetModule}
          className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] border border-[hsl(var(--border))] rounded-lg px-3 py-1.5 hover:bg-[hsl(var(--muted))] transition-all"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Change event type
        </button>
      </div>

      <StepBar steps={steps} current={step} moduleId={selectedModule} />

      {/* Step card */}
      <Card className="attend-card p-6">
        <SectionHead title={stepMeta.title} subtitle={stepMeta.subtitle} />
        {renderStep()}
      </Card>

      {/* Navigation */}
      <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-white px-5 py-4 flex items-center justify-between gap-3">
        <div>
          {step > 0 ? (
            <Button type="button" variant="outline" onClick={back} className="gap-1.5">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={resetModule} className="gap-1.5">
              <ChevronLeft className="h-4 w-4" /> Change type
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isOptional && (
            <button type="button" onClick={next} className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] underline transition-colors">
              Skip this step
            </button>
          )}
          {!isLast ? (
            <Button type="button" onClick={next} className="gap-1.5 px-6">
              Continue to step {step + 2} <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} className="gap-1.5 px-6" style={{ backgroundColor: mod!.color }}>
              <Check className="h-4 w-4" /> Create {mod!.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
