"use client";
import {
  FileText, Calendar, Clock, MapPin, Users, Users2, Radio, Monitor,
  ExternalLink, Star, Mic2, Package, Zap, Trophy, ListChecks, CalendarRange,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
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
  expectedAttendeesCount?: number;
}

export function EventOverviewTab({
  event, fill, eventDocs, agendaItems, isAGM, onNavigate, stakeholderName, expectedAttendeesCount = 0,
}: Props) {
  const FormatIcon    = FORMAT_ICON[event.format] ?? Monitor;
  const isLAUNCH      = event.module === "LAUNCH";
  const isHACKATHON   = event.module === "HACKATHON";
  const attendeeLabel = isAGM ? "Expected Attendees" : "RSVPs";
  const attendeeValue = isAGM ? expectedAttendeesCount.toLocaleString() : event.rsvpCount.toLocaleString();

  // Typed config accessors — the discriminated union keeps these safe at runtime
  const productLaunchConfig      = (event as any).productLaunchConfig      as Record<string, any> | undefined;
  const innovationChallengeConfig = (event as any).innovationChallengeConfig as Record<string, any> | undefined;
  const agmConfig                = (event as any).agmConfig                as Record<string, any> | undefined;
  const featured                 = (event as any).featured                 as boolean | undefined;
  const endDate                  = (event as any).endDate                  as string | undefined;

  // Use API agenda items for AGM when available; fall back to local state
  const agmAgendaItems: LocalAgendaItem[] =
    event.agenda?.length ? event.agenda : agendaItems;

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

        {/* AGM agenda / Resolutions */}
        {isAGM && agmAgendaItems.length > 0 && (
          <Card className="attend-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Resolutions</h2>
              <button onClick={() => onNavigate("Resolutions")} className="text-xs text-[hsl(var(--primary))] hover:underline">Edit →</button>
            </div>
            <div className="flex flex-col divide-y divide-[hsl(var(--border))]">
              {agmAgendaItems.slice(0, 4).map((item) => (
                <div key={item.id} className="flex items-start gap-3 py-2.5">
                  {item.time && <span className="text-xs font-mono font-semibold text-[hsl(var(--primary))] w-16 shrink-0 pt-0.5">{item.time}</span>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{item.title}</p>
                    {item.speaker && <p className="text-xs text-[hsl(var(--muted-foreground))]">{item.speaker}</p>}
                  </div>
                </div>
              ))}
              {agmAgendaItems.length > 4 && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] pt-2.5">+{agmAgendaItems.length - 4} more items</p>
              )}
            </div>
          </Card>
        )}
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
              <div className="h-10 w-10 rounded-xl bg-[hsl(var(--muted))] flex items-center justify-center font-bold text-sm shrink-0 text-[hsl(var(--muted-foreground))]">
                {stakeholderName.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
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

        {/* Live Stream */}
        {event.streamUrl && (event.format === "virtual" || event.format === "hybrid") && (() => {
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

        {/* Documents mini-list */}
        <Card className="attend-card p-5">
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
        </Card>

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
