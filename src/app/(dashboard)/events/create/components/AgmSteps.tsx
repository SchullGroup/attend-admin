"use client";
import { toast } from "sonner";
import { Upload, ShieldCheck, Plus, Trash2, Check, Monitor, MapPin, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Toggle, FormatPicker, ReviewRow, OrgChip } from "./shared";
import type { AgmState } from "./state-hooks";

// ─── Step 0 — Meeting Basics ─────────────────────────────────────────────────

export function AgmStep0({ s, organiserName, showErrors = false }: { s: AgmState; organiserName: string; showErrors?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label className="mb-2 block">Meeting Title <span className="text-red-500">*</span></Label>
        <Input placeholder="e.g. Routelink MFB 10th Annual General Meeting" value={s.title}
          onChange={(e) => s.setTitle(e.target.value)}
          className={cn(showErrors && !s.title.trim() && "border-red-400 focus-visible:ring-red-200")} />
        {showErrors && !s.title.trim() && <p className="text-xs text-red-500 mt-1">Meeting title is required.</p>}
      </div>

      <div>
        <Label className="mb-2 block">Description</Label>
        <textarea rows={3} placeholder="Brief overview of the meeting purpose and agenda scope…"
          value={s.description} onChange={(e) => s.setDescription(e.target.value)}
          className="flex w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none" />
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
          <Input placeholder="https://agm.company.ng/live" value={s.streamUrl} onChange={(e) => s.setStreamUrl(e.target.value)} />
        </div>
      )}
      {(s.format === "in_person" || s.format === "hybrid") && (
        <div>
          <Label className="mb-2 block"><MapPin className="h-3.5 w-3.5 inline mr-1" />Venue / Location</Label>
          <Input placeholder="e.g. Grand Ballroom, Oriental Hotel, Victoria Island, Lagos" value={s.venue} onChange={(e) => s.setVenue(e.target.value)} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="mb-2 block">Maximum Capacity</Label>
          <Input type="number" placeholder="e.g. 500" value={s.capacity} onChange={(e) => s.setCapacity(e.target.value)} />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">RSVP Enabled</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Allow shareholders to confirm attendance</p>
          </div>
          <Toggle checked={s.rsvpEnabled} onChange={s.setRsvpEnabled} color="#374151" />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Featured Event</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Highlight this event on the homepage and discovery feeds</p>
        </div>
        <Toggle checked={s.featured} onChange={s.setFeatured} color="#374151" />
      </div>
    </div>
  );
}

// ─── Step 1 — Agenda ─────────────────────────────────────────────────────────

