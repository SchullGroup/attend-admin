"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Vote, Rocket, Zap, CalendarDays, MapPin, Monitor, Users2,
  Plus, Trash2, GripVertical, Check, ChevronRight, ChevronLeft,
  ArrowLeft, Upload, ShieldCheck, Globe, Mail, Lock, Building2,
  ChevronDown, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Module definitions ───────────────────────────────────────────────────────

type ModuleId = "AGM" | "LAUNCH" | "HACKATHON" | "GENERAL";
type Format = "virtual" | "in_person" | "hybrid";

const MODULES: {
  id: ModuleId; label: string; desc: string; detail: string;
  icon: React.ElementType; color: string; bg: string;
}[] = [
  {
    id: "AGM",
    label: "AGM / EGM",
    desc: "Annual or Extraordinary General Meeting",
    detail: "Resolutions, proxy voting, shareholder register, quorum tracking",
    icon: Vote, color: "#374151", bg: "#f3f4f6",
  },
  {
    id: "LAUNCH",
    label: "Product Launch",
    desc: "Brand or product launch event",
    detail: "Microsite, press kit, embargo settings, speaker profiles",
    icon: Rocket, color: "#b45309", bg: "#fffbeb",
  },
  {
    id: "HACKATHON",
    label: "Innovation Challenge",
    desc: "Innovation challenge or competition",
    detail: "Team registration, judging criteria, prize tiers, submission portal",
    icon: Zap, color: "#7c22c9", bg: "#faf5ff",
  },
  {
    id: "GENERAL",
    label: "General Event",
    desc: "Investor day, conference, workshop or other",
    detail: "Agenda, speakers, audience targeting, capacity management",
    icon: CalendarDays, color: "#0f766e", bg: "#f0fdfa",
  },
];

const STEPS: Record<ModuleId, { label: string; optional?: true }[]> = {
  AGM: [
    { label: "Meeting Basics" },
    { label: "Notice & Agenda" },
    { label: "Resolutions" },
    { label: "Shareholders" },
    { label: "Review" },
  ],
  LAUNCH: [
    { label: "Event Basics" },
    { label: "Product Details" },
    { label: "Speakers", optional: true },
    { label: "Embargo & Audience" },
    { label: "Review" },
  ],
  HACKATHON: [
    { label: "Challenge Basics" },
    { label: "Brief & Rules" },
    { label: "Teams & Eligibility" },
    { label: "Prizes & Judging" },
    { label: "Review" },
  ],
  GENERAL: [
    { label: "Event Basics" },
    { label: "Agenda", optional: true },
    { label: "Audience & Settings" },
    { label: "Review" },
  ],
};

