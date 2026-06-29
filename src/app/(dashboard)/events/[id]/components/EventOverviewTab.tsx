"use client";
import { useState } from "react";
import {
  FileText, Calendar, Clock, MapPin, Users, Users2, Radio, Monitor,
  ExternalLink, Star, Mic2, Package, Zap, Trophy, ListChecks, CalendarRange,
  Plus, Trash2, Loader2, Pencil, Check, X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { useClientEventAgenda, useAddAgendaItem, useDeleteAgendaItem, useUpdateAgendaItem } from "@/api/client-events";
import type { EventShim, LocalAgendaItem } from "./types";

const FORMAT_ICON = { virtual: Monitor, hybrid: Users2, "in-person": MapPin };

function sanitiseStreamUrl(raw: string): string {
  return raw
    .trim()
    .replace(/^https?;\/\//i, (m) => m.replace(";", ":"))
    .replace(/^https?;\/([^/])/i, (_, c) => `https://${c}`)
    .replace(/^https?:[^/]/i, (m) => m.slice(0, m.length - 1) + "://");
}

interface Props {
  event:                   EventShim;
  fill:                    number | null;
  eventDocs:               any[];
  agendaItems:             LocalAgendaItem[];
  isAGM:                   boolean;
  onNavigate:              (tab: string) => void;
  stakeholderName?:        string;
  stakeholderLogoUrl?:     string;
  expectedAttendeesCount?: number;
  /** When true, all agenda write actions (add, edit, delete) are hidden */
  isSuperAdmin?:           boolean;
}

export function EventOverviewTab({
  event, fill, eventDocs, agendaItems, isAGM, onNavigate,
  stakeholderName, stakeholderLogoUrl, expectedAttendeesCount = 0,
  isSuperAdmin = false,
}: Props) {
  const FormatIcon    = FORMAT_ICON[event.format] ?? Monitor;
  const isLAUNCH      = event.module === "LAUNCH";
  const isHACKATHON   = event.module === "HACKATHON";
  const attendeeLabel = isAGM ? "Expected Attendees" : "RSVPs";
  const attendeeValue = isAGM ? expectedAttendeesCount.toLocaleString() : event.rsvpCount.toLocaleString();

  // Fetch live agenda from dedicated endpoint
  const { data: liveAgenda = [] } = useClientEventAgenda(event.id);
  const addMutation    = useAddAgendaItem();
  const updateMutation = useUpdateAgendaItem();
  const deleteMutation = useDeleteAgendaItem();

  // Add-form state
  const [showForm, setShowForm]     = useState(false);
  const [newTime,    setNewTime]    = useState("");
  const [newTitle,   setNewTitle]   = useState("");
  const [newSpeaker, setNewSpeaker] = useState("");

  // Edit state — tracks which item is being edited
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editTime,   setEditTime]   = useState("");
  const [editTitle,  setEditTitle]  = useState("");
  const [editSpeaker,setEditSpeaker]= useState("");

  function startEdit(item: LocalAgendaItem) {
    setEditingId(item.id ?? null);
    setEditTime(item.time ?? "");
    setEditTitle(item.title ?? "");
    setEditSpeaker(item.speaker ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTime(""); setEditTitle(""); setEditSpeaker("");
  }

  function saveEdit(itemId: string) {
    if (!editTitle.trim()) return;
    updateMutation.mutate(
      { eventId: event.id, itemId, data: { time: editTime.trim(), title: editTitle.trim(), speaker: editSpeaker.trim() || undefined } },
      { onSuccess: cancelEdit }
    );
  }

  function handleAddItem() {
    if (!newTitle.trim()) return;
    addMutation.mutate(
      { eventId: event.id, item: { time: newTime.trim(), title: newTitle.trim(), speaker: newSpeaker.trim() || undefined } },
      {
        onSuccess: () => {
          setNewTime(""); setNewTitle(""); setNewSpeaker(""); setShowForm(false);
        },
      }
    );
  }

  // Typed config accessors
  const productLaunchConfig       = (event as any).productLaunchConfig      as Record<string, any> | undefined;
  const innovationChallengeConfig = (event as any).innovationChallengeConfig as Record<string, any> | undefined;
  const agmConfig                 = (event as any).agmConfig                as Record<string, any> | undefined;
  const featured                  = (event as any).featured                 as boolean | undefined;
  const endDate                   = (event as any).endDate                  as string | undefined;

  // Prefer dedicated /agenda endpoint; fall back to event.agenda then local state
  const allAgendaItems: LocalAgendaItem[] =
    liveAgenda.length
      ? (liveAgenda as LocalAgendaItem[])
      : event.agenda?.length
        ? event.agenda
        : agendaItems;

  return (
    <div className="grid grid-cols-3 gap-5">
      {/* ── Left column ── */}
      <div className="col-span-2 flex flex-col gap-5">

        {/* Attendees / Capacity / Fill rate strip */}
        <div className="grid grid-cols-3 divide-x divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
          {[
            { label: attendeeLabel, value: attendeeValue, icon: Users,  color: "#111827" },
            { label: "Capacity",    value: event.capacity ? event.capacity.toLocaleString() : "Unlimited", icon: Users2, color: "#1a6b3c" },
            { label: "Fill Rate",   value: fill !== null ? `${fill}%` : "—", icon: Radio, color: fill !== null && fill >= 80 ? "#dc2626" : "#f97316" },
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

        {/* Event details */}
        <Card className="attend-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[hsl(var(--foreground))]">Event Details</h2>
            {featured && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-[hsl(var(--foreground)/0.07)] text-[hsl(var(--foreground))] border border-[hsl(var(--foreground)/0.12)]">
                <Star className="h-3 w-3 fill-current" /> Featured
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Calendar,   label: "Date",   value: endDate ? `${formatDate(event.date)} → ${formatDate(endDate)}` : formatDate(event.date) },
              { icon: Clock,      label: "Time",   value: `${event.startTime}${event.endTime ? ` – ${event.endTime}` : ""}` || "TBC" },
              { icon: FormatIcon, label: "Format", value: event.format.charAt(0).toUpperCase() + event.format.slice(1).replace("-", " ") },
              { icon: MapPin,     label: "Venue",  value: event.venue || "Virtual (no physical venue)" },
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

        {/* Description */}
        {event.description && (
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-2">Description</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed whitespace-pre-wrap">{event.description}</p>
          </Card>
        )}

        {/* Registration fill bar */}
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
              <span>{attendeeValue} {isAGM ? "expected" : "registered"}</span>
              <span>{event.capacity?.toLocaleString()} capacity</span>
            </div>
          </Card>
        )}

        {/* Product Launch config */}
        {isLAUNCH && productLaunchConfig && (
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4 flex items-center gap-2">
              <Package className="h-4 w-4 text-[hsl(var(--foreground))]" /> Product Launch Details
            </h2>
            <div className="flex flex-col divide-y divide-[hsl(var(--border))]">
              {productLaunchConfig.productName && (
                <div className="py-2.5 flex items-start gap-3">
                  <p className="text-xs text-[hsl(var(--muted-foreground))] w-36 shrink-0 pt-0.5">Product Name</p>
                  <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{productLaunchConfig.productName}</p>
                </div>
              )}
              {productLaunchConfig.tagline && (
                <div className="py-2.5 flex items-start gap-3">
                  <p className="text-xs text-[hsl(var(--muted-foreground))] w-36 shrink-0 pt-0.5">Tagline</p>
                  <p className="text-sm italic text-[hsl(var(--foreground))]">{productLaunchConfig.tagline}</p>
                </div>
              )}
              {productLaunchConfig.pressKitUrl && (
                <div className="py-2.5 flex items-start gap-3">
                  <p className="text-xs text-[hsl(var(--muted-foreground))] w-36 shrink-0 pt-0.5">Press Kit</p>
                  <a href={productLaunchConfig.pressKitUrl} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-[hsl(var(--primary))] hover:underline flex items-center gap-1 truncate">
                    Open press kit <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
              )}
              {productLaunchConfig.demoUrl && (
                <div className="py-2.5 flex items-start gap-3">
                  <p className="text-xs text-[hsl(var(--muted-foreground))] w-36 shrink-0 pt-0.5">Demo URL</p>
                  <a href={productLaunchConfig.demoUrl} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-[hsl(var(--primary))] hover:underline flex items-center gap-1 truncate">
                    Open demo <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Innovation Challenge config */}
        {isHACKATHON && innovationChallengeConfig && (
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#7c22c9]" /> Challenge Details
            </h2>
            <div className="flex flex-col gap-4">
              {/* Tracks */}
              {(innovationChallengeConfig.tracks as string[] | undefined)?.length ? (
                <div>
                  <p className="attend-section-title mb-2">Tracks</p>
                  <div className="flex flex-wrap gap-2">
                    {(innovationChallengeConfig.tracks as string[]).map((t: string) => (
                      <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-[#faf5ff] text-[#7c22c9] border border-[#e9d5ff] font-medium">{t}</span>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Participation */}
              {innovationChallengeConfig.participationType && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-[hsl(var(--muted)/0.4)]">
                    <p className="attend-section-title">Participation</p>
                    <p className="text-sm font-semibold text-[hsl(var(--foreground))] mt-1">
                      {innovationChallengeConfig.participationType === "SOLO_AND_TEAM" ? "Solo & Team"
                       : innovationChallengeConfig.participationType === "SOLO" ? "Solo only" : "Team only"}
                    </p>
                  </div>
                  {innovationChallengeConfig.minTeamSize && (
                    <div className="p-3 rounded-xl bg-[hsl(var(--muted)/0.4)]">
                      <p className="attend-section-title">Min Team</p>
                      <p className="text-sm font-semibold text-[hsl(var(--foreground))] mt-1">{innovationChallengeConfig.minTeamSize}</p>
                    </div>
                  )}
                  {innovationChallengeConfig.maxTeamSize && (
                    <div className="p-3 rounded-xl bg-[hsl(var(--muted)/0.4)]">
                      <p className="attend-section-title">Max Team</p>
                      <p className="text-sm font-semibold text-[hsl(var(--foreground))] mt-1">{innovationChallengeConfig.maxTeamSize}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Problem Statement */}
              {innovationChallengeConfig.problemStatement && (
                <div>
                  <p className="attend-section-title mb-1">Problem Statement</p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed whitespace-pre-wrap">
                    {innovationChallengeConfig.problemStatement}
                  </p>
                </div>
              )}

              {/* Prizes */}
              {(innovationChallengeConfig.prizeTiers as any[] | undefined)?.length ? (
                <div>
                  <p className="attend-section-title mb-2 flex items-center gap-1.5"><Trophy className="h-3.5 w-3.5 text-amber-500" /> Prizes</p>
                  <div className="flex flex-col divide-y divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] overflow-hidden">
                    {(innovationChallengeConfig.prizeTiers as { position: string; reward: string }[]).map((p) => (
                      <div key={p.position} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="text-xs font-bold text-[hsl(var(--muted-foreground))] w-20 shrink-0">{p.position}</span>
                        <span className="text-sm font-semibold text-[hsl(var(--foreground))]">{p.reward}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Judging criteria */}
              {(innovationChallengeConfig.judgingCriteria as any[] | undefined)?.length ? (
                <div>
                  <p className="attend-section-title mb-2 flex items-center gap-1.5"><ListChecks className="h-3.5 w-3.5 text-[#7c22c9]" /> Judging Criteria</p>
                  <div className="flex flex-col gap-1.5">
                    {(innovationChallengeConfig.judgingCriteria as { criterion?: string; name?: string; weight: number }[]).map((c, i) => {
                      const label = c.criterion ?? c.name ?? `Criterion ${i + 1}`;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <div className="flex-1 h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                            <div className="h-full rounded-full bg-[#7c22c9]" style={{ width: `${c.weight}%` }} />
                          </div>
                          <span className="text-xs text-[hsl(var(--muted-foreground))] w-24 shrink-0 text-right">{label} ({c.weight}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        )}

        {/* Agenda — hidden for super admin on AGM */}
        {!(isSuperAdmin && isAGM) && <Card className="attend-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[hsl(var(--foreground))]">
              Agenda
              {allAgendaItems.length > 0 && (
                <span className="ml-2 text-xs font-normal text-[hsl(var(--muted-foreground))]">
                  {allAgendaItems.length} item{allAgendaItems.length !== 1 ? "s" : ""}
                </span>
              )}
            </h2>
            {!isSuperAdmin && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                onClick={() => setShowForm((v) => !v)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add item
              </Button>
            )}
          </div>

          {/* Add form — hidden for super_admin */}
          {!isSuperAdmin && showForm && (
            <div className="mb-4 p-4 rounded-xl bg-[hsl(var(--muted)/0.4)] border border-[hsl(var(--border))] flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">Time <span className="text-[hsl(var(--muted-foreground))]">(optional)</span></label>
                  <Input
                    placeholder="e.g. 10:00 AM"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">Speaker <span className="text-[hsl(var(--muted-foreground))]">(optional)</span></label>
                  <Input
                    placeholder="Speaker name"
                    value={newSpeaker}
                    onChange={(e) => setNewSpeaker(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">Title <span className="text-red-500">*</span></label>
                <Input
                  placeholder="Agenda item title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="h-8 text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddItem(); }}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={!newTitle.trim() || addMutation.isPending}
                  onClick={handleAddItem}
                  className="h-8"
                >
                  {addMutation.isPending ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Saving…</>
                  ) : "Save item"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-[hsl(var(--muted-foreground))]"
                  onClick={() => { setShowForm(false); setNewTime(""); setNewTitle(""); setNewSpeaker(""); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Items list */}
          {allAgendaItems.length === 0 && !showForm ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No agenda items yet. Click "Add item" to get started.</p>
          ) : (
            <div className="flex flex-col divide-y divide-[hsl(var(--border))]">
              {allAgendaItems.map((item, idx) => {
                const isEditing = !isSuperAdmin && editingId === item.id;
                if (isEditing) {
                  return (
                    <div key={item.id ?? idx} className="py-3 flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Time (e.g. 10:00 AM)"
                          value={editTime}
                          onChange={(e) => setEditTime(e.target.value)}
                          className="h-8 text-xs"
                        />
                        <Input
                          placeholder="Speaker (optional)"
                          value={editSpeaker}
                          onChange={(e) => setEditSpeaker(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <Input
                        placeholder="Title *"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(item.id!); if (e.key === "Escape") cancelEdit(); }}
                        className="h-8 text-xs"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          disabled={!editTitle.trim() || updateMutation.isPending}
                          onClick={() => saveEdit(item.id!)}
                        >
                          {updateMutation.isPending ? (
                            <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Saving…</>
                          ) : (
                            <><Check className="h-3 w-3 mr-1" /> Save</>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-[hsl(var(--muted-foreground))]"
                          onClick={cancelEdit}
                        >
                          <X className="h-3 w-3 mr-1" /> Cancel
                        </Button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={item.id ?? idx} className="flex items-start gap-3 py-3 group">
                    {item.time && (
                      <span className="text-xs font-mono font-semibold text-[hsl(var(--primary))] w-16 shrink-0 pt-0.5">
                        {item.time}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[hsl(var(--foreground))]">{item.title}</p>
                      {item.speaker && (
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 flex items-center gap-1">
                          <Mic2 className="h-3 w-3 shrink-0" /> {item.speaker}
                        </p>
                      )}
                    </div>
                    {item.id && !isSuperAdmin && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => startEdit(item)}
                          className="h-6 w-6 rounded-md flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.08)] transition-all"
                          title="Edit item"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate({ eventId: event.id, itemId: item.id! })}
                          disabled={deleteMutation.isPending}
                          className="h-6 w-6 rounded-md flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-red-500 hover:bg-red-50 transition-all"
                          title="Remove item"
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>}
      </div>

      {/* ── Right column ── */}
      <div className="flex flex-col gap-4">

        {/* Organiser card */}
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

        {/* Registrar card */}
        {stakeholderName && (
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3">Registrar</h2>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[hsl(var(--muted))] flex items-center justify-center font-bold text-sm shrink-0 text-[hsl(var(--muted-foreground))] overflow-hidden border border-[hsl(var(--border))]">
                {stakeholderLogoUrl
                  ? <img src={stakeholderLogoUrl} alt={stakeholderName} className="h-full w-full object-cover" />
                  : stakeholderName.split(" ").map((n: string) => n[0]).join("").slice(0, 2)
                }
              </div>
              <div>
                <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{stakeholderName}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Managing registrar</p>
              </div>
            </div>
          </Card>
        )}

        {/* Speakers (PRODUCT_LAUNCH) */}
        {isLAUNCH && event.speakers && event.speakers.length > 0 && (
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3 flex items-center gap-2">
              <Mic2 className="h-4 w-4 text-[hsl(var(--foreground))]" /> Speakers
            </h2>
            <div className="flex flex-col gap-3">
              {event.speakers.map((sp: any, i: number) => (
                <div key={sp.id ?? i} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-[hsl(var(--foreground)/0.08)] flex items-center justify-center text-[hsl(var(--foreground))] font-bold text-xs shrink-0 border border-[hsl(var(--border))]">
                    {(sp.name ?? "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{sp.name}</p>
                    {(sp.roleTitle ?? sp.role) && <p className="text-xs text-[hsl(var(--muted-foreground))]">{sp.roleTitle ?? sp.role}</p>}
                    {sp.bio && <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-2">{sp.bio}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Live Stream — hidden for super admin on AGM */}
        {!(isSuperAdmin && isAGM) && event.streamUrl && (event.format === "virtual" || event.format === "hybrid") && (() => {
          const url = sanitiseStreamUrl(event.streamUrl!);
          return (
            <div className="bg-[hsl(var(--primary)/0.04)] border border-[hsl(var(--primary)/0.1)] rounded-xl p-3">
              <div className="flex items-start gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-[hsl(var(--primary)/0.1)] flex items-center justify-center shrink-0 mt-0.5">
                  <Monitor className="h-4 w-4 text-[hsl(var(--primary))]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-bold text-[hsl(var(--muted-foreground))] tracking-wider uppercase">Live Stream</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse inline-block shrink-0" />
                  </div>
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    className="group flex items-center gap-1 text-[hsl(var(--primary))] hover:underline font-semibold text-sm truncate max-w-full" title={url}>
                    <span className="truncate">{url}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </a>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Documents mini-list — hidden for super admin on AGM */}
        {!(isSuperAdmin && isAGM) && <Card className="attend-card p-5">
          <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3">Documents</h2>
          {eventDocs.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">No documents uploaded yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {eventDocs.map((d) => (
                <div key={d.id} className="flex items-center gap-2 text-sm">
                  <FileText className="h-3.5 w-3.5 text-[hsl(var(--primary))] shrink-0" />
                  <span className="truncate text-[hsl(var(--foreground))]">{d.title}</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => onNavigate("Documents")} className="mt-3 text-xs text-[hsl(var(--primary))] hover:underline">
            View all →
          </button>
        </Card>}

        {/* Event timestamps */}
        {(event.createdAt || event.updatedAt) && (
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3 flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-[hsl(var(--muted-foreground))]" /> Timestamps
            </h2>
            <div className="flex flex-col gap-1.5">
              {event.createdAt && (
                <div className="flex items-start justify-between">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">Created</span>
                  <span className="text-xs font-medium text-[hsl(var(--foreground))]">{new Date(event.createdAt).toLocaleDateString()}</span>
                </div>
              )}
              {event.updatedAt && (
                <div className="flex items-start justify-between">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">Last updated</span>
                  <span className="text-xs font-medium text-[hsl(var(--foreground))]">{new Date(event.updatedAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