export function AgmAgendaStep({ s }: { s: AgmState }) {
  const hasItems = s.agendaItems.some((a) => a.title.trim());
  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 rounded-xl bg-[hsl(var(--muted)/0.4)] border border-[hsl(var(--border))] text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
        Build a running order for the meeting. Each item can have a time, title, and optional speaker. You can skip this step and configure the agenda later from the event settings.
      </div>

      {s.agendaItems.map((item, idx) => (
        <div key={item.id} className="rounded-xl border border-[hsl(var(--border))] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Item {idx + 1}</span>
            {s.agendaItems.length > 1 && (
              <button type="button" onClick={() => s.removeAgendaItem(item.id)}
                className="text-[hsl(var(--muted-foreground))] hover:text-red-500 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="mb-1.5 block"><Clock className="h-3 w-3 inline mr-1" />Time</Label>
              <Input type="time" value={item.time} onChange={(e) => s.updateAgendaItem(item.id, "time", e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="mb-1.5 block">Item Title</Label>
              <Input placeholder="e.g. Opening remarks" value={item.title} onChange={(e) => s.updateAgendaItem(item.id, "title", e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block">Speaker / Presenter <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></Label>
            <Input placeholder="e.g. Chairman — Mr. Adeyemi" value={item.speaker} onChange={(e) => s.updateAgendaItem(item.id, "speaker", e.target.value)} />
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={s.addAgendaItem} className="gap-1.5 self-start">
        <Plus className="h-3.5 w-3.5" /> Add agenda item
      </Button>

      {!hasItems && (
        <p className="text-xs text-[hsl(var(--muted-foreground))] text-center pt-2">
          No items added yet — use "Skip this step" below to proceed without an agenda.
        </p>
      )}
    </div>
  );
}

// ─── Step 2 — Notice ─────────────────────────────────────────────────────────

export function AgmNoticeStep({ s }: { s: AgmState }) {
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    s.setNoticeFile(file.name);
    s.setNoticeFileSize(file.size);
    s.setNoticeUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiClient.post<any>("/api/v1/upload", form, {
        params:           { folder: "agm-notices" },
        headers:          { "Content-Type": undefined },
        maxBodyLength:    Infinity,
        maxContentLength: Infinity,
        timeout:          120_000,
      });
      const d = res.data?.data ?? res.data ?? {};
      s.setNoticeUrl(d.fileUrl ?? d.url ?? "");
    } catch (err: any) {
      const msg = err?.response?.data?.message
        ?? (err?.response?.status === 413 ? "File too large — the server limit is 10 MB." : null)
        ?? "Notice upload failed — please try again.";
      toast.error(msg);
      s.setNoticeFile("");
      s.setNoticeFileSize(0);
      s.setNoticeUrl("");
    } finally {
      s.setNoticeUploading(false);
    }
    e.target.value = "";
  }

  function formatBytes(b: number) {
    if (b === 0) return "0 B";
    if (b < 1_024) return `${b} B`;
    if (b < 1_048_576) return `${(b / 1_024).toFixed(1)} KB`;
    return `${(b / 1_048_576).toFixed(1)} MB`;
  }

  const uploaded = !!s.noticeUrl;

  return (
    <div className="flex flex-col gap-5">
      <div className="p-4 rounded-xl bg-[hsl(var(--muted)/0.4)] border border-[hsl(var(--border))] text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
        Upload the statutory AGM Notice. The PDF will be stored securely — shareholders can download it from the event page.
      </div>
      <label className={cn(
        "border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center transition-colors",
        s.noticeUploading ? "cursor-wait opacity-60" : "cursor-pointer",
        uploaded ? "border-[hsl(var(--primary)/0.5)] bg-[hsl(var(--primary)/0.04)]" : "border-[hsl(var(--border))] hover:border-[hsl(var(--ring)/0.4)]"
      )}>
        <Upload className={cn("h-8 w-8 mb-3", uploaded ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]")} />
        {s.noticeUploading ? (
          <><p className="text-sm font-semibold text-[hsl(var(--foreground))]">Uploading…</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{s.noticeFile}</p></>
        ) : uploaded ? (
          <><p className="text-sm font-semibold text-[hsl(var(--primary))]">{s.noticeFile}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{formatBytes(s.noticeFileSize)} · Click to replace</p>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              <Check className="h-3 w-3" /> Uploaded to cloud
            </span></>
        ) : (
          <><p className="text-sm font-medium text-[hsl(var(--foreground))]">Click to upload AGM Notice</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">PDF · up to 50 MB</p></>
        )}
        <input type="file" accept=".pdf" className="hidden" onChange={handleFileChange} disabled={s.noticeUploading} />
      </label>
      {!uploaded && !s.noticeUploading && (
        <p className="text-xs text-[hsl(var(--muted-foreground))] text-center">
          The notice document is optional — you can skip this step and upload it later from the event settings.
        </p>
      )}
    </div>
  );
}

// ─── Step 3 — Resolutions ────────────────────────────────────────────────────

export function AgmResolutionsStep({ s, showErrors = false }: { s: AgmState; showErrors?: boolean }) {
  const hasValidResolution = s.resolutions.some((r) => r.title.trim());
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between mb-1">
        <Label>Resolutions <span className="text-red-500">*</span></Label>
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
                <input type="checkbox" checked={res.isSpecial}
                  onChange={(e) => s.updateResolution(res.id, "isSpecial", e.target.checked)}
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
          <div><Label className="mb-1.5 block">Resolution Title</Label>
            <Input placeholder="e.g. Approval of Directors' Remuneration" value={res.title}
              onChange={(e) => s.updateResolution(res.id, "title", e.target.value)} /></div>
          <div>
            <Label className="mb-1.5 block">Description <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></Label>
            <textarea rows={2} placeholder="Additional context for shareholders..." value={res.description}
              onChange={(e) => s.updateResolution(res.id, "description", e.target.value)}
              className="flex w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none" />
          </div>
        </div>
      ))}
      {showErrors && !hasValidResolution && (
        <p className="text-xs text-red-500">At least one resolution with a title is required.</p>
      )}
    </div>
  );
}

// ─── Step 4 — Shareholders & Voting ──────────────────────────────────────────

export function AgmShareholdersStep({ s }: { s: AgmState }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Label className="mb-3 block">Shareholder Targeting</Label>
        <div className="flex flex-col gap-2">
          {([
            ["all",    "All registered shareholders", "Invite every shareholder on the register — recommended for AGMs"],
            ["custom", "Custom shareholder list",     "Upload a curated CSV of eligible voters (e.g. cut-off date subset)"],
          ] as const).map(([opt, lbl, desc]) => (
            <label key={opt} className={cn("flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
              s.shareholderTargeting === opt ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.04)]" : "border-[hsl(var(--border))]")}>
              <input type="radio" name="targeting" value={opt} checked={s.shareholderTargeting === opt}
                onChange={() => s.setShareholderTargeting(opt)} className="mt-0.5 accent-[hsl(var(--primary))]" />
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

// ─── Review ───────────────────────────────────────────────────────────────────

export function AgmReview({ s, organiserName }: { s: AgmState; organiserName: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div><p className="attend-section-title mb-2">Meeting Details</p>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 divide-y divide-[hsl(var(--border))]">
          <ReviewRow label="Title" value={s.title} />
          {s.description && <ReviewRow label="Description" value={s.description} />}
          <ReviewRow label="Company" value={organiserName} />
          <ReviewRow label="Date" value={s.date} />
          <ReviewRow label="Start Time" value={s.time || "—"} />
          {s.endTime && <ReviewRow label="End Time" value={s.endTime} />}
          <ReviewRow label="Format" value={s.format} />
          {s.venue && <ReviewRow label="Venue" value={s.venue} />}
          {s.streamUrl && <ReviewRow label="Stream URL" value={s.streamUrl} />}
          {s.capacity && <ReviewRow label="Capacity" value={s.capacity} />}
          <ReviewRow label="RSVP Enabled" value={s.rsvpEnabled ? "Yes" : "No"} />
          {s.featured && <ReviewRow label="Featured" value="Yes" />}
        </div>
      </div>
      {s.agendaItems.some((a) => a.title.trim()) && (
        <div><p className="attend-section-title mb-2">Agenda</p>
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 divide-y divide-[hsl(var(--border))]">
            {s.agendaItems.filter((a) => a.title.trim()).map((a, i) => (
              <ReviewRow key={i} label={a.time || `Item ${i + 1}`} value={a.title + (a.speaker ? ` — ${a.speaker}` : "")} />
            ))}
          </div>
        </div>
      )}
      <div><p className="attend-section-title mb-2">Governance</p>
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 divide-y divide-[hsl(var(--border))]">
          <ReviewRow label="AGM Notice" value={s.noticeFile || "Not uploaded"} />
          <ReviewRow label="Resolutions" value={`${s.resolutions.filter(r => r.title).length} resolution(s)`} />
          <ReviewRow label="Proxy Voting" value={s.proxyEnabled ? "Enabled" : "Disabled"} />
          <ReviewRow label="Shareholder List" value={s.shareholderTargeting === "all" ? "All registered" : "Custom upload"} />
        </div>
      </div>
    </div>
  );
}