const STEP_META: Record<ModuleId, { title: string; subtitle: string }[]> = {
  AGM: [
    { title: "Meeting Basics",          subtitle: "Core details for your Annual or Extraordinary General Meeting" },
    { title: "Notice & Agenda",         subtitle: "Upload the statutory notice and build the meeting programme" },
    { title: "Resolutions",             subtitle: "List all ordinary and special resolutions to be voted on" },
    { title: "Shareholders & Voting",   subtitle: "Configure shareholder targeting, proxy voting and KYC" },
    { title: "Review & Publish",        subtitle: "Confirm all details before creating the meeting" },
  ],
  LAUNCH: [
    { title: "Event Basics",            subtitle: "Core details for your product launch event" },
    { title: "Product Details",         subtitle: "Tell us about the product and the microsite slug" },
    { title: "Speakers",                subtitle: "Add presenters or keynote speakers — skip if none yet" },
    { title: "Embargo & Audience",      subtitle: "Set document release timing and who can register" },
    { title: "Review & Publish",        subtitle: "Confirm all details before creating the launch" },
  ],
  HACKATHON: [
    { title: "Challenge Basics",        subtitle: "Core details for your Innovation Challenge" },
    { title: "Brief & Rules",           subtitle: "Define the problem statement and expected deliverable" },
    { title: "Teams & Eligibility",     subtitle: "Who can participate and in what formation" },
    { title: "Prizes & Judging",        subtitle: "Set up prize tiers and judging criteria" },
    { title: "Review & Publish",        subtitle: "Confirm all details before creating the challenge" },
  ],
  GENERAL: [
    { title: "Event Basics",            subtitle: "Core details for your event" },
    { title: "Agenda",                  subtitle: "Add the programme of activities — you can do this later" },
    { title: "Audience & Settings",     subtitle: "Who can register and how many" },
    { title: "Review & Publish",        subtitle: "Confirm all details before creating the event" },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId() { return Math.random().toString(36).slice(2, 10); }

interface AgendaItem   { id: string; time: string; title: string; speaker?: string; }
interface SpeakerItem  { id: string; name: string; role: string; bio: string; }
interface Resolution   { id: string; title: string; description: string; isSpecial: boolean; }
interface Prize        { id: string; place: string; reward: string; }
interface Criterion    { id: string; label: string; weight: string; }

// ─── StepPanel (left sticky sidebar) ─────────────────────────────────────────

function StepPanel({
  steps, current, moduleId, organiserName, onReset,
}: {
  steps: { label: string; optional?: true }[];
  current: number;
  moduleId: ModuleId;
  organiserName: string;
  onReset: () => void;
}) {
  const mod = MODULES.find((m) => m.id === moduleId)!;
  const pct = Math.round(((current + 1) / steps.length) * 100);

  return (
    <div className="w-[248px] shrink-0 self-start sticky top-6 flex flex-col gap-3">
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-white overflow-hidden">
        <div className="h-1" style={{ backgroundColor: mod.color }} />
        <div className="p-5">
          {/* Module identity */}
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[hsl(var(--border))]">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: mod.bg }}>
              <mod.icon className="h-5 w-5" style={{ color: mod.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[hsl(var(--foreground))] truncate">{mod.label}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{organiserName || "No organiser selected"}</p>
            </div>
          </div>

          {/* Vertical step list */}
          <div className="flex flex-col">
            {steps.map((s, i) => {
              const done   = i < current;
              const active = i === current;
              const last   = i === steps.length - 1;
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <div
                      className={cn(
                        "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                        done ? "text-white border-transparent" : active ? "bg-white" : "bg-white border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
                      )}
                      style={done ? { backgroundColor: mod.color, borderColor: mod.color } : active ? { borderColor: mod.color, color: mod.color } : {}}
                    >
                      {done ? <Check className="h-3 w-3" /> : i + 1}
                    </div>
                    {!last && (
                      <div className="w-0.5 h-5 mt-1 rounded-full transition-all"
                        style={{ backgroundColor: done ? mod.color : "hsl(var(--border))" }} />
                    )}
                  </div>
                  <div className={cn("flex flex-col", last ? "pb-0" : "pb-5")}>
                    <p
                      className={cn("text-sm leading-7 font-medium", active ? "font-semibold" : "text-[hsl(var(--muted-foreground))]")}
                      style={active ? { color: mod.color } : {}}
                    >
                      {s.label}
                    </p>
                    {s.optional && active && (
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))] -mt-1">Optional</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress */}
          <div className="mt-5 pt-4 border-t border-[hsl(var(--border))]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[hsl(var(--muted-foreground))]">Progress</span>
              <span className="text-xs font-bold tabular-nums" style={{ color: mod.color }}>{pct}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[hsl(var(--border))]">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: mod.color }} />
            </div>
          </div>
        </div>
      </div>

      <button type="button" onClick={onReset}
        className="flex items-center justify-center gap-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] border border-[hsl(var(--border))] rounded-xl px-3 py-2.5 bg-white hover:bg-[hsl(var(--muted))] transition-all w-full">
        <ArrowLeft className="h-3.5 w-3.5" /> Change event type
      </button>
    </div>
  );
}

// ─── OrgCombobox (searchable organiser picker) ────────────────────────────────

function OrgCombobox({
  value,
  onValueChange,
  organisers,
}: {
  value: string;
  onValueChange: (id: string) => void;
  organisers: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? organisers.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
    : organisers;

  const selected = organisers.find((o) => o.id === value);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 h-11 rounded-xl border border-[hsl(var(--border))] bg-white px-3 text-sm text-left hover:border-[hsl(var(--ring)/0.5)] transition-colors"
      >
        <Building2 className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0" />
        <span className={cn("flex-1 truncate", !selected && "text-[hsl(var(--muted-foreground))]")}>
          {selected ? selected.name : "Select an organiser…"}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 top-[calc(100%+4px)] left-0 right-0 rounded-xl border border-[hsl(var(--border))] bg-white shadow-lg overflow-hidden">
          <div className="p-2 border-b border-[hsl(var(--border))]">
            <div className="flex items-center gap-2 px-2 py-0.5">
              <Search className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search organisers…"
                className="flex-1 text-sm bg-transparent outline-none py-1 text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
                {organisers.length === 0 ? "No active organisers — enroll one first." : "No results."}
              </p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => { onValueChange(o.id); setOpen(false); setQuery(""); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-[hsl(var(--muted))] transition-colors",
                    value === o.id && "bg-[hsl(var(--primary)/0.05)] text-[hsl(var(--primary))] font-medium"
                  )}
                >
                  <span className="w-3.5 shrink-0 flex items-center">
                    {value === o.id && <Check className="h-3.5 w-3.5" />}
                  </span>
                  {o.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── OrgChip ─────────────────────────────────────────────────────────────────

function OrgChip({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] px-4 py-3">
      <Building2 className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-widest font-semibold">Organiser</p>
        <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">
          {name || <span className="text-[hsl(var(--muted-foreground))] font-normal italic">No organiser selected</span>}
        </p>
      </div>
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

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

function Toggle({ checked, onChange, color }: { checked: boolean; onChange: (v: boolean) => void; color?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0"
      style={{ backgroundColor: checked ? (color ?? "hsl(var(--primary))") : "hsl(var(--muted-foreground) / 0.3)" }}>
      <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-6" : "translate-x-1")} />
    </button>
  );
}

function FormatPicker({ value, onChange }: { value: Format; onChange: (f: Format) => void }) {
  return (
    <div>
      <Label className="mb-2 block">Format</Label>
      <div className="flex gap-2">
        {([["virtual", Monitor, "Virtual"], ["in_person", MapPin, "In-Person"], ["hybrid", Users2, "Hybrid"]] as const).map(([f, Icon, lbl]) => (
          <button key={f} type="button" onClick={() => onChange(f)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-all",
              value === f ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.06)] text-[hsl(var(--primary))]"
                         : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--ring)/0.3)]"
            )}>
            <Icon className="h-3.5 w-3.5" />{lbl}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── AGM Steps ────────────────────────────────────────────────────────────────

function AgmStep0({ s, organiserName }: { s: AgmState; organiserName: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label className="mb-2 block">Meeting Title</Label>
        <Input placeholder="e.g. Zenith Bank Plc — 2026 Annual General Meeting" value={s.title} onChange={(e) => s.setTitle(e.target.value)} />
      </div>
      <OrgChip name={organiserName} />
      <div className="grid grid-cols-2 gap-4">
        <div><Label className="mb-2 block">Date</Label><Input type="date" value={s.date} onChange={(e) => s.setDate(e.target.value)} /></div>
        <div><Label className="mb-2 block">Start Time</Label><Input type="time" value={s.time} onChange={(e) => s.setTime(e.target.value)} /></div>
      </div>
      <FormatPicker value={s.format} onChange={s.setFormat} />
      {(s.format === "in_person" || s.format === "hybrid") && (
        <div><Label className="mb-2 block"><MapPin className="h-3.5 w-3.5 inline mr-1" />Venue</Label><Input placeholder="e.g. Civic Centre, Victoria Island, Lagos" value={s.venue} onChange={(e) => s.setVenue(e.target.value)} /></div>
      )}
    </div>
  );
}

function AgmStep1({ s }: { s: AgmState }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Label className="mb-2 block">Notice Period</Label>
        <Input type="number" placeholder="21" value={s.noticeDays} onChange={(e) => s.setNoticeDays(e.target.value)} className="max-w-[160px]" />
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Minimum 21 days per CAMA</p>
      </div>
      <div>
        <p className="text-sm font-semibold text-[hsl(var(--foreground))] mb-1">AGM Notice Document</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">Upload the statutory notice — it will be distributed to all registered shareholders.</p>
        <label className="border-2 border-dashed border-[hsl(var(--border))] rounded-xl p-6 text-center flex flex-col items-center cursor-pointer hover:border-[hsl(var(--ring)/0.4)] transition-colors">
          <Upload className="h-7 w-7 mb-2 text-[hsl(var(--muted-foreground))]" />
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">{s.noticeFile ? `${s.noticeFile} ✓` : "Click to upload notice"}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">PDF up to 50 MB</p>
          <input type="file" accept=".pdf" className="hidden" onChange={(e) => s.setNoticeFile(e.target.files?.[0]?.name ?? "")} />
        </label>
      </div>
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label>Agenda Items</Label>
          <button type="button" onClick={s.addAgenda} className="flex items-center gap-1 text-sm font-medium text-[hsl(var(--primary))] hover:opacity-70">
            <Plus className="h-3.5 w-3.5" /> Add item
          </button>
        </div>
        {s.agenda.map((item, idx) => (
          <div key={item.id} className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-[hsl(var(--muted-foreground))] w-7 text-center shrink-0">{String(idx + 1).padStart(2, "0")}</span>
            <Input type="time" value={item.time} onChange={(e) => s.updateAgenda(item.id, "time", e.target.value)} className="w-32 shrink-0" />
            <Input placeholder="e.g. Opening of meeting" value={item.title} onChange={(e) => s.updateAgenda(item.id, "title", e.target.value)} className="flex-1" />
            <button type="button" onClick={() => s.removeAgenda(item.id)} disabled={s.agenda.length === 1}
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-30 disabled:pointer-events-none transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgmStep2({ s }: { s: AgmState }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between mb-1">
        <Label>Resolutions</Label>
        <button type="button" onClick={s.addResolution} className="flex items-center gap-1 text-sm font-medium text-[hsl(var(--primary))] hover:opacity-70">
          <Plus className="h-3.5 w-3.5" /> Add resolution
        </button>
      </div>
      {s.resolutions.map((res, idx) => (
        <div key={res.id} className="rounded-xl border border-[hsl(var(--border))] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Resolution {idx + 1}</span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                <input type="checkbox" checked={res.isSpecial} onChange={(e) => s.updateResolution(res.id, "isSpecial", e.target.checked)}
                  className="rounded border-[hsl(var(--border))]" />
                Special resolution
              </label>
              {s.resolutions.length > 1 && (
                <button type="button" onClick={() => s.removeResolution(res.id)} className="text-[hsl(var(--muted-foreground))] hover:text-red-500 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          {res.isSpecial && (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" /> Special resolutions require 75% shareholder approval
            </div>
          )}
          <div><Label className="mb-1.5 block">Resolution Title</Label><Input placeholder="e.g. Approval of Directors' Remuneration" value={res.title} onChange={(e) => s.updateResolution(res.id, "title", e.target.value)} /></div>
          <div>
            <Label className="mb-1.5 block">Description <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></Label>
            <textarea rows={2} placeholder="Additional context for shareholders..." value={res.description} onChange={(e) => s.updateResolution(res.id, "description", e.target.value)}
              className="flex w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none" />
          </div>
        </div>
      ))}
    </div>
  );
}

function AgmStep3({ s }: { s: AgmState }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Label className="mb-3 block">Shareholder Targeting</Label>
        <div className="flex flex-col gap-2">
          {([["all", "All registered shareholders", "Invite every shareholder on the register — recommended for AGMs"], ["custom", "Custom shareholder list", "Upload a curated CSV of eligible voters (e.g. cut-off date subset)"]] as const).map(([opt, lbl, desc]) => (
            <label key={opt} className={cn("flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
              s.shareholderTargeting === opt ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.04)]" : "border-[hsl(var(--border))]")}>
              <input type="radio" name="targeting" value={opt} checked={s.shareholderTargeting === opt} onChange={() => s.setShareholderTargeting(opt)} className="mt-0.5 accent-[hsl(var(--primary))]" />
              <div>
                <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{lbl}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{desc}</p>
              </div>
            </label>
          ))}
        </div>
        {s.shareholderTargeting === "custom" && (
          <label className="mt-3 border-2 border-dashed border-[hsl(var(--border))] rounded-xl p-5 flex flex-col items-center cursor-pointer hover:border-[hsl(var(--ring)/0.4)] transition-colors">
            <Upload className="h-6 w-6 mb-2 text-[hsl(var(--muted-foreground))]" />
            <p className="text-sm font-medium text-[hsl(var(--foreground))]">Upload shareholder list</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">CSV with Name, Email, Phone, ShareCount</p>
            <input type="file" accept=".csv,.xlsx" className="hidden" />
          </label>
        )}
      </div>
      <div className="flex items-center justify-between p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)]">
        <div>
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Enable proxy voting</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Allow shareholders to delegate their vote to a proxy</p>
        </div>
        <Toggle checked={s.proxyEnabled} onChange={s.setProxyEnabled} color="#374151" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label className="mb-2 block">Quorum (%)</Label><Input type="number" placeholder="25" value={s.quorum} onChange={(e) => s.setQuorum(e.target.value)} /></div>
        <div><Label className="mb-2 block">Eligibility Cut-off Date</Label><Input type="date" value={s.cutoff} onChange={(e) => s.setCutoff(e.target.value)} /></div>
      </div>
      <div className="flex items-center gap-2 p-3 rounded-xl bg-[hsl(var(--muted)/0.5)] border border-[hsl(var(--border))]">
        <ShieldCheck className="h-4 w-4 text-[#374151] shrink-0" />
        <p className="text-xs text-[#374151] font-medium">Full KYC verification is required for all AGM voters — enforced automatically</p>
      </div>
    </div>
  );
}

// ─── Launch Steps ─────────────────────────────────────────────────────────────

function LaunchStep0({ s, organiserName }: { s: LaunchState; organiserName: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div><Label className="mb-2 block">Event Title</Label><Input placeholder="e.g. ZenithDirect 3.0 — Official Product Launch" value={s.title} onChange={(e) => s.setTitle(e.target.value)} /></div>
      <OrgChip name={organiserName} />
      <div className="grid grid-cols-2 gap-4">
        <div><Label className="mb-2 block">Date</Label><Input type="date" value={s.date} onChange={(e) => s.setDate(e.target.value)} /></div>
        <div><Label className="mb-2 block">Start Time</Label><Input type="time" value={s.time} onChange={(e) => s.setTime(e.target.value)} /></div>
      </div>
      <FormatPicker value={s.format} onChange={s.setFormat} />
      {(s.format === "in_person" || s.format === "hybrid") && (
        <div><Label className="mb-2 block"><MapPin className="h-3.5 w-3.5 inline mr-1" />Venue</Label><Input placeholder="e.g. Eko Hotels, Victoria Island" value={s.venue} onChange={(e) => s.setVenue(e.target.value)} /></div>
      )}
      <div><Label className="mb-2 block">Capacity</Label><Input type="number" placeholder="e.g. 2000" value={s.capacity} onChange={(e) => s.setCapacity(e.target.value)} /></div>
    </div>
  );
}

function LaunchStep1({ s }: { s: LaunchState }) {
  return (
    <div className="flex flex-col gap-4">
      <div><Label className="mb-2 block">Product Name</Label><Input placeholder="e.g. ZenithDirect 3.0" value={s.productName} onChange={(e) => s.setProductName(e.target.value)} /></div>
      <div><Label className="mb-2 block">Tagline</Label><Input placeholder="e.g. Banking beyond boundaries." value={s.tagline} onChange={(e) => s.setTagline(e.target.value)} /></div>
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

function LaunchStep2({ s }: { s: LaunchState }) {
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
            <textarea rows={2} placeholder="Brief speaker biography..." value={sp.bio} onChange={(e) => s.updateSpeaker(sp.id, "bio", e.target.value)}
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

function LaunchStep3({ s }: { s: LaunchState }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-semibold text-[hsl(var(--foreground))] mb-1 flex items-center gap-2">
          <Lock className="h-4 w-4 text-[#b45309]" /> Document Embargo
        </p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
          Lock documents until a release moment. They unlock automatically when the event goes live.
        </p>
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

// ─── Hackathon Steps ──────────────────────────────────────────────────────────

function HackStep0({ s, organiserName }: { s: HackState; organiserName: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div><Label className="mb-2 block">Challenge Title</Label><Input placeholder="e.g. Meristem FinTech Innovation Challenge 2026" value={s.title} onChange={(e) => s.setTitle(e.target.value)} /></div>
      <OrgChip name={organiserName} />
      <div><Label className="mb-2 block">Theme / Track</Label><Input placeholder="e.g. Open Banking, AgriTech" value={s.theme} onChange={(e) => s.setTheme(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label className="mb-2 block">Start Date</Label><Input type="date" value={s.startDate} onChange={(e) => s.setStartDate(e.target.value)} /></div>
        <div><Label className="mb-2 block">End Date</Label><Input type="date" value={s.endDate} onChange={(e) => s.setEndDate(e.target.value)} /></div>
      </div>
      <FormatPicker value={s.format} onChange={s.setFormat} />
      {(s.format === "in_person" || s.format === "hybrid") && (
        <div><Label className="mb-2 block"><MapPin className="h-3.5 w-3.5 inline mr-1" />Venue</Label><Input placeholder="e.g. Co-creation Hub, Yaba" value={s.venue} onChange={(e) => s.setVenue(e.target.value)} /></div>
      )}
    </div>
  );
}

function HackStep1({ s }: { s: HackState }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label className="mb-2 block">Problem Statement</Label>
        <textarea rows={4} placeholder="What problem are participants solving? Be specific and measurable."
          value={s.problemStatement} onChange={(e) => s.setProblemStatement(e.target.value)}
          className="flex w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none" />
      </div>
      <div><Label className="mb-2 block">Expected Deliverable</Label><Input placeholder="e.g. Working prototype + 3-min pitch deck" value={s.deliverable} onChange={(e) => s.setDeliverable(e.target.value)} /></div>
      <div><Label className="mb-2 block">Submission Deadline</Label><Input type="date" value={s.submissionDeadline} onChange={(e) => s.setSubmissionDeadline(e.target.value)} /></div>
      <div>
        <Label className="mb-2 block">Allowed Tech Stack <span className="font-normal text-[hsl(var(--muted-foreground))] text-xs">(leave blank for open)</span></Label>
        <Input placeholder="e.g. React, Python, any blockchain" value={s.techStack} onChange={(e) => s.setTechStack(e.target.value)} />
      </div>
    </div>
  );
}

function HackStep2({ s }: { s: HackState }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Label className="mb-3 block">Participation Type</Label>
        <div className="flex gap-3">
          {(["solo", "team", "both"] as const).map((t) => (
            <label key={t} className={cn("flex-1 flex flex-col items-center gap-1 p-4 rounded-xl border-2 cursor-pointer transition-all text-center",
              s.participationType === t ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.04)]" : "border-[hsl(var(--border))]")}>
              <input type="radio" className="hidden" checked={s.participationType === t} onChange={() => s.setParticipationType(t)} />
              <span className="text-sm font-semibold capitalize">{t === "both" ? "Solo & Team" : t}</span>
            </label>
          ))}
        </div>
      </div>
      {(s.participationType === "team" || s.participationType === "both") && (
        <div className="grid grid-cols-2 gap-4">
          <div><Label className="mb-2 block">Min Team Size</Label><Input type="number" placeholder="2" value={s.minTeam} onChange={(e) => s.setMinTeam(e.target.value)} /></div>
          <div><Label className="mb-2 block">Max Team Size</Label><Input type="number" placeholder="5" value={s.maxTeam} onChange={(e) => s.setMaxTeam(e.target.value)} /></div>
        </div>
      )}
      <div>
        <Label className="mb-2 block">Eligibility Criteria</Label>
        <textarea rows={3} placeholder="e.g. Open to Nigerian residents 18+. Students and professionals welcome."
          value={s.eligibility} onChange={(e) => s.setEligibility(e.target.value)}
          className="flex w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none" />
      </div>
      <div><Label className="mb-2 block">Maximum Entries</Label><Input type="number" placeholder="e.g. 200" value={s.capacity} onChange={(e) => s.setCapacity(e.target.value)} /></div>
    </div>
  );
}

function HackStep3({ s }: { s: HackState }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label>Prize Tiers</Label>
          <button type="button" onClick={s.addPrize} className="flex items-center gap-1 text-sm font-medium text-[hsl(var(--primary))] hover:opacity-70">
            <Plus className="h-3.5 w-3.5" /> Add tier
          </button>
        </div>
        {s.prizes.map((p, i) => (
          <div key={p.id} className="flex items-center gap-2 mb-2">
            <span className="text-sm w-8 text-center shrink-0">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i+1}`}</span>
            <Input placeholder={i === 0 ? "1st Place" : i === 1 ? "2nd Place" : "3rd Place"} value={p.place} onChange={(e) => s.updatePrize(p.id, "place", e.target.value)} className="flex-1" />
            <Input placeholder="₦5,000,000 or trophy" value={p.reward} onChange={(e) => s.updatePrize(p.id, "reward", e.target.value)} className="flex-1" />
            {s.prizes.length > 1 && (
              <button type="button" onClick={() => s.removePrize(p.id)} className="h-9 w-9 flex items-center justify-center rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="border-t border-[hsl(var(--border))] pt-5">
        <div className="flex items-center justify-between mb-3">
          <Label>Judging Criteria</Label>
          <button type="button" onClick={s.addCriterion} className="flex items-center gap-1 text-sm font-medium text-[hsl(var(--primary))] hover:opacity-70">
            <Plus className="h-3.5 w-3.5" /> Add criterion
          </button>
        </div>
        {s.criteria.map((c) => (
          <div key={c.id} className="flex items-center gap-2 mb-2">
            <Input placeholder="e.g. Innovation" value={c.label} onChange={(e) => s.updateCriterion(c.id, "label", e.target.value)} className="flex-1" />
            <Input placeholder="30%" value={c.weight} onChange={(e) => s.updateCriterion(c.id, "weight", e.target.value)} className="w-24" />
            {s.criteria.length > 1 && (
              <button type="button" onClick={() => s.removeCriterion(c.id)} className="h-9 w-9 flex items-center justify-center rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── General Steps ────────────────────────────────────────────────────────────

function GeneralStep0({ s, organiserName }: { s: GeneralState; organiserName: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div><Label className="mb-2 block">Event Title</Label><Input placeholder="e.g. Meristem Capital Markets Summit 2026" value={s.title} onChange={(e) => s.setTitle(e.target.value)} /></div>
      <OrgChip name={organiserName} />
      <div><Label className="mb-2 block">Capacity</Label><Input type="number" placeholder="e.g. 1000" value={s.capacity} onChange={(e) => s.setCapacity(e.target.value)} /></div>
      <div>
        <Label className="mb-2 block">Description</Label>
        <textarea rows={3} placeholder="Describe the event purpose and what attendees can expect..."
          value={s.description} onChange={(e) => s.setDescription(e.target.value)}
          className="flex w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label className="mb-2 block">Date</Label><Input type="date" value={s.date} onChange={(e) => s.setDate(e.target.value)} /></div>
        <div><Label className="mb-2 block">Start Time</Label><Input type="time" value={s.time} onChange={(e) => s.setTime(e.target.value)} /></div>
      </div>
      <FormatPicker value={s.format} onChange={s.setFormat} />
      {(s.format === "in_person" || s.format === "hybrid") && (
        <div><Label className="mb-2 block"><MapPin className="h-3.5 w-3.5 inline mr-1" />Venue</Label><Input placeholder="e.g. Civic Centre, Victoria Island, Lagos" value={s.venue} onChange={(e) => s.setVenue(e.target.value)} /></div>
      )}
      {(s.format === "virtual" || s.format === "hybrid") && (
        <div><Label className="mb-2 block">Stream URL <span className="font-normal text-[hsl(var(--muted-foreground))] text-xs">(optional)</span></Label><Input placeholder="https://youtube.com/live/..." value={s.streamUrl} onChange={(e) => s.setStreamUrl(e.target.value)} /></div>
      )}
    </div>
  );
}

function GeneralStep1({ s }: { s: GeneralState }) {
  return (
    <div className="flex flex-col gap-3">
      {s.agenda.map((item, idx) => (
        <div key={item.id} className="grid grid-cols-[auto_1fr] gap-3 rounded-xl border border-[hsl(var(--border))] p-4 bg-[hsl(var(--muted)/0.3)]">
          <div className="flex flex-col items-center gap-2 pt-0.5">
            <GripVertical className="h-4 w-4 text-[hsl(var(--muted-foreground)/0.5)]" />
            <span className="text-xs font-bold tabular-nums text-[hsl(var(--muted-foreground))]">{String(idx + 1).padStart(2, "0")}</span>
          </div>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[120px_1fr_auto] gap-2 items-end">
              <div><Label className="mb-1.5 block">Time</Label><Input type="time" value={item.time} onChange={(e) => s.updateAgenda(item.id, "time", e.target.value)} /></div>
              <div><Label className="mb-1.5 block">Title</Label><Input placeholder="e.g. Opening Remarks" value={item.title} onChange={(e) => s.updateAgenda(item.id, "title", e.target.value)} /></div>
              <button type="button" onClick={() => s.removeAgenda(item.id)} disabled={s.agenda.length === 1}
                className="h-9 w-9 flex items-center justify-center rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-30 disabled:pointer-events-none transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div><Label className="mb-1.5 block">Speaker <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></Label>
              <Input placeholder="e.g. Dr. Akinwunmi Adesina" value={item.speaker ?? ""} onChange={(e) => s.updateAgenda(item.id, "speaker", e.target.value)} />
            </div>
          </div>
        </div>
      ))}
      <button type="button" onClick={s.addAgenda} className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--primary))] hover:opacity-70 mt-1">
        <Plus className="h-4 w-4" /> Add agenda item
      </button>
    </div>
  );
}

function GeneralStep2({ s }: { s: GeneralState }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Label className="mb-3 block">Audience Targeting</Label>
        {([["open", Globe, "Open registration", "Anyone can register for this event"], ["invite", Mail, "Invite only", "Only users you explicitly invite can register"]] as const).map(([val, Icon, lbl, desc]) => (
          <label key={val} className={cn("flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all mb-2",
            s.audienceMode === val ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.04)]" : "border-[hsl(var(--border))]")}>
            <input type="radio" name="audience_g" value={val} checked={s.audienceMode === val} onChange={() => s.setAudienceMode(val)} className="mt-0.5 accent-[hsl(var(--primary))]" />
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

// ─── Review Steps ─────────────────────────────────────────────────────────────

function AgmReview({ s, organiserName }: { s: AgmState; organiserName: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div><p className="attend-section-title mb-2">Meeting Details</p>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 divide-y divide-[hsl(var(--border))]">
          <ReviewRow label="Title" value={s.title} />
          <ReviewRow label="Company" value={organiserName} />
          <ReviewRow label="Date" value={s.date} />
          <ReviewRow label="Format" value={s.format} />
          {s.venue && <ReviewRow label="Venue" value={s.venue} />}
        </div>
      </div>
      <div><p className="attend-section-title mb-2">Governance</p>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 divide-y divide-[hsl(var(--border))]">
          <ReviewRow label="Notice Period" value={s.noticeDays ? `${s.noticeDays} days` : ""} />
          <ReviewRow label="Quorum" value={s.quorum ? `${s.quorum}%` : ""} />
          <ReviewRow label="Resolutions" value={`${s.resolutions.filter(r => r.title).length} resolution(s)`} />
          <ReviewRow label="Proxy Voting" value={s.proxyEnabled ? "Enabled" : "Disabled"} />
          <ReviewRow label="Shareholder List" value={s.shareholderTargeting === "all" ? "All registered" : "Custom upload"} />
        </div>
      </div>
    </div>
  );
}

function LaunchReview({ s, organiserName }: { s: LaunchState; organiserName: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div><p className="attend-section-title mb-2">Event Details</p>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 divide-y divide-[hsl(var(--border))]">
          <ReviewRow label="Title" value={s.title} />
          <ReviewRow label="Company" value={organiserName} />
          <ReviewRow label="Date" value={s.date} />
          <ReviewRow label="Format" value={s.format} />
          <ReviewRow label="Capacity" value={s.capacity || "Unlimited"} />
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

function HackReview({ s, organiserName }: { s: HackState; organiserName: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div><p className="attend-section-title mb-2">Challenge Details</p>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 divide-y divide-[hsl(var(--border))]">
          <ReviewRow label="Title" value={s.title} />
          <ReviewRow label="Organiser" value={organiserName} />
          <ReviewRow label="Dates" value={s.startDate && s.endDate ? `${s.startDate} → ${s.endDate}` : ""} />
          <ReviewRow label="Submission" value={s.submissionDeadline} />
          <ReviewRow label="Format" value={s.format} />
        </div>
      </div>
      <div><p className="attend-section-title mb-2">Participation</p>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 divide-y divide-[hsl(var(--border))]">
          <ReviewRow label="Type" value={s.participationType === "both" ? "Solo & Team" : s.participationType} />
          <ReviewRow label="Max Entries" value={s.capacity || "Unlimited"} />
          <ReviewRow label="Prizes" value={`${s.prizes.filter(p => p.reward).length} tier(s)`} />
        </div>
      </div>
    </div>
  );
}

function GeneralReview({ s, organiserName }: { s: GeneralState; organiserName: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div><p className="attend-section-title mb-2">Event Details</p>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 divide-y divide-[hsl(var(--border))]">
          <ReviewRow label="Title" value={s.title} />
          <ReviewRow label="Organiser" value={organiserName} />
          <ReviewRow label="Date" value={s.date} />
          <ReviewRow label="Format" value={s.format} />
          <ReviewRow label="Capacity" value={s.capacity || "Unlimited"} />
          <ReviewRow label="Audience" value={s.audienceMode} />
        </div>
      </div>
    </div>
  );
}

// ─── State hooks ──────────────────────────────────────────────────────────────

type AgmState     = ReturnType<typeof useAgmState>;
type LaunchState  = ReturnType<typeof useLaunchState>;
type HackState    = ReturnType<typeof useHackState>;
type GeneralState = ReturnType<typeof useGeneralState>;

function useAgmState() {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [format, setFormat] = useState<Format>("virtual");
  const [venue, setVenue] = useState("");
  const [noticeDays, setNoticeDays] = useState("21");
  const [noticeFile, setNoticeFile] = useState("");
  const [quorum, setQuorum] = useState("25");
  const [cutoff, setCutoff] = useState("");
  const [agenda, setAgenda] = useState<AgendaItem[]>([{ id: genId(), time: "", title: "", speaker: "" }]);
  const [resolutions, setResolutions] = useState<Resolution[]>([{ id: genId(), title: "", description: "", isSpecial: false }]);
  const [proxyEnabled, setProxyEnabled] = useState(true);
  const [shareholderTargeting, setShareholderTargeting] = useState<"all" | "custom">("all");
  const addAgenda = () => setAgenda((a) => [...a, { id: genId(), time: "", title: "", speaker: "" }]);
  const removeAgenda = (id: string) => setAgenda((a) => a.filter((x) => x.id !== id));
  const updateAgenda = (id: string, field: keyof AgendaItem, val: string) => setAgenda((a) => a.map((x) => x.id === id ? { ...x, [field]: val } : x));
  const addResolution = () => setResolutions((r) => [...r, { id: genId(), title: "", description: "", isSpecial: false }]);
  const removeResolution = (id: string) => setResolutions((r) => r.filter((x) => x.id !== id));
  const updateResolution = (id: string, field: keyof Resolution, val: string | boolean) => setResolutions((r) => r.map((x) => x.id === id ? { ...x, [field]: val } : x));
  return { title, setTitle, date, setDate, time, setTime, format, setFormat, venue, setVenue, noticeDays, setNoticeDays, noticeFile, setNoticeFile, quorum, setQuorum, cutoff, setCutoff, agenda, addAgenda, removeAgenda, updateAgenda, resolutions, addResolution, removeResolution, updateResolution, proxyEnabled, setProxyEnabled, shareholderTargeting, setShareholderTargeting };
}

function useLaunchState() {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [format, setFormat] = useState<Format>("virtual");
  const [venue, setVenue] = useState("");
  const [capacity, setCapacity] = useState("");
  const [productName, setProductName] = useState("");
  const [tagline, setTagline] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [slug, setSlug] = useState("");
  const [speakers, setSpeakers] = useState<SpeakerItem[]>([{ id: genId(), name: "", role: "", bio: "" }]);
  const [embargoEnabled, setEmbargoEnabled] = useState(false);
  const [embargoAt, setEmbargoAt] = useState("");
  const [audienceMode, setAudienceMode] = useState<"open" | "invite">("open");
  const addSpeaker = () => setSpeakers((s) => [...s, { id: genId(), name: "", role: "", bio: "" }]);
  const removeSpeaker = (id: string) => setSpeakers((s) => s.filter((x) => x.id !== id));
  const updateSpeaker = (id: string, field: keyof SpeakerItem, val: string) => setSpeakers((s) => s.map((x) => x.id === id ? { ...x, [field]: val } : x));
  return { title, setTitle, date, setDate, time, setTime, format, setFormat, venue, setVenue, capacity, setCapacity, productName, setProductName, tagline, setTagline, productDesc, setProductDesc, slug, setSlug, speakers, addSpeaker, removeSpeaker, updateSpeaker, embargoEnabled, setEmbargoEnabled, embargoAt, setEmbargoAt, audienceMode, setAudienceMode };
}

function useHackState() {
  const [title, setTitle] = useState("");
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
  const [minTeam, setMinTeam] = useState("2");
  const [maxTeam, setMaxTeam] = useState("5");
  const [eligibility, setEligibility] = useState("");
  const [capacity, setCapacity] = useState("");
  const [prizes, setPrizes] = useState<Prize[]>([{ id: genId(), place: "1st Place", reward: "" }, { id: genId(), place: "2nd Place", reward: "" }, { id: genId(), place: "3rd Place", reward: "" }]);
  const [criteria, setCriteria] = useState<Criterion[]>([{ id: genId(), label: "Innovation", weight: "30%" }, { id: genId(), label: "Impact", weight: "30%" }, { id: genId(), label: "Execution", weight: "40%" }]);
  const addPrize = () => setPrizes((p) => [...p, { id: genId(), place: "", reward: "" }]);
  const removePrize = (id: string) => setPrizes((p) => p.filter((x) => x.id !== id));
  const updatePrize = (id: string, field: "place" | "reward", val: string) => setPrizes((p) => p.map((x) => x.id === id ? { ...x, [field]: val } : x));
  const addCriterion = () => setCriteria((c) => [...c, { id: genId(), label: "", weight: "" }]);
  const removeCriterion = (id: string) => setCriteria((c) => c.filter((x) => x.id !== id));
  const updateCriterion = (id: string, field: "label" | "weight", val: string) => setCriteria((c) => c.map((x) => x.id === id ? { ...x, [field]: val } : x));
  return { title, setTitle, theme, setTheme, startDate, setStartDate, endDate, setEndDate, format, setFormat, venue, setVenue, problemStatement, setProblemStatement, deliverable, setDeliverable, submissionDeadline, setSubmissionDeadline, techStack, setTechStack, participationType, setParticipationType, minTeam, setMinTeam, maxTeam, setMaxTeam, eligibility, setEligibility, capacity, setCapacity, prizes, addPrize, removePrize, updatePrize, criteria, addCriterion, removeCriterion, updateCriterion };
}

function useGeneralState() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [format, setFormat] = useState<Format>("virtual");
  const [venue, setVenue] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [capacity, setCapacity] = useState("");
  const [agenda, setAgenda] = useState<AgendaItem[]>([{ id: genId(), time: "", title: "", speaker: "" }]);
  const [audienceMode, setAudienceMode] = useState<"open" | "invite">("open");
  const addAgenda = () => setAgenda((a) => [...a, { id: genId(), time: "", title: "", speaker: "" }]);
  const removeAgenda = (id: string) => setAgenda((a) => a.filter((x) => x.id !== id));
  const updateAgenda = (id: string, field: keyof AgendaItem, val: string) => setAgenda((a) => a.map((x) => x.id === id ? { ...x, [field]: val } : x));
  return { title, setTitle, description, setDescription, date, setDate, time, setTime, format, setFormat, venue, setVenue, streamUrl, setStreamUrl, capacity, setCapacity, agenda, addAgenda, removeAgenda, updateAgenda, audienceMode, setAudienceMode };
}

// ─── Page Inner ───────────────────────────────────────────────────────────────

function CreateEventInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organisers } = useStore();

  const [selectedModule, setSelectedModule] = useState<ModuleId | null>(null);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [organiserId, setOrganiserId] = useState("");

  useEffect(() => {
    const type = searchParams.get("type") as ModuleId | null;
    if (type && ["AGM", "LAUNCH", "HACKATHON", "GENERAL"].includes(type)) {
      setSelectedModule(type);
      setStep(0);
    }
  }, [searchParams]);

  const agm     = useAgmState();
  const launch  = useLaunchState();
  const hack    = useHackState();
  const general = useGeneralState();

  const activeOrganisers = organisers.filter((o) => o.status === "active");
  const selectedOrganiser = activeOrganisers.find((o) => o.id === organiserId) ?? null;
  const organiserName = selectedOrganiser?.name ?? "";

  const mod    = selectedModule ? MODULES.find((m) => m.id === selectedModule)! : null;
  const steps  = selectedModule ? STEPS[selectedModule] : [];
  const meta   = selectedModule ? STEP_META[selectedModule] : [];
  const isLast = step === steps.length - 1;

  function next() { setStep((s) => Math.min(s + 1, steps.length - 1)); }
  function back() { setStep((s) => Math.max(s - 1, 0)); }
  function skip() { next(); }

  function selectModule(id: ModuleId) { setSelectedModule(id); setStep(0); }
  function resetModule() { setSelectedModule(null); setStep(0); }

  function handleSubmit() {
    if (!organiserId) {
      toast.error("Please select an organiser before creating an event.");
      return;
    }
    if (!selectedModule) return;
    setSubmitting(true);
    setTimeout(() => {
      toast.success("Event created successfully!");
      router.push("/events");
    }, 500);
  }

  // ── Module selection screen ───────────────────────────────────────────────
  if (!selectedModule) {
    return (
      <div className="w-full">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-black text-[hsl(var(--foreground))]">Create New Event</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1.5">
            Choose the organiser and event type to begin setup.
          </p>
        </div>

        {/* Step 1 — Organiser selection */}
        <div className="mb-8 rounded-2xl border border-[hsl(var(--border))] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-white">1</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Select Organiser</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Which organisation is hosting this event?</p>
            </div>
          </div>
          <OrgCombobox
            value={organiserId}
            onValueChange={setOrganiserId}
            organisers={activeOrganisers}
          />
          {organiserId && (
            <p className="mt-2 text-xs text-emerald-600 font-medium flex items-center gap-1">
              <Check className="h-3 w-3" /> {organiserName} selected
            </p>
          )}
          {!organiserId && (
            <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
              Required — every event must be linked to an organiser.
            </p>
          )}
        </div>

        {/* Step 2 — Event type */}
        <div className="flex items-center gap-3 mb-4">
          <div className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-colors",
            organiserId ? "bg-[hsl(var(--primary))]" : "bg-[hsl(var(--muted-foreground)/0.3)]"
          )}>
            <span className="text-xs font-bold text-white">2</span>
          </div>
          <div>
            <p className={cn("text-sm font-semibold transition-colors", organiserId ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]")}>
              Select Event Type
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Each type has its own tailored setup flow.</p>
          </div>
        </div>

        {/* Module cards */}
        <div className={cn("grid grid-cols-2 gap-5 transition-opacity duration-200", !organiserId && "opacity-50 pointer-events-none select-none")}>
          {MODULES.map((m) => {
            const Icon = m.icon;
            const stepCount = STEPS[m.id as ModuleId].length;
            return (
              <button key={m.id} type="button" onClick={() => {
                if (!organiserId) {
                  toast.error("Please select an organiser first.");
                  return;
                }
                selectModule(m.id as ModuleId);
              }}
                className="text-left rounded-2xl border border-[hsl(var(--border))] bg-white overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
                <div className="h-1.5" style={{ backgroundColor: m.color }} />
                <div className="p-6">
                  <div className="flex items-start justify-between mb-5">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: m.bg }}>
                      <Icon className="h-6 w-6" style={{ color: m.color }} />
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: m.bg, color: m.color }}>
                      {stepCount} steps
                    </span>
                  </div>
                  <p className="text-lg font-bold text-[hsl(var(--foreground))] mb-1">{m.label}</p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4 leading-relaxed">{m.desc}</p>
                  <div className="border-t border-[hsl(var(--border))] pt-4">
                    <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{m.detail}</p>
                  </div>
                  <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold group-hover:gap-3 transition-all duration-200" style={{ color: m.color }}>
                    Start setup <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

      </div>
    );
  }

  // ── Per-module multistep flow ─────────────────────────────────────────────
  const stepMeta = meta[step];

  function renderStep() {
    if (selectedModule === "AGM") {
      if (step === 0) return <AgmStep0 s={agm} organiserName={organiserName} />;
      if (step === 1) return <AgmStep1 s={agm} />;
      if (step === 2) return <AgmStep2 s={agm} />;
      if (step === 3) return <AgmStep3 s={agm} />;
      return <AgmReview s={agm} organiserName={organiserName} />;
    }
    if (selectedModule === "LAUNCH") {
      if (step === 0) return <LaunchStep0 s={launch} organiserName={organiserName} />;
      if (step === 1) return <LaunchStep1 s={launch} />;
      if (step === 2) return <LaunchStep2 s={launch} />;
      if (step === 3) return <LaunchStep3 s={launch} />;
      return <LaunchReview s={launch} organiserName={organiserName} />;
    }
    if (selectedModule === "HACKATHON") {
      if (step === 0) return <HackStep0 s={hack} organiserName={organiserName} />;
      if (step === 1) return <HackStep1 s={hack} />;
      if (step === 2) return <HackStep2 s={hack} />;
      if (step === 3) return <HackStep3 s={hack} />;
      return <HackReview s={hack} organiserName={organiserName} />;
    }
    if (selectedModule === "GENERAL") {
      if (step === 0) return <GeneralStep0 s={general} organiserName={organiserName} />;
      if (step === 1) return <GeneralStep1 s={general} />;
      if (step === 2) return <GeneralStep2 s={general} />;
      return <GeneralReview s={general} organiserName={organiserName} />;
    }
    return null;
  }

  return (
    <div className="w-full">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Create Event</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{stepMeta.subtitle}</p>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6 items-start">
        {/* Left: sticky step panel */}
        <StepPanel
          steps={steps}
          current={step}
          moduleId={selectedModule}
          organiserName={organiserName}
          onReset={resetModule}
        />

        {/* Right: form + nav */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <Card className="attend-card p-6">
            <SectionHead title={stepMeta.title} subtitle={stepMeta.subtitle} />
            {renderStep()}
          </Card>

          {/* Navigation */}
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-white px-5 py-4 flex items-center justify-between gap-3">
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
              {steps[step]?.optional && (
                <button type="button" onClick={skip} className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] underline transition-colors">
                  Skip this step
                </button>
              )}
              {!isLast ? (
                <Button type="button" onClick={next} className="gap-1.5 px-6">
                  Continue <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" onClick={handleSubmit} disabled={submitting} className="gap-1.5 px-6"
                  style={{ backgroundColor: mod!.color }}>
                  {submitting ? "Creating…" : <><Check className="h-4 w-4" /> Create {mod!.label}</>}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CreateEventPage() {
  return (
    <Suspense>
      <CreateEventInner />
    </Suspense>
  );
}
