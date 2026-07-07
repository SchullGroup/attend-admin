"use client";
import { useState, useRef, useEffect } from "react";
import { Building2, ChevronDown, Search, Check, ArrowLeft, MapPin, Monitor, Users2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { MODULES } from "./types";
import type { ModuleId, Format } from "./types";

// ─── Toggle ───────────────────────────────────────────────────────────────────

export function Toggle({ checked, onChange, color }: { checked: boolean; onChange: (v: boolean) => void; color?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0"
      style={{ backgroundColor: checked ? (color ?? "hsl(var(--primary))") : "hsl(var(--muted-foreground) / 0.3)" }}>
      <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-6" : "translate-x-1")} />
    </button>
  );
}

// ─── FormatPicker ─────────────────────────────────────────────────────────────

export function FormatPicker({ value, onChange }: { value: Format; onChange: (f: Format) => void }) {
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

// ─── SectionHead ──────────────────────────────────────────────────────────────

export function SectionHead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6 pb-5 border-b border-[hsl(var(--border))]">
      <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">{title}</h2>
      <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{subtitle}</p>
    </div>
  );
}

// ─── ReviewRow ────────────────────────────────────────────────────────────────

export function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[hsl(var(--border))] last:border-0">
      <p className="text-xs text-[hsl(var(--muted-foreground))] w-36 shrink-0 pt-0.5">{label}</p>
      <p className="text-sm text-[hsl(var(--foreground))] font-medium">{value || "—"}</p>
    </div>
  );
}

// ─── OrgChip ─────────────────────────────────────────────────────────────────

export function OrgChip({ name }: { name: string }) {
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

// ─── OrgCombobox ─────────────────────────────────────────────────────────────

export function OrgCombobox({
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
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery(""); }
    }
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 h-11 rounded-xl border border-[hsl(var(--border))] bg-white px-3 text-sm text-left hover:border-[hsl(var(--ring)/0.5)] transition-colors">
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
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search organisers…"
                className="flex-1 text-sm bg-transparent outline-none py-1 text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]" />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
                {organisers.length === 0 ? "No active organisers — enroll one first." : "No results."}
              </p>
            ) : (
              filtered.map((o) => (
                <button key={o.id} type="button"
                  onClick={() => { onValueChange(o.id); setOpen(false); setQuery(""); }}
                  className={cn("w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-[hsl(var(--muted))] transition-colors",
                    value === o.id && "bg-[hsl(var(--primary)/0.05)] text-[hsl(var(--primary))] font-medium")}>
                  <span className="w-3.5 shrink-0 flex items-center">{value === o.id && <Check className="h-3.5 w-3.5" />}</span>
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

// ─── StepPanel ────────────────────────────────────────────────────────────────

export function StepPanel({
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
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[hsl(var(--border))]">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: mod.bg }}>
              <mod.icon className="h-5 w-5" style={{ color: mod.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[hsl(var(--foreground))] truncate">{mod.label}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{organiserName || "No organiser selected"}</p>
            </div>
          </div>
          <div className="flex flex-col">
            {steps.map((s, i) => {
              const done   = i < current;
              const active = i === current;
              const last   = i === steps.length - 1;
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <div className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                      done ? "text-white border-transparent" : active ? "bg-white" : "bg-white border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
                    )}
                      style={done ? { backgroundColor: mod.color, borderColor: mod.color } : active ? { borderColor: mod.color, color: mod.color } : {}}>
                      {done ? <Check className="h-3 w-3" /> : i + 1}
                    </div>
                    {!last && <div className="w-0.5 h-5 mt-1 rounded-full transition-all" style={{ backgroundColor: done ? mod.color : "hsl(var(--border))" }} />}
                  </div>
                  <div className={cn("flex flex-col", last ? "pb-0" : "pb-5")}>
                    <p className={cn("text-sm leading-7 font-medium", active ? "font-semibold" : "text-[hsl(var(--muted-foreground))]")}
                      style={active ? { color: mod.color } : {}}>
                      {s.label}
                    </p>
                    {s.optional && active && <span className="text-[10px] text-[hsl(var(--muted-foreground))] -mt-1">Optional</span>}
                  </div>
                </div>
              );
            })}
          </div>
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
