"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEventDetail, useEventDocuments, useEventAttendees } from "@/api/super-admin";
import { ModuleBadge } from "@/components/custom/module-badge";
import { CustomSelect } from "@/components/custom/custom-select";
import { StatusBadge } from "@/components/custom/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/Loader";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft, Radio, Calendar, Clock, MapPin, Users,
  Monitor, Users2, FileText, Vote, Megaphone, Send, Bell,
  Award, BookOpen, CheckCircle2, Download, PlusCircle, Trash2, Upload,
} from "lucide-react";
import type { EventModule } from "@/types/mock";
import type { AgendaItemResponse } from "@/types/super-admin";

// Local editable agenda item — superset of API shape used by the edit form
interface LocalAgendaItem {
  id: string;
  order?: number;
  title: string;
  description?: string;
  durationMinutes?: number;
  speakerName?: string;
  isCurrent?: boolean;
  // Legacy edit-form fields kept for UI compat
  time?: string;
  speaker?: string;
}

// Map API eventType → legacy module key used throughout the UI
function toModule(eventType?: string): string {
  if (!eventType) return "GENERAL";
  if (eventType === "AGM_EGM") return "AGM";
  if (eventType === "PRODUCT_LAUNCH") return "LAUNCH";
  if (eventType === "INNOVATION_CHALLENGE" || eventType === "HACKATHON") return "HACKATHON";
  return "GENERAL";
}

// Map API uppercase format → legacy lowercase used for icon lookup
function toFormatKey(fmt: string): "virtual" | "hybrid" | "in-person" {
  if (fmt === "VIRTUAL") return "virtual";
  if (fmt === "HYBRID") return "hybrid";
  return "in-person";
}

function VoteBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[hsl(var(--muted-foreground))] w-16 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-semibold tabular-nums w-10 text-right">{pct}%</span>
      <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums w-20 text-right">{value.toLocaleString()}</span>
    </div>
  );
}

function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <label className={`block text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide ${className}`}>{children}</label>;
}

const FORMAT_ICON = { virtual: Monitor, hybrid: Users2, "in-person": MapPin };

let _uid = 0;
const uid = () => `ag_${++_uid}`;

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  // ── API data sources ──────────────────────────────────────────────────────
  const { data: apiEvent, isLoading: eventLoading } = useEventDetail(id);
  const { data: docsResponse }    = useEventDocuments(id);
  const { data: attendeesResponse } = useEventAttendees(id, 0, 50);

  const [tab, setTab] = useState("Overview");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastChannel, setBroadcastChannel] = useState<"push" | "sms" | "email" | "all">("push");
  const [broadcastHistory, setBroadcastHistory] = useState([
    { text: "The event will begin in 30 minutes. Please ensure you are connected.", channel: "Push + SMS", sentAt: "2h ago" },
  ]);
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const [agendaItems, setAgendaItems] = useState<LocalAgendaItem[]>([]);

  if (eventLoading) return <Loader variant="page" text="Loading Event…" />;

  if (!apiEvent) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-semibold text-[hsl(var(--foreground))]">Event not found</p>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">This event may have been removed.</p>
        <Button variant="outline" className="mt-4 gap-2" onClick={() => router.push("/events")}>
          <ArrowLeft className="h-4 w-4" /> Back to Events
        </Button>
      </div>
    );
  }

  // ── Compatibility shim: map API fields → legacy names used in the JSX ─────
  const event = {
    ...apiEvent,
    // field renames
    organiser:   apiEvent.stakeholderName,
    venue:       apiEvent.location ?? "",
    rsvpCount:   apiEvent.registrationCount,
    capacity:    apiEvent.maximumCapacity ?? null,
    endTime:     "",                                          // not in API
    format:      toFormatKey(apiEvent.format),               // lowercase for icon lookup
    module:      toModule(apiEvent.eventType),               // legacy module key
    color:       "#9333ea",                                   // fallback; no color in API
    agenda:      (apiEvent.agenda ?? agendaItems) as LocalAgendaItem[],
  };

  // Participants — guard against every possible API response shape
  const _attendeesRaw = attendeesResponse?.data;
  const participants: any[] =
    Array.isArray(_attendeesRaw)                  ? _attendeesRaw :
    Array.isArray(_attendeesRaw?.content)         ? _attendeesRaw.content :
    Array.isArray(_attendeesRaw?.participants)     ? _attendeesRaw.participants :
    Array.isArray(_attendeesRaw?.data)            ? _attendeesRaw.data :
    [];

  // Documents — same defensive unwrap
  const _docsRaw = docsResponse?.data;
  const eventDocs: any[] =
    Array.isArray(_docsRaw)               ? _docsRaw :
    Array.isArray(_docsRaw?.documents)    ? _docsRaw.documents :
    Array.isArray(_docsRaw?.content)      ? _docsRaw.content :
    [];
  const liveVotes: any[]   = [];                             // no live-votes API yet

  const FormatIcon = FORMAT_ICON[event.format as keyof typeof FORMAT_ICON];
  const fill = event.capacity ? Math.round((event.rsvpCount / event.capacity) * 100) : null;
  const isAGM     = event.module === "AGM";
  const isLAUNCH  = event.module === "LAUNCH";
  const isGENERAL = event.module === "GENERAL";
  const currentStatus = localStatus ?? event.status?.toLowerCase();

  function addAgendaItem() {
    setAgendaItems((a) => [...a, { id: uid(), time: "", title: "", speaker: "" }]);
  }
  function removeAgendaItem(id: string) {
    setAgendaItems((a) => a.filter((x) => x.id !== id));
  }
  function updateAgendaItem(id: string, field: keyof LocalAgendaItem, val: string) {
    setAgendaItems((a) => a.map((x) => (x.id === id ? { ...x, [field]: val } : x)));
  }
  function handleStatusChange(status: string) {
    setLocalStatus(status);
    toast.success(`Event status updated to "${status}"`);
  }

  const TABS = [
    "Overview",
    "Attendees",
    "Documents",
    ...(isAGM ? ["Resolutions"] : []),
    "Broadcast",
    ...(isAGM ? ["Vote Results", "Post-AGM"] : []),
    ...(isLAUNCH ? ["Audience Tiers"] : []),
    ...((isLAUNCH || isGENERAL) ? ["Waitlist"] : []),
    "Settings",
  ];

  return (
    <div>
      {/* Back + header */}
      <div className="mb-6">
        <button
          onClick={() => router.push("/events")}
          className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-4 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Events
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ModuleBadge module={event.module as EventModule} />
              <StatusBadge status={currentStatus} />
              {currentStatus === "live" && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 rounded-full px-2 py-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))] leading-tight">{event.title}</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{event.organiser}</p>
          </div>
          {currentStatus === "live" && (
            <Link href="/events/live">
              <Button className="gap-2 bg-red-600 hover:bg-red-700 text-white">
                <Radio className="h-4 w-4" />
                Control Room
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1 w-full mb-5 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all text-center whitespace-nowrap min-w-[80px] ${
              tab === t
                ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === "Overview" && (
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 flex flex-col gap-5">
            <div className="grid grid-cols-3 divide-x divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
              {[
                { label: "RSVPs", value: event.rsvpCount.toLocaleString(), icon: Users, color: "#111827" },
                { label: "Capacity", value: event.capacity ? event.capacity.toLocaleString() : "Unlimited", icon: Users2, color: "#1a6b3c" },
                { label: "Fill Rate", value: fill !== null ? `${fill}%` : "—", icon: Radio, color: fill !== null && fill >= 80 ? "#dc2626" : "#f97316" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="flex items-center gap-3 px-5 py-4">
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "15" }}>
                    <Icon className="h-4 w-4" style={{ color }} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">{label}</p>
                    <p className="text-xl font-bold tabular-nums text-[hsl(var(--foreground))]">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4">Event Details</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Calendar, label: "Date", value: formatDate(event.date) },
                  { icon: Clock, label: "Time", value: `${event.startTime} – ${event.endTime}` },
                  { icon: FormatIcon, label: "Format", value: event.format.charAt(0).toUpperCase() + event.format.slice(1) },
                  { icon: MapPin, label: "Venue", value: event.venue ?? "Virtual (no physical venue)" },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-[hsl(var(--muted)/0.4)]">
                    <div className="h-8 w-8 rounded-lg bg-[hsl(var(--primary)/0.1)] flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="h-4 w-4 text-[hsl(var(--primary))]" />
                    </div>
                    <div>
                      <p className="attend-section-title">{label}</p>
                      <p className="text-sm font-medium text-[hsl(var(--foreground))] mt-0.5">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {fill !== null && (
              <Card className="attend-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-[hsl(var(--foreground))]">Registration</h2>
                  <span className="text-sm font-semibold" style={{ color: event.color }}>{fill}% full</span>
                </div>
                <div className="h-3 w-full rounded-full bg-[hsl(var(--muted))]">
                  <div className="h-3 rounded-full transition-all" style={{ width: `${Math.min(fill, 100)}%`, backgroundColor: event.color }} />
                </div>
                <div className="flex justify-between mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                  <span>{event.rsvpCount.toLocaleString()} registered</span>
                  <span>{event.capacity?.toLocaleString()} capacity</span>
                </div>
              </Card>
            )}

            {/* Mini agenda preview (AGM only) */}
            {isAGM && agendaItems.length > 0 && (
              <Card className="attend-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-[hsl(var(--foreground))]">{isAGM ? "Resolutions" : "Agenda"}</h2>
                  <button onClick={() => setTab(isAGM ? "Resolutions" : "Agenda")} className="text-xs text-[hsl(var(--primary))] hover:underline">Edit →</button>
                </div>
                <div className="flex flex-col divide-y divide-[hsl(var(--border))]">
                  {agendaItems.slice(0, 4).map((item) => (
                    <div key={item.id} className="flex items-start gap-3 py-2.5">
                      <span className="text-xs font-mono font-semibold text-[hsl(var(--primary))] w-16 shrink-0 pt-0.5">{item.time}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{item.title}</p>
                        {item.speaker && <p className="text-xs text-[hsl(var(--muted-foreground))]">{item.speaker}</p>}
                      </div>
                    </div>
                  ))}
                  {agendaItems.length > 4 && (
                    <p className="text-xs text-[hsl(var(--muted-foreground))] pt-2.5">+{agendaItems.length - 4} more items</p>
                  )}
                </div>
              </Card>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3">Organiser</h2>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-[hsl(var(--primary))] font-bold text-sm shrink-0">
                  {event.organiser.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{event.organiser}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Event organiser</p>
                </div>
              </div>
            </Card>
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3">Documents</h2>
              {eventDocs.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">No documents uploaded for this event.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {eventDocs.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 text-sm">
                      <FileText className="h-3.5 w-3.5 text-[hsl(var(--primary))] shrink-0" />
                      <span className="truncate text-[hsl(var(--foreground))]">{d.title}</span>
                      <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">{d.fileSize}</span>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setTab("Documents")} className="mt-3 text-xs text-[hsl(var(--primary))] hover:underline">
                View all →
              </button>
            </Card>
          </div>
        </div>
      )}

      {/* ── Attendees ── */}
      {tab === "Attendees" && (
        <Card className="attend-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Registered Participants</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{participants.length} participants on platform</p>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => toast.success("Attendee list exported")}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left">Participant</th>
                <th className="px-5 py-3 text-left">Phone</th>
                <th className="px-5 py-3 text-left">KYC</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Registered</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
                <tr key={p.id} className="attend-table-row">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-[hsl(var(--primary))] text-xs font-bold shrink-0">
                        {p.fullName.split(" ").map((n: string ) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[hsl(var(--foreground))]">{p.fullName}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{p.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{p.phone}</td>
                  <td className="px-5 py-3"><StatusBadge status={p.kycStatus} /></td>
                  <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{formatDate(p.registeredAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── Documents ── */}
      {tab === "Documents" && (
        <div className="flex flex-col gap-4">
          <div className="border-2 border-dashed border-[hsl(var(--border))] rounded-2xl p-10 text-center">
            <Upload className="h-8 w-8 mx-auto text-[hsl(var(--muted-foreground))] mb-3" />
            <p className="text-sm font-medium text-[hsl(var(--foreground))]">Upload a document</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 mb-4">PDF, DOCX, PPTX up to 50 MB</p>
            <Button variant="outline" size="sm">Choose File</Button>
          </div>
          <Card className="attend-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="attend-table-header">
                  <th className="px-5 py-3 text-left">Title</th>
                  <th className="px-5 py-3 text-left">Type</th>
                  <th className="px-5 py-3 text-left">Size</th>
                  <th className="px-5 py-3 text-left">Downloads</th>
                  <th className="px-5 py-3 text-left">Uploaded</th>
                  <th className="px-5 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {eventDocs.map((d) => (
                  <tr key={d.id} className="attend-table-row">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[hsl(var(--primary))] shrink-0" />
                        <span className="text-sm font-medium text-[hsl(var(--foreground))]">{d.title}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] rounded-full px-2.5 py-0.5 capitalize font-medium">
                        {d.type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{d.fileSize}</td>
                    <td className="px-5 py-3 text-sm font-medium tabular-nums">{d.downloadCount.toLocaleString()}</td>
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{formatDate(d.uploadedAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" variant="ghost" className="gap-1" onClick={() => toast.success(`Downloading ${d.title}`)}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {eventDocs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">No documents have been uploaded for this event.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ── Resolutions (AGM only) ── */}
      {tab === "Resolutions" && (
        <Card className="attend-card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-[hsl(var(--foreground))]">{isAGM ? "Resolutions" : "Agenda Items"}</h2>
              {isAGM && <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Each resolution will be voted on individually during the meeting. Voting is initiated from the Live Control Room.</p>}
            </div>
            <Button size="sm" variant="outline" onClick={addAgendaItem} className="gap-1.5">
              <PlusCircle className="h-3.5 w-3.5" /> {isAGM ? "Add Resolution" : "Add Item"}
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            {agendaItems.map((item, idx) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
                {!isAGM && (
                  <div className="col-span-2">
                    <Label className="mb-1.5">Time</Label>
                    <Input
                      placeholder="10:00 AM"
                      value={item.time}
                      onChange={(e) => updateAgendaItem(item.id, "time", e.target.value)}
                    />
                  </div>
                )}
                {isAGM && (
                  <div className="col-span-2 flex items-center pb-1">
                    <span className="text-xs font-bold text-[hsl(var(--muted-foreground))]">RES. {idx + 1}</span>
                  </div>
                )}
                <div className={isAGM ? "col-span-9" : "col-span-5"}>
                  <Label className="mb-1.5">{isAGM ? "Resolution title" : "Title"}</Label>
                  <Input
                    placeholder={isAGM ? "e.g. Adoption of Financial Statements" : "Agenda item title"}
                    value={item.title}
                    onChange={(e) => updateAgendaItem(item.id, "title", e.target.value)}
                  />
                </div>
                {!isAGM && (
                  <div className="col-span-4">
                    <Label className="mb-1.5">Speaker (optional)</Label>
                    <Input
                      placeholder="Speaker name"
                      value={item.speaker ?? ""}
                      onChange={(e) => updateAgendaItem(item.id, "speaker", e.target.value)}
                    />
                  </div>
                )}
                <div className="col-span-1 flex justify-center pb-1">
                  <button
                    type="button"
                    onClick={() => removeAgendaItem(item.id)}
                    className="text-[hsl(var(--muted-foreground))] hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {agendaItems.length === 0 && (
              <p className="text-sm text-[hsl(var(--muted-foreground))] py-6 text-center">
                {isAGM ? "No resolutions yet. Add resolutions that shareholders will vote on." : "No agenda items yet. Click \"Add Item\" to start."}
              </p>
            )}
          </div>
          {agendaItems.length > 0 && (
            <div className="flex justify-end mt-4 pt-4 border-t border-[hsl(var(--border))]">
              <Button size="sm" onClick={() => toast.success(isAGM ? "Resolutions saved!" : "Agenda saved!")}>{isAGM ? "Save Resolutions" : "Save Agenda"}</Button>
            </div>
          )}
        </Card>
      )}

      {/* ── Broadcast ── */}
      {tab === "Broadcast" && (
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2">
            <Card className="attend-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                <h2 className="font-semibold text-[hsl(var(--foreground))]">Send Broadcast</h2>
                <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">{event.rsvpCount.toLocaleString()} recipients</span>
              </div>
              <div className="px-5 py-5 flex flex-col gap-4">
                <div>
                  <Label className="mb-2">Delivery Channel</Label>
                  <div className="flex gap-2 flex-wrap mt-2">
                    {([
                      { key: "push" as const, label: "Push", icon: Bell },
                      { key: "sms" as const, label: "SMS", icon: Send },
                      { key: "email" as const, label: "Email", icon: FileText },
                      { key: "all" as const, label: "All Channels", icon: Megaphone },
                    ]).map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        onClick={() => setBroadcastChannel(key)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                          broadcastChannel === key
                            ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]"
                            : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-transparent hover:border-[hsl(var(--border))]"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-2">Message</Label>
                  <textarea
                    value={broadcastMsg}
                    onChange={(e) => setBroadcastMsg(e.target.value)}
                    placeholder={`Write an update for ${event.rsvpCount.toLocaleString()} registered attendees…`}
                    rows={4}
                    className="mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] resize-none"
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{broadcastMsg.length} / 500</span>
                    {broadcastMsg.length > 500 && <span className="text-xs text-red-500 font-medium">Too long</span>}
                  </div>
                </div>
                <Button
                  className="self-start gap-2"
                  disabled={!broadcastMsg.trim() || broadcastMsg.length > 500}
                  onClick={() => {
                    setBroadcastHistory((prev) => [
                      { text: broadcastMsg.trim(), channel: broadcastChannel === "all" ? "Push + SMS + Email" : broadcastChannel.charAt(0).toUpperCase() + broadcastChannel.slice(1), sentAt: "just now" },
                      ...prev,
                    ]);
                    setBroadcastMsg("");
                    toast.success("Broadcast sent!");
                  }}
                >
                  <Send className="h-4 w-4" />
                  Send to {event.rsvpCount.toLocaleString()} attendees
                </Button>
              </div>
            </Card>
          </div>
          <div>
            <Card className="attend-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
                <h2 className="font-semibold text-[hsl(var(--foreground))]">Sent Broadcasts</h2>
              </div>
              {broadcastHistory.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">No broadcasts sent yet.</div>
              ) : (
                <div className="divide-y divide-[hsl(var(--border))]">
                  {broadcastHistory.map((item, i) => (
                    <div key={i} className="px-5 py-4">
                      <div className="flex items-center justify-between mb-1.5 gap-2">
                        <span className="text-xs font-semibold bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] rounded-full px-2 py-0.5">{item.channel}</span>
                        <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">{item.sentAt}</span>
                      </div>
                      <p className="text-sm text-[hsl(var(--foreground))] leading-relaxed">{item.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ── Vote Results (AGM only) ── */}
      {tab === "Vote Results" && isAGM && (
        <div className="flex flex-col gap-4">
          {liveVotes.length === 0 ? (
            <Card className="attend-card p-12 text-center">
              <Vote className="h-10 w-10 mx-auto mb-3 text-[hsl(var(--muted-foreground))] opacity-30" />
              <p className="text-[hsl(var(--muted-foreground))]">No vote results available yet.</p>
            </Card>
          ) : (
            liveVotes.map((v, i) => {
              const total = v.for + v.against + v.abstain;
              return (
                <Card key={v.resolutionId} className="attend-card p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="text-xs font-bold text-[hsl(var(--muted-foreground))] mb-1">RESOLUTION {i + 1}</div>
                      <div className="text-base font-semibold text-[hsl(var(--foreground))]">{v.title}</div>
                    </div>
                    <StatusBadge status={v.status} />
                  </div>
                  {total > 0 ? (
                    <div className="flex flex-col gap-2.5 bg-[hsl(var(--muted)/0.4)] rounded-xl p-4">
                      <VoteBar label="For" value={v.for} total={total} color="#16a34a" />
                      <VoteBar label="Against" value={v.against} total={total} color="#dc2626" />
                      <VoteBar label="Abstain" value={v.abstain} total={total} color="#9ca3af" />
                      <div className="mt-2 pt-2 border-t border-[hsl(var(--border))] text-xs text-[hsl(var(--muted-foreground))]">
                        Total votes: <span className="font-semibold text-[hsl(var(--foreground))]">{total.toLocaleString()}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-[hsl(var(--muted-foreground))] italic">Voting has not commenced for this resolution.</div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ── Post-AGM (AGM only) ── */}
      {tab === "Post-AGM" && isAGM && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-4 divide-x divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
            {[
              { label: "Resolutions Passed", value: `${liveVotes.filter((v) => v.for > v.against).length} / ${liveVotes.length}`, icon: Vote, color: "#1a6b3c" },
              { label: "Total Votes Cast", value: liveVotes.reduce((s, v) => s + v.for + v.against + v.abstain, 0).toLocaleString(), icon: CheckCircle2, color: "#111827" },
              { label: "Attendees Present", value: event.rsvpCount.toLocaleString(), icon: Users, color: "#7c22c9" },
              { label: "Minutes Status", value: "Draft", icon: BookOpen, color: "#d97706" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex items-center gap-3 px-5 py-4">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "15" }}>
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <div>
                  <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">{label}</p>
                  <p className="text-xl font-bold tabular-nums text-[hsl(var(--foreground))]">{value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[hsl(var(--muted-foreground))]" /> Draft Minutes
              </h2>
              <div className="flex gap-2">
                <button onClick={() => toast.success("Minutes saved as draft")} className="px-3 py-1.5 rounded-lg text-sm font-medium border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors">Save Draft</button>
                <button onClick={() => toast.success("Minutes finalised and sent to SEC filing queue")} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[hsl(var(--primary))] text-white hover:opacity-90 transition-opacity">Finalise & Distribute</button>
              </div>
            </div>
            <textarea
              rows={10}
              defaultValue={`MINUTES OF THE ANNUAL GENERAL MEETING\n\nHeld on ${new Date(event.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} at ${event.startTime}\n\nATTENDANCE: ${event.rsvpCount.toLocaleString()} shareholders present or represented.\n\nBUSINESS TRANSACTED\n1. ...\n`}
              className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { title: "Vote Audit Log", desc: "Timestamped record of every vote cast with voter ID", icon: Vote, action: "Export CSV" },
              { title: "Attendance Register", desc: "Verified attendees with KYC and share count", icon: Users, action: "Export CSV" },
              { title: "Statutory Return", desc: "SEC/CAC-compliant post-AGM filing document", icon: Award, action: "Generate PDF" },
            ].map(({ title, desc, icon: Icon, action }) => (
              <div key={title} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
                <div className="h-9 w-9 rounded-xl bg-[hsl(var(--primary)/0.1)] flex items-center justify-center mb-3">
                  <Icon className="h-4 w-4 text-[hsl(var(--primary))]" />
                </div>
                <div className="text-sm font-semibold text-[hsl(var(--foreground))] mb-1">{title}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))] mb-4">{desc}</div>
                <button onClick={() => toast.success(`${title} export started`)} className="flex items-center gap-1.5 w-full justify-center px-3 py-2 rounded-lg text-sm font-medium border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors">
                  <Download className="h-3.5 w-3.5" /> {action}
                </button>
              </div>
            ))}
          </div>

          <Card className="attend-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
                <Award className="h-4 w-4 text-[hsl(var(--muted-foreground))]" /> Attendance Certificates
              </h2>
              <Button size="sm" variant="outline" onClick={() => toast.success("Certificates sent to all verified attendees")}>
                Send All Certificates
              </Button>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-[hsl(var(--muted)/0.4)]">
              <CheckCircle2 className="h-5 w-5 text-[hsl(var(--primary))] shrink-0" />
              <div>
                <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                  {participants.filter((p) => p.kycStatus === "full").length} verified attendees eligible for certificates
                </p>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                  Certificates will be delivered to their document vault and email
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── Audience Tiers (LAUNCH only) ── */}
      {tab === "Audience Tiers" && isLAUNCH && (
        <div className="flex flex-col gap-5">
          <Card className="attend-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Audience Tiers</h2>
              <Button size="sm" variant="outline" onClick={() => toast.success("Invitation list exported")}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> Export
              </Button>
            </div>
            <div className="flex flex-col gap-3">
              {[
                { tier: "Press / Media", color: "#7c22c9", bg: "#f5f3ff", count: 42, desc: "Journalists, bloggers and media contacts", inviteOnly: true },
                { tier: "VIP Guests", color: "#d97706", bg: "#fffbeb", count: 120, desc: "Executives, partners and strategic stakeholders", inviteOnly: true },
                { tier: "Public", color: "#111827", bg: "#eff6ff", count: Math.max(0, event.rsvpCount - 162), desc: "Open registration attendees", inviteOnly: false },
              ].map(({ tier, color, bg, count, desc, inviteOnly }) => (
                <div key={tier} className="flex items-center gap-4 p-4 rounded-xl border border-[hsl(var(--border))]">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: bg }}>
                    <Users className="h-5 w-5" style={{ color }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[hsl(var(--foreground))]">{tier}</span>
                      {inviteOnly && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: bg, color }}>Invite-only</span>
                      )}
                    </div>
                    <div className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{desc}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold tabular-nums" style={{ color }}>{count.toLocaleString()}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">invited</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => toast.success(`Invitation sent to ${tier} list`)}>
                    Send Invite
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4">Add to Invite List</h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-1.5">Email Address</label>
                <Input placeholder="press@example.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-1.5">Tier</label>
                <CustomSelect
                  value="press"
                  onChange={() => {}}
                  options={[{ label: "Press / Media", value: "press" }, { label: "VIP Guests", value: "vip" }]}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => toast.success("Invitation sent!")}>Send Individual Invite</Button>
              <Button size="sm" variant="outline" onClick={() => toast.success("CSV uploaded — invitations queued")}>
                <Upload className="h-3.5 w-3.5 mr-1.5" /> Bulk Upload CSV
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Waitlist (LAUNCH + GENERAL) ── */}
      {tab === "Waitlist" && (isLAUNCH || isGENERAL) && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Waitlist Management</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">Manage registrants waiting for a spot to open up.</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => toast.success("Approved 10 waitlisted attendees")}>Approve Next 10</Button>
              <Button size="sm" onClick={() => toast.success("All eligible waitlist registrants notified")}>Notify All</Button>
            </div>
          </div>
          <Card className="attend-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="attend-table-header">
                  <th className="px-5 py-3 text-left">#</th>
                  <th className="px-5 py-3 text-left">Name</th>
                  <th className="px-5 py-3 text-left">Email</th>
                  <th className="px-5 py-3 text-left">Joined</th>
                  <th className="px-5 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { pos: 1, name: "Chisom Eze", email: "chisom.eze@gmail.com", joined: "2026-05-10" },
                  { pos: 2, name: "Babatunde Adeola", email: "b.adeola@corporate.ng", joined: "2026-05-11" },
                  { pos: 3, name: "Ngozi Obi", email: "ngozi.obi@meristem.com", joined: "2026-05-12" },
                  { pos: 4, name: "Emeka Nwosu", email: "e.nwosu@outlook.com", joined: "2026-05-13" },
                  { pos: 5, name: "Fatima Bello", email: "fatima.b@yahoo.com", joined: "2026-05-14" },
                ].map((row) => (
                  <tr key={row.pos} className="attend-table-row">
                    <td className="px-5 py-3 text-sm font-mono text-[hsl(var(--muted-foreground))]">#{row.pos}</td>
                    <td className="px-5 py-3 text-sm font-medium text-[hsl(var(--foreground))]">{row.name}</td>
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{row.email}</td>
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{formatDate(row.joined)}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1.5">
                        <Button size="sm" className="h-7 text-xs" onClick={() => toast.success(`${row.name} approved`)}>Approve</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500" onClick={() => toast.success(`${row.name} removed from waitlist`)}>Remove</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ── Settings ── */}
      {tab === "Settings" && (
        <div className="flex flex-col gap-5">
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4">Event Information</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-2">Event Title</label>
                <Input defaultValue={event.title} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-2">Organiser</label>
                <Input defaultValue={event.organiser} />
              </div>
              <Button size="sm" className="self-start" onClick={() => toast.success("Event details saved!")}>Save Changes</Button>
            </div>
          </Card>

          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4">Status Controls</h2>
            <div className="flex flex-col divide-y divide-[hsl(var(--border))]">
              {[
                { label: "Publish Event", desc: "Make event visible and open RSVPs", action: "Publish", status: "published", disabled: currentStatus === "published" || currentStatus === "live" || currentStatus === "ended" },
                { label: "Go Live", desc: "Start the live stream and event", action: "Go Live", status: "live", disabled: currentStatus === "live" || currentStatus === "ended" },
                { label: "End Event", desc: "Mark event as concluded", action: "End Event", status: "ended", disabled: currentStatus === "ended" || currentStatus === "draft" },
              ].map(({ label, desc, action, status, disabled }) => (
                <div key={label} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">{label}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{desc}</p>
                  </div>
                  <Button size="sm" variant={status === "live" ? "default" : "outline"} disabled={disabled} onClick={() => handleStatusChange(status)}>
                    {status === "live" && <Radio className="h-3.5 w-3.5 mr-1.5" />}
                    {action}
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="attend-card p-5" style={{ borderColor: "#fecaca" }}>
            <h2 className="font-semibold text-red-600 mb-4">Danger Zone</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[hsl(var(--foreground))]">Cancel Event</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">This will notify all registered attendees.</p>
              </div>
              <Button
                size="sm"
                variant="destructive"
                disabled={currentStatus === "cancelled" || currentStatus === "ended"}
                onClick={() => handleStatusChange("cancelled")}
              >
                Cancel Event
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
